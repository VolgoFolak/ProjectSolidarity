const helmet = require('helmet');
const compression = require('compression');

module.exports = (app) => {
  // Compresión GZIP
  app.use(compression());

  // Headers de seguridad
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://js.stripe.com", "https://cdn.jsdelivr.net", "https://www.googletagmanager.com", "https://translate.google.com"],
        imgSrc: ["'self'", "data:", "https:", "*.supabase.co"],
        connectSrc: ["'self'", "https:", "*.supabase.co", "https://api.stripe.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
        frameSrc: ["'self'", "https://js.stripe.com"],
        upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
      }
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  }));

  // Rate limiting más estricto para producción
  const rateLimit = require('express-rate-limit');
  
  const createRateLimit = (windowMs, max, message) => rateLimit({
    windowMs,
    max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({ 
        error: message,
        retryAfter: Math.round(windowMs / 1000)
      });
    }
  });

  // Rate limits específicos
  app.use('/api/', createRateLimit(1 * 60 * 1000, 100, 'Demasiadas peticiones API'));
  app.use('/login-supabase', createRateLimit(15 * 60 * 1000, 5, 'Demasiados intentos de login'));
  app.use('/register', createRateLimit(60 * 60 * 1000, 3, 'Demasiados registros'));
  app.use('/api/stripe/', createRateLimit(5 * 60 * 1000, 10, 'Demasiadas peticiones a Stripe'));
};