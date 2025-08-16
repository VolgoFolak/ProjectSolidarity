require('dotenv').config();

// ✅ VERIFICACIÓN DE CONFIGURACIÓN CRÍTICA
console.log('🔧 Verificando configuración...');
const requiredEnvVars = [
  'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'STRIPE_SECRET_KEY', 
  'STRIPE_PUBLISHABLE_KEY', 'SESSION_SECRET', 'DOMAIN'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.error('❌ Variables de entorno faltantes:', missingVars);
  process.exit(1);
}

console.log('✅ Configuración verificada:');
console.log('- NODE_ENV:', process.env.NODE_ENV);
console.log('- DOMAIN:', process.env.DOMAIN);
console.log('- FRONTEND_URL:', process.env.FRONTEND_URL);
console.log('- COOKIE_DOMAIN:', process.env.COOKIE_DOMAIN);

// ✅ CONFIGURACIÓN DE PRODUCCIÓN
if (process.env.NODE_ENV === 'production') {
  const fs = require('fs');
  const path = require('path');
  
  const logsDir = path.join(__dirname, 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  const logFile = fs.createWriteStream(path.join(logsDir, 'app.log'), { flags: 'a' });
  console.log = (...args) => {
    const timestamp = new Date().toISOString();
    logFile.write(`[${timestamp}] ${args.join(' ')}\n`);
    // También mostrar en consola:
    process.stdout.write(`${args.join(' ')}\n`);
  };
}

// Importar middleware de seguridad
const configureSecurity = require('./middleware/security');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const nunjucks = require('nunjucks');
const { createClient } = require('@supabase/supabase-js');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const session = require('express-session');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const rateLimit = require('express-rate-limit');
const csrf = require('csurf');
const { body, validationResult } = require('express-validator');
const { ipKeyGenerator } = require('express-rate-limit');

// Inicializar Express
const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Exportar para middlewares
module.exports = { supabase, stripe };

// ✅ 1. MIDDLEWARES BÁSICOS PRIMERO
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// ✅ 2. CONFIGURACIÓN DE CONFIANZA DE PROXY (CORREGIDA)
const isLocalhost = true; // Fuerza modo desarrollo
const frontendUrl = 'http://localhost:3000';

app.set('trust proxy', 0); // No confiar en proxy en desarrollo

// ✅ 3. CONFIGURACIÓN CORS (solo localhost en desarrollo)
app.use(cors({
  origin: ['http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

// ✅ 4. CONFIGURACIÓN DE SESIÓN (desarrollo)
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret-change-in-development',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // No usar cookies seguras en desarrollo
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24,
    sameSite: 'lax', // 'lax' en desarrollo
    domain: undefined // Sin dominio en desarrollo
  }
}));

// ELIMINA O COMENTA TODO ESTO:
// const pgSession = require('connect-pg-simple')(session);
// app.use(session({
//   secret: process.env.SESSION_SECRET,
//   resave: false,
//   saveUninitialized: false,
//   store: new pgSession({
//     conString: process.env.DATABASE_URL,
//     tableName: 'session',
//     errorLog: function (err) {
//       console.error('❌ Error en el store de sesión:', err);
//     }
//   }),
//   cookie: {
//     secure: process.env.NODE_ENV === 'production',
//     httpOnly: true,
//     maxAge: 1000 * 60 * 60 * 24,
//     sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
//   }
// }));

// ✅ 5. MIDDLEWARE DE SINCRONIZACIÓN DE SESIÓN
app.use((req, res, next) => {
  res.set({
    'X-Session-ID': req.sessionID,
    'X-User-ID': req.session.user?.id || '',
    'X-Session-Status': req.session.user ? 'authenticated' : 'anonymous'
  });
  next();
});

// ✅ 6. DESACTIVA CSRF COMPLETAMENTE
// COMENTA O ELIMINA ESTAS LÍNEAS:
// const csrf = require('csurf');
// const csrfProtection = csrf({ 
//   cookie: {
//     httpOnly: true,
//     secure: process.env.NODE_ENV === 'production',
//     sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
//   }
// });

// Aplica CSRF solo en rutas que lo necesiten
// app.use('/form', csrfProtection); // solo para formularios

// Excluye rutas API y login
// app.use('/api/check-session', (req, res, next) => next());
// app.use('/login-supabase', (req, res, next) => next());

// ✅ 7. RATE LIMITING (DESPUÉS DE SESIÓN)
const createRateLimit = (windowMs, max, message) => rateLimit({
  windowMs,
  max,
  message: { error: message },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req) + ':' + (req.sessionID || ''),
  handler: (req, res) => {
    res.status(429).json({ 
      error: message,
      retryAfter: Math.round(windowMs / 1000)
    });
  }
});

app.use('/login-supabase', createRateLimit(15 * 60 * 1000, 5, 'Demasiados intentos de login'));
app.use('/register', createRateLimit(60 * 60 * 1000, 3, 'Demasiados registros'));
app.use('/api/', createRateLimit(1 * 60 * 1000, 100, 'Demasiadas peticiones API'));

// Middleware para servir archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// ✅ 9. CONFIGURACIÓN DE MULTER (VERIFICAR UPLOADS)
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log('📁 Created uploads directory:', uploadDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido'));
    }
  }
});

// ✅ 10. CONFIGURACIÓN DE NUNJUCKS
nunjucks.configure('views', {
  autoescape: true,
  express: app
});
app.set('view engine', 'njk');

// Middlewares personalizados
const detectLanguage = require('./middleware/detectlanguage');
app.use(detectLanguage);

const authenticateUser = require('./middleware/authenticateUser');

// ✅ 12. MIDDLEWARE PARA VISTAS (SIN CSRF TOKEN)
app.use((req, res, next) => {
  console.log(`📝 ${req.method} ${req.path} - Session ID: ${req.sessionID}`);
  console.log('🔍 Session User:', req.session.user ? req.session.user.username : 'No user');
  
  res.locals.user = req.session.user || null;
  res.locals.lang = req.lang || 'es';
  // ELIMINA ESTA LÍNEA:
  // res.locals.csrfToken = req.csrfToken();
  res.locals.env = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    NODE_ENV: process.env.NODE_ENV,
    DOMAIN: process.env.DOMAIN // ✅ Agregar esto
  };
  next();
});

// ✅ 13. MIDDLEWARE PARA DETECTAR CAMBIOS DE SESIÓN
app.use((req, res, next) => {
  const originalJson = res.json;
  res.json = function(data) {
    if (typeof data === 'object' && data !== null) {
      data._session = {
        id: req.sessionID,
        authenticated: !!req.session.user,
        userId: req.session.user?.id || null,
        timestamp: new Date().toISOString()
      };
    }
    return originalJson.call(this, data);
  };
  next();
});

// --- RUTAS DE AUTENTICACIÓN Y SESIÓN ---

// Endpoint /me completo
app.get('/me', (req, res) => {
  if (req.session && req.session.user) {
    const userData = {
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
    };
    res.json(userData);
  } else {
    res.status(401).json({ 
      logged: false,
      authenticated: false,
      error: 'No session found'
    });
  }
});

// Keep-alive robusto
app.post('/api/session/keep-alive', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ 
      ok: false, 
      reason: 'no_session',
      sessionId: req.sessionID 
    });
  }

  req.session.lastActivity = new Date();
  req.session.save((err) => {
    if (err) {
      return res.status(500).json({ 
        ok: false, 
        reason: 'session_save_error' 
      });
    }

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

// Heartbeat endpoint
app.get('/api/session/heartbeat', (req, res) => {
  if (req.session && req.session.user) {
    req.session.lastActivity = new Date();
    
    res.json({
      alive: true,
      sessionId: req.sessionID,
      userId: req.session.user.id,
      lastActivity: req.session.lastActivity,
      serverTime: new Date().toISOString()
    });
  } else {
    res.status(401).json({ 
      alive: false,
      reason: 'no_session',
      serverTime: new Date().toISOString()
    });
  }
});

// Verificación de sesión
app.get('/api/check-session', (req, res) => {
  console.log('🔍 Check session called:', req.session.user ? 'User found' : 'No user');
  if (req.session && req.session.user) {
    return res.json({
      authenticated: true,
      user: req.session.user
    });
  }
  res.json({ authenticated: false });
});

// Regenerar sesión
app.post('/api/session/regenerate', (req, res) => {
  const oldUser = req.session.user;
  
  req.session.regenerate((err) => {
    if (err) {
      return res.status(500).json({ error: 'Error regenerating session' });
    }
    
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

// ✅ LOGIN ROBUSTO Y DEFINITIVO
app.post('/login-supabase', async (req, res) => {
  try {
    console.log('🔐 Login attempt with token:', !!req.body.token);

    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token required' });

    // Verifica token con Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      console.log('❌ Token verification failed:', error);
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Consulta perfil en Supabase
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, username, email, photo_url, first_name, user_type')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return res.status(404).json({ error: 'Perfil no encontrado' });
    }

    // Guarda usuario en sesión con datos completos
    req.session.user = {
      id: profile.id,
      name: profile.first_name || user.user_metadata?.full_name || user.email.split('@')[0],
      username: profile.username,
      email: profile.email,
      photo_url: profile.photo_url || '',
      type: profile.user_type || 'user'
    };

    console.log('✅ User saved to session:', req.session.user.id);

    res.json({ ok: true, user: req.session.user });
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Logout mejorado
app.post('/logout', (req, res) => {
  const sessionId = req.sessionID;
  
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    
    res.clearCookie('solidarity.sid');
    res.clearCookie('connect.sid');
    
    res.json({ 
      success: true, 
      message: 'Logged out successfully' 
    });
  });
});

// Stripe callback robusto
app.get('/stripe-callback', async (req, res) => {
  try {
    const { user_id } = req.query;
    console.log('🔄 Stripe callback para usuario:', user_id);

    if (!user_id) {
      console.error('❌ No user_id en callback');
      return res.redirect('/causes?stripe_error=missing_user_id');
    }

    // Restaurar sesión si no existe
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

      req.session.regenerate((err) => {
        if (err) {
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

        req.session.save((saveErr) => {
          if (saveErr) {
            return res.redirect('/login?error=session_save_error');
          }
          processStripeCallback();
        });
      });
    } else {
      processStripeCallback();
    }

    async function processStripeCallback() {
      try {
        console.log('🔄 Procesando callback Stripe...');

        // Obtener cuenta Stripe del usuario
        const { data: stripeAccount, error: accountError } = await supabase
          .from('stripe_accounts')
          .select('stripe_account_id')
          .eq('user_id', user_id)
          .single();

        if (accountError || !stripeAccount?.stripe_account_id) {
          console.error('❌ No se encontró cuenta Stripe:', accountError);
          return res.redirect('/causes?stripe_error=no_account');
        }

        // Verificar estado en Stripe API
        const account = await stripe.accounts.retrieve(stripeAccount.stripe_account_id);
        console.log('📊 Estado de cuenta Stripe:', {
          charges_enabled: account.charges_enabled,
          details_submitted: account.details_submitted
        });

        // Actualizar estado en base de datos
        const { error: updateError } = await supabase
          .from('stripe_accounts')
          .update({
            charges_enabled: account.charges_enabled,
            details_submitted: account.details_submitted,
            status: account.charges_enabled ? 'active' : 'pending',
            last_verified: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user_id);

        if (updateError) {
          console.error('❌ Error actualizando estado:', updateError);
        } else {
          console.log('✅ Estado actualizado en base de datos');
        }

        // Guardar en sesión
        req.session.stripeStatus = {
          connected: account.charges_enabled,
          onboardingComplete: account.details_submitted,
          accountId: stripeAccount.stripe_account_id
        };

        req.session.save((saveErr) => {
          if (saveErr) {
            console.error('❌ Error guardando sesión:', saveErr);
          }

          // Redirigir con parámetros de éxito
          console.log('✅ Redirigiendo a página de éxito');
          res.redirect(`/causes?stripe=success&user_id=${user_id}&account_status=${account.charges_enabled ? 'active' : 'pending'}`);
        });

      } catch (error) {
        console.error('❌ Error procesando callback:', error);
        res.redirect('/causes?stripe_error=processing_error');
      }
    }

  } catch (error) {
    console.error('❌ Error en callback Stripe:', error);
    res.redirect('/causes?stripe_error=callback_failed');
  }
});

// Restaurar sesión
app.post('/api/restore-session', async (req, res) => {
  const { user_id } = req.body;
  
  if (!user_id) {
    return res.status(400).json({ error: 'user_id required' });
  }

  try {
    const { data: user, error } = await supabase
      .from('profiles')
      .select('id, username, email, photo_url, first_name')
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
        type: 'user'
      };
      req.session.lastActivity = new Date();

      req.session.save((saveErr) => {
        if (saveErr) {
          return res.status(500).json({ error: 'Session save failed' });
        }
        
        res.cookie('solidarity.sid', req.sessionID, {
          secure: process.env.NODE_ENV === 'production',
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
          httpOnly: true,
          maxAge: 7 * 24 * 60 * 60 * 1000,
          domain: process.env.NODE_ENV === 'production' ? '.project-solidarity.com' : undefined,
          path: '/',
        });
        
        res.json({ 
          success: true, 
          user: req.session.user,
          sessionId: req.sessionID
        });
      });
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- RUTAS DE USUARIO ---

// Subir foto de perfil
app.post('/upload-photo', upload.single('photo'), (req, res) => {
  if (!req.file) {
    return res.json({ ok: false, error: 'No se subió ninguna imagen.' });
  }
  const url = '/uploads/' + req.file.filename;
  res.json({ ok: true, url });
});

// Registro de usuario
const USERS_FILE = path.join(__dirname, 'users.json');

function readUsers() {
  if (!fs.existsSync(USERS_FILE)) return [];
  const data = fs.readFileSync(USERS_FILE, 'utf8');
  return data ? JSON.parse(data) : [];
}

function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

app.post('/register',
  body('username').isLength({ min: 3 }).trim().escape(),
  body('password').isLength({ min: 6 }),
  body('email').isEmail().normalizeEmail(),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ ok: false, errors: errors.array() });
    }

    const { username, password, name, email, photo_url } = req.body;
    if (!username || !password || !name || !email) {
      return res.status(400).json({ ok: false, error: 'Faltan campos obligatorios' });
    }
    const users = readUsers();
    if (users.find(u => u.username === username)) {
      return res.status(400).json({ ok: false, error: 'Usuario ya existe' });
    }
    const newUser = { username, password, name, email, photo_url: photo_url || '' };
    users.push(newUser);
    writeUsers(users);
    res.json({ ok: true });
  }
);

// Health check endpoint para monitoreo
app.get('/health', async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Verificar conexión a base de datos
    const { data, error } = await supabase
      .from('profiles')
      .select('count')
      .limit(1);
    
    const dbStatus = error ? 'error' : 'ok';
    
    // Verificar Stripe
    let stripeStatus = 'ok';
    try {
      await stripe.accounts.list({ limit: 1 });
    } catch (stripeError) {
      stripeStatus = 'error';
    }
    
    const responseTime = Date.now() - startTime;
    
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      responseTime: responseTime + 'ms',
      services: {
        database: dbStatus,
        stripe: stripeStatus,
        session: 'ok'
      },
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// --- RUTAS PRINCIPALES (VISTAS) ---
const renderView = (view, title = '') => (req, res) => {
  res.render(view, {
    title,
    lang: req.lang,
    user: req.session.user,
    env: {
      SUPABASE_URL: process.env.SUPABASE_URL,
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
      NODE_ENV: process.env.NODE_ENV,
      DOMAIN: process.env.DOMAIN // ✅ Agregar esto
    }
  });
};

app.get('/', renderView('index'));
app.get('/login', renderView('auth/login'));
app.get('/register', renderView('auth/register'));
app.get('/causes', renderView('causes/index'));
app.get('/causes/create', renderView('causes/create'));
app.get('/causes/:id', renderView('causes/index', 'Causa - Solidarity'));
app.get('/tasks', renderView('tasks/index'));
app.get('/tasks/create', renderView('tasks/create'));
app.get('/tasks/:id', renderView('tasks/index', 'Tarea - Solidarity'));
app.get('/tarea/:id', renderView('tasks/index', 'Tarea - Solidarity'));
app.get('/volunteering', renderView('volunteering/index'));
app.get('/volunteering/create', renderView('volunteering/create'));
app.get('/volunteering/:id', renderView('volunteering/index', 'Voluntariado - Solidarity'));
app.get('/voluntariado/:id', renderView('volunteering/index', 'Voluntariado - Solidarity'));
app.get('/challenges', renderView('challenges/index'));
app.get('/challenges/:id', renderView('challenges/index', 'Desafío - Solidarity'));
app.get('/reto/:id', renderView('challenges/index', 'Reto - Solidarity'));
app.get('/teams', renderView('teams/index'));
app.get('/teams/:id', renderView('teams/index', 'Equipo - Solidarity'));
app.get('/equipo/:id', renderView('teams/index', 'Equipo - Solidarity'));
app.get('/myteams', renderView('myteams/myteams'));
app.get('/takeaction', renderView('takeaction/index'));
app.get('/ranking', renderView('ranking/index'));
app.get('/profile', renderView('profile/index'));
app.get('/editprofile', renderView('profile/editprofile'));
app.get('/profile/myactivities', renderView('profile/myactivities'));
app.get('/maps', renderView('maps/index'));
app.get('/members', renderView('members/members'));
app.get('/messages', renderView('messages/index'));
app.get('/docs/privacy', renderView('docs/privacy'));
app.get('/docs/terms', renderView('docs/terms'));
app.get('/contact', renderView('contact'));
app.get('/docs/about', renderView('docs/about'));
app.get('/docs/help', renderView('docs/help'));

// --- API DE MENSAJES ---
app.get('/api/conversations', authenticateUser, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('conversations')
      .select(`
        id,
        created_at,
        last_message: messages!conversations_last_message_id_fkey (content, created_at),
        participants: conversation_participants!inner (
          profile: profiles!conversation_participants_profile_id_fkey (id, username, photo_url)
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/messages/:conversationId', authenticateUser, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('id, content, created_at, sender:profiles!messages_sender_id_fkey (id, username)')
      .eq('conversation_id', req.params.conversationId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/messages', authenticateUser, async (req, res) => {
  try {
    const { conversation_id, content } = req.body;
    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id,
        sender_id: req.session.user.id,
        content
      })
      .select('id')
      .single();

    if (error) throw error;

    await supabase
      .from('conversations')
      .update({ last_message_id: data.id })
      .eq('id', conversation_id);

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/conversations', authenticateUser, async (req, res) => {
  try {
    const { recipient_id, content } = req.body;
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .insert({})
      .select('id')
      .single();

    if (convError) throw convError;

    await supabase.from('conversation_participants').insert([
      { conversation_id: conversation.id, profile_id: req.session.user.id },
      { conversation_id: conversation.id, profile_id: recipient_id }
    ]);

    const { data: message, error: msgError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversation.id,
        sender_id: req.session.user.id,
        content
      })
      .select('id')
      .single();

    if (msgError) throw msgError;

    await supabase
      .from('conversations')
      .update({ last_message_id: message.id })
      .eq('id', conversation.id);

    res.json(conversation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/users', authenticateUser, async (req, res) => {
  try {
    const searchTerm = req.query.search || '';
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, photo_url')
      .ilike('username', `%${searchTerm}%`)
      .neq('id', req.session.user.id)
      .limit(5);

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- RUTAS DE STRIPE ---
app.post('/create-stripe-account', authenticateUser, async (req, res) => {
  try {
    const { userId, email } = req.body;
    const { data: existingAccount } = await supabase
      .from('stripe_accounts')
      .select()
      .eq('user_id', userId)
      .single();

    if (existingAccount) {
      return res.status(400).json({ error: 'El usuario ya tiene una cuenta Stripe' });
    }

    const account = await stripe.accounts.create({
      type: 'express',
      email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true }
      }
    });

    await supabase.from('stripe_accounts').insert({
      user_id: userId,
      stripe_account_id: account.id,
      status: 'pending'
    });

    res.json({ accountId: account.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/create-account-link', authenticateUser, async (req, res) => {
  try {
    const { accountId, userId } = req.body;
    
    // Verificar que el usuario pueda acceder a esta cuenta
    if (req.session.user.id !== userId) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    // CORREGIDO: Construir URLs completas
    const baseUrl = process.env.DOMAIN || 'http://localhost:3000';
    const refreshUrl = `${baseUrl}/causes?stripe_error=refresh&user_id=${userId}`;
    const returnUrl = `${baseUrl}/stripe-callback?user_id=${userId}`;

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding'
    });

    res.json({ url: accountLink.url });
  } catch (error) {
    console.error('Error creando enlace de cuenta:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/stripe/status', async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId requerido' });
    }

    console.log('🔍 Verificando estado Stripe para usuario:', userId);

    // Buscar cuenta Stripe del usuario
    const { data: stripeAccount, error } = await supabase
      .from('stripe_accounts')
      .select('*')
      .eq('user_id', userId)
      .single();

    console.log('📊 Resultado de consulta:', { stripeAccount, error });

    if (error && error.code !== 'PGRST116') {
      console.error('Error consultando Stripe account:', error);
      return res.status(500).json({ error: 'Error consultando cuenta' });
    }

    if (!stripeAccount) {
      console.log('❌ No se encontró cuenta Stripe para usuario:', userId);
      return res.json({
        isActive: false,
        accountData: null,
        message: 'No tiene cuenta Stripe'
      });
    }

    console.log('✅ Cuenta encontrada:', stripeAccount.stripe_account_id);

    // Verificar estado en Stripe si la cuenta existe
    try {
      const account = await stripe.accounts.retrieve(stripeAccount.stripe_account_id);
      
      const isActive = account.details_submitted && 
                      account.charges_enabled && 
                      account.payouts_enabled;

      console.log('📊 Estado desde Stripe API:', {
        details_submitted: account.details_submitted,
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
        isActive
      });

      // Actualizar estado en base de datos si cambió
      if (isActive !== stripeAccount.is_active) {
        await supabase
          .from('stripe_accounts')
          .update({ 
            is_active: isActive,
            charges_enabled: account.charges_enabled,
            details_submitted: account.details_submitted,
            updated_at: new Date().toISOString()
          })
          .eq('id', stripeAccount.id);
        
        console.log('✅ Estado actualizado en base de datos');
      }

      res.json({
        isActive,
        accountData: {
          id: account.id,
          email: account.email,
          country: account.country,
          charges_enabled: account.charges_enabled,
          payouts_enabled: account.payouts_enabled,
          details_submitted: account.details_submitted
        },
        message: isActive ? 'Cuenta activa' : 'Cuenta pendiente de configuración'
      });

    } catch (stripeError) {
      console.error('Error consultando Stripe API:', stripeError);
      res.json({
        isActive: false,
        accountData: stripeAccount,
        message: 'Error verificando estado en Stripe'
      });
    }

  } catch (error) {
    console.error('Error en /api/stripe/status:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.post('/api/stripe/create-account', async (req, res) => {
  try {
    const { email, userId, causeData } = req.body;
    
    if (!email || !userId) {
      return res.status(400).json({ error: 'Email y userId requeridos' });
    }

    console.log('🔄 Procesando cuenta Stripe para:', { email, userId });

    // Verificar si ya tiene cuenta
    const { data: existingAccount } = await supabase
      .from('stripe_accounts')
      .select('*')
      .eq('user_id', userId)
      .single();

    let stripeAccountId;

    if (existingAccount && existingAccount.stripe_account_id) {
      stripeAccountId = existingAccount.stripe_account_id;
      console.log('✅ Usando cuenta Stripe existente:', stripeAccountId);
    } else {
      // Crear nueva cuenta en Stripe
      const account = await stripe.accounts.create({
        type: 'express',
        email: email,
        metadata: {
          user_id: userId,
          source: 'solidarity_causes'
        }
      });

      stripeAccountId = account.id;
      console.log('✅ Nueva cuenta Stripe creada:', stripeAccountId);

      // ✅ CORREGIDO: Guardar en base de datos INMEDIATAMENTE
      const insertData = {
        user_id: userId,
        stripe_account_id: stripeAccountId,
        email: email,
        is_active: false,
        charges_enabled: false,
        details_submitted: false,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      console.log('💾 Insertando en stripe_accounts:', insertData);

      if (existingAccount) {
        const { error: updateError } = await supabase
          .from('stripe_accounts')
          .update(insertData)
          .eq('id', existingAccount.id);
        
        if (updateError) {
          console.error('❌ Error actualizando cuenta:', updateError);
          throw new Error('Error actualizando cuenta en base de datos');
        }
      } else {
        const { error: insertError } = await supabase
          .from('stripe_accounts')
          .insert([insertData]);
        
        if (insertError) {
          console.error('❌ Error insertando cuenta:', insertError);
          throw new Error('Error guardando cuenta en base de datos');
        }
      }

      console.log('✅ Cuenta guardada en base de datos');
    }

    // ✅ CORREGIDO: URLs con user_id para el callback
    const baseUrl = process.env.DOMAIN || 'http://localhost:3000';
    const refreshUrl = `${baseUrl}/causes?stripe=refresh&user_id=${userId}`;
    const returnUrl = `${baseUrl}/stripe-callback?user_id=${userId}`;

    console.log('🔗 URLs de redirección:', { refreshUrl, returnUrl });

    // Crear enlace de onboarding
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    });

    res.json({
      success: true,
      returnUrl: accountLink.url,
      accountId: stripeAccountId
    });

  } catch (error) {
    console.error('❌ Error creando cuenta Stripe:', error);
    res.status(500).json({ 
      error: 'Error creando cuenta Stripe',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Endpoint para crear causa
app.post('/api/causes/create', upload.single('photo'), async (req, res) => {
  try {
    let photo_url = null;
    if (req.file) {
      photo_url = `/uploads/${req.file.filename}`;
    } else if (req.body.photo_url) {
      photo_url = req.body.photo_url;
    }

    // Convierte cualquier valor vacío, nulo o no numérico a null
    function parseNumber(val) {
      if (val === '' || val === undefined || val === null) return null;
      const num = Number(val);
      return (isNaN(num) || val === '') ? null : num;
    }

    // Obtén todas las columnas válidas de la tabla causes
    const {
      title, short_description, description, goal, beneficiaries,
      city, country, points, contact_email, phone_number,
      mobile_wallet, lat, lng, user_id, stripe_account_id
    } = req.body;

    const insertData = {
      title,
      short_description,
      description,
      goal: parseNumber(goal),
      beneficiaries: parseNumber(beneficiaries),
      points: parseNumber(points),
      city,
      country,
      contact_email,
      phone_number,
      mobile_wallet,
      lat: parseNumber(lat),
      lng: parseNumber(lng),
      user_id,
      stripe_account_id,
      photo_url
    };

    // Elimina cualquier campo numérico que sea null si tu tabla no permite null
    Object.keys(insertData).forEach(key => {
      if (insertData[key] === null) delete insertData[key];
    });

    const { data, error } = await supabase
      .from('causes')
      .insert([insertData]);

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    console.error('❌ Error en /api/causes/create:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/causes', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const offset = (page - 1) * limit;
    const category = req.query.category;
    const search = req.query.search;

    let query = supabase.from('causes').select('*', { count: 'exact' });

    if (category && category !== 'all') {
      query = query.eq('category', category);
    }
    if (search && search.trim() !== '') {
      query = query.ilike('title', `%${search}%`);
    }

    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({
      data,
      total: count
    });
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// --- ENDPOINTS DE CONFIGURACIÓN ---
app.get('/api/config', (req, res) => {
  res.json({
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
    stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    environment: process.env.NODE_ENV || 'development'
  });
});

// --- FUNCIÓN AUXILIAR PARA VERIFICAR STRIPE ---
async function verifyStripeStatus(userId) {
  try {
    const { data: stripeAccount, error: dbError } = await supabase
      .from('stripe_accounts')
      .select('stripe_account_id, status, charges_enabled, last_verified')
      .eq('user_id', userId)
      .single();

    if (dbError || !stripeAccount) {
      return { connected: false, error: 'No account found' };
    }

    const lastVerified = stripeAccount.last_verified ? new Date(stripeAccount.last_verified) : null;
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    
    if (lastVerified && lastVerified > fiveMinutesAgo && stripeAccount.charges_enabled) {
      return {
        connected: stripeAccount.charges_enabled,
        onboardingComplete: true,
        accountId: stripeAccount.stripe_account_id,
        status: stripeAccount.charges_enabled ? 'active' : 'pending',
        cached: true
      };
    }

    const account = await stripe.accounts.retrieve(stripeAccount.stripe_account_id);
    
    await supabase
      .from('stripe_accounts')
      .update({
        charges_enabled: account.charges_enabled,
        details_submitted: account.details_submitted,
        status: account.charges_enabled ? 'active' : 'pending',
        last_verified: now
      })
      .eq('user_id', userId);

    return {
      connected: account.charges_enabled,
      onboardingComplete: account.details_submitted,
      accountId: stripeAccount.stripe_account_id,
      status: account.charges_enabled ? 'active' : 'pending',
      requirements: account.requirements,
      cached: false
    };
  } catch (error) {
    console.error('Error verifying Stripe status:', error);
    return { connected: false, error: error.message };
  }
}

// --- MANEJO DE ERRORES ---
app.use((err, req, res, next) => {
  console.error('❌ Error del servidor:', err.stack);
  
  if (res.headersSent) {
    return next(err);
  }
  
  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({ 
      error: 'Token CSRF inválido',
      code: 'INVALID_CSRF'
    });
  }

  if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
    return res.status(503).json({ 
      error: 'Servicio temporalmente no disponible',
      code: 'SERVICE_UNAVAILABLE'
    });
  }

  const response = {
    error: 'Error interno del servidor',
    code: 'INTERNAL_ERROR',
    timestamp: new Date().toISOString(),
    requestId: req.sessionID
  };

  if (process.env.NODE_ENV !== 'production') {
    response.details = err.message;
    response.stack = err.stack;
  }

  res.status(500).json(response);
});

app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ 
      error: 'Endpoint no encontrado',
      code: 'NOT_FOUND',
      path: req.path
    });
  }
  
  res.status(404).render('404', { 
    lang: req.lang, 
    user: req.session?.user,
    requestedPath: req.path
  });
});

// Iniciar servidor
const server = app.listen(PORT, () => {
  console.log(`🚀 Servidor iniciado en puerto ${PORT}`);
  console.log(`🌍 Entorno: development`);
  console.log(`🔗 URL: http://localhost:${PORT}`);
  console.log('✅ Configuración de desarrollo activa');
  console.log('🔒 Cookies seguras deshabilitadas');
  console.log('🌐 CORS solo para localhost');
});

// Manejo graceful de cierre
process.on('SIGTERM', () => {
  console.log('📡 SIGTERM recibido, cerrando servidor...');
  server.close(() => {
    console.log('✅ Servidor cerrado correctamente');
  });
});

// Añadir después de las rutas de Stripe existentes:
app.get('/stripe-account-status/:userId', authenticateUser, async (req, res) => {
  try {
    const userId = req.params.userId;
    
    // Verificar que el usuario pueda acceder a estos datos
    if (req.session.user.id !== userId) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const { data: account, error } = await supabase
      .from('stripe_accounts')
      .select('stripe_account_id, status, charges_enabled, details_submitted')
      .eq('user_id', userId)
      .single();

    if (error || !account) {
      return res.json({ 
        hasAccount: false,
        status: 'none',
        account_id: null
      });
    }

    // Verificar estado actual en Stripe si es necesario
    try {
      const stripeAccount = await stripe.accounts.retrieve(account.stripe_account_id);
      
      // Actualizar estado en base de datos si cambió
      if (stripeAccount.charges_enabled !== account.charges_enabled) {
        await supabase
          .from('stripe_accounts')
          .update({
            charges_enabled: stripeAccount.charges_enabled,
            details_submitted: stripeAccount.details_submitted,
            status: stripeAccount.charges_enabled ? 'active' : 'pending',
            last_verified: new Date()
          })
          .eq('user_id', userId);
      }

      res.json({
        hasAccount: true,
        status: stripeAccount.charges_enabled ? 'active' : 'pending',
        account_id: account.stripe_account_id,
        charges_enabled: stripeAccount.charges_enabled,
        details_submitted: stripeAccount.details_submitted
      });
      
    } catch (stripeError) {
      console.error('Error verificando cuenta Stripe:', stripeError);
      res.json({
        hasAccount: true,
        status: account.status || 'unknown',
        account_id: account.stripe_account_id
      });
    }

  } catch (error) {
    console.error('Error en stripe-account-status:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.use(async (req, res, next) => {
  if (!req.session.user && req.headers.authorization?.startsWith('Bearer ')) {
    try {
      const token = req.headers.authorization.split(' ')[1];
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (!error && user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        if (profile) {
          req.session.user = {
            id: profile.id,
            name: profile.first_name,
            username: profile.username,
            email: profile.email,
            photo_url: profile.photo_url,
            type: profile.user_type || 'user'
          };
          req.session.lastActivity = new Date();
        }
      }
    } catch (err) {
      console.error('Session sync error:', err);
    }
  }
  next();
});

app.use((req, res, next) => {
  console.log(`Session check - ID: ${req.sessionID}, User: ${req.session.user?.id || 'none'}`);
  next();
});

(async () => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);

    if (error) {
      console.error('❌ Error conectando a Supabase/PostgreSQL:', error.message);
    } else {
      console.log('✅ PostgreSQL/Supabase connection successful');
    }
  } catch (err) {
    console.error('❌ Error conectando a Supabase/PostgreSQL:', err.message);
  }
})();

// --- RUTAS DE DONACIONES ---
const donationsRouter = require('./routes/api/donations');
app.use('/api/donations', donationsRouter);

// --- NUEVAS RUTAS DE STRIPE ---
app.post('/api/stripe/create-checkout', async (req, res) => {
  try {
    const { causeId, amount, currency } = req.body;
    if (!causeId || !amount || !currency) {
      return res.status(400).json({ error: 'Datos incompletos' });
    }

    // Busca la causa y su cuenta Stripe
    const { data: cause, error } = await supabase
      .from('causes')
      .select('stripe_account_id, title')
      .eq('id', causeId)
      .single();

    if (error || !cause?.stripe_account_id) {
      return res.status(404).json({ error: 'Causa o cuenta Stripe no encontrada' });
    }

    // Crea la sesión de pago Stripe
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency,
          product_data: {
            name: `Donación a: ${cause.title}`,
          },
          unit_amount: Math.round(amount * 100), // Stripe usa céntimos
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${process.env.DOMAIN}/causes?donation=success`,
      cancel_url: `${process.env.DOMAIN}/causes?donation=cancel`,
      payment_intent_data: {
        application_fee_amount: 0, // Si quieres cobrar comisión, pon aquí el fee en céntimos
      },
      stripe_account: cause.stripe_account_id // Pago directo a la cuenta de la causa
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('❌ Error en /api/stripe/create-checkout:', err);
    res.status(500).json({ error: 'Error creando sesión de pago' });
  }
});