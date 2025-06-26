/**
 * Renderiza un bloque de compartir UNIVERSAL con vista previa estética y botones en fila
 * Funciona para causas, tareas, retos, voluntariados, equipos, etc.
 */

function renderCompartir({ title, summary, photo_url, link, type = 'causa' }, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  // Configuración de textos por tipo
  const typeConfig = {
    causa: {
      defaultTitle: 'Únete a esta causa solidaria',
      defaultSummary: 'Ayuda a hacer la diferencia',
      defaultImage: '/img/causa-default.jpg',
      headerText: 'Ayuda a difundir esta causa',
      placeholder: 'CAUSA'
    },
    tarea: {
      defaultTitle: 'Únete a esta tarea de impacto',
      defaultSummary: 'Colabora en esta iniciativa',
      defaultImage: '/img/tarea-default.jpg',
      headerText: 'Comparte esta tarea',
      placeholder: 'TAREA'
    },
    reto: {
      defaultTitle: 'Participa en este reto',
      defaultSummary: 'Únete al desafío',
      defaultImage: '/img/reto-default.jpg',
      headerText: 'Comparte este reto',
      placeholder: 'RETO'
    },
    desafio: {
      defaultTitle: 'Participa en este desafío',
      defaultSummary: 'Únete al desafío',
      defaultImage: '/img/reto-default.jpg',
      headerText: 'Comparte este desafío',
      placeholder: 'RETO'
    },
    voluntariado: {
      defaultTitle: 'Únete a este voluntariado',
      defaultSummary: 'Haz la diferencia como voluntario',
      defaultImage: '/img/voluntariado-default.jpg',
      headerText: 'Comparte este voluntariado',
      placeholder: 'VOL'
    },
    equipo: {
      defaultTitle: 'Únete a este equipo',
      defaultSummary: 'Forma parte de la comunidad',
      defaultImage: '/img/equipo-default.jpg',
      headerText: 'Comparte este equipo',
      placeholder: 'TEAM'
    }
  };

  const config = typeConfig[type] || typeConfig.causa;

  // Datos limpios para compartir
  const cleanTitle = title || config.defaultTitle;
  const cleanSummary = summary || config.defaultSummary;
  const cleanPhoto = photo_url || config.defaultImage;
  const cleanLink = link || window.location.href;

  // Debug: verificar datos
  console.log(`🔗 Datos para compartir ${type}:`, { cleanTitle, cleanSummary, cleanPhoto, cleanLink });

  // Función para obtener el HTML de la preview según la red
  function getPreviewHtml(network) {
    return `
      <div class="preview-card">
        <div class="preview-image">
          <img src="${cleanPhoto}" 
               alt="Imagen del ${type}" 
               onerror="console.error('Error cargando imagen:', this.src); this.src='https://via.placeholder.com/100x100/4fc3a1/ffffff?text=${config.placeholder}';"
               onload="console.log('✅ Imagen cargada:', this.src);">
        </div>
        <div class="preview-content">
          <h4 class="preview-title">${cleanTitle}</h4>
          <p class="preview-summary">${cleanSummary}</p>
          <div class="preview-link">${cleanLink}</div>
        </div>
      </div>
    `;
  }

  // HTML con estilo original simple + preview en medio
  container.innerHTML = `
    <div class="share-section">
      <h3><i class="fas fa-share-alt"></i> ${config.headerText}</h3>
      
      <!-- Vista previa estética -->
      <div class="share-preview" id="${containerId}-preview">
        ${getPreviewHtml('default')}
      </div>
      
      <!-- Botones originales en fila -->
      <div class="share-buttons">
        <button class="share-btn facebook" data-network="facebook" data-container="${containerId}">
          <i class="fab fa-facebook-f"></i>
          Facebook
        </button>
        <button class="share-btn whatsapp" data-network="whatsapp" data-container="${containerId}">
          <i class="fab fa-whatsapp"></i>
          WhatsApp
        </button>
        <button class="share-btn twitter" data-network="twitter" data-container="${containerId}">
          <i class="fab fa-twitter"></i>
          Twitter
        </button>
        <button class="share-btn copy-link" data-network="copy" data-container="${containerId}">
          <i class="fas fa-link"></i>
          Copiar enlace
        </button>
      </div>
    </div>
    
    <style>
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
      
      /* VISTA PREVIA ESTÉTICA */
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
      
      .preview-image {
        flex-shrink: 0;
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
      
      /* BOTONES ORIGINALES */
      .share-buttons {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
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
      
      .share-btn.facebook {
        background-color: #3b5998;
      }
      
      .share-btn.whatsapp {
        background-color: #25d366;
      }
      
      .share-btn.twitter {
        background-color: #1da1f2;
      }
      
      .share-btn.copy-link {
        background-color: var(--primary, #4a6fa5);
      }
      
      .share-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(0,0,0,0.15);
      }
      
      .share-btn.facebook:hover { background-color: #2d4373; }
      .share-btn.whatsapp:hover { background-color: #1eaa52; }
      .share-btn.twitter:hover { background-color: #1991db; }
      .share-btn.copy-link:hover { background-color: var(--primary-dark, #3a5682); }
      
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
    </style>
  `;

  // Event listeners para los botones
  const buttons = container.querySelectorAll('.share-btn');
  buttons.forEach(btn => {
    const network = btn.dataset.network;
    const containerIdBtn = btn.dataset.container;
    
    btn.addEventListener('click', () => {
      // Mostrar preview
      const previewDiv = document.getElementById(containerIdBtn + '-preview');
      if (previewDiv) {
        previewDiv.style.opacity = '0.7';
        setTimeout(() => {
          previewDiv.innerHTML = getPreviewHtml(network);
          previewDiv.style.opacity = '1';
        }, 200);
      }
      
      // Feedback visual
      btn.style.transform = 'scale(0.95)';
      setTimeout(() => {
        btn.style.transform = '';
        
        // Compartir después de mostrar preview
        if (network === 'copy') {
          copyCompartirLink(cleanLink);
        } else {
          shareOnSocial(network, cleanLink, cleanTitle, cleanSummary);
        }
      }, 300);
    });
  });

  // Función para copiar enlace
  window.copyCompartirLink = function(link) {
    navigator.clipboard.writeText(link).then(() => {
      // Toast simple
      const toast = document.createElement('div');
      toast.innerHTML = '✅ ¡Enlace copiado!';
      toast.style.cssText = `
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
        animation: slideIn 0.3s ease;
      `;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 2500);
    }).catch(() => {
      prompt('Copia este enlace:', link);
    });
  };

  // Función para compartir en redes
  window.shareOnSocial = function(network, link, title, summary) {
    let url = '';
    let text = `${title}\n\n${summary}\n\n${link}`;
    
    switch (network) {
      case 'facebook':
        url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}&quote=${encodeURIComponent(text)}`;
        break;
      case 'twitter':
        const shortText = `${title}\n\n${link}`;
        url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shortText)}`;
        break;
      case 'whatsapp':
        url = `https://wa.me/?text=${encodeURIComponent(text)}`;
        break;
      default:
        return;
    }
    
    window.open(url, '_blank', 'width=600,height=500,scrollbars=yes,resizable=yes');
  };
}

// CSS para animaciones
if (!document.querySelector('#share-animations')) {
  const styles = document.createElement('style');
  styles.id = 'share-animations';
  styles.textContent = `
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: none; opacity: 1; }
    }
  `;
  document.head.appendChild(styles);
}