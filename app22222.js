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

// --- RUTAS DE USUARIO ---

// Subir foto de perfil
app.post('/upload-photo', upload.single('photo'), (req, res) => {
  if (!req.file) {
    return res.json({ ok: false, error: 'No se subió ninguna imagen.' });
  }
  const url = '/uploads/' + req.file.filename;
  res.json({ ok: true, url });
});

// Registro de usuario (local)
const USERS_FILE = path.join(__dirname, 'users.json');

function readUsers() {
  if (!fs.existsSync(USERS_FILE)) return [];
  const data = fs.readFileSync(USERS_FILE, 'utf8');
  return data ? JSON.parse(data) : [];
}

function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

app.post('/register', (req, res) => {
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
});

// --- RUTAS DE IDIOMA ---
app.post('/set-language', (req, res) => {
  const { lang } = req.body;
  const supportedLangs = ['es', 'en', 'fr', 'de', 'pt', 'it', 'nl', 'pl', 'ru', 'sv', 'no', 'en-US', 'ja', 'ko'];
  
  if (supportedLangs.includes(lang)) {
    res.cookie('userLang', lang, { 
      maxAge: 31536000000,
      httpOnly: false,
      secure: false,
      sameSite: 'lax'
    });
    res.json({ success: true, lang });
  } else {
    res.status(400).json({ error: 'Idioma no soportado' });
  }
});

app.get('/current-language', (req, res) => {
  res.json({ lang: req.lang || 'es' });
});

// --- RUTAS PRINCIPALES (VISTAS) ---
const renderView = (view, title = '') => (req, res) => {
  res.render(view, { 
    title, 
    lang: req.lang, 
    user: req.session.user,
    // ✅ Exponer variables de entorno necesarias
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

app.get('/api/check-session', (req, res) => {
  if (req.session.user) {
    res.json(req.session.user);
  } else {
    res.status(401).json({ ok: false });
  }
});

// --- RUTAS DE STRIPE ---

// Crear cuenta Stripe Express
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

// Crear enlace de onboarding Stripe Express
app.post('/api/stripe/create-account-link', authenticateUser, async (req, res) => {
  try {
    const { accountId } = req.body;
    const userId = req.session.user.id;
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${frontendUrl}/causes?stripe_error=reauth`,
      return_url: `${frontendUrl}/causes/stripe-callback?user_id=${userId}`,
      type: 'account_onboarding'
    });

    res.json({ url: accountLink.url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Callback de Stripe después del onboarding (mejorado)
app.get('/causes/stripe-callback', async (req, res) => {
  try {
    const { user_id } = req.query;
    console.log('🔄 Stripe callback para usuario:', user_id);

    if (user_id) {
      // Restaurar sesión del usuario
      const { data: user } = await supabase
        .from('profiles')
        .select('id, username, email, photo_url, first_name')
        .eq('id', user_id)
        .single();

      if (user) {
        req.session.user = {
          id: user.id,
          name: user.first_name,
          photo_url: user.photo_url || '',
          username: user.username,
          email: user.email
        };
        console.log('✅ Sesión restaurada para:', user.username);
      }

      // Verificar estado de la cuenta Stripe
      const { data: stripeAccount } = await supabase
        .from('stripe_accounts')
        .select('stripe_account_id, charges_enabled')
        .eq('user_id', user_id)
        .single();

      if (stripeAccount?.stripe_account_id) {
        const account = await stripe.accounts.retrieve(stripeAccount.stripe_account_id);
        
        // Actualizar estado en la base de datos
        await supabase
          .from('stripe_accounts')
          .update({
            charges_enabled: account.charges_enabled,
            details_submitted: account.details_submitted,
            status: account.charges_enabled ? 'active' : 'pending'
          })
          .eq('user_id', user_id);

        console.log('✅ Estado Stripe actualizado:', {
          charges_enabled: account.charges_enabled,
          details_submitted: account.details_submitted
        });
      }
    }

    res.redirect(`${frontendUrl}/causes?stripe=success&user_id=${user_id}`);
  } catch (error) {
    console.error('❌ Error en Stripe callback:', error);
    res.redirect('/causes?stripe_error=callback_failed');
  }
});

// Restaurar sesión después de Stripe
app.post('/api/restore-session', async (req, res) => {
  const { user_id } = req.body;
  const { data: user } = await supabase
    .from('profiles')
    .select('id, username, email, photo_url, name')
    .eq('id', user_id)
    .single();

  if (user) {
    req.session.user = user;
    return res.json({ success: true });
  }
  res.status(404).json({ error: 'User not found' });
});

// Estado de cuenta Stripe
app.get('/stripe-account-status/:userId', authenticateUser, async (req, res) => {
  try {
    const userId = req.params.userId;
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

// Webhook de Stripe
app.post('/webhook', async (req, res) => {
  const event = stripe.webhooks.constructEvent(
    req.body,
    req.headers['stripe-signature'],
    process.env.STRIPE_WEBHOOK_SECRET
  );

  if (event.type === 'account.updated') {
    const account = event.data.object;
    await supabase
      .from('stripe_accounts')
      .upsert({
        stripe_account_id: account.id,
        charges_enabled: account.charges_enabled,
        details_submitted: account.details_submitted,
        status: account.charges_enabled ? 'active' : 'pending'
      }, { onConflict: ['stripe_account_id'] });
  }
  res.json({ received: true });
});

// Crear sesión de pago (donación)
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

// Estado Stripe del usuario autenticado
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

// Reintentar onboarding Stripe
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
      return_url: `${frontendUrl}/causes/stripe-callback?user_id=${userId}`,
      type: 'account_onboarding',
    });

    res.redirect(accountLink.url);
  } catch (error) {
    res.redirect('/causes/create?error=reauth_failed');
  }
});

// Enlace al dashboard de Stripe Express
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

// Guardar borrador de causa
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
    res.status(500).json({ 
      error: 'Error guardando borrador',
      details: error.message 
    });
  }
});

// Recuperar borrador de causa
app.get('/api/causes/get-user-draft/:userId', authenticateUser, async (req, res) => {
  const userId = req.params.userId;
  if (req.session.user.id !== userId) {
    return res.status(403).json({ error: 'Usuario no autorizado' });
  }
  try {
    const { data: draft, error } = await supabase
      .from('cause_drafts')
      .select('id, draft_data, stripe_account_id, stripe_enabled')
      .eq('user_id', userId)
      .single();

    if (error) throw error;
    res.json({ draft });
  } catch (err) {
    res.status(500).json({ error: 'Error recuperando borrador' });
  }
});

// Eliminar borrador de causa
app.delete('/api/causes/delete-draft/:draftId', authenticateUser, async (req, res) => {
  const draftId = req.params.draftId;
  try {
    const { error } = await supabase
      .from('cause_drafts')
      .delete()
      .eq('id', draftId);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error eliminando borrador' });
  }
});

// Crear causa final desde borrador
app.post('/api/causes/create-final', authenticateUser, async (req, res) => {
  try {
    const { draftId } = req.body;
    const userId = req.session.user.id;

    const { data: draft, error: draftError } = await supabase
      .from('cause_drafts')
      .select('*')
      .eq('id', draftId)
      .eq('user_id', userId)
      .single();

    if (draftError || !draft) {
      return res.status(404).json({ error: 'Borrador no encontrado o no autorizado' });
    }

    let stripeEnabled = false;
    let stripeAccountId = null;
    if (draft.stripe_account_id) {
      const account = await stripe.accounts.retrieve(draft.stripe_account_id);
      stripeEnabled = account.charges_enabled && account.details_submitted;
      stripeAccountId = stripeEnabled ? draft.stripe_account_id : null;
    }

    const { data: newCause, error: causeError } = await supabase
      .from('causes')
      .insert([{ 
        ...draft.draft_data,
        user_id: userId,
        status: 'active',
        stripe_enabled: stripeEnabled,
        stripe_account_id: stripeAccountId
      }])
      .select()
      .single();

    if (causeError) throw new Error(causeError.message);

    await supabase.from('cause_drafts').delete().eq('id', draftId);
    await supabase.from('pending_onboardings').delete().eq('draft_id', draftId);

    res.json({ 
      success: true,
      cause: newCause,
      redirectUrl: `/causes/${newCause.id}?creation=success`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Crear cuenta Stripe y onboarding
app.post('/api/stripe/create-account', authenticateUser, async (req, res) => {
  try {
    const { email, causeData } = req.body;
    const userId = req.session.user.id;

    const account = await stripe.accounts.create({
      type: 'express',
      email,
      capabilities: {
        transfers: { requested: true },
        card_payments: { requested: true }
      },
      business_profile: {
        product_description: causeData?.title || 'Recaudación para causa solidaria',
      }
    });

    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${frontendUrl}/causes?stripe_error=refresh`,
      return_url: `${frontendUrl}/api/causes/stripe-callback?user_id=${userId}`,
      type: 'account_onboarding'
    });

    await supabase
      .from('stripe_accounts')
      .upsert({
        user_id: userId,
        stripe_account_id: account.id,
        status: 'pending'
      });

    res.json({
      accountId: account.id,
      returnUrl: accountLink.url
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Guardar borrador de causa con imagen
app.post('/api/causes/save-draft', authenticateUser, async (req, res) => {
  try {
    const { causeData, stripeAccountId, stripeEnabled = false } = req.body;
    const userId = req.session.user.id;

    let photoUrl = causeData.photo_url || null;
    if (causeData.photoFile) {
      const fileExt = causeData.photoFile.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
      const filePath = `causes/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('public')
        .upload(filePath, causeData.photoFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('public')
        .getPublicUrl(filePath);

      photoUrl = publicUrl;
    }

    const { data, error } = await supabase
      .from('cause_drafts')
      .upsert({
        user_id: userId,
        draft_data: {
          ...causeData,
          photo_url: photoUrl
        },
        stripe_account_id: stripeAccountId,
        stripe_enabled: stripeEnabled,
        updated_at: new Date()
      })
      .select()
      .single();

    if (error) throw error;

    res.json({ draftId: data.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Callback de Stripe
app.get('/api/causes/stripe-callback', authenticateUser, async (req, res) => {
  try {
    const { user_id } = req.query;

    if (!req.session.user && user_id) {
      const { data: user } = await supabase
        .from('profiles')
        .select('id, username, email, photo_url, name')
        .eq('id', user_id)
        .single();

      if (user) req.session.user = user;
    }

    const { data: account } = await supabase
      .from('stripe_accounts')
      .select('charges_enabled')
      .eq('user_id', user_id)
      .single();

    if (!account?.charges_enabled) {
      return res.redirect('/causes?stripe_error=not_ready');
    }

    res.redirect(`${frontendUrl}/causes?stripe=success&user_id=${user_id}`);
  } catch (error) {
    res.redirect('/causes?stripe_error=callback_failed');
  }
});

// --- RUTA: Estado de cuenta Stripe por userId (mejorada) ---
app.get('/api/stripe/status', async (req, res) => {
  try {
    // No requerir autenticación para consultas básicas
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
    console.error('Stripe status check error:', error);
    res.status(500).json({ error: 'Error checking Stripe status' });
  }
});

// Mejorar endpoint de causas con paginación
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
    console.error('Error loading causes:', error);
    res.status(500).json({ 
      error: error.message,
      data: [],
      total: 0
    });
  }
});

// ✅ ENDPOINT para configuración del frontend (mover antes del manejo de errores)
app.get('/api/config', (req, res) => {
  res.json({
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
    stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    environment: process.env.NODE_ENV || 'development'
  });
});

// ✅ MEJORAR manejo de errores y logging
app.use((err, req, res, next) => {
  console.error('❌ Error del servidor:', err.stack);
  
  // En producción, no exponer detalles del error
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