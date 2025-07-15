require('dotenv').config();

const express = require('express');
const path = require('path');
const session = require('express-session');
const fs = require('fs');
const multer = require('multer');
const nunjucks = require('nunjucks');
const stripe = require('stripe')('REMOVED_SECRET');
const stripeWebhookSecret = 'REMOVED_SECRET';

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://cyftasxlrzuynzbrfgkd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5ZnRhc3hscnp1eW56YnJmZ2tkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgwMzUzMTksImV4cCI6MjA2MzYxMTMxOX0.I56ZqFTfLgdwWlcozMVncGNGBZ4A2_5VpAbHeNmtDhA'
);

const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const app = express();
const PORT = 3000;

const USERS_FILE = path.join(__dirname, 'users.json');

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
app.use(session({
    secret: 'secreto-super-seguro',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, sameSite: 'lax' }
}));
app.use(express.static(path.join(__dirname, 'public')));

// --- Multer config para subir imágenes ---
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
});
const upload = multer({ storage: storage });

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
    const { username, password, name, email, photo } = req.body;
    if (!username || !password || !name || !email) {
        return res.status(400).json({ ok: false, error: 'Faltan campos obligatorios' });
    }
    let users = readUsers();
    if (users.find(u => u.username === username)) {
        return res.status(400).json({ ok: false, error: 'Usuario ya existe' });
    }
    const newUser = { username, password, name, email, photo: photo || '' };
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
            photo: user.photo || '', 
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
    photo: profile.photo_url || '',
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
    req.session.destroy(() => res.json({ ok: true }));
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
app.get('/messages/new', (req, res) => { res.render('messages/new', { lang: req.lang, user: req.session.user }); });
app.get('/messages/:conversationId', (req, res) => { res.render('messages/conversation', { lang: req.lang, user: req.session.user }); });
app.get('/docs/about', (req, res) => { res.render('docs/about', { lang: req.lang, user: req.session.user }); });
app.get('/docs/cookies', (req, res) => { res.render('docs/cookies', { lang: req.lang, user: req.session.user }); });
app.get('/docs/privacy', (req, res) => { res.render('docs/privacy', { lang: req.lang, user: req.session.user }); });
app.get('/docs/terms', (req, res) => { res.render('docs/terms', { lang: req.lang, user: req.session.user }); });

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
    res.json({ ok: true });
  } else {
    res.status(401).json({ ok: false });
  }
});

// --- Stripe Connect: Crear cuenta ---
app.post('/create-stripe-account', authenticateUser, async (req, res) => {
  const { userId, email } = req.body;
  try {
    const account = await stripe.accounts.create({
      type: 'express',
      email,
      capabilities: { transfers: { requested: true } }
    });
    await supabase.from('stripe_accounts').upsert({
      user_id: userId,
      stripe_account_id: account.id,
      status: 'pending'
    });
    res.json({ accountId: account.id });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- Stripe Connect: Enlace de onboarding ---
app.post('/create-account-link', authenticateUser, async (req, res) => {
  const { accountId, userId } = req.body;
  if (req.session.user.id !== userId) {
    return res.status(403).json({ error: 'Usuario no autorizado' });
  }
  try {
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: 'https://www.project-solidarity.com/reauth-stripe?account_id=' + accountId,
      return_url: 'https://www.project-solidarity.com/causes?stripe=success', // <-- Cambia aquí
      type: 'account_onboarding',
    });
    res.json({ url: accountLink.url });
  } catch (err) {
    res.status(500).json({ error: 'Error al generar enlace de verificación' });
  }
});

// --- Stripe: Estado de cuenta ---
app.get('/stripe-account-status/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const { data, error } = await supabase
      .from('stripe_accounts')
      .select('stripe_account_id, status')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return res.json({ hasAccount: false, status: 'none' });
    }

    // Verificar estado real en Stripe
    const account = await stripe.accounts.retrieve(data.stripe_account_id);
    const status = account.charges_enabled ? 'active' : 'pending';
    
    // Actualizar estado si cambió
    if (status !== data.status) {
      await supabase
        .from('stripe_accounts')
        .update({ status })
        .eq('user_id', userId);
    }

    res.json({ hasAccount: true, status });
  } catch (error) {
    console.error('Error checking Stripe account:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Endpoint para crear cuenta Stripe y borrador de causa
app.post('/create-stripe-account', async (req, res) => {
  try {
    const { userId, email, causeData } = req.body;
    
    // Crear cuenta en Stripe
    const account = await stripe.accounts.create({
      type: 'express',
      email: email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });

    // Guardar en Supabase
    const { error } = await supabase
      .from('stripe_accounts')
      .upsert({
        user_id: userId,
        stripe_account_id: account.id,
        status: 'pending',
      });

    if (error) throw error;

    // Guardar borrador de causa
    const { data: draft, error: draftError } = await supabase
      .from('cause_drafts')
      .insert({
        user_id: userId,
        draft_data: causeData,
        stripe_account_id: account.id
      })
      .select()
      .single();

    if (draftError) throw draftError;

    // Generar enlace de onboarding
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${process.env.FRONTEND_URL}/causes?stripe_error=refresh`,
      return_url: `${process.env.FRONTEND_URL}/causes?stripe=success&draft_id=${draft.id}`,
      type: 'account_onboarding',
    });

    res.json({ accountId: account.id, returnUrl: accountLink.url });
  } catch (error) {
    console.error('Error creating Stripe account:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para crear sesión de pago
app.post('/create-checkout-session', async (req, res) => {
  try {
    const { causeId, amount, userId, creatorId } = req.body;
    
    // Obtener cuenta Stripe del creador
    const { data: stripeAccount } = await supabase
      .from('stripe_accounts')
      .select('stripe_account_id')
      .eq('user_id', creatorId)
      .single();

    if (!stripeAccount) {
      throw new Error('Creator has no Stripe account');
    }

    // Crear sesión de pago
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: {
            name: `Donación a causa: ${causeId}`,
          },
          unit_amount: amount * 100, // en céntimos
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL}/causes/${causeId}?donation=success`,
      cancel_url: `${process.env.FRONTEND_URL}/causes/${causeId}`,
      payment_intent_data: {
        application_fee_amount: Math.round(amount * 0.02 * 100), // 2% fee
        transfer_data: {
          destination: stripeAccount.stripe_account_id,
        },
      },
    });

    // Registrar sesión en DB
    await supabase
      .from('donation_sessions')
      .insert({
        session_id: session.id,
        cause_id: causeId,
        user_id: userId,
        amount: amount,
        status: 'pending'
      });

    res.json({ sessionId: session.id });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Webhook para eventos de Stripe
app.post('/stripe-webhook', bodyParser.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Manejar evento de pago exitoso
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    
    // Actualizar sesión en DB
    await supabase
      .from('donation_sessions')
      .update({ status: 'completed' })
      .eq('session_id', session.id);

    // Actualizar causa
    const { data: donation } = await supabase
      .from('donation_sessions')
      .select('cause_id, amount')
      .eq('session_id', session.id)
      .single();

    if (donation) {
      await supabase.rpc('increment_cause_raised', {
        cause_id: donation.cause_id,
        amount: donation.amount
      });
    }
  }

  res.json({ received: true });
});

// --- Guardar borrador de causa ---
app.post('/save-cause-draft', authenticateUser, async (req, res) => {
  try {
    const { draftData } = req.body;
    const { data, error } = await supabase
      .from('cause_drafts')
      .upsert({
        user_id: req.session.user.id,
        draft_data: draftData,
        updated_at: new Date()
      })
      .select()
      .single();
    if (error) throw error;
    res.json({ draftId: data.id });
  } catch (err) {
    res.status(500).json({ error: 'Error guardando borrador' });
  }
});

// --- Recuperar borrador de causa ---
app.get('/get-user-draft/:userId', authenticateUser, async (req, res) => {
  const userId = req.params.userId;
  if (req.session.user.id !== userId) {
    return res.status(403).json({ error: 'Usuario no autorizado' });
  }
  try {
    const { data: draft, error } = await supabase
      .from('cause_drafts')
      .select('id, draft_data')
      .eq('user_id', userId)
      .single();
    if (error) throw error;
    res.json({ draft });
  } catch (err) {
    res.status(500).json({ error: 'Error recuperando borrador' });
  }
});

// --- Eliminar borrador de causa ---
app.delete('/delete-draft/:draftId', authenticateUser, async (req, res) => {
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

// --- Crear causa final desde borrador ---
app.post('/create-final-cause', authenticateUser, async (req, res) => {
  try {
    const { draftId } = req.body;
    const { data: draft, error: draftError } = await supabase
      .from('cause_drafts')
      .select('draft_data')
      .eq('id', draftId)
      .single();
    if (draftError || !draft) throw draftError || new Error('Borrador no encontrado');
    const causeData = draft.draft_data;
    const { data: newCause, error: causeError } = await supabase
      .from('causes')
      .insert([{ ...causeData, user_id: req.session.user.id, status: 'active', raised: 0, donors: 0 }])
      .select()
      .single();
    if (causeError) throw causeError;
    await supabase.from('cause_drafts').delete().eq('id', draftId);
    res.json({ cause: newCause });
  } catch (err) {
    res.status(500).json({ error: 'Error creando causa final' });
  }
});

// --- Ruta para 404 - DEBE ESTAR AL FINAL ---
app.use((req, res) => {
    res.status(404).send('Página no encontrada');
});

app.listen(PORT, () => {
    console.log(`Servidor iniciado en http://localhost:${PORT}`);
});