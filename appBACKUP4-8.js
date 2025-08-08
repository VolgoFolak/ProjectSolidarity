require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const nunjucks = require('nunjucks');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const app = express();
const PORT = process.env.PORT || 3000;

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

// Detecta entorno y configura URLs y cookie de sesión
const isLocalhost = process.env.NODE_ENV !== 'production';
const frontendUrl = isLocalhost ? 'http://localhost:3000' : process.env.FRONTEND_URL;

const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? [process.env.FRONTEND_URL, 'https://www.project-solidarity.com']
    : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
};
app.use(require('cors')(corsOptions));

app.use(require('express-session')({
  secret: process.env.SESSION_SECRET || 'secreto-super-seguro',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: !isLocalhost,
    sameSite: isLocalhost ? 'lax' : 'none',
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    domain: isLocalhost ? undefined : '.project-solidarity.com'
  }
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
app.get('/', (req, res) => {
  res.render('index', {
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseKey: process.env.SUPABASE_KEY
  });
});
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

// --- RUTAS STRIPE (CORREGIDAS) ---

// Estado de cuenta Stripe (SIN autenticación para permitir verificaciones públicas)
app.get('/stripe-account-status/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    
    const { data: accountRow } = await supabase
      .from('stripe_accounts')
      .select('stripe_account_id, status')
      .eq('user_id', userId)
      .single();
      
    if (!accountRow) {
      return res.json({ hasAccount: false, status: 'none' });
    }
    
    const account = await stripe.accounts.retrieve(accountRow.stripe_account_id);
    res.json({
      hasAccount: true,
      status: account.charges_enabled ? 'active' : 'pending',
      detailsSubmitted: account.details_submitted
    });
  } catch (error) {
    console.error('Error checking Stripe status:', error);
    res.status(500).json({ error: 'Error verificando estado de Stripe' });
  }
});

// Crear cuenta Stripe (SIN autenticación para el proceso de onboarding)
app.post('/api/stripe/create-account', async (req, res) => {
  try {
    const { userId, email, causeData } = req.body;

    if (!userId || !email) {
      return res.status(400).json({ error: 'Se requieren userId y email' });
    }

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
      return_url: `${frontendUrl}/api/causes/stripe-callback?user_id=${userId}`, // ✅ CORREGIDO
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
    console.error('Error creating Stripe account:', error);
    res.status(500).json({ 
      error: 'Error creando cuenta Stripe',
      details: error.message 
    });
  }
});

// Crear enlace de cuenta (SIN autenticación)
app.post('/api/stripe/create-account-link', async (req, res) => {
  try {
    const { accountId } = req.body;
    
    if (!accountId) {
      return res.status(400).json({ error: 'Se requiere accountId' });
    }
    
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${frontendUrl}/causes?stripe_refresh=true`,
      return_url: `${frontendUrl}/causes?stripe_success=true&account_id=${accountId}`,
      type: 'account_onboarding',
    });
    
    res.json({ url: accountLink.url });
  } catch (err) {
    console.error('Error creating account link:', err);
    res.status(500).json({ error: err.message });
  }
});

// --- Stripe: Webhook ---
app.post('/webhook', bodyParser.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, stripeWebhookSecret);

    switch (event.type) {
      case 'account.updated': {
        const account = event.data.object;
        await supabase
          .from('stripe_accounts')
          .update({
            status: account.charges_enabled ? 'active' : 'pending',
            details_submitted: account.details_submitted,
            charges_enabled: account.charges_enabled
          })
          .eq('stripe_account_id', account.id);
        break;
      }
      case 'checkout.session.completed': {
        const session = event.data.object;
        const causeId = session.success_url?.split('/causes/')[1]?.split('?')[0];
        if (causeId) {
          await supabase
            .from('donations')
            .insert([{
              cause_id: causeId,
              amount: session.amount_total / 100,
              stripe_session_id: session.id,
              donor_email: session.customer_details?.email || null,
              created_at: new Date()
            }]);
        }
        break;
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error(`Webhook Error: ${err.message}`);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
});

// --- RUTAS DE BORRADORES (CON autenticación) ---

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
    console.error('Error saving draft:', error);
    res.status(500).json({ 
      error: 'Error guardando borrador',
      details: error.message 
    });
  }
});

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

app.post('/create-final-cause', authenticateUser, async (req, res) => {
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

    if (causeError) {
      console.error('Error RLS al crear causa:', causeError);
      throw new Error(causeError.message);
    }

    await supabase.from('cause_drafts').delete().eq('id', draftId);
    await supabase.from('pending_onboardings').delete().eq('draft_id', draftId);

    res.json({ 
      success: true,
      cause: newCause,
      redirectUrl: `/causes/${newCause.id}?creation=success`
    });

  } catch (error) {
    console.error('Error creating final cause:', error);
    res.status(500).json({ 
      error: 'Error creando causa final',
      details: error.message,
      code: error.code
    });
  }
});

// --- Ruta para 404 - DEBE ESTAR AL FINAL ---
app.use((req, res) => {
    res.status(404).send('Página no encontrada');
});

app.listen(PORT, () => {
    console.log(`Servidor iniciado en http://localhost:${PORT}`);
});

// Reemplazar la ruta callback existente:
app.get('/api/causes/stripe-callback', async (req, res) => {
  try {
    const { user_id } = req.query;
    
    if (!user_id) {
      return res.redirect('/causes?stripe_error=no_user');
    }

    // Verificar estado de la cuenta Stripe
    const { data: stripeAccount } = await supabase
      .from('stripe_accounts')
      .select('stripe_account_id')
      .eq('user_id', user_id)
      .single();

    if (!stripeAccount) {
      return res.redirect('/causes?stripe_error=no_account');
    }

    // Verificar con Stripe API
    const account = await stripe.accounts.retrieve(stripeAccount.stripe_account_id);
    
    if (!account.charges_enabled || !account.details_submitted) {
      return res.redirect('/causes?stripe_error=not_verified');
    }

    // Redirigir SOLO al modal de éxito, SIN crear causa automáticamente
    res.redirect('/causes?stripe=success&onboarding_complete=true');

  } catch (error) {
    console.error('Error in Stripe callback:', error);
    res.redirect('/causes?stripe_error=internal_error');
  }
});

// API para crear causa final (después del onboarding exitoso)
app.post('/api/causes/create-final', authenticateUser, async (req, res) => {
  try {
    const { causeData } = req.body;
    const userId = req.session.user.id;

    if (!causeData || !userId) {
      return res.status(400).json({ error: 'Datos incompletos' });
    }

    // Verificar si el usuario tiene Stripe configurado
    const { data: stripeAccount } = await supabase
      .from('stripe_accounts')
      .select('stripe_account_id, status')
      .eq('user_id', userId)
      .single();

    let stripeEnabled = false;
    let stripeAccountId = null;

    if (stripeAccount?.stripe_account_id) {
      const account = await stripe.accounts.retrieve(stripeAccount.stripe_account_id);
      stripeEnabled = account.charges_enabled && account.details_submitted;
      stripeAccountId = stripeEnabled ? stripeAccount.stripe_account_id : null;
    }

    // Crear causa
    const { data: newCause, error: causeError } = await supabase
      .from('causes')
      .insert([{
        ...causeData,
        user_id: userId,
        status: 'active',
        stripe_enabled: stripeEnabled,
        stripe_account_id: stripeAccountId,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (causeError) {
      console.error('Error creating cause:', causeError);
      throw new Error(causeError.message);
    }

    // Crear membresía del fundador
    await supabase
      .from('causes_members')
      .insert({
        user_id: userId,
        cause_id: newCause.id,
        role: 'founder',
        status: 'active'
      });

    res.json({
      success: true,
      cause: newCause,
      stripeEnabled
    });

  } catch (error) {
    console.error('Error creating final cause:', error);
    res.status(500).json({
      error: 'Error creando causa',
      details: error.message
    });
  }
});

// Agregar rutas API faltantes ANTES de app.listen():

// Ruta para verificar sesión
app.get('/api/check-session', (req, res) => {
  if (req.session && req.session.user) {
    res.json({ 
      authenticated: true, 
      user: req.session.user 
    });
  } else {
    res.status(401).json({ 
      authenticated: false, 
      message: 'No authenticated' 
    });
  }
});

// Ruta para obtener causas
app.get('/api/causes', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('causes')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(data || []);
  } catch (error) {
    console.error('Error al obtener causas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});