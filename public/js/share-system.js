/**
 * Sistema universal de compartir para todas las secciones
 */

// Configuración de tipos de contenido
const CONTENT_TYPES = {
  causes: {
    name: 'causa',
    apiEndpoint: 'causes',
    globalVar: 'causes',
    shareText: 'Mira esta causa solidaria'
  },
  tasks: {
    name: 'tarea',
    apiEndpoint: 'tasks', 
    globalVar: 'tasks',
    shareText: 'Mira esta tarea de impacto'
  },
  tarea: {
    name: 'tarea',
    apiEndpoint: 'tasks', 
    globalVar: 'tasks',
    shareText: 'Mira esta tarea de impacto'
  },
  volunteering: {
    name: 'voluntariado',
    apiEndpoint: 'volunteering',
    globalVar: 'volunteering',
    shareText: 'Únete a este voluntariado'
  },
  voluntariado: {
    name: 'voluntariado',
    apiEndpoint: 'volunteering',
    globalVar: 'volunteering',
    shareText: 'Únete a este voluntariado'
  },
  challenges: {
    name: 'reto',
    apiEndpoint: 'challenges',
    globalVar: 'challenges', 
    shareText: 'Participa en este reto'
  },
  reto: {
    name: 'reto',
    apiEndpoint: 'challenges',
    globalVar: 'challenges', 
    shareText: 'Participa en este reto'
  },
  teams: {
    name: 'equipo',
    apiEndpoint: 'teams',
    globalVar: 'teams',
    shareText: 'Únete a este equipo'
  },
  equipo: {
    name: 'equipo',
    apiEndpoint: 'teams',
    globalVar: 'teams',
    shareText: 'Únete a este equipo'
  }
};

/**
 * Detecta el tipo de página y el ID específico desde la URL
 */
function detectContentFromURL() {
  const urlPath = window.location.pathname;
  
  // Patrones para detectar cada tipo
  const patterns = {
    causes: /\/causes\/([^\/]+)$/,
    tasks: /\/tasks\/([^\/]+)$/,
    tarea: /\/tarea\/([^\/]+)$/,
    volunteering: /\/volunteering\/([^\/]+)$/,
    voluntariado: /\/voluntariado\/([^\/]+)$/,
    challenges: /\/challenges\/([^\/]+)$/,
    reto: /\/reto\/([^\/]+)$/,
    teams: /\/teams\/([^\/]+)$/,
    equipo: /\/equipo\/([^\/]+)$/
  };
  
  for (const [type, pattern] of Object.entries(patterns)) {
    const match = urlPath.match(pattern);
    if (match) {
      return {
        type,
        id: match[1],
        config: CONTENT_TYPES[type]
      };
    }
  }
  
  return null;
}

/**
 * Función universal para abrir modal de contenido específico
 */
async function openSpecificContent() {
  const detection = detectContentFromURL();
  if (!detection) return;
  
  const { type, id, config } = detection;
  console.log(`🎯 URL detectada para ${config.name} específico:`, id);
  
  // Esperar a que se carguen los datos
  let attempts = 0;
  const maxAttempts = 20; // ✅ Aumentar intentos
  
  const waitAndShow = () => {
    attempts++;
    console.log(`🔄 Intento ${attempts}: Esperando ${config.name}s...`);
    
    const globalData = window[config.globalVar];
    if (globalData && globalData.length > 0) {
      const specificItem = globalData.find(item => item.id === id);
      
      if (specificItem) {
        console.log(`✅ ${config.name} encontrado, abriendo modal...`, specificItem);
        setTimeout(() => {
          // ✅ LLAMAR A LA FUNCIÓN CORRECTA
          if (type === 'tasks' || type === 'tarea') {
            if (window.showTaskModal) {
              window.showTaskModal(id);
            } else {
              showTaskModal(id);
            }
          } else if (type === 'challenges' || type === 'reto') {
            if (window.showChallengeModal) {
              window.showChallengeModal(id);
            } else {
              showChallengeModal(id);
            }
          } else if (type === 'volunteering' || type === 'voluntariado') {
            if (window.showVolunteeringModal) {
              window.showVolunteeringModal(id);
            } else {
              showVolunteeringModal(id);
            }
          } else if (type === 'teams' || type === 'equipo') {
            if (window.showTeamModal) {
              window.showTeamModal(id);
            } else {
              showTeamModal(id);
            }
          } else {
            // Fallback para causas y otros tipos
            const modalFunction = `show${type.charAt(0).toUpperCase() + type.slice(0, -1)}Modal`;
            if (window[modalFunction]) {
              window[modalFunction](id);
            }
          }
        }, 500);
      } else {
        console.error(`❌ ${config.name} no encontrado con ID:`, id);
        window.location.href = `/${type === 'tarea' ? 'tasks' : type}`;
      }
    } else if (attempts < maxAttempts) {
      setTimeout(waitAndShow, 1500); // ✅ Más tiempo entre intentos
    } else {
      console.error(`❌ Timeout buscando ${config.name}`);
      window.location.href = `/${type === 'tarea' ? 'tasks' : type}`;
    }
  };
  
  setTimeout(waitAndShow, 2000); // ✅ Dar más tiempo inicial
}

/**
 * Función universal para generar links de compartir
 */
function generateShareLink(type, item) {
  const config = CONTENT_TYPES[type];
  if (!config || !item) return null;
  
  return {
    title: item.title || item.name,
    summary: item.short_description || item.summary || item.description?.substring(0, 120) + '...',
    photo_url: item.photo_url || '/img/default.jpg',
    link: `${window.location.origin}/${type}/${item.id}`,
    shareText: config.shareText
  };
}

/**
 * Función universal de compartir (para usar en todas las páginas)
 */
window.universalShare = function(type, itemId) {
  const globalData = window[CONTENT_TYPES[type]?.globalVar];
  const item = globalData?.find(i => i.id == itemId);
  
  if (!item) {
    console.error(`❌ No se encontró ${type} con ID:`, itemId);
    return;
  }
  
  const shareData = generateShareLink(type, item);
  // ✅ AGREGAR EL TIPO para que aparezca el texto correcto
  shareData.type = type;
  
  console.log('🔗 Compartiendo:', shareData);
  
  renderCompartir(shareData, 'shareSection');
  
  document.getElementById('shareSection').scrollIntoView({ 
    behavior: 'smooth', 
    block: 'center' 
  });
};

// Auto-ejecutar detección al cargar la página
document.addEventListener('DOMContentLoaded', () => {
  // Pequeño delay para que otras funciones se ejecuten primero
  setTimeout(openSpecificContent, 2000);
});