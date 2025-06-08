require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const fs = require('fs');
const multer = require('multer');
const nunjucks = require('nunjucks');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const app = express();
const PORT = 3000;

const USERS_FILE = path.join(__dirname, 'users.json');

// Middleware para parsear JSON
app.use(express.json());

// Sesiones (añadido cookie: { sameSite: 'lax' } para compatibilidad frontend-backend)
app.use(session({
    secret: 'secreto-super-seguro',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, sameSite: 'lax' }
}));

// Servir archivos estáticos (NO HTML aquí, solo CSS, JS, imágenes)
app.use(express.static(path.join(__dirname)));
app.use(express.static(path.join(__dirname, 'public'))); // Para scripts y assets

// --- Multer config para subir imágenes ---
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Nombre único: fecha + nombre original
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
    // URL accesible desde el navegador
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
    // Permitir login por username o email
    const { username, password, email } = req.body;
    let users = readUsers();
    let user = null;
    if (username && password) {
        user = users.find(u => u.username === username && u.password === password);
    } else if (email && password) {
        user = users.find(u => u.email === email && u.password === password);
    }
    if (user) {
        req.session.user = { name: user.name, photo: user.photo || '', username: user.username, email: user.email };
        res.json({ ok: true, user: req.session.user });
    } else {
        res.status(401).json({ ok: false, error: 'Credenciales incorrectas' });
    }
});

// --- Saber si hay sesión ---
app.get('/me', (req, res) => {
    if (req.session.user) {
        res.json({ logged: true, user: req.session.user });
    } else {
        res.json({ logged: false });
    }
});

// --- Logout ---
app.post('/logout', (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
});

// --- Configura nunjucks para usar la carpeta 'views' ---
nunjucks.configure('views', {
  autoescape: true,
  express: app
});
app.set('view engine', 'njk');

// --- Rutas para las páginas principales (usa .njk) ---
app.get('/', (req, res) => {
    res.render('index.njk');
});
app.get('/login', (req, res) => {
    res.render('auth/login.njk');
});
app.get('/register', (req, res) => {
    res.render('auth/register.njk');
});
app.get('/causes', (req, res) => {
    res.render('causes/index.njk');
});
app.get('/tasks', (req, res) => {
    res.render('tasks/index.njk');
});
app.get('/volunteering', (req, res) => {
    res.render('volunteering/index.njk');
});
app.get('/profile', (req, res) => {
    res.render('profile/index.njk');
});
app.get('/causes/create', (req, res) => {
    res.render('causes/create.njk');
});
app.get('/tasks/create', (req, res) => {
    res.render('tasks/create.njk');
});
app.get('/volunteering/create', (req, res) => {
    res.render('volunteering/create.njk');
});
app.get('/maps', (req, res) => {
    res.render('maps/index.njk');
});
app.get('/challenges', (req, res) => {
    res.render('challenges/index.njk');
});
app.get('/teams', (req, res) => {
    res.render('teams/index.njk');
});
app.get('/teams/myteams', (req, res) => {
    res.render('teams/myteams.njk');
});
app.get('/ranking', (req, res) => {
    res.render('ranking/index.njk');
});
app.get('/takeaction', (req, res) => {
    res.render('takeaction/index.njk');
});

// --- Ruta para 404 ---
app.use((req, res) => {
    res.status(404).send('Página no encontrada');
});

// 1. Crear cuenta Express para el creador de la causa
app.post('/connect-account', async (req, res) => {
  const { userId, email } = req.body;
  try {
    const account = await stripe.accounts.create({
      type: 'express',
      email,
      capabilities: { transfers: { requested: true } }
    });
    // Guarda account.id en tu BD, asociado al usuario
    // ...
    res.json({ accountId: account.id });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 2. Crear link de onboarding para que el usuario complete su cuenta
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

// 3. Crear sesión de pago para donar a una causa
app.post('/donate', async (req, res) => {
  const { amount, causeId, creatorStripeAccountId, donorEmail } = req.body;
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: { name: `Donación a causa #${causeId}` },
          unit_amount: amount * 100, // en céntimos
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: 'https://tusitio.com/donacion-exitosa',
      cancel_url: 'https://tusitio.com/donacion-cancelada',
      payment_intent_data: {
        application_fee_amount: 100, // comisión para la plataforma (opcional)
        transfer_data: {
          destination: creatorStripeAccountId, // el Stripe Account del creador
        },
      },
      customer_email: donorEmail,
    });
    res.json({ url: session.url });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.listen(PORT, () => {
    console.log(`Servidor iniciado en http://localhost:${PORT}`);
});