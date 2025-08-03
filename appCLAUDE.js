require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const nunjucks = require('nunjucks');
const session = require('express-session');

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const app = express();
const PORT = 3000;

const USERS_FILE = path.join(__dirname, 'users.json');

// --- Variables de entorno y configuración ---
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const FRONTEND_URL = process.env.NODE_ENV === 'production' 
  ? 'https://www.project-solidarity.com' 
  : 'http://localhost:3000';

// Inicializar Stripe solo si hay clave
const stripe = STRIPE_SECRET_KEY ? require('stripe')(STRIPE_SECRET_KEY) : null;

// --- Configuración de multer para uploads ---
const upload = multer({ 
  dest: path.join(__dirname, 'uploads/'),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes'));
    }
  }
});

// --- Configuración de sesiones ---
app.use(session({
  secret: process.env.SESSION_SECRET || 'solidarity-secret-dev',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 horas
    sameSite: 'lax'
  }
}));

// --- Middleware de autenticación ---
const authenticateUser = (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Acceso no autorizado' });
  }
  next();
};

// --- Middlewares ---
app.use(express.json());
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));

// Servir archivos estáticos
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static('public'));

// --- Configura nunjucks ---
nunjucks.configure('views', {
  autoescape: true,
  express: app
});
app.set('view engine', 'njk');

// --- Middleware de idioma ---
const detectLanguage = require('./middleware/detectlanguage');
app.use(detectLanguage);

// --- Subida de foto de perfil ---
app.post('/upload-photo', upload.single('photo'), (req, res) => {
    if (!req.file) {
        return res.json({ ok: false, error: 'No se subió ninguna imagen.' });
    }
    const url = '/uploads/' + req.file.filename;
    res.json({ ok: true, url });
});

// --- Leer y guardar usuarios ---
function readUsers() {
    if (!fs.existsSync(USERS_FILE)) return [];
    const data = fs.readFileSync(USERS_FILE, 'utf8');
    if (!data) return [];
    return JSON.parse(data);
}
function writeUsers(users) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// --- Registro de usuario ---
app.post('/register', (req, res) => {
    const { username, password, name, email, photo_url } = req.body;
    if (!username || !password || !name || !email) {
        return res.status(400).json({ ok: false, error: 'Faltan campos obligatorios' });
    }
    let users = readUsers();
    if (users.find(u => u.username === username)) {
        return res.status(400).json({ ok: false, error: 'Usuario ya existe' });
    }
    const newUser = { username, password, name, email, photo_url: photo_url || '' };
    users.push(newUser);
    writeUsers(users);
    res.json({ ok: true });
});

// --- Login ---
app.post('/login', (req, res) => {
    const { username, password, email } = req.body;
    let users = readUsers();
    let user = null;
    if (username && password) {
        user = users.find(u => u.username === username && u.password === password);
    } else if (email && password) {
        user = users.find(u => u.email === email && u.password === password);
    }
    if (user) {
        req.session.user = { 
            id: user.id || user.username,
            name: user.name, 
            photo_url: user.photo_url || '',
            username: user.username, 
            email: user.email 
        };
        res.json({ ok: true, user: req.session.user });
    } else {
        res.status(401).json({ ok: false, error: 'Credenciales incorrectas' });
    }
});

// --- Login con Supabase ---
app.post('/login-supabase', async (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ error: 'No token' });
  }
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return res.status(401).json({ error: 'Token inválido' });
  }
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, username, first_name, email, photo_url')
    .eq('id', user.id)
    .single();
  if (profileError || !profile) {
    return res.status(401).json({ error: 'Perfil no encontrado' });
  }
  req.session.user = {
    id: profile.id,
    name: profile.first_name,
    photo_url: profile.photo_url || '',
    username: profile.username,
    email: profile.email
  };
  req.session.firstLogin = true;
  res.json({ ok: true, user: req.session.user });
});

// --- Saber si hay sesión ---
app.get('/me', (req, res) => {
    if (req.session.user) {
        res.json({ 
            logged: true,
            user: req.session.user,
            firstLogin: req.session.firstLogin
        });
    } else {
        res.json({ logged: false });
    }
});

// --- Logout ---
app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.sendStatus(200);
  });
});

// --- Rutas para cambiar idioma ---
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

// --- Rutas principales (todas las vistas) ---
app.get('/', (req, res) => { res.render('index', { lang: req.lang, user: req.session.user }); });
app.get('/login', (req, res) => { res.render('auth/login', { lang: req.lang }); });
app.get('/register', (req, res) => { res.render('auth/register', { lang: req.lang }); });
app.get('/causes', (req, res) => { res.render('causes/index', { lang: req.lang, user: req.session.user }); });
app.get('/causes/create', (req, res) => { res.render('causes/create', { lang: req.lang, user: req.session.user }); });
app.get('/causes/:id', (req, res) => { res.render('causes/index', { title: 'Causa - Solidarity', lang: req.lang, user: req.session.user }); });
app.get('/tasks', (req, res) => { res.render('tasks/index', { lang: req.lang, user: req.session.user }); });
app.get('/tasks/create', (req, res) => { res.render('tasks/create', { lang: req.lang, user: req.session.user }); });
app.get('/tasks/:id', (req, res) => { res.render('tasks/index', { title: 'Tarea - Solidarity', lang: req.lang, user: req.session.user }); });
app.get('/tarea/:id', (req, res) => { res.render('tasks/index', { title: 'Tarea - Solidarity', lang: req.lang, user: req.session.user }); });
app.get('/volunteering', (req, res) => { res.render('volunteering/index', { lang: req.lang, user: req.session.user }); });
app.get('/volunteering/create', (req, res) => { res.render('volunteering/create', { lang: req.lang, user: req.session.user }); });
app.get('/volunteering/:id', (req, res) => { res.render('volunteering/index', { title: 'Voluntariado - Solidarity', lang: req.lang, user: req.session.user }); });
app.get('/voluntariado/:id', (req, res) => { res.render('volunteering/index', { title: 'Voluntariado - Solidarity', lang: req.lang, user: req.session.user }); });
app.get('/challenges', (req, res) => { res.render('challenges/index', { lang: req.lang, user: req.session.user }); });
app.get('/challenges/:id', (req, res) => { res.render('challenges/index', { title: 'Desafío - Solidarity', lang: req.lang, user: req.session.user }); });
app.get('/reto/:id', (req, res) => { res.render('challenges/index', { title: 'Reto - Solidarity', lang: req.lang, user: req.session.user }); });
app.get('/teams', (req, res) => { res.render('teams/index', { lang: req.lang, user: req.session.user }); });
app.get('/teams/:id', (req, res) => { res.render('teams/index', { title: 'Equipo - Solidarity', lang: req.lang, user: req.session.user }); });
app.get('/equipo/:id', (req, res) => { res.render('teams/index', { title: 'Equipo - Solidarity', lang: req.lang, user: req.session.user }); });
app.get('/myteams', (req, res) => { res.render('myteams/myteams', { lang: req.lang, user: req.session.user }); });
app.get('/takeaction', (req, res) => { res.render('takeaction/index', { lang: req.lang, user: req.session.user }); });
app.get('/ranking', (req, res) => { res.render('ranking/index', { lang: req.lang, user: req.session.user }); });
app.get('/profile', (req, res) => { res.render('profile/index', { lang: req.lang, user: req.session.user }); });
app.get('/editprofile', (req, res) => { res.render('profile/editprofile', { lang: req.lang, user: req.session.user }); });
app.get('/profile/myactivities', (req, res) => { res.render('profile/myactivities', { lang: req.lang, user: req.session.user }); });
app.get('/maps', (req, res) => { res.render('maps/index', { lang: req.lang, user: req.session.user }); });
app.get('/members', (req, res) => { res.render('members/members', { lang: req.lang, user: req.session.user }); });
app.get('/messages', (req, res) => { res.render('messages/index', { lang: req.lang, user: req.session.user }); });
app.get('/docs/privacy', (req, res) => { res.render('docs/privacy', { lang: req.lang, user: req.session.user }); });
app.get('/docs/terms', (req, res) => { res.render('docs/terms', { lang: req.lang, user: req.session.user }); });
app.get('/contact', (req, res) => {
  res.render('contact', { lang: req.lang, user: req.session.user });
});
app.get('/docs/about', (req, res) => {
  res.render('docs/about', { lang: req.lang, user: req.session.user });
});
app.get('/docs/help', (req, res) => {
  res.render('docs/help', { lang: req.lang, user: req.session.user });
});

// --- API para mensajes ---
app.get('/api/conversations', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'No autenticado' });
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

app.get('/api/messages/:conversationId', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'No autenticado' });
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

app.post('/api/messages', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'No autenticado' });
    const { conversation_id, content } = req.body;
    try {
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

app.post('/api/conversations', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'No autenticado' });
    const { recipient_id, content } = req.body;
    try {
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

app.get('/api/users', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'No autenticado' });
    const searchTerm = req.query.search || '';
    try {
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

// --- STRIPE ROUTES (solo si está configurado) ---
if (stripe && STRIPE_SECRET_KEY) {

  // --- Stripe: Crear cuenta y onboarding mejorado para producción ---
  app.post('/api/stripe/create-account', authenticateUser, async (req, res) => {
    try {
      const { email, causeData } = req.body;
      const userId = req.session.user.id;

      // Verificar si ya existe cuenta
      const { data: existingAccount } = await supabase
        .from('stripe_accounts')
        .select('stripe_account_id, status')
        .eq('user_id', userId)
        .single();

      let accountId;
      if (existingAccount && existingAccount.stripe_account_id) {
        accountId = existingAccount.stripe_account_id;
      } else {
        // Crear nueva cuenta Stripe
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
        accountId = account.id;

        // Guardar en Supabase
        await supabase.from('stripe_accounts').upsert({
          user_id: userId,
          stripe_account_id: accountId,
          status: 'pending',
          email: email
        });
      }

      // Guardar datos de la causa como borrador
      if (causeData) {
        await supabase.from('cause_drafts').upsert({
          user_id: userId,
          draft_data: causeData,
          stripe_account_id: accountId,
          stripe_enabled: false
        });
      }

      // Crear enlace de onboarding con URLs específicas para producción
      const accountLink = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: `${FRONTEND_URL}/causes?stripe_error=refresh&user_id=${userId}`,
        return_url: `${FRONTEND_URL}/api/stripe/callback?user_id=${userId}`,
        type: 'account_onboarding'
      });

      res.json({
        accountId: accountId,
        returnUrl: accountLink.url
      });

    } catch (error) {
      console.error('Error creating Stripe account:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // --- Callback mejorado para mantener sesión ---
  app.get('/api/stripe/callback', async (req, res) => {
    try {
      const { user_id } = req.query;
      
      console.log('🔄 Stripe callback - User ID:', user_id);

      if (!user_id) {
        return res.redirect(`${FRONTEND_URL}/causes?stripe_error=no_user_id`);
      }

      // Restaurar sesión del usuario
      const { data: user, error: userError } = await supabase
        .from('profiles')
        .select('id, username, email, photo_url, first_name')
        .eq('id', user_id)
        .single();

      if (userError || !user) {
        console.error('❌ Error obteniendo usuario:', userError);
        return res.redirect(`${FRONTEND_URL}/causes?stripe_error=user_not_found`);
      }

      // Restaurar sesión
      req.session.user = {
        id: user.id,
        name: user.first_name || user.username,
        photo_url: user.photo_url || '',
        username: user.username,
        email: user.email
      };

      // Verificar estado de la cuenta Stripe
      const { data: stripeAccount, error: stripeError } = await supabase
        .from('stripe_accounts')
        .select('stripe_account_id, status')
        .eq('user_id', user_id)
        .single();

      if (stripeError || !stripeAccount) {
        console.error('❌ Error obteniendo cuenta Stripe:', stripeError);
        return res.redirect(`${FRONTEND_URL}/causes?stripe_error=no_stripe_account`);
      }

      // Verificar el estado real en Stripe
      try {
        const account = await stripe.accounts.retrieve(stripeAccount.stripe_account_id);
        
        if (account.charges_enabled && account.details_submitted) {
          // Actualizar estado en base de datos
          await supabase
            .from('stripe_accounts')
            .update({ 
              status: 'active',
              charges_enabled: true,
              details_submitted: true 
            })
            .eq('user_id', user_id);

          // Verificar si hay borrador para crear causa
          const { data: draft } = await supabase
            .from('cause_drafts')
            .select('*')
            .eq('user_id', user_id)
            .single();

          if (draft) {
            // Crear causa automáticamente
            const { data: newCause, error: causeError } = await supabase
              .from('causes')
              .insert([{
                ...draft.draft_data,
                user_id: user_id,
                status: 'active',
                stripe_enabled: true,
                stripe_account_id: stripeAccount.stripe_account_id
              }])
              .select()
              .single();

            if (!causeError && newCause) {
              // Eliminar borrador
              await supabase.from('cause_drafts').delete().eq('user_id', user_id);
              
              console.log('✅ Causa creada exitosamente:', newCause.id);
              return res.redirect(`${FRONTEND_URL}/causes?stripe=success&cause_id=${newCause.id}&user_id=${user_id}`);
            }
          }

          // Si no hay borrador, solo mostrar éxito de conexión
          console.log('✅ Stripe conectado exitosamente');
          return res.redirect(`${FRONTEND_URL}/causes?stripe=success&user_id=${user_id}`);
          
        } else {
          console.log('⚠️ Cuenta Stripe no completamente configurada');
          return res.redirect(`${FRONTEND_URL}/causes?stripe_error=incomplete&user_id=${user_id}`);
        }
      } catch (stripeApiError) {
        console.error('❌ Error verificando cuenta en Stripe:', stripeApiError);
        return res.redirect(`${FRONTEND_URL}/causes?stripe_error=stripe_api_error&user_id=${user_id}`);
      }

    } catch (error) {
      console.error('❌ Error en callback de Stripe:', error);
      res.redirect(`${FRONTEND_URL}/causes?stripe_error=callback_failed`);
    }
  });

  // --- Endpoint para restaurar sesión desde el frontend ---
  app.post('/api/restore-session', async (req, res) => {
    try {
      const { user_id } = req.body;
      
      if (!user_id) {
        return res.status(400).json({ error: 'User ID requerido' });
      }

      const { data: user, error } = await supabase
        .from('profiles')
        .select('id, username, email, photo_url, first_name')
        .eq('id', user_id)
        .single();

      if (error || !user) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      req.session.user = {
        id: user.id,
        name: user.first_name || user.username,
        photo_url: user.photo_url || '',
        username: user.username,
        email: user.email
      };

      await new Promise((resolve, reject) => {
        req.session.save((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      res.json({ success: true, user: req.session.user });
    } catch (error) {
      console.error('Error restaurando sesión:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });

  // --- Webhook Stripe ---
  app.post('/webhook', bodyParser.raw({type: 'application/json'}), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
      console.log('✅ Webhook recibido:', event.type);

      switch (event.type) {
        case 'account.updated': {
          const account = event.data.object;
          console.log('🔄 Actualizando cuenta:', account.id);
          
          await supabase
            .from('stripe_accounts')
            .update({
              status: account.charges_enabled ? 'active' : 'pending',
              details_submitted: account.details_submitted,
              charges_enabled: account.charges_enabled,
              updated_at: new Date()
            })
            .eq('stripe_account_id', account.id);
          
          console.log('✅ Estado de cuenta actualizado');
          break;
        }
        
        case 'checkout.session.completed': {
          const session = event.data.object;
          const causeId = session.metadata?.causeId;
          
          if (causeId) {
            console.log('💰 Donación completada para causa:', causeId);
            
            await supabase
              .from('donations')
              .insert([{
                cause_id: causeId,
                amount: session.amount_total / 100,
                stripe_session_id: session.id,
                donor_email: session.customer_details?.email || null,
                status: 'completed',
                created_at: new Date()
              }]);
            
            console.log('✅ Donación registrada');
          }
          break;
        }
        
        default:
          console.log('ℹ️ Evento no manejado:', event.type);
      }

      res.json({ received: true });
    } catch (err) {
      console.error('❌ Error en webhook:', err.message);
      res.status(400).send(`Webhook Error: ${err.message}`);
    }
  });

  // --- Crear sesión de pago (donación) ---
  app.post('/api/causes/create-donation', authenticateUser, async (req, res) => {
    try {
      const { amount, causeId } = req.body;
      if (!amount || !causeId) return res.status(400).json({ error: 'Faltan datos' });

      // Obtener causa y cuenta Stripe
      const { data: cause, error: causeError } = await supabase
        .from('causes')
        .select('id, title, stripe_account_id, stripe_enabled')
        .eq('id', causeId)
        .single();

      if (causeError || !cause || !cause.stripe_enabled || !cause.stripe_account_id) {
        return res.status(400).json({ error: 'Causa no habilitada para donaciones' });
      }

      // Crear sesión de pago Stripe
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'eur',
            product_data: {
              name: cause.title,
            },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        }],
        mode: 'payment',
        success_url: `${FRONTEND_URL}/causes/${causeId}?donation=success`,
        cancel_url: `${FRONTEND_URL}/causes/${causeId}?donation=cancel`,
        payment_intent_data: {
          application_fee_amount: 0,
        },
        metadata: {
          causeId: causeId,
          donorId: req.session.user.id,
        },
        stripeAccount: cause.stripe_account_id
      });

      res.json({ sessionId: session.id });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // --- Estado Stripe del usuario autenticado ---
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

  // --- Enlace de dashboard Stripe Express ---
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

} else {
  // Rutas Stripe deshabilitadas - devolver error informativo
  app.post('/api/stripe/*', (req, res) => {
    res.status(503).json({ error: 'Stripe no configurado en este entorno' });
  });
  app.get('/api/stripe/*', (req, res) => {
    res.status(503).json({ error: 'Stripe no configurado en este entorno' });
  });
}

// --- API para causas (borradores y finales) ---
app.post('/api/causes/save-draft', authenticateUser, async (req, res) => {
  try {
    const { causeData, stripeAccountId, stripeEnabled = false } = req.body;
    const userId = req.session.user.id;

    // Subir imagen si existe
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

    // Guardar borrador (upsert)
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

// --- Recuperar borrador de causa ---
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

// --- Eliminar borrador de causa ---
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

// --- Crear causa final ---
app.post('/api/causes/create-final', authenticateUser, async (req, res) => {
  try {
    const { causeData } = req.body;
    const userId = req.session.user.id;

    // Verificar estado Stripe si está configurado
    let stripeEnabled = false;
    let stripeAccountId = null;
    
    if (stripe && causeData.stripe_account_id) {
      const account = await stripe.accounts.retrieve(causeData.stripe_account_id);
      stripeEnabled = account.charges_enabled && account.details_submitted;
      stripeAccountId = stripeEnabled ? causeData.stripe_account_id : null;
    }

    // Crear causa
    const { data: newCause, error: causeError } = await supabase
      .from('causes')
      .insert([{ 
        ...causeData,
        user_id: userId,
        status: 'active',
        stripe_enabled: stripeEnabled,
        stripe_account_id: stripeAccountId
      }])
      .select()
      .single();

    if (causeError) throw new Error(causeError.message);

    // Eliminar borrador si existe
    await supabase.from('cause_drafts').delete().eq('user_id', userId);

    res.json({ 
      success: true,
      cause: newCause,
      redirectUrl: `/causes/${newCause.id}?creation=success`
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- Endpoint público para listar causas ---
app.get('/api/causes', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('causes')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- Endpoint para obtener causa específica ---
app.get('/api/causes/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('causes')
      .select(`
        *,
        creator:profiles!causes_user_id_fkey (
          id, username, first_name, photo_url
        )
      `)
      .eq('id', req.params.id)
      .single();
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- Ruta para 404 - DEBE ESTAR AL FINAL ---
app.use((req, res) => {
    res.status(404).send('Página no encontrada');
});

// --- Manejo de errores globales ---
app.use((err, req, res, next) => {
    console.error('Error global:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor iniciado en http://localhost:${PORT}`);
    console.log(`🌍 Entorno: ${process.env.NODE_ENV || 'development'}`);
    console.log(`💳 Stripe: ${stripe ? 'Configurado' : 'No configurado'}`);
});