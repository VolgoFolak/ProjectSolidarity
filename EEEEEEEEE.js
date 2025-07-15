require('dotenv').config();

const express = require('express');
const path = require('path');
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
// Detecta entorno y configura URLs y cookie de sesión
const isLocalhost = process.env.NODE_ENV !== 'production';
const corsOptions = {
  origin: isLocalhost ? 'http://localhost:3000' : 'https://www.project-solidarity.com',
  credentials: true,
};
app.use(require('cors')(corsOptions));

app.use(require('express-session')({
  secret: 'secreto-super-seguro',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: !isLocalhost,
    sameSite: isLocalhost ? 'lax' : 'none',
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000
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

// Stripe: Crear cuenta (mejorado)
app.post('/create-stripe-account', authenticateUser, async (req, res) => {
  try {
    const { userId, email } = req.body;
    // Verificar si ya existe cuenta
    const { data: existingAccount } = await supabase
      .from('stripe_accounts')
      .select()
      .eq('user_id', userId)
      .single();
    if (existingAccount) {
      return res.status(400).json({ error: 'El usuario ya tiene una cuenta Stripe' });
    }
    // Crear nueva cuenta
    const account = await stripe.accounts.create({
      type: 'express',
      email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true }
      }
    });
    // Guardar en Supabase
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

// --- Endpoint mejorado para crear enlace de onboarding Stripe ---
app.post('/create-account-link', authenticateUser, async (req, res) => {
  try {
    const { accountId, returnUrl, refreshUrl } = req.body;
    
    // Validaciones
    if (!accountId) {
      return res.status(400).json({ error: 'Se requiere accountId' });
    }

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${FRONTEND_URL}/reauth-stripe?user_id=${userId}`,
      return_url: `${FRONTEND_URL}/causes/stripe-callback?user_id=${userId}`,
      type: 'account_onboarding',
    });

    if (!accountLink.url) {
      throw new Error('Stripe no devolvió URL de onboarding');
    }

    res.json({ url: accountLink.url });
    
  } catch (error) {
    console.error('Error creating account link:', error);
    res.status(500).json({ 
      error: 'Error al generar enlace de verificación',
      details: error.message 
    });
  }
});

// Stripe: Estado de cuenta (mejorado)
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
        // Registrar donación en la base de datos
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
      // Puedes añadir más eventos si lo necesitas
    }

    res.json({ received: true });
  } catch (err) {
    console.error(`Webhook Error: ${err.message}`);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
});

// --- Guardar borrador de causa ---
app.post('/save-cause-draft', authenticateUser, async (req, res) => {
  try {
    const { draftData, stripeAccountId, stripeEnabled = false } = req.body;
    const userId = req.session.user.id;

    // Validación básica
    if (!draftData || !userId) {
      return res.status(400).json({ error: 'Datos incompletos' });
    }

    // Verificar si ya existe un borrador para este usuario
    const { data: existingDraft } = await supabase
      .from('cause_drafts')
      .select('id')
      .eq('user_id', userId)
      .single();

    let result;
    if (existingDraft) {
      // Actualizar borrador existente
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
      // Crear nuevo borrador
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
    
    // 1. Obtener el borrador
    const { data: draft, error: draftError } = await supabase
      .from('cause_drafts')
      .select('*')
      .eq('id', draftId)
      .single();

    if (draftError || !draft) {
      return res.status(404).json({ error: 'Borrador no encontrado' });
    }

    // 2. Verificar que pertenece al usuario
    if (draft.user_id !== req.session.user.id) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    // 3. Crear la causa final
    const { data: newCause, error: causeError } = await supabase
      .from('causes')
      .insert([{ 
        ...draft.draft_data,
        user_id: req.session.user.id,
        status: 'active',
        stripe_enabled: !!draft.stripe_account_id,
        stripe_account_id: draft.stripe_account_id
      }])
      .select()
      .single();

    if (causeError) throw causeError;

    // 4. Eliminar borrador
    await supabase.from('cause_drafts').delete().eq('id', draftId);

    res.json({ cause: newCause });

  } catch (error) {
    console.error('Error creating final cause:', error);
    res.status(500).json({ 
      error: 'Error creando causa final',
      details: error.message 
    });
  }
});

// --- Stripe: Crear cuenta y onboarding ---
app.post('/api/stripe/create-account', authenticateUser, async (req, res) => {
  try {
    const { userId, email, causeData } = req.body;

    // 1. Crear cuenta Stripe
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

    // 2. Crear enlace de onboarding
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${FRONTEND_URL}/causes?stripe_error=refresh`,
      return_url: `${FRONTEND_URL}/api/causes/stripe-callback?user_id=${userId}`,
      type: 'account_onboarding'
    });

    // 3. Guardar en Supabase
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
    res.status(500).json({ error: error.message });
  }
});

// --- Guardar borrador de causa ---
app.post('/api/causes/save-draft', authenticateUser, async (req, res) => {
  try {
    const { userId, causeData, stripeAccountId, stripeEnabled = false } = req.body;

    // Subir imagen si existe
    let photoUrl = null;
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

    // Guardar en Supabase
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
    console.error('Error saving draft:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- Callback de Stripe ---
app.get('/api/causes/stripe-callback', authenticateUser, async (req, res) => {
  try {
    const { user_id: userId } = req.query;

    // 1. Verificar que el usuario está autenticado
    if (!req.session.user || req.session.user.id !== userId) {
      return res.redirect('/causes?stripe_error=unauthorized');
    }

    // 2. Obtener la cuenta Stripe del usuario
    const { data: account, error: accountError } = await supabase
      .from('stripe_accounts')
      .select('stripe_account_id')
      .eq('user_id', userId)
      .single();

    if (accountError || !account) {
      return res.redirect('/causes?stripe_error=no_account');
    }

    // 3. Verificar estado con Stripe
    const stripeAccount = await stripe.accounts.retrieve(account.stripe_account_id);
    if (!stripeAccount.charges_enabled || !stripeAccount.details_submitted) {
      return res.redirect('/causes?stripe_error=not_verified');
    }

    // 4. Actualizar estado en Supabase
    await supabase
      .from('stripe_accounts')
      .update({
        status: 'active',
        charges_enabled: true,
        details_submitted: true
      })
      .eq('user_id', userId);

    // 5. Buscar borrador pendiente
    const { data: draft } = await supabase
      .from('cause_drafts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!draft) {
      return res.redirect('/causes?stripe_error=no_draft');
    }

    // 6. Crear causa final
    const { data: cause, error: createError } = await supabase
      .from('causes')
      .insert([{
        ...draft.draft_data,
        user_id: userId,
        status: 'active',
        stripe_enabled: true,
        stripe_account_id: draft.stripe_account_id
      }])
      .select()
      .single();

    if (createError) throw createError;

    // 7. Eliminar borrador
    await supabase.from('cause_drafts').delete().eq('id', draft.id);

    // 8. Redirigir con éxito
    res.redirect(`/causes/${cause.id}?stripe=success`);

  } catch (error) {
    console.error('Error in Stripe callback:', error);
    res.redirect('/causes?stripe_error=internal_error');
  }
});

// --- Endpoint de diagnóstico Stripe ---
app.get('/api/stripe/debug/:userId', authenticateUser, async (req, res) => {
  try {
    const userId = req.params.userId;
    // 1. Obtener cuenta de Supabase
    const { data: account, error } = await supabase
      .from('stripe_accounts')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !account) {
      return res.json({ error: 'No Stripe account found in database' });
    }

    // 2. Verificar en Stripe
    const stripeAccount = await stripe.accounts.retrieve(account.stripe_account_id);
    res.json({
      supabaseData: account,
      stripeData: {
        id: stripeAccount.id,
        charges_enabled: stripeAccount.charges_enabled,
        details_submitted: stripeAccount.details_submitted,
        requirements: stripeAccount.requirements,
        payouts_enabled: stripeAccount.payouts_enabled
      }
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- Ruta para 404 - DEBE ESTAR AL FINAL ---
app.use((req, res) => {
    res.status(404).send('Página no encontrada');
});

app.listen(PORT, () => {
    console.log(`Servidor iniciado en http://localhost:${PORT}`);
});

// Guardar borrador de causa
app.post('/api/causes/save-draft', authenticateUser, async (req, res) => {
  try {
    const { userId, causeData, stripeAccountId, stripeEnabled = false } = req.body;

    // Subir imagen si existe
    let photoUrl = null;
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

    // Guardar en Supabase
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
    console.error('Error saving draft:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- Stripe: Crear cuenta y enlace de onboarding ---
app.post('/api/stripe/create-account', authenticateUser, async (req, res) => {
  try {
    const { userId, email, causeData } = req.body;
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
      refresh_url: `${FRONTEND_URL}/causes?stripe_error=refresh`,
      return_url: `${FRONTEND_URL}/api/causes/stripe-callback?user_id=${userId}`,
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

// --- Stripe: Callback de onboarding ---
app.get('/api/causes/stripe-callback', authenticateUser, async (req, res) => {
  try {
    const { user_id: userId } = req.query;
    // 1. Verificar que el usuario está autenticado
    if (!req.session.user || req.session.user.id !== userId) {
      return res.redirect('/causes?stripe_error=unauthorized');
    }
    // 2. Obtener la cuenta Stripe del usuario
    const { data: accountRow } = await supabase
      .from('stripe_accounts')
      .select('stripe_account_id')
      .eq('user_id', userId)
      .single();
    const account = await stripe.accounts.retrieve(accountRow.stripe_account_id);
    // 3. Verificar estado con Stripe
    if (!account.charges_enabled || !account.details_submitted) {
      return res.redirect('/causes?stripe_error=not_verified');
    }
    // 4. Actualizar estado en Supabase
    await supabase
      .from('stripe_accounts')
      .update({ status: 'active' })
      .eq('user_id', userId);
    // 5. Obtener borrador y crear causa final
    const { data: draft } = await supabase
      .from('cause_drafts')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();
    if (!draft) {
      return res.redirect(`/causes?stripe_error=no_draft`);
    }
    const { data: newCause, error: createError } = await supabase
      .from('causes')
      .insert([{
        ...draft.draft_data,
        user_id: userId,
        status: 'active',
        stripe_enabled: true,
        stripe_account_id: draft.stripe_account_id
      }])
      .select('id')
      .single();
    if (createError) throw createError;
    // 6. Eliminar borrador
    await supabase
      .from('cause_drafts')
      .delete()
      .eq('id', draft.id);
    // 7. Redirigir con éxito
    res.redirect(`/causes?stripe=success&cause_id=${newCause.id}`);
  } catch (error) {
    res.redirect('/causes?stripe_error=internal');
  }
});

// --- Donación con Stripe Connect ---
app.post('/api/causes/create-donation', authenticateUser, async (req, res) => {
  try {
    const { causeId, amount, donorName, donorEmail } = req.body;
    
    // 1. Validar cantidad
    if (amount < 1) {
      return res.status(400).json({ error: 'Amount must be at least 1 EUR' });
    }

    // 2. Obtener información de la causa
    const { data: cause, error: causeError } = await supabase
      .from('causes')
      .select('stripe_account_id, title')
      .eq('id', causeId)
      .single();

    if (causeError || !cause || !cause.stripe_account_id) {
      return res.status(404).json({ error: 'Cause not found or not configured for payments' });
    }

    // 3. Crear sesión de pago
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: { 
            name: `Donación a: ${cause.title}`,
            description: 'Gracias por tu apoyo'
          },
          unit_amount: Math.round(amount * 100),
        },
        quantity: 1,
      }],
      mode: 'payment',
      payment_intent_data: {
        application_fee_amount: Math.round(amount * 0.02 * 100), // 2% fee
        transfer_data: { destination: cause.stripe_account_id },
      },
      metadata: {
        causeId,
        donorName,
        donorEmail
      },
      customer_email: donorEmail,
      success_url: `${req.headers.origin}/causes/${causeId}?donation=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin}/causes/${causeId}?donation=cancelled`,
    });

    res.json({ sessionId: session.id });
  } catch (error) {
    console.error('Donation error:', error);
    res.status(500).json({ 
      error: 'Error creating donation session',
      details: error.message 
    });
  }
});

// --- Stripe: Webhook para completar onboarding ---
app.get('/stripe/onboarding-complete', authenticateUser, async (req, res) => {
  const { account_id } = req.query;
  const userId = req.session.user.id;
  const account = await stripe.accounts.retrieve(account_id);
  if (!account.charges_enabled) {
    return res.redirect('/causes/create?error=stripe_not_ready');
  }
  const { data: pending } = await supabase
    .from('pending_onboardings')
    .select('draft_id')
    .eq('stripe_account_id', account_id)
    .eq('user_id', userId)
    .single();
  if (!pending) return res.redirect('/causes/create?error=no_draft_found');
  const { data: draft } = await supabase
    .from('cause_drafts')
    .select('*')
    .eq('id', pending.draft_id)
    .single();
  const { data: cause } = await supabase
    .from('causes')
    .insert([{
      ...draft.draft_data,
      user_id: userId,
      stripe_account_id: account_id,
      stripe_enabled: true,
      status: 'active'
    }])
    .select()
    .single();
  await supabase.from('pending_onboardings').delete().eq('draft_id', pending.draft_id);
  await supabase.from('cause_drafts').delete().eq('id', pending.draft_id);
  res.redirect(`/causes/${cause.id}?onboarding=success`);
});

// --- Iniciar onboarding de Stripe ---
app.post('/start-stripe-onboarding', authenticateUser, async (req, res) => {
  const { draftData, email } = req.body;
  // 1. Guardar borrador
  const { data: draft, error: draftError } = await supabase
    .from('cause_drafts')
    .insert([{ draft_data: draftData, user_id: req.session.user.id }])
    .select()
    .single();
  if (draftError) return res.status(500).json({ error: draftError.message });

  // 2. Crear cuenta Stripe
  const account = await stripe.accounts.create({
    type: 'express',
    email,
    metadata: { draft_id: draft.id, user_id: req.session.user.id }
  });

  // 3. Guardar onboarding pendiente
  await supabase.from('pending_onboardings').insert({
    user_id: req.session.user.id,
    draft_id: draft.id,
    stripe_account_id: account.id
  });

  // 4. Crear link de onboarding
  const accountLink = await stripe.accountLinks.create({
    account: account.id,
    refresh_url: `${process.env.FRONTEND_URL}/causes/create?draft_id=${draft.id}`,
    return_url: `${process.env.FRONTEND_URL}/stripe/onboarding-complete?account_id=${account.id}`,
    type: 'account_onboarding'
  });

  res.json({ url: accountLink.url });
});