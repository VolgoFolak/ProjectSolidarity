require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const fs = require('fs');
const multer = require('multer');
const nunjucks = require('nunjucks');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');
const cookieParser = require('cookie-parser'); // ✅ AÑADIR ESTO
const app = express();
const PORT = 3000;

const USERS_FILE = path.join(__dirname, 'users.json');

// Configuración de Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Middleware para parsear JSON
app.use(express.json());
app.use(cookieParser()); // ✅ AÑADIR ESTO ANTES DEL MIDDLEWARE DE IDIOMA

// Sesiones
app.use(session({
    secret: 'secreto-super-seguro',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, sameSite: 'lax' }
}));

// Servir archivos estáticos
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
    console.log('No token recibido');
    return res.status(400).json({ error: 'No token' });
  }

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    console.log('Token inválido:', error);
    return res.status(401).json({ error: 'Token inválido' });
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, username, first_name, email, photo_url')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    console.log('Perfil no encontrado:', profileError);
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

// --- Configura nunjucks ---
nunjucks.configure('views', {
  autoescape: true,
  express: app
});
app.set('view engine', 'njk');

// ✅ MIDDLEWARE DE DETECCIÓN DE IDIOMA
const detectLanguage = require('./middleware/detectlanguage');
app.use(detectLanguage);

// ✅ RUTAS PARA CAMBIAR IDIOMA
app.post('/set-language', (req, res) => {
  const { lang } = req.body;
  const supportedLangs = ['es', 'en', 'fr', 'de', 'pt', 'it', 'nl', 'pl', 'ru', 'sv', 'no', 'en-US', 'ja', 'ko'];
  
  if (supportedLangs.includes(lang)) {
    res.cookie('userLang', lang, { 
      maxAge: 31536000000, // 1 año
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

// ✅ RUTAS PRINCIPALES - CON DETECCIÓN DE IDIOMA (CORREGIDAS)
app.get('/', (req, res) => {
  res.render('index', { 
    lang: req.lang,
    user: req.session.user  // ✅ CORREGIDO: req.session.user
  });
});

app.get('/login', (req, res) => {
  res.render('auth/login', {
    lang: req.lang
  });
});

app.get('/register', (req, res) => {
  res.render('auth/register', {
    lang: req.lang
  });
});

app.get('/causes', (req, res) => {
  res.render('causes/index', {
    lang: req.lang,
    user: req.session.user
  });
});

app.get('/causes/create', (req, res) => {
    res.render('causes/create', {
        lang: req.lang,
        user: req.session.user
    });
});

app.get('/causes/:id', (req, res) => {
  try {
    const causeId = req.params.id;
    console.log('📍 Solicitando causa con ID:', causeId);
    res.render('causes/index', { 
      title: 'Causa - Solidarity',
      lang: req.lang,
      user: req.session.user
    });
  } catch (error) {
    console.error('❌ Error en ruta /causes/:id:', error);
    res.status(500).send('Error del servidor');
  }
});

app.get('/tasks', (req, res) => {
  res.render('tasks/index', {
    lang: req.lang,
    user: req.session.user
  });
});

app.get('/tasks/create', (req, res) => {
    res.render('tasks/create', {
        lang: req.lang,
        user: req.session.user
    });
});

app.get('/tasks/:id', (req, res) => {
  try {
    const taskId = req.params.id;
    console.log('📍 Solicitando tarea con ID:', taskId);
    res.render('tasks/index', { 
      title: 'Tarea - Solidarity',
      lang: req.lang,
      user: req.session.user
    });
  } catch (error) {
    console.error('❌ Error en ruta /tasks/:id:', error);
    res.status(500).send('Error del servidor');
  }
});

app.get('/tarea/:id', (req, res) => {
  try {
    const taskId = req.params.id;
    console.log('📍 Solicitando tarea con ID (español):', taskId);
    res.render('tasks/index', { 
      title: 'Tarea - Solidarity',
      lang: req.lang,
      user: req.session.user
    });
  } catch (error) {
    console.error('❌ Error en ruta /tarea/:id:', error);
    res.status(500).send('Error del servidor');
  }
});

app.get('/volunteering', (req, res) => {
  res.render('volunteering/index', {
    lang: req.lang,
    user: req.session.user
  });
});

app.get('/volunteering/create', (req, res) => {
    res.render('volunteering/create', {
        lang: req.lang,
        user: req.session.user
    });
});

app.get('/volunteering/:id', (req, res) => {
  try {
    const volunteeringId = req.params.id;
    console.log('📍 Solicitando voluntariado con ID:', volunteeringId);
    res.render('volunteering/index', { 
      title: 'Voluntariado - Solidarity',
      lang: req.lang,
      user: req.session.user
    });
  } catch (error) {
    console.error('❌ Error en ruta /volunteering/:id:', error);
    res.status(500).send('Error del servidor');
  }
});

app.get('/voluntariado/:id', (req, res) => {
  try {
    const volunteeringId = req.params.id;
    console.log('📍 Solicitando voluntariado con ID (español):', volunteeringId);
    res.render('volunteering/index', { 
      title: 'Voluntariado - Solidarity',
      lang: req.lang,
      user: req.session.user
    });
  } catch (error) {
    console.error('❌ Error en ruta /voluntariado/:id:', error);
    res.status(500).send('Error del servidor');
  }
});

app.get('/challenges', (req, res) => {
  res.render('challenges/index', {
    lang: req.lang,
    user: req.session.user
  });
});

app.get('/challenges/:id', (req, res) => {
  try {
    const challengeId = req.params.id;
    console.log('📍 Solicitando desafío con ID:', challengeId);
    res.render('challenges/index', { 
      title: 'Desafío - Solidarity',
      lang: req.lang,
      user: req.session.user
    });
  } catch (error) {
    console.error('❌ Error en ruta /challenges/:id:', error);
    res.status(500).send('Error del servidor');
  }
});

app.get('/reto/:id', (req, res) => {
  try {
    const challengeId = req.params.id;
    console.log('📍 Solicitando reto con ID (español):', challengeId);
    res.render('challenges/index', { 
      title: 'Reto - Solidarity',
      lang: req.lang,
      user: req.session.user
    });
  } catch (error) {
    console.error('❌ Error en ruta /reto/:id:', error);
    res.status(500).send('Error del servidor');
  }
});

app.get('/teams', (req, res) => {
  res.render('teams/index', {
    lang: req.lang,
    user: req.session.user
  });
});

app.get('/teams/:id', (req, res) => {
  try {
    const teamId = req.params.id;
    console.log('📍 Solicitando equipo con ID:', teamId);
    res.render('teams/index', { 
      title: 'Equipo - Solidarity',
      lang: req.lang,
      user: req.session.user
    });
  } catch (error) {
    console.error('❌ Error en ruta /teams/:id:', error);
    res.status(500).send('Error del servidor');
  }
});

app.get('/equipo/:id', (req, res) => {
  try {
    const teamId = req.params.id;
    console.log('📍 Solicitando equipo con ID (español):', teamId);
    res.render('teams/index', { 
      title: 'Equipo - Solidarity',
      lang: req.lang,
      user: req.session.user
    });
  } catch (error) {
    console.error('❌ Error en ruta /equipo/:id:', error);
    res.status(500).send('Error del servidor');
  }
});

app.get('/myteams', (req, res) => {
    res.render('myteams/myteams', {
        lang: req.lang,
        user: req.session.user
    });
});

app.get('/takeaction', (req, res) => {
  res.render('takeaction/index', {
    lang: req.lang,
    user: req.session.user
  });
});

app.get('/ranking', (req, res) => {
  res.render('ranking/index', {
    lang: req.lang,
    user: req.session.user
  });
});

app.get('/profile', (req, res) => {
  res.render('profile/index', {
    lang: req.lang,
    user: req.session.user
  });
});

app.get('/editprofile', (req, res) => {
    res.render('profile/editprofile', {
        lang: req.lang,
        user: req.session.user
    });
});

app.get('/profile/myactivities', (req, res) => {
    res.render('profile/myactivities', {
        lang: req.lang,
        user: req.session.user
    });
});

app.get('/maps', (req, res) => {
  res.render('maps/index', {
    lang: req.lang,
    user: req.session.user
  });
});

app.get('/members', (req, res) => {
  res.render('members/members', {
    lang: req.lang,
    user: req.session.user
  });
});

app.get('/messages', (req, res) => {
  res.render('messages/index', {
    lang: req.lang,
    user: req.session.user
  });
});

app.get('/messages/new', (req, res) => {
    res.render('messages/new', {
        lang: req.lang,
        user: req.session.user
    });
});

app.get('/messages/:conversationId', (req, res) => {
    res.render('messages/conversation', {
        lang: req.lang,
        user: req.session.user
    });
});

// ✅ DOCS ROUTES
app.get('/docs/about', (req, res) => {
    res.render('docs/about', {
        lang: req.lang,
        user: req.session.user
    });
});

app.get('/docs/cookies', (req, res) => {
    res.render('docs/cookies', {
        lang: req.lang,
        user: req.session.user
    });
});

app.get('/docs/privacy', (req, res) => {
    res.render('docs/privacy', {
        lang: req.lang,
        user: req.session.user
    });
});

app.get('/docs/terms', (req, res) => {
    res.render('docs/terms', {
        lang: req.lang,
        user: req.session.user
    });
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
    res.json({ ok: true });
  } else {
    res.status(401).json({ ok: false });
  }
});

// --- STRIPE ROUTES ---
app.post('/connect-account', async (req, res) => {
  const { userId, email } = req.body;
  try {
    const account = await stripe.accounts.create({
      type: 'express',
      email,
      capabilities: { transfers: { requested: true } }
    });
    res.json({ accountId: account.id });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/connect-onboarding', async (req, res) => {
  const { accountId } = req.body;
  try {
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: 'https://tusitio.com/stripe/refresh',
      return_url: 'https://tusitio.com/stripe/return',
      type: 'account_onboarding',
    });
    res.json({ url: accountLink.url });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/donate', async (req, res) => {
  const { amount, causeId, creatorStripeAccountId, donorEmail } = req.body;
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: { name: `Donación a causa #${causeId}` },
          unit_amount: amount * 100,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: 'https://tusitio.com/donacion-exitosa',
      cancel_url: 'https://tusitio.com/donacion-cancelada',
      payment_intent_data: {
        application_fee_amount: 100,
        transfer_data: {
          destination: creatorStripeAccountId,
        },
      },
      customer_email: donorEmail,
    });
    res.json({ url: session.url });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/impact-points', async (req, res) => {
  const { userId, points, communityId, weekly } = req.body;

  let updateObj = { impact_points: supabase.rpc('add_points', { user_id: userId, points }) };

  if (weekly) {
    updateObj.weekly_points = supabase.rpc('add_weekly_points', { user_id: userId, points });
  }

  if (communityId) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('community_points')
      .eq('id', userId)
      .single();

    let communityPoints = profile?.community_points || {};
    communityPoints[communityId] = (communityPoints[communityId] || 0) + points;

    updateObj.community_points = communityPoints;
  }

  await supabase
    .from('profiles')
    .update(updateObj)
    .eq('id', userId);

  res.json({ success: true });
});

// --- Ruta para 404 - DEBE ESTAR AL FINAL ---
app.use((req, res) => {
    res.status(404).send('Página no encontrada');
});

app.listen(PORT, () => {
    console.log(`Servidor iniciado en http://localhost:${PORT}`);
});