require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const nunjucks = require('nunjucks');
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const session = require('express-session');
const cors = require('cors');
const winston = require('winston');
const app = express();
const PORT = 3000;

// --- Logging estructurado ---
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// --- i18n para mensajes ---
const i18n = {
  es: {
    stripeError: 'Error con Stripe: {error}',
    donationSuccess: '¡Donación exitosa!',
    errorGeneric: 'Algo salió mal',
    forbidden: 'Acceso prohibido'
  },
  en: {
    stripeError: 'Stripe error: {error}',
    donationSuccess: 'Donation successful!',
    errorGeneric: 'Something went wrong',
    forbidden: 'Forbidden'
  }
};
function t(key, lang = 'es', params = {}) {
  let text = i18n[lang][key] || key;
  Object.keys(params).forEach(k => {
    text = text.replace(`{${k}}`, params[k]);
  });
  return text;
}

// --- Cookies seguras ---
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    domain: process.env.NODE_ENV === 'production' ? '.project-solidarity.com' : undefined
  }
}));

// --- CORS ---
const allowedOrigins = [
  'http://localhost:3000',
  'https://www.project-solidarity.com'
];
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// --- Multer para imágenes ---
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

// --- Nunjucks ---
nunjucks.configure('views', { autoescape: true, express: app });
app.set('view engine', 'njk');

// --- Middleware de autenticación ---
const authenticateUser = (req, res, next) => {
  if (!req.session.user) return res.status(401).json({ error: 'Acceso no autorizado' });
  next();
};

// --- Middleware de idioma ---
// Si tienes el archivo: ./middleware/detectlanguage.js
const detectLanguage = require('./middleware/detectlanguage');
app.use(detectLanguage);

// --- Validación mejorada de causa ---
function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}
function validateCauseData(data) {
  const errors = [];
  if (!data.title || data.title.length < 5) errors.push('El título debe tener al menos 5 caracteres');
  if (data.goal < 10) errors.push('La meta mínima es de 10€');
  if (data.beneficiaries < 1) errors.push('Debe haber al menos 1 beneficiario');
  if (data.photo_url && !isValidUrl(data.photo_url)) errors.push('La URL de la imagen no es válida');
  return errors.length ? errors : null;
}

// --- Wrapper para manejo de errores en endpoints ---
const asyncHandler = fn => (req, res, next) => 
  Promise.resolve(fn(req, res, next)).catch(next);

// --- Stripe ---
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// --- Seguridad adicional para Stripe Webhook ---
const stripeIps = ['54.187.174.169', '54.187.205.235', '54.187.216.72'];
app.post('/webhook', bodyParser.raw({type: 'application/json'}), asyncHandler(async (req, res) => {
  if (!stripeIps.includes(req.ip)) {
    logger.warn('Intento de webhook desde IP no autorizada', { ip: req.ip });
    return res.status(403).send(t('forbidden', req.lang || 'es'));
  }
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      req.headers['stripe-signature'],
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    logger.error('Error en webhook Stripe', { error: err.message });
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {
    case 'account.updated':
      await updateStripeAccountStatus(event.data.object);
      break;
    case 'checkout.session.completed':
      await handleDonation(event.data.object);
      break;
    case 'charge.refunded':
      await handleRefund(event.data.object);
      break;
    case 'account.application.deauthorized':
      await handleDeauth(event.data.object);
      break;
    default:
      logger.info(`Unhandled event type: ${event.type}`);
  }
  res.json({ received: true });
}));

// --- Estandarización de rutas Stripe y mejoras de seguridad/validación ---
const STRIPE_WEBHOOK_IPS = ['54.187.174.169', '54.187.205.235', '54.187.216.72'];
const BACKEND_URL = process.env.BACKEND_URL || `http://localhost:${PORT}`;
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://www.project-solidarity.com';

// Crear cuenta Stripe
app.post('/api/stripe/accounts', authenticateUser, async (req, res) => {
  try {
    const { email } = req.session.user;
    const userId = req.session.user.id;

    // Verificar si ya existe
    const { data: existing } = await supabase
      .from('stripe_accounts')
      .select('stripe_account_id')
      .eq('user_id', userId)
      .single();

    if (existing?.stripe_account_id) {
      return res.json({ accountId: existing.stripe_account_id });
    }

    const account = await stripe.accounts.create({
      type: 'express',
      email,
      capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
      business_profile: { product_description: 'Recaudación para causas solidarias', url: FRONTEND_URL }
    });

    await supabase.from('stripe_accounts').upsert({
      user_id: userId,
      stripe_account_id: account.id,
      status: 'pending'
    });

    res.json({ accountId: account.id });
  } catch (error) {
    logger.error('Stripe account creation error', { error: error.message, stack: error.stack, userId: req.session.user?.id });
    res.status(500).json({ error: error.message });
  }
});

// Iniciar onboarding Stripe
app.post('/api/stripe/onboarding', authenticateUser, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { data: accountRow } = await supabase
      .from('stripe_accounts')
      .select('stripe_account_id')
      .eq('user_id', userId)
      .single();

    if (!accountRow) throw new Error('No Stripe account found');

    const accountLink = await stripe.accountLinks.create({
      account: accountRow.stripe_account_id,
      refresh_url: `${FRONTEND_URL}/onboarding-retry`,
      return_url: `${BACKEND_URL}/api/stripe/callback?user_id=${userId}&account_id=${accountRow.stripe_account_id}`,
      type: 'account_onboarding'
    });

    res.json({ url: accountLink.url });
  } catch (error) {
    logger.error('Stripe onboarding error', { error: error.message, stack: error.stack, userId: req.session.user?.id });
    res.status(500).json({ error: error.message });
  }
});

// Callback Stripe (manejado solo en backend)
app.get('/api/stripe/callback', authenticateUser, async (req, res) => {
  try {
    const { account_id, user_id, draft_id } = req.query;
    if (!account_id || !user_id) throw new Error('Parámetros inválidos');

    // Verificar que el usuario autenticado es el mismo
    if (req.session.user.id !== user_id) return res.redirect(`${FRONTEND_URL}/onboarding-error?reason=unauthorized`);

    // Verificar cuenta Stripe
    const account = await stripe.accounts.retrieve(account_id);
    if (!account.details_submitted || !account.charges_enabled) {
      return res.redirect(`${FRONTEND_URL}/onboarding-error?reason=incomplete`);
    }

    // Actualizar base de datos
    await supabase.from('stripe_accounts')
      .update({ status: 'active', charges_enabled: true, details_submitted: true })
      .eq('stripe_account_id', account_id);

    // Si hay draft_id, puedes actualizar el borrador aquí si lo necesitas

    res.redirect(`${FRONTEND_URL}/onboarding-success?account_id=${account_id}`);
  } catch (error) {
    logger.error('Stripe callback error', { error: error.message, stack: error.stack, userId: req.session.user?.id });
    res.redirect(`${FRONTEND_URL}/onboarding-error?reason=${encodeURIComponent(error.message)}`);
  }
});

// Validación robusta de donaciones
app.post('/api/donations', authenticateUser, async (req, res) => {
  try {
    const { causeId, amount } = req.body;
    if (!causeId || typeof amount !== 'number') throw new Error('Datos inválidos');
    if (amount < 0.5) throw new Error('El monto mínimo es 0.50€');
    if (amount > 10000) throw new Error('El monto máximo es 10,000€');

    // Verificar causa y usuario
    const { data: cause } = await supabase
      .from('causes')
      .select('stripe_account_id, stripe_enabled')
      .eq('id', causeId)
      .single();

    if (!cause?.stripe_enabled || !cause?.stripe_account_id) {
      throw new Error('Causa no habilitada para donaciones');
    }

    // Crear sesión de pago Stripe
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: { name: `Donación a causa ${causeId}` },
          unit_amount: Math.round(amount * 100),
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${FRONTEND_URL}/causes/${causeId}?donation=success`,
      cancel_url: `${FRONTEND_URL}/causes/${causeId}?donation=cancel`,
      payment_intent_data: {
        application_fee_amount: Math.round(amount * 0.02 * 100),
        transfer_data: { destination: cause.stripe_account_id }
      },
      metadata: { causeId, donorId: req.session.user.id }
    });

    res.json({ sessionId: session.id });
  } catch (error) {
    logger.error('Donation error', {
      error: error.message,
      stack: error.stack,
      userId: req.session.user?.id,
      body: req.body
    });
    res.status(400).json({
      error: 'Error processing donation',
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message
    });
  }
});

// Webhook Stripe con protección de IP y logging
app.post('/webhook', bodyParser.raw({type: 'application/json'}), async (req, res) => {
  const ip = req.ip || req.connection.remoteAddress;
  if (!STRIPE_WEBHOOK_IPS.includes(ip)) {
    logger.warn(`Invalid webhook IP: ${ip}`);
    return res.status(403).end();
  }
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      req.headers['stripe-signature'],
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    logger.error('Stripe webhook error', { error: err.message, headers: req.headers });
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'account.updated':
        await updateStripeAccountStatus(event.data.object);
        break;
      case 'checkout.session.completed':
        await handleDonation(event.data.object);
        break;
      case 'charge.refunded':
        await handleRefund(event.data.object);
        break;
      case 'account.application.deauthorized':
        await handleDeauth(event.data.object);
        break;
      default:
        logger.info(`Unhandled event type: ${event.type}`);
    }
    res.json({ received: true });
  } catch (error) {
    logger.error('Webhook event handling error', { error: error.message, eventType: event?.type, stack: error.stack });
    res.status(500).json({ error: error.message });
  }
});

// --- Endpoints con asyncHandler y logging ---
app.post('/api/donations', authenticateUser, asyncHandler(async (req, res) => {
  logger.info('Iniciando donación', { userId: req.session.user.id, causeId: req.body.causeId });
  const { causeId, amount } = req.body;

  // Validación básica
  if (!causeId || !amount || amount < 1) {
    logger.warn('Datos de donación inválidos', { causeId, amount });
    return res.status(400).json({ error: 'Datos inválidos' });
  }

  // Verificar causa
  const { data: cause } = await supabase
    .from('causes')
    .select('stripe_account_id, goal, raised')
    .eq('id', causeId)
    .single();

  if (!cause?.stripe_account_id) {
    logger.warn('Causa no acepta donaciones', { causeId });
    return res.status(400).json({ error: 'Causa no acepta donaciones' });
  }

  // Crear sesión de pago
  const sessionStripe = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'eur',
        product_data: { name: `Donación a causa ${causeId}` },
        unit_amount: Math.round(amount * 100),
      },
      quantity: 1,
    }],
    mode: 'payment',
    success_url: `${process.env.FRONTEND_URL}/causes/${causeId}?donation=success`,
    cancel_url: `${process.env.FRONTEND_URL}/causes/${causeId}`,
    payment_intent_data: {
      application_fee_amount: Math.round(amount * 0.02 * 100), // 2% fee
      transfer_data: { destination: cause.stripe_account_id }
    },
    metadata: { causeId, donorId: req.session.user.id }
  });

  logger.info('Sesión Stripe creada', { sessionId: sessionStripe.id });
  res.json({ sessionId: sessionStripe.id, message: t('donationSuccess', req.lang || 'es') });
}));

// --- Mejoras en el flujo de onboarding Stripe ---
app.get('/api/causes/stripe-callback', authenticateUser, asyncHandler(async (req, res) => {
  try {
    const { user_id: userId, draft_id: draftId } = req.query;

    // 1. Verificar que el draft pertenece al usuario
    const { data: draft, error: draftError } = await supabase
      .from('cause_drafts')
      .select('*')
      .eq('id', draftId)
      .eq('user_id', userId)
      .single();

    if (draftError || !draft) {
      return res.redirect('/causes?error=invalid_draft');
    }

    // 2. Verificar estado de Stripe
    const { data: onboarding } = await supabase
      .from('pending_onboardings')
      .select('*')
      .eq('draft_id', draftId)
      .single();

    if (!onboarding) {
      return res.redirect('/causes?error=no_onboarding');
    }

    const account = await stripe.accounts.retrieve(onboarding.stripe_account_id);

    if (!account.charges_enabled || !account.details_submitted) {
      return res.redirect(`/causes/create?draft_id=${draftId}&onboarding_error=incomplete`);
    }

    // 3. Actualizar estado en Supabase
    await supabase
      .from('stripe_accounts')
      .upsert({
        user_id: userId,
        stripe_account_id: account.id,
        status: 'active',
        charges_enabled: true,
        details_submitted: true
      });

    // 4. Crear causa final directamente (sin fetch)
    const { data: newCause, error: causeError } = await supabase
      .from('causes')
      .insert([{ 
        ...draft.draft_data,
        user_id: userId,
        status: 'active',
        stripe_enabled: true,
        stripe_account_id: account.id
      }])
      .select()
      .single();

    if (causeError) {
      throw new Error(causeError.message || 'Error creando causa');
    }

    // 5. Eliminar borrador y limpiar
    await supabase.from('cause_drafts').delete().eq('id', draftId);
    await supabase.from('pending_onboardings').delete().eq('draft_id', draftId);

    // 6. Redirigir con éxito
    res.redirect(`/causes/${newCause.id}?stripe=success`);
  } catch (error) {
    logger.error('Error in Stripe callback', { error: error.message });
    res.redirect('/causes?error=stripe_callback_failed');
  }
}));

// --- Manejo centralizado de errores ---
app.use((err, req, res, next) => {
  logger.error('Error global', { error: err.message, stack: err.stack });
  res.status(500).json({
    error: t('errorGeneric', req.lang || 'es'),
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
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
app.get('/causes', (req, res) => {
  res.render('causes/index', {
    lang: req.lang,
    user: req.session.user,
    stripe_public_key: process.env.STRIPE_PUBLISHABLE_KEY // <-- Añade esto
  });
});
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
    res.json({ ok: true });
  } else {
    res.status(401).json({ ok: false });
  }
});

// --- Endpoint para crear sesión de donación Stripe ---
app.post('/api/donations', authenticateUser, async (req, res) => {
  try {
    const { causeId, amount } = req.body;
    
    // Verificar causa
    const { data: cause } = await supabase
      .from('causes')
      .select('stripe_account_id, goal, raised')
      .eq('id', causeId)
      .single();
    // Crear sesión de pago
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: { name: `Donación a causa ${causeId}` },
          unit_amount: Math.round(amount * 100),
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL}/causes/${causeId}?donation=success`,
      cancel_url: `${process.env.FRONTEND_URL}/causes/${causeId}`,
      payment_intent_data: {
        application_fee_amount: Math.round(amount * 0.02 * 100), // 2% fee
        transfer_data: { destination: cause.stripe_account_id }
      },
      metadata: { causeId, donorId: req.session.user.id }
    });

    res.json({ sessionId: session.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- Webhook Stripe mejorado ---
app.post('/webhook', bodyParser.raw({type: 'application/json'}), async (req, res) => {
  console.log('🔔 Webhook recibido:', req.headers['stripe-signature']);
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      req.headers['stripe-signature'],
      process.env.STRIPE_WEBHOOK_SECRET
    );
    console.log(`Evento ${event.type} procesado`);
  } catch (err) {
    console.error(`⚠️ Error en webhook: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {
    case 'account.updated':
      try {
        await updateStripeAccountStatus(event.data.object);
      } catch (e) {
        console.error('Error actualizando cuenta Stripe:', e);
      }
      break;
    case 'checkout.session.completed':
      try {
        await handleDonation(event.data.object);
      } catch (e) {
        console.error('Error procesando donación:', e);
      }
      break;
    case 'charge.refunded':
      try {
        await handleRefund(event.data.object);
      } catch (e) {
        console.error('Error procesando reembolso:', e);
      }
      break;
    case 'account.application.deauthorized':
      try {
        await handleDeauth(event.data.object);
      } catch (e) {
        console.error('Error desautorizando cuenta:', e);
      }
      break;
    default:
      console.log(`Evento no manejado: ${event.type}`);
  }

  res.json({ received: true });
});

async function handleDonation(session) {
  const { causeId, donorId } = session.metadata;
  
  // Registrar donación en Supabase
  await supabase.from('donations').insert([{
    cause_id: causeId,
    donor_id: donorId,
    amount: session.amount_total / 100,
    fee: session.application_fee_amount / 100,
    stripe_session_id: session.id,
    status: 'completed'
  }]);

  // Actualizar total recaudado en causa
  await supabase.rpc('increment_cause_raised', {
    cause_id: causeId,
    amount: session.amount_total / 100
  });
}

async function handleRefund(charge) {
  // Actualiza donación como reembolsada
  await supabase.from('donations').update({ status: 'refunded' }).eq('stripe_charge_id', charge.id);
}

async function handleDeauth(account) {
  // Marca cuenta Stripe como desautorizada
  await supabase.from('stripe_accounts').update({ status: 'deauthorized' }).eq('stripe_account_id', account.id);
}

async function updateStripeAccountStatus(account) {
  await supabase
    .from('stripe_accounts')
    .update({
      status: account.charges_enabled ? 'active' : 'pending',
      details_submitted: account.details_submitted,
      charges_enabled: account.charges_enabled
    })
    .eq('stripe_account_id', account.id);
}

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
    const userId = req.session.user.id;

    // 1. Obtener el borrador con verificación de propiedad
    const { data: draft, error: draftError } = await supabase
      .from('cause_drafts')
      .select('*')
      .eq('id', draftId)
      .eq('user_id', userId)
      .single();

    if (draftError || !draft) {
      return res.status(404).json({ error: 'Borrador no encontrado o no autorizado' });
    }

    // 2. Verificar estado de Stripe si es necesario
    let stripeEnabled = false;
    let stripeAccountId = null;

    if (draft.stripe_account_id) {
      const account = await stripe.accounts.retrieve(draft.stripe_account_id);
      stripeEnabled = account.charges_enabled && account.details_submitted;
      stripeAccountId = stripeEnabled ? draft.stripe_account_id : null;
    }

    // 3. Crear la causa con políticas RLS
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

    // 4. Eliminar borrador y limpiar
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

// --- Callback de Stripe corregido ---
app.get('/api/causes/stripe-callback', authenticateUser, asyncHandler(async (req, res) => {
  try {
    const { user_id: userId, draft_id: draftId } = req.query;

    // 1. Verificar que el draft pertenece al usuario
    const { data: draft, error: draftError } = await supabase
      .from('cause_drafts')
      .select('*')
      .eq('id', draftId)
      .eq('user_id', userId)
      .single();

    if (draftError || !draft) {
      return res.redirect('/causes?error=invalid_draft');
    }

    // 2. Verificar estado de Stripe
    const { data: onboarding } = await supabase
      .from('pending_onboardings')
      .select('*')
      .eq('draft_id', draftId)
      .single();

    if (!onboarding) {
      return res.redirect('/causes?error=no_onboarding');
    }

    const account = await stripe.accounts.retrieve(onboarding.stripe_account_id);

    if (!account.charges_enabled || !account.details_submitted) {
      return res.redirect(`/causes/create?draft_id=${draftId}&onboarding_error=incomplete`);
    }

    // 3. Actualizar estado en Supabase
    await supabase
      .from('stripe_accounts')
      .upsert({
        user_id: userId,
        stripe_account_id: account.id,
        status: 'active',
        charges_enabled: true,
        details_submitted: true
      });

    // 4. Crear causa final directamente (sin fetch)
    const { data: newCause, error: causeError } = await supabase
      .from('causes')
      .insert([{ 
        ...draft.draft_data,
        user_id: userId,
        status: 'active',
        stripe_enabled: true,
        stripe_account_id: account.id
      }])
      .select()
      .single();

    if (causeError) {
      throw new Error(causeError.message || 'Error creando causa');
    }

    // 5. Eliminar borrador y limpiar
    await supabase.from('cause_drafts').delete().eq('id', draftId);
    await supabase.from('pending_onboardings').delete().eq('draft_id', draftId);

    // 6. Redirigir con éxito
    res.redirect(`/causes/${newCause.id}?stripe=success`);
  } catch (error) {
    logger.error('Error in Stripe callback', { error: error.message });
    res.redirect('/causes?error=stripe_callback_failed');
  }
}));

// --- Ruta para 404 - DEBE ESTAR AL FINAL ---
app.use((req, res) => {
    res.status(404).send('Página no encontrada');
});

app.listen(PORT, () => {
  logger.info(`Servidor iniciado en http://localhost:${PORT}`);
  console.log(`Servidor iniciado en http://localhost:${PORT}`);
});