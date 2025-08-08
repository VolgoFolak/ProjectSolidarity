require('dotenv').config();

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

// ✅ 2. CONFIGURACIÓN DE CONFIANZA DE PROXY
const isLocalhost = process.env.NODE_ENV !== 'production';
const frontendUrl = isLocalhost ? 'http://localhost:3000' : 'https://www.project-solidarity.com';

if (!isLocalhost) {
  app.set('trust proxy', 1);
}

// ✅ 3. CONFIGURACIÓN CORS
const allowedOrigins = [
  'https://project-solidarity.com',
  'https://www.project-solidarity.com',
  'http://localhost:3000'
];

app.use(cors({
  origin: ['http://localhost:3000', 'https://project-solidarity.com'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

// ✅ 4. CONFIGURACIÓN DE SESIÓN (SOLO MEMORIA)
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  // NO configures ningún store aquí - usa MemoryStore por defecto
  cookie: {
    secure: false, // false para localhost sin HTTPS
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24,
    sameSite: 'lax' // lax para localhost
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

// ✅ 9. CONFIGURACIÓN DE MULTER
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
    NODE_ENV: process.env.NODE_ENV
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

    // Guarda usuario en sesión
    req.session.user = {
      id: user.id,
      email: user.email,
      name: user.user_metadata?.full_name || user.email.split('@')[0],
      username: user.email.split('@')[0]
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
    
    if (!user_id) {
      return res.redirect('/causes?stripe_error=missing_user_id');
    }

    if (!req.session.user) {
      const { data: user, error: userError } = await supabase
        .from('profiles')
        .select('id, username, email, photo_url, first_name')
        .eq('id', user_id)
        .single();

      if (userError || !user) {
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
          type: 'user'
        };
        req.session.lastActivity = new Date();

        req.session.save((saveErr) => {
          if (saveErr) {
            return res.redirect('/login?error=session_save_error');
          }
          completeStripeProcess();
        });
      });
    } else {
      completeStripeProcess();
    }

    async function completeStripeProcess() {
      try {
        const { data: stripeAccount } = await supabase
          .from('stripe_accounts')
          .select('stripe_account_id, charges_enabled')
          .eq('user_id', req.session.user.id)
          .single();

        if (!stripeAccount?.stripe_account_id) {
          return res.redirect('/causes?stripe_error=no_account');
        }

        const account = await stripe.accounts.retrieve(stripeAccount.stripe_account_id);
        
        await supabase
          .from('stripe_accounts')
          .update({
            charges_enabled: account.charges_enabled,
            details_submitted: account.details_submitted,
            status: account.charges_enabled ? 'active' : 'pending',
            last_verified: new Date()
          })
          .eq('user_id', req.session.user.id);

        req.session.stripeStatus = {
          connected: account.charges_enabled,
          onboardingComplete: account.details_submitted,
          accountId: stripeAccount.stripe_account_id
        };

        req.session.save((saveErr) => {
          res.clearCookie('stripe_return_url');
          res.redirect(`/causes?stripe=success&user_id=${req.session.user.id}`);
        });

      } catch (error) {
        res.redirect('/causes?stripe_error=processing_error');
      }
    }

  } catch (error) {
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
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY, // <-- CORREGIDO
      NODE_ENV: process.env.NODE_ENV
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

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${frontendUrl}/causes?stripe_error=refresh&user_id=${userId}`,
      return_url: `${frontendUrl}/stripe-callback?user_id=${userId}`,
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
    const userId = req.query.userId;
    
    if (!userId) {
      return res.json({ 
        hasAccount: false,
        isActive: false,
        requiresAction: false
      });
    }

    const { data: account, error } = await supabase
      .from('stripe_accounts')
      .select('stripe_account_id, status, charges_enabled')
      .eq('user_id', userId)
      .single();

    if (error || !account) {
      return res.json({ 
        hasAccount: false,
        isActive: false,
        requiresAction: false
      });
    }

    const stripeAccount = await stripe.accounts.retrieve(account.stripe_account_id);
    res.json({
      hasAccount: true,
      isActive: stripeAccount.charges_enabled && stripeAccount.details_submitted,
      requiresAction: !stripeAccount.charges_enabled,
      stripeAccountId: account.stripe_account_id,
      status: stripeAccount.charges_enabled ? 'active' : 'pending'
    });
  } catch (error) {
    res.status(500).json({ error: 'Error checking Stripe status' });
  }
});

app.post('/api/causes/create-donation', authenticateUser, async (req, res) => {
  try {
    const { amount, causeId } = req.body;
    if (!amount || !causeId) return res.status(400).json({ error: 'Faltan datos' });

    const { data: cause, error: causeError } = await supabase
      .from('causes')
      .select('id, title, stripe_account_id, stripe_enabled')
      .eq('id', causeId)
      .single();

    if (causeError || !cause || !cause.stripe_enabled || !cause.stripe_account_id) {
      return res.status(400).json({ error: 'Causa no habilitada para donaciones' });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: { name: cause.title },
          unit_amount: Math.round(amount * 100),
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${frontendUrl}/causes/${causeId}?donation=success`,
      cancel_url: `${frontendUrl}/causes/${causeId}?donation=cancel`,
      payment_intent_data: { application_fee_amount: 0 },
      metadata: { causeId, donorId: req.session.user.id },
      stripeAccount: cause.stripe_account_id
    });

    res.json({ sessionId: session.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/stripe/my-status', authenticateUser, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { data: accountRow } = await supabase
      .from('stripe_accounts')
      .select('stripe_account_id, status')
      .eq('user_id', userId)
      .single();

    if (!accountRow) return res.json({ hasAccount: false, status: 'none' });

    const account = await stripe.accounts.retrieve(accountRow.stripe_account_id);
    res.json({
      hasAccount: true,
      status: account.charges_enabled ? 'active' : 'pending',
      detailsSubmitted: account.details_submitted
    });
  } catch (error) {
    res.status(500).json({ error: 'Error verificando estado de Stripe' });
  }
});

app.get('/reauth-stripe', authenticateUser, async (req, res) => {
  try {
    const userId = req.session.user.id;
    if (!accountRow) return res.redirect('/causes/create?error=no_stripe_account');

    const accountLink = await stripe.accountLinks.create({
      account: accountRow.stripe_account_id,
      refresh_url: `${frontendUrl}/reauth-stripe`,
      return_url: `${frontendUrl}/stripe-callback?user_id=${userId}`,
      type: 'account_onboarding',
    });

    res.redirect(accountLink.url);
  } catch (error) {
    res.redirect('/causes/create?error=reauth_failed');
  }
});

app.get('/api/stripe/dashboard-link', authenticateUser, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { data: accountRow } = await supabase
      .from('stripe_accounts')
      .select('stripe_account_id')
      .eq('user_id', userId)
      .single();

    if (!accountRow) return res.status(404).json({ error: 'No Stripe account' });

    const loginLink = await stripe.accounts.createLoginLink(accountRow.stripe_account_id);
    res.json({ url: loginLink.url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- RUTAS DE CAUSAS ---
app.post('/save-cause-draft', authenticateUser, async (req, res) => {
  try {
    const { draftData, stripeAccountId, stripeEnabled = false } = req.body;
    const userId = req.session.user.id;

    if (!draftData || !userId) {
      return res.status(400).json({ error: 'Datos incompletos' });
    }

    const { data: existingDraft } = await supabase
      .from('cause_drafts')
      .select('id')
      .eq('user_id', userId)
      .single();

    let result;
    if (existingDraft) {
      const { data, error } = await supabase
        .from('cause_drafts')
        .update({
          draft_data: draftData,
          stripe_account_id: stripeAccountId,
          stripe_enabled: stripeEnabled,
          updated_at: new Date()
        })
        .eq('id', existingDraft.id)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      const { data, error } = await supabase
        .from('cause_drafts')
        .insert([{
          user_id: userId,
          draft_data: draftData,
          stripe_account_id: stripeAccountId,
          stripe_enabled: stripeEnabled
        }])
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    res.json({ draftId: result.id });
  } catch (error) {
    res.status(500).json({ error: 'Error guardando borrador' });
  }
});

app.get('/api/causes', async (req, res) => {
  try {
    // Si usas Supabase en backend:
    const { data: causes, error } = await supabase
      .from('causes')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json(causes);
  } catch (err) {
    res.status(500).json({ error: err.message });
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
app.listen(PORT, () => {
  console.log(`🚀 Servidor iniciado en http://localhost:${PORT}`);
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