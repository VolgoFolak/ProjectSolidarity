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
const rateLimit = require('express-rate-limit');
const csurf = require('csurf');
const { body, validationResult } = require('express-validator');

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

// Configuración CORS
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

// Configuración de sesión robusta
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

// Middlewares personalizados
const detectLanguage = require('./middleware/detectlanguage');
app.use(detectLanguage);

const authenticateUser = require('./middleware/authenticateUser');

// Middleware para agregar datos de sesión a todas las vistas
app.use((req, res, next) => {
  console.log(`📝 ${req.method} ${req.path} - Session ID: ${req.sessionID}`);
  console.log('🔍 Session User:', req.session.user ? req.session.user.username : 'No user');
  
  res.locals.user = req.session.user || null;
  res.locals.lang = req.lang || 'es';
  res.locals.csrfToken = req.session.csrfToken || '';
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

// Verificación de sesión
app.get('/api/session/check', (req, res) => {
  if (req.session && req.session.user) {
    res.json({
      ok: true,
      authenticated: true,
      user: req.session.user,
      sessionId: req.sessionID
    });
  } else {
    res.status(401).json({ 
      ok: false,
      authenticated: false,
      sessionId: req.sessionID
    });
  }
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

// Login con Supabase mejorado
app.post('/login-supabase', async (req, res) => {
  const { token } = req.body;
  
  if (!token) {
    return res.status(400).json({ error: 'No token provided' });
  }

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

    req.session.regenerate((err) => {
      if (err) {
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
      
      req.session.save((saveErr) => {
        if (saveErr) {
          return res.status(500).json({ error: 'Session save failed' });
        }
        
        // Configurar cookie de sesión
        res.cookie('solidarity.sid', req.sessionID, {
          secure: process.env.NODE_ENV === 'production',
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
          httpOnly: true,
          maxAge: 7 * 24 * 60 * 60 * 1000,
          domain: process.env.NODE_ENV === 'production' ? '.project-solidarity.com' : undefined,
          path: '/',
        });
        
        res.json({ 
          ok: true, 
          user: req.session.user,
          sessionId: req.sessionID,
          message: 'Login successful'
        });
      });
    });
  } catch (error) {
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

// Función auxiliar para verificar Stripe
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
    return { connected: false };
  }
}

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
        .select('id, username, email, photo_url, first_name, user_type')
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
          type: user.user_type || 'user'
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
  // Validar tipo de archivo
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
  if (!allowedTypes.includes(req.file.mimetype)) {
    fs.unlinkSync(req.file.path); // Eliminar archivo no permitido
    return res.status(400).json({ ok: false, error: 'Tipo de archivo no permitido.' });
  }
  // Validar tamaño (máx 2MB)
  if (req.file.size > 2 * 1024 * 1024) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ ok: false, error: 'Archivo demasiado grande (máx 2MB).' });
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

// 1. Rate limiting para endpoints sensibles
app.use('/login', rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // máximo 10 intentos por IP
  message: { error: 'Demasiados intentos, espera unos minutos.' }
}));
app.use('/register', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Demasiados registros, espera unos minutos.' }
}));

// 2. Protección CSRF para formularios y endpoints POST
app.use(csurf({ cookie: true }));

// Middleware para exponer el token CSRF en todas las vistas
app.use((req, res, next) => {
  res.locals.csrfToken = req.csrfToken ? req.csrfToken() : '';
  next();
});

// 3. Validación de datos con express-validator
// Ejemplo en registro de usuario
app.post('/register',
  body('username').isLength({ min: 3 }).trim().escape(),
  body('password').isLength({ min: 6 }),
  body('email').isEmail().normalizeEmail(),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ ok: false, errors: errors.array() });
    }
    // ...resto del código de registro...
  }
);

// 5. Health check endpoint para monitoreo
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 6. Modularización de rutas (ejemplo para autenticación)
// Crea un archivo routes/auth.js y mueve las rutas de login, logout, register allí
// Luego aquí:
// const authRoutes = require('./routes/auth');
// app.use('/auth', authRoutes);

// 7. Mejorar manejo de errores 404 y CSRF
app.use((err, req, res, next) => {
  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({ error: 'CSRF token inválido.' });
  }
  // ...existing error handler...
  next(err);
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

app.post('/api/stripe/create-account-link', authenticateUser, async (req, res) => {
  try {
    const { accountId } = req.body;
    const userId = req.session.user.id;
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${frontendUrl}/causes?stripe_error=reauth`,
      return_url: `${frontendUrl}/stripe-callback?user_id=${userId}`,
      type: 'account_onboarding'
    });

    res.json({ url: accountLink.url });
  } catch (error) {
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
    const { data: accountRow } = await supabase
      .from('stripe_accounts')
      .select('stripe_account_id')
      .eq('user_id', userId)
      .single();

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
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const category = req.query.category;
    const search = req.query.search;
    
    let query = supabase
      .from('causes')
      .select('*', { count: 'exact' })
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (category && category !== 'all') {
      query = query.eq('category', category);
    }
    
    if (search && search.trim() !== '') {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%,city.ilike.%${search}%,country.ilike.%${search}%`);
    }

    const { data, count, error } = await query;
    
    if (error) throw error;
    
    res.json({
      data: data || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit)
    });
  } catch (error) {
    res.status(500).json({ 
      error: error.message,
      data: [],
      total: 0
    });
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

// --- MANEJO DE ERRORES ---
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

app.use((req, res) => {
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