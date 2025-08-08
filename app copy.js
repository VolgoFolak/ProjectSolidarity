require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const nunjucks = require('nunjucks');
const { createClient } = require('@supabase/supabase-js');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Inicializar Express
const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// ✅ EXPORTAR SUPABASE PARA MIDDLEWARES
module.exports = { supabase, stripe };

// Middlewares básicos
app.use(express.json());
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));

// Configuración de entorno
const isLocalhost = process.env.NODE_ENV !== 'production';
const frontendUrl = isLocalhost ? 'http://localhost:3000' : 'https://www.project-solidarity.com';

if (!isLocalhost) {
  app.set('trust proxy', 1);
}

// ✅ CONFIGURACIÓN CORS MEJORADA
const allowedOrigins = [
  'https://project-solidarity.com',
  'https://www.project-solidarity.com',
  'http://localhost:3000'
];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  exposedHeaders: ['set-cookie'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token']
}));

// ✅ CONFIGURACIÓN DE SESIÓN ROBUSTA
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
    domain: process.env.NODE_ENV === 'production' ? '.project-solidarity.com' : undefined,
    path: '/',
  },
  store: new pgSession({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
    ttl: 7 * 24 * 60 * 60, // 7 días en segundos
    pruneSessionInterval: 60 * 60 // Limpiar cada hora
  }),
  rolling: true, // Renovar automáticamente
  name: 'solidarity.sid'
}));

// Middleware para servir archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Configuración de Multer
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({ storage });

// Configuración de Nunjucks
nunjucks.configure('views', {
  autoescape: true,
  express: app
});
app.set('view engine', 'njk');

// ✅ MIDDLEWARE DE IDIOMA
const detectLanguage = require('./middleware/detectlanguage');
app.use(detectLanguage);

// ✅ MIDDLEWARE DE AUTENTICACIÓN MEJORADO
const authenticateUser = require('./middleware/authenticateUser');

// ✅ MIDDLEWARE PARA AGREGAR DATOS DE SESIÓN A TODAS LAS VISTAS
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.lang = req.lang || 'es';
  res.locals.csrfToken = req.session.csrfToken || '';
  next();
});

// --- RUTAS DE AUTENTICACIÓN Y SESIÓN ---

// ✅ ENDPOINT /me COMPLETO
app.get('/me', (req, res) => {
  if (req.session.user) {
    res.json({
      logged: true,
      authenticated: true,
      user: {
        id: req.session.user.id,
        name: req.session.user.name,
        username: req.session.user.username,
        email: req.session.user.email,
        photo_url: req.session.user.photo_url || '',
        type: req.session.user.type || 'user'
      },
      session: {
        id: req.sessionID,
        lastActivity: req.session.lastActivity || new Date(),
        firstLogin: req.session.firstLogin || false,
        stripeStatus: req.session.stripeStatus || null
      },
      preferences: {
        language: req.lang || 'es',
        theme: req.session.theme || 'light'
      }
    });
  } else {
    res.status(401).json({ 
      logged: false,
      authenticated: false,
      error: 'No session found'
    });
  }
});

// ✅ KEEP-ALIVE ROBUSTO
app.post('/api/session/keep-alive', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ 
      ok: false, 
      reason: 'no_session',
      sessionId: req.sessionID 
    });
  }

  // Actualizar actividad
  req.session.lastActivity = new Date();
  req.session.save((err) => {
    if (err) {
      console.error('Error guardando sesión:', err);
      return res.status(500).json({ 
        ok: false, 
        reason: 'session_save_error' 
      });
    }

    // Verificar Stripe si está en rutas relacionadas
    if (req.body.currentPath?.includes('/causes')) {
      verifyStripeStatus(req.session.user.id)
        .then(status => {
          req.session.stripeStatus = status;
          res.json({ 
            ok: true, 
            stripeStatus: status,
            sessionId: req.sessionID,
            lastActivity: req.session.lastActivity
          });
        })
        .catch(error => {
          console.error('Error verificando Stripe:', error);
          res.json({ 
            ok: true,
            sessionId: req.sessionID,
            lastActivity: req.session.lastActivity
          });
        });
    } else {
      res.json({ 
        ok: true,
        sessionId: req.sessionID,
        lastActivity: req.session.lastActivity
      });
    }
  });
});

// ✅ VERIFICACIÓN DE SESIÓN
app.get('/api/session/check', (req, res) => {
  if (req.session.user) {
    res.json({
      authenticated: true,
      user: {
        id: req.session.user.id,
        name: req.session.user.name,
        email: req.session.user.email,
        username: req.session.user.username
      },
      sessionId: req.sessionID,
      stripeStatus: req.session.stripeStatus || null,
      lastActivity: req.session.lastActivity || new Date()
    });
  } else {
    res.status(401).json({ 
      authenticated: false,
      sessionId: req.sessionID 
    });
  }
});

// ✅ REGENERAR SESIÓN (para casos de error)
app.post('/api/session/regenerate', (req, res) => {
  const oldUser = req.session.user;
  
  req.session.regenerate((err) => {
    if (err) {
      return res.status(500).json({ error: 'Error regenerating session' });
    }
    
    // Restaurar datos de usuario si existían
    if (oldUser) {
      req.session.user = oldUser;
      req.session.lastActivity = new Date();
    }
    
    res.json({ 
      success: true, 
      sessionId: req.sessionID 
    });
  });
});

// Login mejorado (local y Supabase)
app.post('/login', (req, res) => {
  const { username, password, email } = req.body;
  const users = readUsers();
  let user = null;
  
  if (username && password) {
    user = users.find(u => u.username === username && u.password === password);
  } else if (email && password) {
    user = users.find(u => u.email === email && u.password === password);
  }
  
  if (user) {
    // Regenerar sesión por seguridad
    req.session.regenerate((err) => {
      if (err) {
        return res.status(500).json({ error: 'Session error' });
      }
      
      req.session.user = { 
        id: user.id || user.username,
        name: user.name, 
        photo_url: user.photo_url || '',
        username: user.username, 
        email: user.email,
        type: user.type || 'user'
      };
      req.session.lastActivity = new Date();
      req.session.firstLogin = true;
      
      req.session.save((err) => {
        if (err) {
          return res.status(500).json({ error: 'Session save error' });
        }
        res.json({ ok: true, user: req.session.user });
      });
    });
  } else {
    res.status(401).json({ ok: false, error: 'Credenciales incorrectas' });
  }
});

// ✅ LOGIN CON SUPABASE MEJORADO
app.post('/login-supabase', async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'No token provided' });

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Token inválido' });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, username, first_name, email, photo_url, user_type')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return res.status(401).json({ error: 'Perfil no encontrado' });
    }

    // Regenerar sesión de forma segura
    req.session.regenerate((err) => {
      if (err) {
        console.error('Error regenerating session:', err);
        return res.status(500).json({ error: 'Session regeneration failed' });
      }

      req.session.user = {
        id: profile.id,
        name: profile.first_name,
        photo_url: profile.photo_url || '',
        username: profile.username,
        email: profile.email,
        type: profile.user_type || 'user'
      };
      req.session.lastActivity = new Date();
      req.session.firstLogin = true;
      
      // Guardar sesión explícitamente
      req.session.save((saveErr) => {
        if (saveErr) {
          console.error('Error saving session:', saveErr);
          return res.status(500).json({ error: 'Session save failed' });
        }
        
        console.log('✅ Sesión Supabase creada para:', profile.username);
        res.json({ 
          ok: true, 
          user: req.session.user,
          sessionId: req.sessionID
        });
      });
    });
  } catch (error) {
    console.error('Error in Supabase login:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ✅ LOGOUT MEJORADO
app.post('/logout', (req, res) => {
  const sessionId = req.sessionID;
  
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
      return res.status(500).json({ error: 'Logout failed' });
    }
    
    res.clearCookie('solidarity.sid');
    res.clearCookie('connect.sid');
    
    console.log(`✅ Sesión ${sessionId} destruida correctamente`);
    res.json({ 
      success: true, 
      message: 'Logged out successfully' 
    });
  });
});

// ✅ FUNCIÓN AUXILIAR PARA VERIFICAR STRIPE
async function verifyStripeStatus(userId) {
  try {
    const { data: stripeAccount } = await supabase
      .from('stripe_accounts')
      .select('stripe_account_id, status, charges_enabled')
      .eq('user_id', userId)
      .single();

    if (!stripeAccount) return { connected: false };

    const account = await stripe.accounts.retrieve(stripeAccount.stripe_account_id);
    return {
      connected: account.charges_enabled,
      onboardingComplete: account.details_submitted,
      accountId: stripeAccount.stripe_account_id,
      status: account.charges_enabled ? 'active' : 'pending'
    };
  } catch (error) {
    console.error('Error verifying Stripe status:', error);
    return { connected: false };
  }
}

// ✅ STRIPE CALLBACK ÚNICO Y ROBUSTO
app.get('/stripe-callback', async (req, res) => {
  try {
    const { user_id, state } = req.query;
    console.log('🔄 Stripe callback iniciado para user_id:', user_id);

    if (!user_id) {
      console.error('❌ No user_id en callback');
      return res.redirect('/causes?stripe_error=missing_user_id');
    }

    // Si no hay sesión, crear/restaurar una
    if (!req.session.user) {
      console.log('🔄 Restaurando sesión para user_id:', user_id);
      
      const { data: user, error: userError } = await supabase
        .from('profiles')
        .select('id, username, email, photo_url, first_name, user_type')
        .eq('id', user_id)
        .single();

      if (userError || !user) {
        console.error('❌ Error obteniendo perfil:', userError);
        return res.redirect('/login?error=user_not_found');
      }

      // Regenerar sesión de forma segura
      req.session.regenerate((err) => {
        if (err) {
          console.error('❌ Error regenerando sesión:', err);
          return res.redirect('/login?error=session_error');
        }

        req.session.user = {
          id: user.id,
          name: user.first_name,
          photo_url: user.photo_url || '',
          username: user.username,
          email: user.email,
          type: user.user_type || 'user'
        };
        req.session.lastActivity = new Date();

        // Guardar sesión y continuar
        req.session.save((saveErr) => {
          if (saveErr) {
            console.error('❌ Error guardando sesión:', saveErr);
            return res.redirect('/login?error=session_save_error');
          }
          
          console.log('✅ Sesión restaurada para:', user.username);
          completeStripeProcess();
        });
      });
    } else {
      console.log('✅ Sesión existente encontrada');
      completeStripeProcess();
    }

    async function completeStripeProcess() {
      try {
        // Verificar y actualizar estado de Stripe
        const { data: stripeAccount } = await supabase
          .from('stripe_accounts')
          .select('stripe_account_id, charges_enabled')
          .eq('user_id', req.session.user.id)
          .single();

        if (!stripeAccount?.stripe_account_id) {
          console.error('❌ No se encontró cuenta Stripe');
          return res.redirect('/causes?stripe_error=no_account');
        }

        const account = await stripe.accounts.retrieve(stripeAccount.stripe_account_id);
        
        // Actualizar estado en BD
        const { error: updateError } = await supabase
          .from('stripe_accounts')
          .update({
            charges_enabled: account.charges_enabled,
            details_submitted: account.details_submitted,
            status: account.charges_enabled ? 'active' : 'pending',
            last_verified: new Date()
          })
          .eq('user_id', req.session.user.id);

        if (updateError) {
          console.error('❌ Error actualizando Stripe:', updateError);
        }

        // Guardar estado en sesión
        req.session.stripeStatus = {
          connected: account.charges_enabled,
          onboardingComplete: account.details_submitted,
          accountId: stripeAccount.stripe_account_id
        };

        req.session.save((saveErr) => {
          if (saveErr) {
            console.error('❌ Error guardando estado Stripe:', saveErr);
          }

          console.log('✅ Callback Stripe completado exitosamente');
          console.log('✅ Estado Stripe:', {
            charges_enabled: account.charges_enabled,
            details_submitted: account.details_submitted
          });

          // Limpiar cookies temporales
          res.clearCookie('stripe_return_url');
          
          // Redirigir con parámetros de éxito
          res.redirect(`/causes?stripe=success&user_id=${req.session.user.id}`);
        });

      } catch (error) {
        console.error('❌ Error en proceso Stripe:', error);
        res.redirect('/causes?stripe_error=processing_error');
      }
    }

  } catch (error) {
    console.error('❌ Error general en Stripe callback:', error);
    res.redirect('/causes?stripe_error=callback_failed');
  }
});

// ✅ RESTAURAR SESIÓN (para casos específicos)
app.post('/api/restore-session', async (req, res) => {
  const { user_id } = req.body;
  
  if (!user_id) {
    return res.status(400).json({ error: 'user_id required' });
  }

  try {
    const { data: user, error } = await supabase
      .from('profiles')
      .select('id, username, email, photo_url, first_name, user_type')
      .eq('id', user_id)
      .single();

    if (error || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    req.session.regenerate((err) => {
      if (err) {
        return res.status(500).json({ error: 'Session regeneration failed' });
      }

      req.session.user = {
        id: user.id,
        name: user.first_name,
        photo_url: user.photo_url || '',
        username: user.username,
        email: user.email,
        type: user.user_type || 'user'
      };
      req.session.lastActivity = new Date();

      req.session.save((saveErr) => {
        if (saveErr) {
          return res.status(500).json({ error: 'Session save failed' });
        }
        
        console.log('✅ Sesión restaurada para:', user.username);
        res.json({ 
          success: true, 
          user: req.session.user,
          sessionId: req.sessionID
        });
      });
    });
  } catch (error) {
    console.error('Error restoring session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ... [resto de rutas existentes] ...

// ✅ MANEJO DE ERRORES STRIPE
const stripeErrorHandler = require('./middleware/stripeErrorHandler');
app.use(stripeErrorHandler);

// ✅ MANEJO DE ERRORES GENERAL
app.use((err, req, res, next) => {
  console.error('❌ Error del servidor:', err.stack);
  
  if (process.env.NODE_ENV === 'production') {
    res.status(500).json({ 
      error: 'Error interno del servidor',
      timestamp: new Date().toISOString(),
      path: req.path,
      sessionId: req.sessionID
    });
  } else {
    res.status(500).json({ 
      error: 'Error interno del servidor',
      details: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString(),
      path: req.path,
      sessionId: req.sessionID
    });
  }
});

// ✅ 404 HANDLER
app.use((req, res) => {
  console.log('📝 404 - Página no encontrada:', req.path);
  res.status(404).render('404', { 
    lang: req.lang, 
    user: req.session.user,
    requestedPath: req.path
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor iniciado en http://localhost:${PORT}`);
});