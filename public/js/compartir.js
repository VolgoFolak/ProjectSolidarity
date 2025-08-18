/**
 * Sistema de compartir UNIVERSAL con puntos automáticos
 * Funciona para causas, tareas, retos, voluntariados, equipos, etc.
 */

class ShareSystem {
  constructor() {
    this.supabase = window.supabase;
    this.init();
  }

  async init() {
    // Esperar a que Supabase esté listo
    if (!this.supabase && window.supabaseReady) {
      this.supabase = window.supabase;
    } else if (!this.supabase) {
      document.addEventListener('supabaseReady', () => {
        this.supabase = window.supabase;
      }, { once: true });
    }
  }

  /**
   * Registrar compartido y otorgar puntos
   */
  async registerShare(activityId, activityType, platform = 'unknown') {
    try {
      // Verificar si el usuario está autenticado
      const { data: { session } } = await this.supabase.auth.getSession();
      if (!session) {
        console.log('Usuario no autenticado, no se registran puntos por compartir');
        return { success: false, message: 'Usuario no autenticado' };
      }

      const response = await fetch('/api/shares/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          activityId,
          activityType,
          platform
        })
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Error registrando compartido');
      }

      // Mostrar notificación de puntos si se otorgaron
      if (result.points > 0) {
        this.showPointsNotification(result.points, result.message);
      }

      return result;

    } catch (error) {
      console.error('Error registrando compartido:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Compartir en WhatsApp con puntos
   */
  async shareWhatsApp(activityId, activityType, text, url) {
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text + '\n\n' + url)}`;
    window.open(whatsappUrl, '_blank');
    
    // Registrar compartido después de un delay (asumiendo que el usuario compartió)
    setTimeout(async () => {
      await this.registerShare(activityId, activityType, 'whatsapp');
    }, 2000);
  }

  /**
   * Compartir en Facebook con puntos
   */
  async shareFacebook(activityId, activityType, url, quote = '') {
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(quote)}`;
    window.open(facebookUrl, '_blank');
    
    setTimeout(async () => {
      await this.registerShare(activityId, activityType, 'facebook');
    }, 2000);
  }

  /**
   * Compartir en Twitter con puntos
   */
  async shareTwitter(activityId, activityType, text, url) {
    const twitterText = text.length > 240 ? text.substring(0, 200) + '...' : text;
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(twitterText)}&url=${encodeURIComponent(url)}`;
    window.open(twitterUrl, '_blank');
    
    setTimeout(async () => {
      await this.registerShare(activityId, activityType, 'twitter');
    }, 2000);
  }

  /**
   * Copiar enlace con puntos
   */
  async copyLink(activityId, activityType, url) {
    try {
      await navigator.clipboard.writeText(url);
      this.showSuccessNotification('¡Enlace copiado al portapapeles!');
      
      // Registrar compartido por copia de enlace
      await this.registerShare(activityId, activityType, 'copy');
      
    } catch (error) {
      console.error('Error copiando enlace:', error);
      // Fallback para navegadores que no soportan clipboard
      prompt('Copia este enlace:', url);
      await this.registerShare(activityId, activityType, 'copy');
    }
  }

  /**
   * Mostrar notificación de puntos ganados
   */
  showPointsNotification(points, message) {
    const notification = document.createElement('div');
    notification.className = 'points-notification';
    notification.innerHTML = `
      <div style="
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #4CAF50, #45a049);
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 10px;
        box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
        z-index: 10000;
        animation: slideInRight 0.3s ease-out;
        font-family: 'Poppins', sans-serif;
      ">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <i class="fas fa-star" style="color: #FFD700;"></i>
          <strong>+${points} puntos</strong>
        </div>
        <div style="font-size: 0.9rem; margin-top: 0.2rem;">
          ${message}
        </div>
      </div>
    `;

    document.body.appendChild(notification);

    // Remover después de 3 segundos
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }

  /**
   * Mostrar notificación de éxito
   */
  showSuccessNotification(message) {
    const notification = document.createElement('div');
    notification.innerHTML = `
      <div style="
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10b981;
        color: white;
        padding: 0.8rem 1.2rem;
        border-radius: 8px;
        z-index: 10000;
        font-weight: 600;
        box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
        animation: slideInRight 0.3s ease;
      ">
        ${message}
      </div>
    `;

    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 2500);
  }
}

// Instancia global del sistema de compartir
window.shareSystem = new ShareSystem();

/**
 * Renderiza un bloque de compartir UNIVERSAL con puntos automáticos
 */
function renderCompartir({ title, summary, photo_url, link, type = 'causa', activityId }, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  // Limpiar contenido previo
  container.innerHTML = '';

  // Configuración de textos por tipo
  const typeConfig = {
    causa: {
      defaultTitle: 'Únete a esta causa solidaria',
      defaultSummary: 'Ayuda a hacer la diferencia',
      defaultImage: '/img/causa-default.jpg',
      headerText: 'Ayuda a difundir esta causa',
      placeholder: 'CAUSA',
      activityType: 'cause'
    },
    tarea: {
      defaultTitle: 'Únete a esta tarea de impacto',
      defaultSummary: 'Colabora en esta iniciativa',
      defaultImage: '/img/tarea-default.jpg',
      headerText: 'Comparte esta tarea',
      placeholder: 'TAREA',
      activityType: 'task'
    },
    reto: {
      defaultTitle: 'Participa en este reto',
      defaultSummary: 'Únete al desafío',
      defaultImage: '/img/reto-default.jpg',
      headerText: 'Comparte este reto',
      placeholder: 'RETO',
      activityType: 'challenge'
    },
    desafio: {
      defaultTitle: 'Participa en este desafío',
      defaultSummary: 'Únete al desafío',
      defaultImage: '/img/reto-default.jpg',
      headerText: 'Comparte este desafío',
      placeholder: 'RETO',
      activityType: 'challenge'
    },
    voluntariado: {
      defaultTitle: 'Únete a este voluntariado',
      defaultSummary: 'Haz la diferencia como voluntario',
      defaultImage: '/img/voluntariado-default.jpg',
      headerText: 'Comparte este voluntariado',
      placeholder: 'VOL',
      activityType: 'volunteering'
    },
    equipo: {
      defaultTitle: 'Únete a este equipo',
      defaultSummary: 'Forma parte de la comunidad',
      defaultImage: '/img/equipo-default.jpg',
      headerText: 'Comparte este equipo',
      placeholder: 'TEAM',
      activityType: 'team'
    }
  };

  const config = typeConfig[type] || typeConfig.causa;

  // Datos limpios para compartir
  const cleanTitle = title || config.defaultTitle;
  const cleanSummary = summary || config.defaultSummary;
  const cleanPhoto = photo_url || config.defaultImage;
  const cleanLink = link || window.location.href;
  
  // Extraer ID de la actividad desde la URL si no se proporciona
  const finalActivityId = activityId || extractActivityIdFromUrl();

  // HTML del componente de compartir
  container.innerHTML = `
    <div class="share-section">
      <h3><i class="fas fa-share-alt"></i> ${config.headerText}</h3>
      
      <!-- Vista previa estética -->
      <div class="share-preview">
        <div class="preview-card">
          <div class="preview-image">
            <img src="${cleanPhoto}" 
                 alt="Imagen del ${type}" 
                 onerror="this.src='https://via.placeholder.com/100x100/4fc3a1/ffffff?text=${config.placeholder}';">
          </div>
          <div class="preview-content">
            <h4 class="preview-title">${cleanTitle}</h4>
            <p class="preview-summary">${cleanSummary}</p>
            <div class="preview-link">${cleanLink}</div>
          </div>
        </div>
      </div>
      
      <!-- Botones de compartir con puntos -->
      <div class="share-buttons">
        <button class="share-btn facebook" data-activity-id="${finalActivityId}" data-activity-type="${config.activityType}">
          <i class="fab fa-facebook-f"></i>
          Facebook
        </button>
        <button class="share-btn whatsapp" data-activity-id="${finalActivityId}" data-activity-type="${config.activityType}">
          <i class="fab fa-whatsapp"></i>
          WhatsApp
        </button>
        <button class="share-btn twitter" data-activity-id="${finalActivityId}" data-activity-type="${config.activityType}">
          <i class="fab fa-twitter"></i>
          Twitter
        </button>
        <button class="share-btn copy-link" data-activity-id="${finalActivityId}" data-activity-type="${config.activityType}">
          <i class="fas fa-link"></i>
          Copiar enlace
        </button>
      </div>
      
      <div class="points-info">
        <i class="fas fa-star"></i>
        ¡Gana 5 puntos por cada compartido!
      </div>
    </div>
  `;

  // Adjuntar event listeners con sistema de puntos
  attachShareEventListeners(container, {
    title: cleanTitle,
    summary: cleanSummary,
    link: cleanLink,
    activityType: config.activityType
  });
}

/**
 * Extrae el ID de actividad de la URL actual
 */
function extractActivityIdFromUrl() {
  const path = window.location.pathname;
  const segments = path.split('/');
  
  // Patrones comunes: /causes/123, /tasks/456, etc.
  if (segments.length >= 3 && segments[2]) {
    return segments[2];
  }
  
  return null;
}

/**
 * Adjunta event listeners a los botones de compartir
 */
function attachShareEventListeners(container, shareData) {
  const buttons = container.querySelectorAll('.share-btn');
  
  buttons.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      
      const activityId = btn.dataset.activityId;
      const activityType = btn.dataset.activityType;
      const platform = btn.classList.contains('facebook') ? 'facebook' :
                      btn.classList.contains('whatsapp') ? 'whatsapp' :
                      btn.classList.contains('twitter') ? 'twitter' :
                      btn.classList.contains('copy-link') ? 'copy' : 'unknown';

      // Feedback visual
      btn.style.transform = 'scale(0.95)';
      setTimeout(() => { btn.style.transform = ''; }, 150);

      // Ejecutar acción de compartir con puntos
      try {
        switch (platform) {
          case 'facebook':
            await window.shareSystem.shareFacebook(activityId, activityType, shareData.link, `${shareData.title}\n\n${shareData.summary}`);
            break;
          case 'whatsapp':
            await window.shareSystem.shareWhatsApp(activityId, activityType, `${shareData.title}\n\n${shareData.summary}`, shareData.link);
            break;
          case 'twitter':
            await window.shareSystem.shareTwitter(activityId, activityType, shareData.title, shareData.link);
            break;
          case 'copy':
            await window.shareSystem.copyLink(activityId, activityType, shareData.link);
            break;
        }
      } catch (error) {
        console.error('Error compartiendo:', error);
      }
    });
  });
}

// CSS para las animaciones y estilos del sistema de puntos
if (!document.querySelector('#share-system-styles')) {
  const styles = document.createElement('style');
  styles.id = 'share-system-styles';
  styles.textContent = `
    @keyframes slideInRight {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }

    .share-section {
      background: #f8f9fa;
      border-radius: 8px;
      padding: 1.5rem;
      margin: 1.5rem 0;
      border: 1px solid #e9ecef;
    }
    
    .share-section h3 {
      margin: 0 0 1.5rem 0;
      font-size: 1.2rem;
      color: var(--primary, #4a6fa5);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      text-align: center;
      font-weight: 700;
    }
    
    .share-preview {
      margin-bottom: 1.5rem;
      background: white;
      border-radius: 10px;
      padding: 1.3rem;
      border: 1px solid #e9ecef;
      box-shadow: 0 2px 8px rgba(0,0,0,0.05);
    }
    
    .preview-card {
      display: flex;
      gap: 1.3rem;
      align-items: center;
    }
    
    .preview-image img {
      width: 90px;
      height: 90px;
      object-fit: cover;
      border-radius: 8px;
      border: 3px solid var(--accent, #4fc3a1);
      background: #f0f0f0;
      box-shadow: 0 3px 10px rgba(79, 195, 161, 0.2);
      transition: transform 0.2s ease;
    }
    
    .preview-image img:hover {
      transform: scale(1.05);
    }
    
    .preview-content {
      flex: 1;
      min-width: 0;
    }
    
    .preview-title {
      font-size: 1.1rem;
      font-weight: 700;
      color: var(--primary, #4a6fa5);
      margin: 0 0 0.5rem 0;
      line-height: 1.3;
    }
    
    .preview-summary {
      font-size: 0.9rem;
      color: #4b5563;
      margin: 0 0 0.6rem 0;
      line-height: 1.5;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    
    .preview-link {
      font-size: 0.8rem;
      color: var(--accent, #4fc3a1);
      font-weight: 600;
      word-break: break-all;
    }
    
    .share-buttons {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
      margin-bottom: 1rem;
    }
    
    .share-btn {
      flex: 1;
      min-width: 120px;
      padding: 0.6rem 0.8rem;
      border: none;
      border-radius: 6px;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.4rem;
      transition: all 0.2s ease;
      color: white;
    }
    
    .share-btn.facebook { background-color: #3b5998; }
    .share-btn.whatsapp { background-color: #25d366; }
    .share-btn.twitter { background-color: #1da1f2; }
    .share-btn.copy-link { background-color: var(--primary, #4a6fa5); }
    
    .share-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(0,0,0,0.15);
    }
    
    .share-btn.facebook:hover { background-color: #2d4373; }
    .share-btn.whatsapp:hover { background-color: #1eaa52; }
    .share-btn.twitter:hover { background-color: #1991db; }
    .share-btn.copy-link:hover { background-color: var(--primary-dark, #3a5682); }

    .points-info {
      background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      padding: 0.8rem;
      text-align: center;
      color: var(--primary, #4a6fa5);
      font-size: 0.9rem;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
    }

    .points-info i {
      color: #f59e0b;
    }
    
    /* Responsive */
    @media (max-width: 640px) {
      .share-buttons {
        flex-direction: column;
      }
      .share-btn {
        min-width: auto;
      }
      .preview-card {
        flex-direction: column;
        text-align: center;
        gap: 1rem;
      }
      .preview-content {
        text-align: center;
      }
      .preview-image img {
        width: 80px;
        height: 80px;
      }
    }
  `;
  document.head.appendChild(styles);
}

// Hacer funciones disponibles globalmente
window.renderCompartir = renderCompartir;