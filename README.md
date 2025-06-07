# Solidarity Web - Documentación Completa

## ¿Qué es Solidarity?

**Solidarity** es una plataforma web colaborativa y gamificada para impulsar la solidaridad y el impacto social. Permite a personas y organizaciones crear, coordinar y participar en comunidades, causas, tareas, retos y voluntariados, sumando puntos de impacto y motivando la acción colectiva.

---

## Tabla de Contenidos

- [Estética y estructura global (HEAD y estilos)](#estética-y-estructura-global-head-y-estilos)
- [Características principales](#características-principales)
- [Dinámicas y lógica de la plataforma](#dinámicas-y-lógica-de-la-plataforma)
- [Estructura de datos](#estructura-de-datos)
- [Explicación de cada sección y código clave](#explicación-de-cada-sección-y-código-clave)
  - [Comunidades (Equipos)](#comunidades-equipos)
  - [Causas](#causas)
  - [Tareas](#tareas)
  - [Retos](#retos)
  - [Voluntariado](#voluntariado)
  - [Mapa de Ayudas](#mapa-de-ayudas)
  - [Perfil y Gamificación](#perfil-y-gamificación)
  - [Chat y Coordinación](#chat-y-coordinación)
  - [Autenticación](#autenticación)
- [Gamificación y Engagement](#gamificación-y-engagement)
- [Ejemplo de flujo de usuario](#ejemplo-de-flujo-de-usuario)
- [Variables y funciones clave](#variables-y-funciones-clave)
- [Ejemplo de código por sección](#ejemplo-de-código-por-sección)
- [Cómo restaurar comunidades de ejemplo](#cómo-restaurar-comunidades-de-ejemplo)
- [Licencia](#licencia)

---

## Estética y estructura global (HEAD y estilos)

El diseño de Solidarity es moderno, accesible y amigable, con colores suaves y acentos en azul y verde.  
El `<head>` de cada página incluye:

```html
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Solidarity - [Sección]</title>
    <link rel="stylesheet" href="/styles.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        :root {
            --primary: #4a6fa5;
            --accent: #4fc3a1;
            --bg: #f8fafc;
            --card: #fff;
            --shadow: 0 5px 18px rgba(0,0,0,0.07);
        }
        body { background: var(--bg); }
        /* ...muchos estilos para tarjetas, formularios, navbar, chat, notificaciones... */
        .notification {
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 12px 16px;
            border-radius: 4px;
            color: white;
            display: flex;
            align-items: center;
            gap: 8px;
            z-index: 1000;
            animation: slideIn 0.3s ease-out;
        }
        .notification.success { background-color: #4CAF50;}
        .notification.info { background-color: #2196F3;}
        @keyframes slideIn { from { transform: translateY(100px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    </style>
</head>
```

**Colores principales:**  
- Azul (`--primary`): #4a6fa5  
- Verde (`--accent`): #4fc3a1  
- Fondo claro (`--bg`): #f8fafc  
- Tarjetas blancas, bordes suaves, sombras ligeras.

**Iconografía:**  
- FontAwesome para iconos sociales, de acción y gamificación.

---

## Características principales

- **Comunidades (Equipos):** Crea o únete a comunidades temáticas que gestionan causas, tareas, retos y voluntariados.
- **Causas:** Proyectos solidarios con objetivos concretos.
- **Tareas:** Acciones puntuales para sumar al impacto de una causa o comunidad.
- **Retos:** Objetivos gamificados colectivos o individuales.
- **Voluntariado:** Ofertas y demandas de voluntariado.
- **Mapa de Ayudas:** Visualización geolocalizada de acciones y necesidades.
- **Perfil:** Historial, puntos de impacto, logros y ranking.
- **Chat:** Comunicación interna en cada comunidad.
- **Gamificación:** Puntos, logros, badges, ranking y notificaciones motivacionales.
- **Autenticación:** Registro, login y gestión de sesión.

---

## Dinámicas y lógica de la plataforma

- **Engagement:** El usuario es motivado a participar mediante puntos de impacto, retos, logros y notificaciones.
- **Impacto colectivo:** Los puntos individuales suman al total de la comunidad.
- **Coordinación:** Chat interno, tableros y calendario para organizar acciones.
- **Crecimiento:** Los usuarios pueden crear nuevas comunidades y liderar acciones.
- **Transparencia:** Estadísticas de impacto y beneficiarios visibles para todos.

---

## Estructura de datos

### Comunidad (Equipo)
```js
{
  id: Number,
  name: String,
  desc: String,
  avatar: String,
  tags: [String],
  members: [{id, name, avatar, role}],
  stats: {
    totalBeneficiaries: Number,
    activeCauses: Number,
    activeTasks: Number,
    activeChallenges: Number,
    totalImpact: Number,
    lastMonthImpact: Number
  },
  linkedActivities: {
    causes: [String],
    tasks: [String],
    challenges: [String]
  },
  chat: [{user, avatar, msg, time}],
  lastActivity: Date
}
```

### Causa
```js
{
  id: Number,
  title: String,
  desc: String,
  communityId: Number,
  status: String,
  beneficiaries: Number,
  tasks: [taskId],
  challenges: [challengeId]
}
```

### Tarea
```js
{
  id: Number,
  title: String,
  desc: String,
  assignedTo: userId,
  completed: Boolean,
  points: Number,
  deadline: Date
}
```

### Reto
```js
{
  id: Number,
  title: String,
  desc: String,
  goal: Number,
  progress: Number,
  deadline: Date,
  completed: Boolean,
  participants: [userId]
}
```

### Usuario (Perfil)
```js
{
  id: Number,
  name: String,
  avatar: String,
  communities: [communityId],
  impactPoints: Number,
  history: [{date, action, points, details}],
  badges: [String]
}
```

---

## Explicación de cada sección y código clave

### Comunidades (Equipos)

- **Crear comunidad:** Formulario para nombre, descripción, áreas de acción y avatar.
- **Unirse a comunidad:** Botón en cada tarjeta de comunidad.
- **Ver detalles:** Muestra estadísticas, causas, tareas y retos activos.
- **Chat:** Comunicación interna para coordinación.
- **Puntos:** Crear o unirse suma puntos de impacto.

#### Código clave (crear comunidad)
```js
document.getElementById('teamForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const name = document.getElementById('teamName').value;
    const desc = document.getElementById('teamDesc').value;
    const tags = document.getElementById('teamTags').value.split(',').map(t => t.trim()).filter(Boolean);
    const avatar = document.getElementById('teamAvatar').value || "https://randomuser.me/api/portraits/lego/2.jpg";
    const userName = localStorage.getItem('userName') || 'Usuario Demo';
    const userAvatar = localStorage.getItem('userAvatar') || 'https://randomuser.me/api/portraits/lego/1.jpg';
    const newTeam = {
        id: Date.now(),
        name,
        desc,
        tags: tags.length ? tags : ["solidaridad"],
        avatar,
        members: [{
            id: Date.now(),
            name: userName,
            avatar: userAvatar,
            role: "Coordinador/a"
        }],
        stats: {
            totalBeneficiaries: 0,
            activeCauses: 0,
            activeTasks: 0,
            activeChallenges: 0,
            totalImpact: 0,
            lastMonthImpact: 0
        },
        linkedActivities: { causes: [], tasks: [], challenges: [] },
        chat: [],
        lastActivity: new Date().toISOString()
    };
    teams.unshift(newTeam);
    localStorage.setItem('solidarityTeams', JSON.stringify(teams));
    updateUserImpactPoints(100, `Creación de la comunidad ${name}`);
    renderTeams();
    this.reset();
    showNotification(`¡Comunidad "${name}" creada con éxito! Ganaste 100 puntos de impacto.`, 'success');
});
```

### Causas

- **Listado de causas:** Asociadas a comunidades o independientes.
- **Participar:** Sumar tareas, retos o voluntariado a una causa.
- **Impacto:** Cada causa suma beneficiarios y puntos.

#### Código clave (estructura de causa)
```js
const causes = [
    {
        id: 1,
        title: "Reforestación urbana",
        desc: "Plantación de árboles en zonas urbanas.",
        communityId: 1,
        status: "activa",
        beneficiaries: 120,
        tasks: [1,2],
        challenges: [1]
    }
];
```

### Tareas

- **Listado de tareas:** Por causa o comunidad.
- **Asignación:** El usuario puede tomar una tarea.
- **Completar:** Marca como realizada y suma puntos.

#### Código clave (completar tarea)
```js
function completeTask(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (task && !task.completed) {
        task.completed = true;
        updateUserImpactPoints(task.points, `Tarea completada: ${task.title}`);
        showNotification(`¡Tarea "${task.title}" completada!`, 'success');
        // Actualizar localStorage y UI...
    }
}
```

### Retos

- **Listado de retos:** Por comunidad o causa.
- **Participar:** El usuario se apunta y suma progreso.
- **Completar:** Suma puntos a todos los participantes.

#### Código clave (estructura de reto)
```js
const challenges = [
    {
        id: 1,
        title: "100 árboles plantados",
        desc: "Reto colectivo de reforestación.",
        goal: 100,
        progress: 45,
        deadline: "2024-12-31",
        completed: false,
        participants: [1,2,3]
    }
];
```

### Voluntariado

- **Ofertas y demandas:** Publicadas por comunidades o usuarios.
- **Inscripción:** El usuario se apunta y recibe instrucciones.

#### Código clave (estructura de voluntariado)
```js
const volunteeringOffers = [
    {
        id: 1,
        title: "Voluntariado en comedor social",
        desc: "Ayuda a servir comidas los viernes.",
        communityId: 2,
        slots: 5,
        signedUp: [1,4]
    }
];
```

### Mapa de Ayudas

- **Visualización:** Muestra causas, tareas y comunidades en un mapa.
- **Filtrado:** Por tipo de acción, área o urgencia.

#### Código clave (estructura de punto en el mapa)
```js
const mapPoints = [
    {
        id: 1,
        type: "causa",
        title: "Reforestación urbana",
        lat: 41.3879,
        lng: 2.16992,
        communityId: 1
    }
];
```

### Perfil y Gamificación

- **Historial:** Acciones, tareas y retos completados.
- **Puntos de impacto:** Total y desglose por acción.
- **Badges:** Logros por hitos (ej: 10 tareas, 3 retos, 1000 puntos).
- **Ranking:** Comparativa con otros usuarios y comunidades.

#### Código clave (estructura de perfil)
```js
const userProfile = {
    id: 1,
    name: "Laura",
    avatar: "https://randomuser.me/api/portraits/women/44.jpg",
    communities: [1,2],
    impactPoints: 1200,
    history: [
        {date: "2024-05-01", action: "Tarea completada", points: 20, details: "Limpieza parque"},
        {date: "2024-05-02", action: "Reto superado", points: 100, details: "100 árboles plantados"}
    ],
    badges: ["Eco Líder", "Voluntario Activo"]
};
```

### Chat y Coordinación

- **Chat interno:** En cada comunidad.
- **Notificaciones:** Mensajes emergentes por logros, acciones y novedades.

#### Código clave (enviar mensaje al chat)
```js
document.getElementById('chatForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const input = document.getElementById('chatInput');
    const msg = input.value.trim();
    if (!msg) return;
    const team = teams[selectedTeamIndex];
    const userName = localStorage.getItem('userName') || 'Usuario Demo';
    const userAvatar = localStorage.getItem('userAvatar') || 'https://randomuser.me/api/portraits/lego/1.jpg';
    team.chat.push({
        user: userName,
        avatar: userAvatar,
        msg: msg,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    team.lastActivity = new Date().toISOString();
    localStorage.setItem('solidarityTeams', JSON.stringify(teams));
    renderChat();
    input.value = '';
    renderTeams();
});
```

### Autenticación

- **Registro y login:** Acceso a funcionalidades avanzadas.
- **Gestión de sesión:** Estado visible en la interfaz.

#### Código clave (gestión de sesión)
```js
function updateAuthUI(isLoggedIn, userData = null) {
    const authButtons = document.getElementById('auth-buttons');
    const userInfo = document.getElementById('user-info');
    if (isLoggedIn) {
        authButtons.style.display = 'none';
        userInfo.style.display = 'flex';
        if (userData) {
            document.getElementById('user-photo').src = userData.photo || "https://randomuser.me/api/portraits/lego/1.jpg";
            document.getElementById('user-name').textContent = userData.name || userData.username || 'Usuario';
            localStorage.setItem('userName', userData.name || userData.username);
            localStorage.setItem('userAvatar', userData.photo || "https://randomuser.me/api/portraits/lego/1.jpg");
        }
    } else {
        authButtons.style.display = '';
        userInfo.style.display = 'none';
        localStorage.removeItem('userName');
        localStorage.removeItem('userAvatar');
    }
}
```

---

## Gamificación y Engagement

- **Puntos de impacto:** Por crear, unirse, completar tareas y retos.
- **Retos:** Objetivos colectivos e individuales.
- **Ranking:** Usuarios y comunidades.
- **Badges:** Por hitos y participación.
- **Notificaciones:** Motivacionales y de progreso.

---

## Ejemplo de flujo de usuario

1. El usuario se registra o inicia sesión.
2. Crea o se une a una comunidad.
3. Participa en causas, tareas y retos.
4. Suma puntos de impacto y ve su progreso.
5. Usa el chat para coordinarse.
6. Recibe notificaciones por logros.
7. Consulta su ranking y perfil.

---

## Variables y funciones clave

- **teams**: Array de comunidades activas.
- **userImpact**: Objeto con puntos totales e historial del usuario.
- **renderTeams()**: Muestra las comunidades activas.
- **joinTeam(idx)**: Unirse a una comunidad.
- **updateUserImpactPoints(points, reason)**: Suma puntos al usuario.
- **showNotification(message, type)**: Notificaciones emergentes.
- **openChat(idx)** y **renderChat()**: Chat de comunidad.
- **localStorage**: Almacenamiento persistente en el navegador.

---

## Ejemplo de código por sección

(Ver ejemplos en cada sección anterior.)

---

## Cómo restaurar comunidades de ejemplo

El sistema recarga automáticamente las comunidades de ejemplo si no hay ninguna guardada.  
Si alguna vez necesitas restaurarlas manualmente, ejecuta en la consola del navegador:

```js
localStorage.removeItem('solidarityTeams');
location.reload();
```

---

## Licencia

Este proyecto es de código abierto y puede ser adaptado para fines sociales y educativos.  
Por favor, mantén la atribución a la plataforma Solidarity.

---

**¡Gracias por contribuir a la solidaridad digital!**
