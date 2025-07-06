# Solidarity - Documentación Completa del Proyecto

## Misión y Visión

### Misión
Solidarity es una plataforma digital colaborativa que conecta personas, organizaciones y causas solidarias para crear un impacto positivo en la sociedad. Nuestra misión es **fomentar la solidaridad, la colaboración y el compromiso social**, facilitando la participación ciudadana y el apoyo a quienes más lo necesitan.

### Visión
Convertirse en la plataforma líder mundial para la acción social colaborativa, donde cada persona pueda encontrar su forma de contribuir al bien común y medir su impacto real en la sociedad.

### Valores Fundamentales
- **Transparencia**: Todas las actividades y causas son públicas y auditables
- **Colaboración**: Creemos en el trabajo en equipo y la suma de esfuerzos
- **Impacto**: Medimos y celebramos cada acción solidaria
- **Inclusión**: Cualquier persona puede participar y proponer iniciativas
- **Innovación**: Usamos tecnología para facilitar la solidaridad

## Arquitectura Técnica

### Stack Tecnológico
- **Backend**: Node.js + Express.js
- **Base de Datos**: Supabase (PostgreSQL)
- **Frontend**: HTML5, CSS3, JavaScript Vanilla
- **Templating**: Nunjucks (.njk)
- **Autenticación**: Supabase Auth
- **Componentes**: Web Components nativos
- **Estilos**: CSS Variables + Font Awesome
- **Mapas**: Leaflet

### Configuración de Supabase
```javascript
// Configuración principal en layout.njk
const supabaseUrl = 'https://cyftasxlrzuynzbrfgkd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5ZnRhc3hscnp1eW56YnJmZ2tkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgwMzUzMTksImV4cCI6MjA2MzYxMTMxOX0.I56ZqFTfLgdwWlcozMVncGNGBZ4A2_5VpAbHeNmtDhA';
const supabase = window.supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
```

## Estructura del Proyecto

### Directorios Principales
```
/views/
  /auth/ - Autenticación (login, register)
  /causes/ - Gestión de causas
  /tasks/ - Gestión de tareas
  /challenges/ - Retos y desafíos
  /teams/ - Comunidades
  /volunteering/ - Voluntariados
  /profile/ - Perfil de usuario
  /partials/ - Componentes reutilizables (navbar, footer)
  /docs/ - Documentación (about, terms, privacy)
/public/
  /js/ - JavaScript modular
  /css/ - Estilos CSS
  /img/ - Imágenes y assets
```

## Funcionalidades Principales

### 1. Sistema de Autenticación

#### Descripción
Sistema completo de registro, login y gestión de sesiones con Supabase Auth.

#### Código Relevante - Navbar Authentication
```javascript
// views/partials/navbar.njk
<!-- Botones de autenticación - solo cuando NO está logueado -->
{% if not user %}
<div id="auth-buttons">
  <a href="/login" class="btn btn-outline">Iniciar Sesión</a>
  <a href="/register" class="btn btn-primary" style="margin-left: 8px;">Registrarse</a>
</div>
{% endif %}

<!-- Menú de usuario - solo cuando SÍ está logueado -->
{% if user %}
<div id="user-menu" style="display:block;">
  <div id="user-trigger">
    <img id="user-avatar" src="{{ user.photo_url or '/img/default-user.png' }}" alt="Foto de perfil" class="user-avatar">
    <span id="user-name" class="user-name">{{ user.name or user.username }}</span>
    <i class="fas fa-caret-down dropdown-icon"></i>
  </div>
  <!-- Dropdown con opciones de usuario -->
</div>
{% endif %}
```

#### Gestión de Sesión (navbar.js)
```javascript
// public/js/navbar.js
function updateAuthUI(isLoggedIn, userData = null) {
    const authButtons = document.getElementById('auth-buttons');
    const userMenu = document.getElementById('user-menu');
    
    if (isLoggedIn && userData) {
        authButtons.style.display = 'none';
        userMenu.style.display = 'flex';
        document.getElementById('user-name').textContent = userData.name || userData.username;
        document.getElementById('user-avatar').src = userData.photo_url || '/img/default-user.png';
    } else {
        authButtons.style.display = 'flex';
        userMenu.style.display = 'none';
    }
}
```

### 2. Sistema de Causas

#### Descripción
Gestión completa de causas solidarias con creación, visualización, participación y seguimiento de progreso.

#### Estructura de Datos
```javascript
// Tabla: causes
{
  id: uuid,
  title: string,
  description: text,
  category: string, // 'medio_ambiente', 'educacion', 'salud', etc.
  city: string,
  country: string,
  lat: float,
  lng: float,
  goal: integer, // Meta de recaudación
  raised: integer, // Cantidad recaudada
  points: integer, // Puntos de impacto
  beneficiaries: integer,
  photo_url: string,
  user_id: uuid, // Creador
  created_at: timestamp
}
```

#### Código de Renderizado (causes-renderer.js)
```javascript
// public/js/modules/causes-renderer.js
class CausesRenderer {
  async loadCausesFromSupabase(filter = "all", searchTerm = "") {
    let query = supabase
      .from('causes')
      .select('*')
      .order('created_at', { ascending: false });

    if (filter !== "all") {
      query = query.eq('category', filter);
    }
    if (searchTerm && searchTerm.trim() !== "") {
      query = query.or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
    }

    const { data: causes, error } = await query;
    return { causes: causes || [], error };
  }

  renderCause(causa) {
    const progreso = causa.goal ? Math.min(100, Math.round((causa.raised / causa.goal) * 100)) : 0;
    
    return `
      <div class="cause-card" data-id="${causa.id}">
        <div class="cause-image">
          <img src="${causa.photo_url || '/img/cause-default.jpg'}" alt="${causa.title}">
          <div class="cause-category">${this.getCategoryName(causa.category)}</div>
        </div>
        <div class="cause-content">
          <h3>${causa.title}</h3>
          <p>${causa.description}</p>
          <div class="cause-location">
            <i class="fas fa-map-marker-alt"></i>
            ${causa.city || 'Sin ubicación'}${causa.country ? ', ' + causa.country : ''}
          </div>
          <div class="progress-container">
            <div class="progress-bar">
              <div class="progress" style="width: ${progreso}%;"></div>
            </div>
            <div class="progress-info">
              <span>${causa.raised || 0}€ de ${causa.goal || 0}€</span>
              <span>${progreso}%</span>
            </div>
          </div>
          <div class="cause-stats">
            <span><i class="fas fa-users"></i> ${causa.beneficiaries || 0} beneficiarios</span>
            <span><i class="fas fa-star"></i> ${causa.points || 0} puntos</span>
          </div>
        </div>
      </div>
    `;
  }
}
```

### 3. Sistema de Tareas

#### Descripción
Tareas específicas que los usuarios pueden completar para sumar puntos de impacto a causas o comunidades.

#### Estructura de Datos
```javascript
// Tabla: tasks
{
  id: uuid,
  title: string,
  description: text,
  category: string,
  city: string,
  country: string,
  points: integer, // Puntos que otorga completar la tarea
  difficulty: string, // 'facil', 'medio', 'dificil'
  estimated_time: string, // Tiempo estimado
  photo_url: string,
  user_id: uuid, // Creador
  cause_id: uuid, // Causa asociada (opcional)
  team_id: uuid, // Comunidad asociada (opcional)
  completed: boolean,
  created_at: timestamp
}
```

#### Renderizado de Tareas
```javascript
// public/js/modules/tasks-renderer.js
renderTask(task) {
  const difficultyColor = {
    'facil': '#27ae60',
    'medio': '#f39c12',
    'dificil': '#e74c3c'
  };

  return `
    <div class="task-card" data-id="${task.id}">
      <div class="task-image">
        <img src="${task.photo_url || '/img/task-default.jpg'}" alt="${task.title}">
        <div class="task-difficulty" style="background: ${difficultyColor[task.difficulty]}">
          ${task.difficulty.toUpperCase()}
        </div>
      </div>
      <div class="task-content">
        <h3>${task.title}</h3>
        <p>${task.description}</p>
        <div class="task-meta">
          <span><i class="fas fa-clock"></i> ${task.estimated_time || 'No especificado'}</span>
          <span><i class="fas fa-star"></i> ${task.points} puntos</span>
        </div>
        <div class="task-actions">
          <button class="btn btn-primary complete-task-btn" data-id="${task.id}">
            <i class="fas fa-check"></i> Completar Tarea
          </button>
        </div>
      </div>
    </div>
  `;
}
```

### 4. Sistema de Retos (Challenges)

#### Descripción
Desafíos colectivos o individuales con objetivos específicos y gamificación.

#### Estructura de Datos
```javascript
// Tabla: challenges
{
  id: uuid,
  title: string,
  description: text,
  category: string,
  goal: integer, // Meta del reto
  current_progress: integer, // Progreso actual
  points_reward: integer, // Puntos por completar
  start_date: date,
  end_date: date,
  difficulty: string,
  photo_url: string,
  user_id: uuid, // Creador
  team_id: uuid, // Comunidad asociada (opcional)
  is_completed: boolean,
  created_at: timestamp
}
```

### 5. Sistema de Comunidades (Teams)

#### Descripción
Grupos de usuarios que trabajan juntos en causas, tareas y retos compartidos.

#### Estructura de Datos
```javascript
// Tabla: teams
{
  id: uuid,
  name: string,
  description: text,
  category: string,
  avatar_url: string,
  tags: string[], // Array de etiquetas
  goal: integer, // Meta de recaudación
  funds_raised: integer,
  impact: integer, // Puntos de impacto acumulados
  members_count: integer,
  activities_count: integer,
  beneficiaries: integer,
  is_public: boolean,
  user_id: uuid, // Fundador
  created_at: timestamp
}

// Tabla: team_members
{
  id: uuid,
  team_id: uuid,
  user_id: uuid,
  role: string, // 'founder', 'admin', 'member', 'pending'
  joined_at: timestamp
}
```

#### Renderizado de Comunidades
```javascript
// public/js/modules/teams-renderer.js
renderTeam(team) {
  const progressPercent = team.goal ? Math.min(100, Math.round((team.funds_raised / team.goal) * 100)) : 0;
  
  return `
    <div class="team-card" data-id="${team.id}">
      <div class="team-header">
        <img src="${team.avatar_url || '/img/team-default.jpg'}" alt="${team.name}" class="team-avatar">
        <div class="team-info">
          <h3>${team.name}</h3>
          <p>${team.description}</p>
          <div class="team-category">${this.getCategoryName(team.category)}</div>
        </div>
      </div>
      <div class="team-stats">
        <div class="stat">
          <i class="fas fa-users"></i>
          <span>${team.members_count || 0} miembros</span>
        </div>
        <div class="stat">
          <i class="fas fa-star"></i>
          <span>${team.impact || 0} puntos</span>
        </div>
        <div class="stat">
          <i class="fas fa-heart"></i>
          <span>${team.beneficiaries || 0} beneficiarios</span>
        </div>
      </div>
      <div class="team-progress">
        <div class="progress-bar">
          <div class="progress" style="width: ${progressPercent}%;"></div>
        </div>
        <span>${team.funds_raised || 0}€ de ${team.goal || 0}€ (${progressPercent}%)</span>
      </div>
      <div class="team-tags">
        ${(team.tags || []).map(tag => `<span class="tag">${tag}</span>`).join('')}
      </div>
      <div class="team-actions">
        <button class="btn btn-primary join-team-btn" data-id="${team.id}">
          <i class="fas fa-user-plus"></i> Unirse
        </button>
        <button class="btn btn-outline ver-mas-btn" data-id="${team.id}">
          <i class="fas fa-eye"></i> Ver más
        </button>
      </div>
    </div>
  `;
}
```

### 6. Sistema de Voluntariado

#### Descripción
Oportunidades de voluntariado presencial y virtual organizadas por comunidades o individuos.

#### Estructura de Datos
```javascript
// Tabla: volunteering
{
  id: uuid,
  title: string,
  description: text,
  category: string,
  city: string,
  country: string,
  lat: float,
  lng: float,
  volunteers_needed: integer,
  volunteers_registered: integer,
  event_date: date,
  duration: string, // Duración estimada
  requirements: text,
  contact_info: text,
  photo_url: string,
  user_id: uuid, // Organizador
  team_id: uuid, // Comunidad organizadora (opcional)
  is_active: boolean,
  created_at: timestamp
}
```

### 7. Sistema de Perfil de Usuario

#### Descripción
Perfil completo del usuario con historial de actividades, estadísticas y gamificación.

#### Estructura de Datos
```javascript
// Tabla: profiles
{
  id: uuid, // Coincide con auth.users.id
  name: string,
  username: string,
  email: string,
  photo_url: string,
  bio: text,
  city: string,
  country: string,
  impact_points: integer,
  level: integer,
  badges: string[], // Array de badges conseguidos
  created_at: timestamp,
  updated_at: timestamp
}

// Tabla: user_activities (historial)
{
  id: uuid,
  user_id: uuid,
  activity_type: string, // 'cause_created', 'task_completed', 'challenge_joined', etc.
  activity_id: uuid, // ID de la actividad específica
  points_earned: integer,
  description: text,
  created_at: timestamp
}
```

#### Código del Perfil
```javascript
// views/profile/index.njk - Carga de estadísticas
async function loadUserStats(userId) {
  // Cargar actividades del usuario
  const { data: userActivities } = await supabase
    .from('user_activities')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  // Calcular estadísticas
  const totalPoints = userActivities.reduce((sum, activity) => sum + (activity.points_earned || 0), 0);
  const totalActivities = userActivities.length;
  
  // Cargar causas creadas
  const { data: userCauses } = await supabase
    .from('causes')
    .select('*')
    .eq('user_id', userId);

  // Cargar tareas completadas
  const { data: completedTasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .eq('completed', true);

  // Actualizar UI con animación
  animateCounter('impact-points', totalPoints);
  animateCounter('total-activities', totalActivities);
  animateCounter('causes-created', userCauses?.length || 0);
  animateCounter('tasks-completed', completedTasks?.length || 0);
}

function animateCounter(elementId, target, duration = 1200) {
  const element = document.getElementById(elementId);
  let current = 0;
  const step = Math.max(1, Math.ceil(target / 50));
  const interval = Math.max(10, Math.floor(duration / (target / step)));
  
  const timer = setInterval(() => {
    current += step;
    if (current >= target) {
      element.textContent = target;
      clearInterval(timer);
    } else {
      element.textContent = current;
    }
  }, interval);
}
```

### 8. Sistema de Navegación Móvil

#### Descripción
Componentes especializados para navegación móvil con Web Components nativos.

#### Mobile Header Component
```javascript
// public/js/components/mobile-header.js
class SolidarityMobileHeader extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: none !important;
          position: fixed !important;
          top: 0 !important;
          width: 100vw !important;
          height: 80px !important;
          z-index: 999998 !important;
          background: rgba(255, 255, 255, 0.95) !important;
          backdrop-filter: blur(10px) !important;
        }
        
        @media (max-width: 992px) {
          :host {
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            padding: 0 18px !important;
          }
        }
      </style>
      
      <div class="left-section">
        <slot name="hamburger"></slot>
      </div>
      
      <div class="center-section">
        <a href="/" class="logo">
          <img src="${window.location.origin}/img/logotransparente.jpg" alt="Solidarity Logo" class="logo-icon">
          <span class="logo-text">Solidarity</span>
        </a>
      </div>
      
      <div class="right-section">
        <slot name="avatar"></slot>
      </div>
    `;
  }
}

customElements.define('solidarity-mobile-header', SolidarityMobileHeader);
```

#### Mobile Avatar Component
```javascript
// public/js/components/mobile-avatar.js
class SolidarityMobileAvatar extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    
    this.shadowRoot.innerHTML = `
      <!-- Avatar para usuario logueado -->
      <button class="menu-toggle hidden" id="avatarButton">
        <img src="/img/default-user.png" alt="Avatar" id="avatarImg">
      </button>
      
      <!-- Botón para usuario no logueado -->
      <button class="login-button hidden" id="loginButton">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <circle cx="12" cy="7" r="4"></circle>
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="18" cy="6" r="3" fill="currentColor" stroke="none"></circle>
          <line x1="18" y1="4.5" x2="18" y2="7.5" stroke="#ffffff" stroke-width="1.5"></line>
          <line x1="16.5" y1="6" x2="19.5" y2="6" stroke="#ffffff" stroke-width="1.5"></line>
        </svg>
      </button>
    `;
  }
  
  updateAuthState(isLoggedIn, userData = null) {
    const avatarButton = this.shadowRoot.getElementById('avatarButton');
    const loginButton = this.shadowRoot.getElementById('loginButton');
    
    if (isLoggedIn) {
      avatarButton.classList.remove('hidden');
      loginButton.classList.add('hidden');
      if (userData?.photo_url) {
        this.shadowRoot.getElementById('avatarImg').src = userData.photo_url;
      }
    } else {
      avatarButton.classList.add('hidden');
      loginButton.classList.remove('hidden');
    }
  }
}

customElements.define('solidarity-mobile-avatar', SolidarityMobileAvatar);
```

### 9. Sistema de Mapas

#### Descripción
Visualización geolocalizada de causas, voluntariados y actividades usando Leaflet.

#### Código Principal
```javascript
// views/maps/index.njk
async function initMap() {
  const map = L.map('map').setView([40.4168, -3.7038], 6); // Madrid como centro
  
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);

  // Cargar causas con coordenadas
  const { data: causes, error: causesError } = await supabase
    .from('causes')
    .select('*')
    .not('lat', 'is', null)
    .not('lng', 'is', null);

  if (!causesError && causes) {
    causes.forEach(causa => {
      const marker = L.marker([causa.lat, causa.lng])
        .bindPopup(`
          <div class="map-popup">
            <h3>${causa.title}</h3>
            <p>${causa.description.substring(0, 100)}...</p>
            <div class="popup-stats">
              <span><i class="fas fa-users"></i> ${causa.beneficiaries || 0}</span>
              <span><i class="fas fa-star"></i> ${causa.points || 0} puntos</span>
            </div>
            <a href="/causes/${causa.id}" class="btn btn-primary btn-sm">Ver Causa</a>
          </div>
        `)
        .addTo(map);
    });
  }

  // Cargar voluntariados con coordenadas
  const { data: volunteering, error: volunteeringError } = await supabase
    .from('volunteering')
    .select('*')
    .not('lat', 'is', null)
    .not('lng', 'is', null);

  if (!volunteeringError && volunteering) {
    volunteering.forEach(vol => {
      const marker = L.marker([vol.lat, vol.lng], {
        icon: L.icon({
          iconUrl: '/img/volunteer-marker.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41]
        })
      })
        .bindPopup(`
          <div class="map-popup">
            <h3>${vol.title}</h3>
            <p>${vol.description.substring(0, 100)}...</p>
            <div class="popup-stats">
              <span><i class="fas fa-calendar"></i> ${new Date(vol.event_date).toLocaleDateString()}</span>
              <span><i class="fas fa-users"></i> ${vol.volunteers_needed} necesarios</span>
            </div>
            <a href="/volunteering/${vol.id}" class="btn btn-accent btn-sm">Ver Voluntariado</a>
          </div>
        `)
        .addTo(map);
    });
  }
}
```

### 10. Sistema de Ranking

#### Descripción
Sistema de clasificación de usuarios y comunidades por puntos de impacto.

#### Código de Ranking
```javascript
// views/ranking/index.njk
async function loadUserRanking(period = 'mensual') {
  let dateFilter = '';
  const now = new Date();
  
  switch(period) {
    case 'mensual':
      const firstDayMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFilter = firstDayMonth.toISOString();
      break;
    case 'semanal':
      const firstDayWeek = new Date(now.setDate(now.getDate() - now.getDay()));
      dateFilter = firstDayWeek.toISOString();
      break;
    case 'historico':
      // Sin filtro de fecha
      break;
  }

  let query = supabase
    .from('profiles')
    .select('id, name, username, photo_url, impact_points')
    .order('impact_points', { ascending: false })
    .limit(50);

  if (period !== 'historico') {
    // Para ranking temporal, sumar puntos de user_activities en el período
    const { data: activities } = await supabase
      .from('user_activities')
      .select('user_id, points_earned')
      .gte('created_at', dateFilter);
    
    // Procesar datos para ranking temporal
    const userPoints = {};
    activities?.forEach(activity => {
      userPoints[activity.user_id] = (userPoints[activity.user_id] || 0) + activity.points_earned;
    });
    
    // Convertir a array y ordenar
    const ranking = Object.entries(userPoints)
      .map(([userId, points]) => ({ userId, points }))
      .sort((a, b) => b.points - a.points)
      .slice(0, 50);
      
    return ranking;
  }

  const { data: users, error } = await query;
  return users || [];
}

function renderUserRanking(users, rankingType, currentUserId) {
  const tbody = document.querySelector(`#${rankingType}-ranking tbody`);
  tbody.innerHTML = '';
  
  users.forEach((user, index) => {
    const position = index + 1;
    const isCurrentUser = user.id === currentUserId;
    
    const row = document.createElement('tr');
    if (isCurrentUser) row.classList.add('current-user');
    
    row.innerHTML = `
      <td class="position">
        ${position <= 3 ? getMedalIcon(position) : position}
      </td>
      <td class="user-info">
        <img src="${user.photo_url || '/img/default-user.png'}" alt="${user.name}" class="user-avatar-small">
        <span>${user.name || user.username}</span>
        ${isCurrentUser ? '<span class="you-indicator">(Tú)</span>' : ''}
      </td>
      <td class="points">${user.impact_points || 0}</td>
      <td class="level">${calculateLevel(user.impact_points || 0)}</td>
    `;
    
    tbody.appendChild(row);
  });
}

function getMedalIcon(position) {
  const medals = {
    1: '<i class="fas fa-trophy" style="color: #ffd700;"></i>',
    2: '<i class="fas fa-medal" style="color: #c0c0c0;"></i>',
    3: '<i class="fas fa-medal" style="color: #cd7f32;"></i>'
  };
  return medals[position] || position;
}

function calculateLevel(points) {
  if (points >= 10000) return 'Experto';
  if (points >= 5000) return 'Avanzado';
  if (points >= 1000) return 'Intermedio';
  return 'Principiante';
}
```

## Gamificación y Sistema de Puntos

### Sistema de Puntos de Impacto
- **Crear causa**: 100 puntos
- **Completar tarea fácil**: 10-20 puntos
- **Completar tarea media**: 30-50 puntos
- **Completar tarea difícil**: 60-100 puntos
- **Unirse a comunidad**: 25 puntos
- **Crear comunidad**: 100 puntos
- **Completar reto**: 50-200 puntos
- **Participar en voluntariado**: 75 puntos

### Sistema de Niveles
```javascript
function calculateUserLevel(points) {
  if (points >= 50000) return { level: 'Leyenda', color: '#9b59b6' };
  if (points >= 25000) return { level: 'Maestro', color: '#e74c3c' };
  if (points >= 10000) return { level: 'Experto', color: '#f39c12' };
  if (points >= 5000) return { level: 'Avanzado', color: '#3498db' };
  if (points >= 1000) return { level: 'Intermedio', color: '#27ae60' };
  return { level: 'Principiante', color: '#95a5a6' };
}
```

### Sistema de Badges
```javascript
const AVAILABLE_BADGES = {
  'first_cause': { name: 'Primera Causa', icon: 'fas fa-heart', description: 'Creaste tu primera causa' },
  'task_master': { name: 'Maestro de Tareas', icon: 'fas fa-check-circle', description: 'Completaste 50 tareas' },
  'community_leader': { name: 'Líder Comunitario', icon: 'fas fa-users', description: 'Fundaste una comunidad' },
  'volunteer_hero': { name: 'Héroe Voluntario', icon: 'fas fa-hands-helping', description: 'Participaste en 10 voluntariados' },
  'impact_warrior': { name: 'Guerrero del Impacto', icon: 'fas fa-star', description: 'Alcanzaste 10,000 puntos' }
};
```

## Flujo de Usuario Típico

### 1. Registro e Inicio
1. Usuario visita solidarity.com
2. Se registra usando email o proveedores sociales
3. Completa su perfil con ubicación e intereses
4. Recibe puntos de bienvenida (50 puntos)

### 2. Exploración y Participación
1. Explora causas por categoría o ubicación
2. Se une a una comunidad afín (+25 puntos)
3. Completa su primera tarea (+20 puntos)
4. Participa en un reto comunitario (+50 puntos)

### 3. Contribución Activa
1. Crea su primera causa (+100 puntos)
2. Organiza un voluntariado
3. Invita amigos a la plataforma
4. Sube de nivel y obtiene badges

### 4. Liderazgo
1. Funda una comunidad (+100 puntos)
2. Gestiona actividades y miembros
3. Coordina esfuerzos a gran escala
4. Aparece en rankings de líderes

## Arquitectura de Base de Datos

### Tablas Principales
```sql
-- Usuarios (gestionado por Supabase Auth)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  name TEXT,
  username TEXT UNIQUE,
  photo_url TEXT,
  bio TEXT,
  city TEXT,
  country TEXT,
  impact_points INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  badges TEXT[], -- Array de badge IDs
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Causas
CREATE TABLE causes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  city TEXT,
  country TEXT,
  lat FLOAT,
  lng FLOAT,
  goal INTEGER DEFAULT 0,
  raised INTEGER DEFAULT 0,
  points INTEGER DEFAULT 0,
  beneficiaries INTEGER DEFAULT 0,
  photo_url TEXT,
  user_id UUID REFERENCES profiles(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Comunidades
CREATE TABLE teams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  avatar_url TEXT,
  tags TEXT[],
  goal INTEGER DEFAULT 0,
  funds_raised INTEGER DEFAULT 0,
  impact INTEGER DEFAULT 0,
  members_count INTEGER DEFAULT 1,
  activities_count INTEGER DEFAULT 0,
  beneficiaries INTEGER DEFAULT 0,
  is_public BOOLEAN DEFAULT true,
  user_id UUID REFERENCES profiles(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Miembros de comunidades
CREATE TABLE team_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member', -- 'founder', 'admin', 'member', 'pending'
  joined_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

-- Tareas
CREATE TABLE tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  city TEXT,
  country TEXT,
  points INTEGER DEFAULT 0,
  difficulty TEXT DEFAULT 'facil',
  estimated_time TEXT,
  photo_url TEXT,
  user_id UUID REFERENCES profiles(id),
  cause_id UUID REFERENCES causes(id),
  team_id UUID REFERENCES teams(id),
  completed BOOLEAN DEFAULT false,
  completed_by UUID REFERENCES profiles(id),
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Retos
CREATE TABLE challenges (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  goal INTEGER,
  current_progress INTEGER DEFAULT 0,
  points_reward INTEGER DEFAULT 0,
  start_date DATE,
  end_date DATE,
  difficulty TEXT DEFAULT 'medio',
  photo_url TEXT,
  user_id UUID REFERENCES profiles(id),
  team_id UUID REFERENCES teams(id),
  is_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Voluntariados
CREATE TABLE volunteering (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  city TEXT,
  country TEXT,
  lat FLOAT,
  lng FLOAT,
  volunteers_needed INTEGER,
  volunteers_registered INTEGER DEFAULT 0,
  event_date DATE,
  duration TEXT,
  requirements TEXT,
  contact_info TEXT,
  photo_url TEXT,
  user_id UUID REFERENCES profiles(id),
  team_id UUID REFERENCES teams(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Historial de actividades del usuario
CREATE TABLE user_activities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL, -- 'cause_created', 'task_completed', etc.
  activity_id UUID, -- ID de la actividad específica
  points_earned INTEGER DEFAULT 0,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Códigos de Utilidad y Helpers

### Notificaciones del Sistema
```javascript
// public/js/notifications.js
function showNotification(message, type = 'success', duration = 5000) {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.innerHTML = `
    <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'times-circle' : 'info-circle'}"></i>
    <span>${message}</span>
    <button class="close-btn" onclick="this.parentElement.remove()">×</button>
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    if (notification.parentElement) {
      notification.remove();
    }
  }, duration);
}
```

### Sistema de Compartir
```javascript
// public/js/compartir.js
function renderCompartir({ title, summary, photo_url, link, type = 'causa' }, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const shareText = encodeURIComponent(`${title} - ${summary}`);
  const shareUrl = encodeURIComponent(link);
  
  container.innerHTML = `
    <div class="share-section">
      <h3><i class="fas fa-share-alt"></i> Comparte esta ${type}</h3>
      <div class="share-preview">
        <img src="${photo_url}" alt="${title}" class="share-image">
        <div class="share-content">
          <h4>${title}</h4>
          <p>${summary}</p>
          <div class="share-buttons">
            <a href="https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}" target="_blank" class="share-btn twitter">
              <i class="fab fa-twitter"></i> Twitter
            </a>
            <a href="https://www.facebook.com/sharer/sharer.php?u=${shareUrl}" target="_blank" class="share-btn facebook">
              <i class="fab fa-facebook"></i> Facebook
            </a>
            <a href="https://wa.me/?text=${shareText}%20${shareUrl}" target="_blank" class="share-btn whatsapp">
              <i class="fab fa-whatsapp"></i> WhatsApp
            </a>
            <button class="share-btn copy" onclick="copyToClipboard('${link}')">
              <i class="fas fa-copy"></i> Copiar enlace
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showNotification('Enlace copiado al portapapeles', 'success');
  });
}
```

## Configuración y Deployment

### Variables de Entorno
```javascript
// config.js
const config = {
  supabase: {
    url: process.env.SUPABASE_URL || 'https://cyftasxlrzuynzbrfgkd.supabase.co',
    anonKey: process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  },
  app: {
    name: 'Solidarity',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    port: process.env.PORT || 3000
  }
};
```

### Estructura de Archivos CSS
```css
/* public/css/style.css - Variables principales */
:root {
  --primary: #4a6fa5;
  --primary-dark: #166088;
  --accent: #4fc3a1;
  --accent-dark: #3da58a;
  --urgent: #e53e3e;
  --warning: #f59e42;
  --gold: #eab308;
  --light: #f8fafc;
  --dark: #2d3748;
  --gray: #e2e8f0;
  --success: #22c55e;
  --error: #ef4444;
  --info: #3b82f6;
}

/* Estilos base */
* { box-sizing: border-box; margin: 0; padding: 0; }
body { 
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  background: var(--light);
  color: var(--dark);
  line-height: 1.6;
}

/* Componentes principales */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-primary { background: var(--primary); color: white; }
.btn-primary:hover { background: var(--primary-dark); transform: translateY(-2px); }

.btn-accent { background: var(--accent); color: white; }
.btn-accent:hover { background: var(--accent-dark); }

.btn-outline { 
  background: transparent; 
  border: 2px solid var(--primary); 
  color: var(--primary); 
}
.btn-outline:hover { background: var(--primary); color: white; }
```

## Objetivos de Desarrollo Futuro

### Funcionalidades Planificadas
1. **Sistema de Mensajería**: Chat privado entre usuarios
2. **Eventos en Tiempo Real**: Notificaciones push y actualizaciones live
3. **Sistema de Donaciones**: Integración con pasarelas de pago
4. **API Pública**: Para integraciones con otras plataformas
5. **App Móvil**: Aplicación nativa iOS y Android
6. **IA para Recomendaciones**: Sugerencias personalizadas de causas
7. **Sistema de Mentorías**: Conexión entre usuarios experimentados y nuevos
8. **Certificaciones**: Validación de horas de voluntariado

### Métricas de Éxito
- **Usuarios activos mensuales**: 10,000+ en el primer año
- **Causas creadas**: 1,000+ causas activas
- **Puntos de impacto generados**: 1,000,000+ puntos totales
- **Horas de voluntariado**: 10,000+ horas registradas
- **Fondos recaudados**: 100,000€+ para causas

## Conclusión

Solidarity representa una plataforma integral para la acción social colaborativa, combinando tecnología moderna con gamificación efectiva para motivar la participación ciudadana en causas solidarias. Su arquitectura modular y escalable permite un crecimiento sostenible mientras mantiene la experiencia de usuario como prioridad central.

La plataforma está diseñada para ser más que una simple web de voluntariado: es un ecosistema completo donde cada acción cuenta, cada usuario importa y cada causa tiene el potencial de generar un impacto real y medible en la sociedad.

---

**Última actualización**: Julio 2025  
**Versión del documento**: 1.0  
**Estado del proyecto**: En desarrollo activo