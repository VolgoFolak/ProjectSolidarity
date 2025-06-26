/**
 * Renderiza un bloque de compartir SÚPER VISUAL y atractivo, con preview dinámica realista.
 * Llama a esta función pasando los datos de la actividad y el id del contenedor donde quieres mostrarlo.
 * Ejemplo:
 *   renderCompartir({
 *     title: 'Título de la causa',
 *     summary: 'Resumen de la causa',
 *     photo_url: '/img/causa.jpg',
 *     link: 'https://tusitio.com/causes/123'
 *   }, 'shareSectionCause');
 */

function renderCompartir({ title, summary, photo_url, link }, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  // Datos limpios para compartir
  const cleanTitle = title || 'Únete a esta causa solidaria';
  const cleanSummary = summary || 'Ayuda a hacer la diferencia';
  const cleanPhoto = photo_url || '/img/causa-default.jpg';
  const cleanLink = link || window.location.href;

  // HTML base súper mejorado
  container.innerHTML = `
    <div class="compartir-block" id="${containerId}-block">
      <div class="compartir-sparkles">✨</div>
      <h3 class="compartir-title">
        <i class="fas fa-share-alt compartir-icon"></i> 
        <span>¡Comparte esta experiencia!</span>
      </h3>
      <p class="compartir-subtitle">Ayuda a que más personas se unan a esta causa 💫</p>
      
      <div class="compartir-preview" id="${containerId}-preview">
        <!-- Preview dinámico se carga aquí -->
      </div>
      
      <div class="compartir-buttons-row">
        <button class="compartir-btn fb" data-network="facebook" data-container="${containerId}">
          <div class="btn-icon-wrapper">
            <i class="fab fa-facebook-f"></i>
          </div>
          <span>Facebook</span>
          <div class="btn-glow"></div>
        </button>
        <button class="compartir-btn wa" data-network="whatsapp" data-container="${containerId}">
          <div class="btn-icon-wrapper">
            <i class="fab fa-whatsapp"></i>
          </div>
          <span>WhatsApp</span>
          <div class="btn-glow"></div>
        </button>
        <button class="compartir-btn tw" data-network="twitter" data-container="${containerId}">
          <div class="btn-icon-wrapper">
            <i class="fab fa-twitter"></i>
          </div>
          <span>Twitter</span>
          <div class="btn-glow"></div>
        </button>
        <button class="compartir-btn link" data-network="copy" data-container="${containerId}">
          <div class="btn-icon-wrapper">
            <i class="fas fa-link"></i>
          </div>
          <span>Copiar</span>
          <div class="btn-glow"></div>
        </button>
      </div>
      
      <div class="compartir-hint">
        <i class="fas fa-mouse-pointer"></i>
        Haz clic para preview • Doble clic para compartir
      </div>
    </div>
    
    <style>
      .compartir-block {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 24px;
        padding: 2.5rem 2rem;
        box-shadow: 
          0 20px 40px rgba(102, 126, 234, 0.3),
          0 0 0 1px rgba(255,255,255,0.1) inset;
        margin: 2.5rem auto;
        text-align: center;
        max-width: 580px;
        position: relative;
        overflow: hidden;
        animation: compartirEntrance 0.8s cubic-bezier(.16,1,.3,1);
      }
      
      @keyframes compartirEntrance {
        0% { 
          opacity: 0; 
          transform: translateY(50px) scale(0.95);
          filter: blur(10px);
        }
        100% { 
          opacity: 1; 
          transform: none;
          filter: none;
        }
      }
      
      .compartir-sparkles {
        position: absolute;
        top: 1.5rem;
        right: 1.5rem;
        font-size: 1.5rem;
        animation: sparkle 2s infinite;
      }
      
      @keyframes sparkle {
        0%, 100% { transform: scale(1) rotate(0deg); opacity: 0.7; }
        50% { transform: scale(1.2) rotate(180deg); opacity: 1; }
      }
      
      .compartir-title {
        font-size: 1.65rem;
        font-weight: 800;
        color: #fff;
        margin-bottom: 0.5rem;
        display: flex;
        align-items: center;
        gap: 0.8rem;
        justify-content: center;
        letter-spacing: -0.5px;
        text-shadow: 0 2px 4px rgba(0,0,0,0.3);
      }
      
      .compartir-icon {
        animation: bounce 2s infinite;
      }
      
      @keyframes bounce {
        0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
        40% { transform: translateY(-8px); }
        60% { transform: translateY(-4px); }
      }
      
      .compartir-subtitle {
        color: rgba(255,255,255,0.9);
        font-size: 1.1rem;
        margin-bottom: 2rem;
        font-weight: 500;
      }
      
      .compartir-preview {
        margin-bottom: 2rem;
        min-height: 140px;
        transition: all 0.3s ease;
      }
      
      .preview-card {
        display: flex;
        gap: 1.3rem;
        align-items: flex-start;
        background: rgba(255,255,255,0.95);
        backdrop-filter: blur(10px);
        border-radius: 16px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.1);
        padding: 1.5rem;
        margin-bottom: 0.5rem;
        border: 1px solid rgba(255,255,255,0.2);
        animation: previewSlideIn 0.5s cubic-bezier(.16,1,.3,1);
        position: relative;
        overflow: hidden;
      }
      
      .preview-card::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 4px;
        background: linear-gradient(90deg, #667eea, #764ba2);
      }
      
      @keyframes previewSlideIn {
        0% { 
          opacity: 0; 
          transform: translateX(-30px) scale(0.95);
        }
        100% { 
          opacity: 1; 
          transform: none;
        }
      }
      
      .preview-img img {
        width: 100px;
        height: 100px;
        object-fit: cover;
        border-radius: 12px;
        border: 3px solid #667eea;
        background: #f0f0f0;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        transition: transform 0.2s;
      }
      
      .preview-img img:hover {
        transform: scale(1.05);
      }
      
      .preview-info {
        flex: 1;
        text-align: left;
        display: flex;
        flex-direction: column;
        justify-content: center;
      }
      
      .preview-title {
        font-size: 1.2rem;
        font-weight: 700;
        color: #2d3748;
        margin-bottom: 0.5rem;
        line-height: 1.3;
      }
      
      .preview-summary {
        color: #4a5568;
        font-size: 1rem;
        margin-bottom: 0.8rem;
        line-height: 1.5;
      }
      
      .preview-link {
        color: #667eea;
        font-size: 0.95rem;
        word-break: break-all;
        text-decoration: none;
        font-weight: 600;
      }
      
      .preview-label {
        font-size: 0.9rem;
        font-weight: 700;
        color: #fff;
        background: #667eea;
        border-radius: 20px;
        padding: 0.4rem 1rem;
        margin-bottom: 1rem;
        display: inline-block;
        letter-spacing: 0.5px;
        text-transform: uppercase;
        box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
      }
      
      .preview-label.fb { background: linear-gradient(45deg, #3b5998, #4267B2); }
      .preview-label.wa { background: linear-gradient(45deg, #25d366, #128C7E); }
      .preview-label.tw { background: linear-gradient(45deg, #1da1f2, #0d8bd9); }
      .preview-label.default { background: linear-gradient(45deg, #667eea, #764ba2); }
      
      .compartir-buttons-row {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
        gap: 1.2rem;
        margin-bottom: 1.5rem;
      }
      
      .compartir-btn {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
        padding: 1.2rem 1rem;
        border-radius: 16px;
        font-weight: 700;
        font-size: 0.95rem;
        border: none;
        cursor: pointer;
        transition: all 0.3s cubic-bezier(.16,1,.3,1);
        color: #fff;
        background: rgba(255,255,255,0.1);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255,255,255,0.2);
        overflow: hidden;
      }
      
      .btn-icon-wrapper {
        font-size: 1.5rem;
        transition: transform 0.3s;
      }
      
      .btn-glow {
        position: absolute;
        inset: 0;
        border-radius: 16px;
        opacity: 0;
        background: linear-gradient(45deg, transparent, rgba(255,255,255,0.1), transparent);
        transition: opacity 0.3s;
      }
      
      .compartir-btn:hover {
        transform: translateY(-4px) scale(1.02);
        box-shadow: 0 12px 24px rgba(0,0,0,0.2);
      }
      
      .compartir-btn:hover .btn-icon-wrapper {
        transform: scale(1.1) rotate(5deg);
      }
      
      .compartir-btn:hover .btn-glow {
        opacity: 1;
      }
      
      .compartir-btn.fb:hover { background: rgba(59, 89, 152, 0.3); }
      .compartir-btn.wa:hover { background: rgba(37, 211, 102, 0.3); }
      .compartir-btn.tw:hover { background: rgba(29, 161, 242, 0.3); }
      .compartir-btn.link:hover { background: rgba(102, 126, 234, 0.3); }
      
      .compartir-hint {
        font-size: 0.95rem;
        color: rgba(255,255,255,0.8);
        display: flex;
        align-items: center;
        gap: 0.5rem;
        justify-content: center;
        font-weight: 500;
      }
      
      .compartir-hint i {
        animation: pulse 2s infinite;
      }
      
      @keyframes pulse {
        0%, 100% { opacity: 0.8; }
        50% { opacity: 1; }
      }
      
      /* Responsive */
      @media (max-width: 640px) {
        .compartir-block {
          padding: 2rem 1.5rem;
          margin: 1.5rem auto;
        }
        .compartir-buttons-row {
          grid-template-columns: repeat(2, 1fr);
        }
        .preview-card {
          flex-direction: column;
          text-align: center;
        }
        .preview-info {
          text-align: center;
        }
      }
    </style>
  `;

  // Función para obtener el HTML de la preview según la red (MEJORADA)
  function getPreviewHtml(network) {
    let label = '';
    let labelClass = '';
    
    switch (network) {
      case 'facebook':
        label = '📘 Facebook Preview';
        labelClass = 'fb';
        break;
      case 'whatsapp':
        label = '💬 WhatsApp Preview';
        labelClass = 'wa';
        break;
      case 'twitter':
        label = '🐦 Twitter Preview';
        labelClass = 'tw';
        break;
      default:
        label = '🌟 Vista previa';
        labelClass = 'default';
    }
    
    return `
      <div class="preview-label ${labelClass}">${label}</div>
      <div class="preview-card">
        <div class="preview-img">
          <img src="${cleanPhoto}" alt="Imagen de la causa" onerror="this.src='/img/causa-default.jpg'">
        </div>
        <div class="preview-info">
          <div class="preview-title">${cleanTitle}</div>
          <div class="preview-summary">${cleanSummary}</div>
          <div class="preview-link">${cleanLink}</div>
        </div>
      </div>
    `;
  }

  // Event listeners para los botones
  const buttons = container.querySelectorAll('.compartir-btn');
  buttons.forEach(btn => {
    const network = btn.dataset.network;
    const containerId = btn.dataset.container;
    
    // Click simple: mostrar preview
    btn.addEventListener('click', () => {
      showPreview(containerId, network);
      
      // Feedback visual
      btn.style.transform = 'scale(0.95)';
      setTimeout(() => {
        btn.style.transform = '';
      }, 150);
    });
    
    // Doble click: compartir real
    btn.addEventListener('dblclick', () => {
      if (network === 'copy') {
        copyCompartirLink(cleanLink);
      } else {
        shareOnSocial(network, cleanLink, cleanTitle, cleanSummary);
      }
      
      // Efecto de éxito
      btn.style.background = 'rgba(72, 187, 120, 0.3)';
      setTimeout(() => {
        btn.style.background = '';
      }, 1000);
    });
  });

  // Función para cambiar preview (MEJORADA)
  window.showPreview = function(containerId, network) {
    const previewDiv = document.getElementById(containerId + '-preview');
    if (previewDiv) {
      previewDiv.style.opacity = '0';
      previewDiv.style.transform = 'translateY(10px)';
      
      setTimeout(() => {
        previewDiv.innerHTML = getPreviewHtml(network);
        previewDiv.style.opacity = '1';
        previewDiv.style.transform = 'none';
      }, 150);
    }
  };

  // Función para copiar enlace (MEJORADA)
  window.copyCompartirLink = function(link) {
    navigator.clipboard.writeText(link).then(() => {
      // Toast mejorado
      if (window.showToast) {
        showToast('🎉 ¡Enlace copiado!', 'success');
      } else {
        // Fallback visual
        const toast = document.createElement('div');
        toast.innerHTML = '🎉 ¡Enlace copiado!';
        toast.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          background: #48bb78;
          color: white;
          padding: 1rem 1.5rem;
          border-radius: 8px;
          z-index: 10000;
          animation: toastSlide 0.3s ease;
        `;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
      }
    }).catch(() => {
      prompt('Copia este enlace:', link);
    });
  };

  // Función para compartir en redes (MEJORADA)
  window.shareOnSocial = function(network, link, title, summary) {
    let url = '';
    let text = `${title}\n\n${summary}\n\n${link}`;
    
    switch (network) {
      case 'facebook':
        url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}&quote=${encodeURIComponent(text)}`;
        break;
      case 'twitter':
        // Twitter tiene límite de caracteres
        const shortText = `${title}\n\n${link}`;
        url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shortText)}`;
        break;
      case 'whatsapp':
        url = `https://wa.me/?text=${encodeURIComponent(text)}`;
        break;
      default:
        return;
    }
    
    // Abrir ventana con efecto
    const popup = window.open(url, '_blank', 'width=600,height=500,scrollbars=yes,resizable=yes');
    
    // Opcional: trackear si se comparte
    if (popup) {
      console.log(`Compartiendo en ${network}:`, { title, link });
    }
  };

  // Inicializar con preview por defecto
  setTimeout(() => {
    showPreview(containerId, 'default');
  }, 300);
}

// Añadir toast CSS si no existe
if (!document.querySelector('#toast-styles')) {
  const toastStyles = document.createElement('style');
  toastStyles.id = 'toast-styles';
  toastStyles.textContent = `
    @keyframes toastSlide {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: none; opacity: 1; }
    }
  `;
  document.head.appendChild(toastStyles);
}