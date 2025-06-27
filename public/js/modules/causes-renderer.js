/**
 * Módulo para renderizar tarjetas y modales de causas
 * Template basado EXACTAMENTE en views/causes/index.njk
 */

class CausesRenderer {
  constructor() {
    this.causes = [];
    this.currentFilter = "all";
  }

  /**
   * Renderiza una grilla de tarjetas de causas (EXACTO al código original)
   */
  renderGrid(causes, container, options = {}) {
    this.causes = causes;
    container.innerHTML = '';

    if (!causes || causes.length === 0) {
      container.innerHTML = '<div style="color:#6b7280;text-align:center;padding:2rem;grid-column:1/-1;">No se encontraron causas.</div>';
      return;
    }

    // Aplicar estilos de grid si no existen
    if (!container.classList.contains('causes-grid')) {
      container.className = 'causes-grid';
      this.injectGridStyles();
    }

    causes.forEach(cause => {
      const card = this.createCauseCard(cause, options);
      container.appendChild(card);
    });

    // Guardar causas globalmente para compatibilidad
    window.causes = causes;

    this.attachEventListeners(container);
  }

  /**
   * Crea una tarjeta individual de causa (EXACTO al template original)
   */
  createCauseCard(cause, options = {}) {
    const progress = cause.goal ? Math.min(Math.round((cause.raised / cause.goal) * 100), 100) : 0;
    const urgentBadge = cause.urgent ? `<div class="cause-badge urgent"><i class="fas fa-exclamation-circle"></i> Urgente</div>` : "";
    const pointsBadge = `<div class="cause-badge points"><i class="fas fa-star"></i> +${cause.points || 0} pts</div>`;
    const location = cause.city && cause.country ? `${cause.city}, ${cause.country}` : "";

    const card = document.createElement('div');
    card.className = 'cause-card';
    
    // ✅ TEMPLATE EXACTO del código original
    card.innerHTML = `
      <div class="cause-image">
        <img src="${cause.photo_url || '/img/causa-default.jpg'}" alt="${cause.title}" 
             onerror="if (!this._defaulted) { this._defaulted = true; this.src='/img/causa-default.jpg'; }">
        ${urgentBadge}
        ${pointsBadge}
      </div>
      <div class="cause-content">
        <h3>${cause.title}</h3>
        <p>${cause.short_description || ''}</p>
        <div class="cause-meta">
          <div class="meta-item"><i class="fas fa-map-marker-alt"></i> ${location}</div>
          <div class="meta-item"><i class="fas fa-users"></i> ${cause.donors || 0} donantes</div>
          <div class="beneficiaries-count">
            <i class="fas fa-heart"></i> Beneficia a ${cause.beneficiaries || 0} personas
          </div>
        </div>
        <div class="cause-progress">
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${progress}%"></div>
          </div>
          <div class="progress-info">
            <span>${progress}% completado</span>
            <span>${cause.raised || 0} € de ${cause.goal || 0} €</span>
          </div>
        </div>
        <div class="cause-actions">
          <button class="btn btn-primary view-cause-btn" data-cause-id="${cause.id}">Ver más</button>
          <a href="#" class="btn btn-accent">Donar</a>
        </div>
      </div>
    `;

    return card;
  }

  /**
   * Muestra el modal con EXACTO el template del código original
   */
  async showModal(causeId) {
    const cause = window.causes?.find(c => c.id == causeId);
    if (!cause) {
      console.error('❌ Causa no encontrada:', causeId);
      return;
    }
    
    const progress = cause.goal ? Math.min(Math.round((cause.raised / cause.goal) * 100), 100) : 0;
    const createdDate = new Date(cause.created_at).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Obtener o crear el modal
    const modal = this.getOrCreateModal();
    const modalBody = modal.querySelector('#modalBody');

    // ✅ TEMPLATE EXACTO del modal original
    modalBody.innerHTML = `
      <div class="modal-cause-container">
        <!-- Título principal centrado, más espacio abajo -->
        <h1 class="modal-cause-title" style="font-size:2rem; font-weight:800; color:var(--primary); margin-bottom:2.7rem; text-align:center; width:100%;">${cause.title}</h1>
        <div class="modal-cause-header" style="display:flex; gap:2.5rem; margin-bottom:2.7rem;">
          <div class="modal-cause-image-wrapper" style="flex:1; min-width:320px; height:300px; border-radius:12px; overflow:hidden; position:relative; box-shadow:0 4px 12px rgba(0,0,0,0.08);">
            <!-- Badge arriba a la izquierda, verde -->
            <div class="modal-cause-badge" style="top:1.2rem; left:1.2rem; right:auto; background:var(--accent); color:white; position:absolute;">
              <i class="fas fa-hands-helping"></i> Causa Solidaria
            </div>
            <img class="modal-cause-image" src="${cause.photo_url || '/img/causa-default.jpg'}" 
                 alt="Imagen de la causa ${cause.title}"
                 style="width:100%;height:100%;object-fit:cover;"
                 onerror="this.src='/img/causa-default.jpg'">
            ${cause.urgent ? `
            <div class="modal-cause-badge urgent" style="right:1.2rem; left:auto; top:1.2rem; background:var(--urgent); color:white;">
              <i class="fas fa-exclamation-circle"></i> Urgente
            </div>` : ''}
          </div>
          <!-- Info a la derecha de la foto -->
          <div class="modal-cause-info" style="flex:1.5; display:flex; flex-direction:column; justify-content:flex-start;">
            <div class="modal-cause-progress-container" style="background:#f8fafc; padding:1.2rem; border-radius:12px; margin-bottom:1.2rem; border:1px solid #e5e7eb;">
              <div class="progress-bar">
                <div class="progress-fill" style="width: ${progress}%"></div>
              </div>
              <div class="progress-info">
                <span>${progress}% completado</span>
                <span>${cause.raised || 0} € de ${cause.goal || 0} €</span>
              </div>
            </div>
            <!-- Meta compacta en dos columnas -->
            <div class="modal-cause-meta-grid" style="display:grid; grid-template-columns:1fr 1fr; gap:0.7rem 1.2rem; margin-bottom:1.2rem;">
              <div class="meta-item">
                <span class="meta-icon"><i class="fas fa-map-marker-alt"></i></span>
                <span>${cause.city || 'Sin ubicación'}${cause.country ? ', ' + cause.country : ''}</span>
              </div>
              <div class="meta-item">
                <span class="meta-icon"><i class="fas fa-users"></i></span>
                <span>${cause.donors || 0} donantes</span>
              </div>
              <div class="meta-item">
                <span class="meta-icon"><i class="fas fa-heart"></i></span>
                <span>${cause.beneficiaries || 0} beneficiarios</span>
              </div>
              <div class="meta-item">
                <span class="meta-icon"><i class="fas fa-calendar-alt"></i></span>
                <span>${createdDate}</span>
              </div>
            </div>
            <div class="points-notice" style="background:#f0f9ff; border-left:4px solid var(--accent); padding:0.8rem; border-radius:0 8px 8px 0; font-size:0.97rem; display:flex; align-items:center; gap:0.7rem;">
              <i class="fas fa-star" style="color: var(--accent);"></i>
              Cada euro donado recibirá <strong>${cause.points || 20} puntos</strong> de impacto
            </div>
          </div>
        </div>
        <!-- Resumen y descripción debajo, con más espacio entre bloques -->
        <div class="modal-cause-content" style="margin-top:0;">
          <div class="content-section" style="margin-bottom:2.2rem;">
            <h3 class="content-title" style="font-size:1.2rem; font-weight:600; color:var(--primary); margin-bottom:0.9rem; display:flex; align-items:center; gap:0.7rem;">
              <i class="fas fa-align-left"></i> Resumen
            </h3>
            <p class="content-text" style="line-height:1.7; color:#4b5563; font-size:1.05rem; margin-left:0; margin-right:0; text-align:justify;">${cause.short_description || 'No hay resumen disponible para esta causa.'}</p>
          </div>
          <div class="content-section" style="margin-bottom:2.2rem;">
            <h3 class="content-title" style="font-size:1.2rem; font-weight:600; color:var(--primary); margin-bottom:0.9rem; display:flex; align-items:center; gap:0.7rem;">
              <i class="fas fa-info-circle"></i> Descripción completa
            </h3>
            <p class="content-text" style="line-height:1.7; color:#4b5563; font-size:1.05rem; margin-left:0; margin-right:0; text-align:justify;">${cause.description || 'No hay descripción detallada disponible para esta causa.'}</p>
          </div>
        </div>
        <!-- Botones abajo, con más espacio arriba -->
        <div class="cause-actions" style="display:flex; gap:0.8rem; margin-top:2.2rem;">
          <button class="btn btn-primary" style="flex:1;" onclick="donateToCause('${cause.id}')">
            <i class="fas fa-donate"></i> Donar ahora
          </button>
          <button class="btn btn-accent" style="flex:1;" onclick="joinCause('${cause.id}')">
            <i class="fas fa-hands-helping"></i> Participar
          </button>
          <button class="btn btn-outline" style="flex:1;" onclick="window.mostrarCompartir?.('${cause.id}')">
            <i class="fas fa-share-alt"></i> Compartir
          </button>
        </div>
        <div class="share-section" id="shareSection"></div>
      </div>
    `;

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // Actualizar URL si estamos en la página de causas
    if (window.location.pathname === '/causes' || window.location.pathname === '/causes/') {
      window.history.pushState({}, '', `/causes/${causeId}`);
    }
  }

  /**
   * Obtiene o crea el modal reutilizable (EXACTO estructura original)
   */
  getOrCreateModal() {
    let modal = document.getElementById('causeModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'causeModal';
      modal.className = 'modal';
      modal.style.cssText = 'display:none; position:fixed; z-index:9999; left:0; top:0; width:100vw; height:100vh; background:rgba(0,0,0,0.35); align-items:center; justify-content:center;';
      
      modal.innerHTML = `
        <div class="modal-content" style="background:#fff; border-radius:18px; max-width:800px; width:95vw; padding:2rem; box-shadow:0 8px 32px rgba(74,111,165,0.13); position:relative; max-height:90vh; overflow-y:auto;">
          <button id="closeModal" style="position:absolute; top:1.5rem; right:1.5rem; background:none; border:none; font-size:1.8rem; color:#6b7280; cursor:pointer; transition:color 0.2s;" onmouseover="this.style.color='#4a6fa5'" onmouseout="this.style.color='#6b7280'">&times;</button>
          <div id="modalBody" style="padding:0.5rem;">
            <!-- Contenido dinámico -->
          </div>
        </div>
      `;
      
      document.body.appendChild(modal);
      this.attachModalEvents(modal);
    }
    return modal;
  }

  /**
   * Adjunta eventos al modal
   */
  attachModalEvents(modal) {
    // Cerrar con botón X
    const closeBtn = modal.querySelector('#closeModal');
    if (closeBtn) {
      closeBtn.onclick = () => this.closeModal();
    }

    // Cerrar al hacer click fuera del modal
    modal.onclick = (e) => {
      if (e.target === modal) {
        this.closeModal();
      }
    };
  }

  /**
   * Cierra el modal y limpia la URL
   */
  closeModal() {
    const modal = document.getElementById('causeModal');
    if (modal) {
      modal.style.display = 'none';
      document.body.style.overflow = '';
      
      // Limpiar URL si es necesario
      if (window.location.pathname.includes('/causes/') && window.location.pathname !== '/causes') {
        window.history.pushState({}, '', '/causes');
      }
    }
  }

  /**
   * Adjunta event listeners a las tarjetas
   */
  attachEventListeners(container) {
    container.querySelectorAll('.view-cause-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const causeId = btn.getAttribute('data-cause-id');
        this.showModal(causeId);
      });
    });
  }

  /**
   * Carga causas desde Supabase (método auxiliar)
   */
  async loadCausesFromSupabase(filter = "all", searchTerm = "") {
    this.currentFilter = filter;
    let query = supabase
      .from('causes')
      .select('*')
      .order('created_at', { ascending: false });

    if (filter !== "all") {
      query = query.eq('category', filter);
    }
    if (searchTerm && searchTerm.trim() !== "") {
      query = query.or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,city.ilike.%${searchTerm}%,country.ilike.%${searchTerm}%`);
    }

    const { data: causes, error } = await query;
    
    if (error) {
      console.error('Error cargando causas:', error);
      return { causes: [], error };
    }

    return { causes: causes || [], error: null };
  }

  /**
   * Inyecta estilos CSS necesarios (TODOS los estilos del archivo original)
   */
  injectGridStyles() {
    if (document.getElementById('causes-renderer-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'causes-renderer-styles';
    style.textContent = `
      /* ✅ ESTILOS EXACTOS extraídos de views/causes/index.njk */
      :root {
        --primary: #4a6fa5;
        --primary-dark: #166088;
        --gray: #e2e8f0;
        --white: #fff;
        --accent: #4fc3a1;
        --accent-dark: #3da58a;
        --urgent: #e53e3e;
      }

      .causes-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
        gap: 2rem;
      }

      .cause-card {
        background: white;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.05);
        transition: all 0.3s ease;
        border: 1px solid var(--gray);
        display: flex;
        flex-direction: column;
      }

      .cause-card:hover {
        transform: translateY(-5px);
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
      }

      .cause-image {
        height: 180px;
        overflow: hidden;
        position: relative;
      }

      .cause-image img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        transition: transform 0.3s ease;
      }

      .cause-card:hover .cause-image img {
        transform: scale(1.05);
      }

      .cause-badge {
        position: absolute;
        top: 1rem;
        right: 1rem;
        background: rgba(255, 255, 255, 0.9);
        padding: 0.3rem 0.8rem;
        border-radius: 50px;
        font-size: 0.8rem;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
      }

      .cause-badge.urgent {
        background: var(--urgent);
        color: white;
      }

      .cause-badge.points {
        background: var(--primary);
        color: white;
        left: 1rem;
        right: auto;
      }

      .cause-content {
        padding: 1.5rem;
        display: flex;
        flex-direction: column;
        flex: 1;
      }

      .cause-content h3 {
        font-size: 1.3rem;
        margin-bottom: 0.8rem;
        color: #2d3748;
      }

      .cause-content p {
        color: #6b7280;
        margin-bottom: 1.5rem;
        font-size: 0.95rem;
        line-height: 1.6;
        flex-grow: 1;
      }

      .cause-meta {
        display: flex;
        gap: 1rem;
        margin-bottom: 1.5rem;
        font-size: 0.85rem;
        flex-wrap: wrap;
      }

      .meta-item {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        color: #6b7280;
      }

      .meta-item i {
        color: var(--primary);
      }

      .beneficiaries-count {
        display: inline-flex;
        align-items: center;
        background: #f0f9ff;
        color: var(--primary);
        padding: 0.3rem 0.8rem;
        border-radius: 50px;
        font-size: 0.85rem;
        font-weight: 600;
      }

      .beneficiaries-count i {
        margin-right: 0.3rem;
      }

      .cause-progress {
        margin-bottom: 1.5rem;
      }

      .progress-bar {
        height: 8px;
        background: var(--gray);
        border-radius: 4px;
        overflow: hidden;
        margin-bottom: 0.5rem;
      }

      .progress-fill {
        height: 100%;
        background: var(--primary);
        border-radius: 4px;
      }

      .progress-info {
        display: flex;
        justify-content: space-between;
        font-size: 0.9rem;
        color: #6b7280;
      }

      .cause-actions {
        display: flex;
        gap: 0.8rem;
      }

      .cause-actions .btn {
        flex: 1;
        text-align: center;
        justify-content: center;
      }

      /* Estilos de botones básicos */
      .btn {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.6rem 1.2rem;
        border-radius: 8px;
        font-weight: 600;
        text-decoration: none;
        border: none;
        cursor: pointer;
        transition: all 0.2s ease;
        font-size: 0.9rem;
      }

      .btn-primary {
        background: var(--primary);
        color: white;
      }

      .btn-primary:hover {
        background: var(--primary-dark);
        transform: translateY(-2px);
      }

      .btn-accent {
        background: var(--accent);
        color: white;
      }

      .btn-accent:hover {
        background: var(--accent-dark);
        transform: translateY(-2px);
      }

      .btn-outline {
        background: transparent;
        color: var(--primary);
        border: 1px solid var(--primary);
      }

      .btn-outline:hover {
        background: var(--primary);
        color: white;
        transform: translateY(-2px);
      }

      /* Modal de Causa - Estilos exactos */
      .modal {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0,0,0,0.5);
        z-index: 1000;
        justify-content: center;
        align-items: center;
      }

      .modal-content {
        background: #fff;
        padding: 2rem;
        border-radius: 10px;
        max-width: 500px;
        width: 90%;
        text-align: center;
      }

      .modal-cause-container {
        font-family: 'Poppins', sans-serif;
        color: #2d3748;
      }

      .modal-cause-header {
        display: flex;
        gap: 2rem;
        margin-bottom: 2rem;
      }

      .modal-cause-image-wrapper {
        flex: 1;
        min-width: 300px;
        height: 280px;
        border-radius: 12px;
        overflow: hidden;
        position: relative;
        box-shadow: 0 4px 12px rgba(0,0,0,0.08);
      }

      .modal-cause-image {
        width: 100%;
        height: 100%;
        object-fit: cover;
        transition: transform 0.3s ease;
      }

      .modal-cause-badge {
        position: absolute;
        top: 1.5rem;
        right: 1.5rem;
        background: rgba(255,255,255,0.95);
        padding: 0.5rem 1rem;
        border-radius: 50px;
        font-size: 0.9rem;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 0.6rem;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        z-index: 2;
      }

      .modal-cause-badge.urgent {
        background: var(--urgent);
        color: white;
      }

      .modal-cause-info {
        flex: 1.5;
        display: flex;
        flex-direction: column;
      }

      .modal-cause-title {
        font-size: 1.8rem;
        font-weight: 700;
        color: var(--primary);
        margin-bottom: 1rem;
        line-height: 1.3;
      }

      .modal-cause-progress-container {
        background: #f8fafc;
        padding: 1.5rem;
        border-radius: 12px;
        margin-bottom: 1.5rem;
        border: 1px solid #e5e7eb;
      }

      .modal-cause-meta-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: 1.2rem;
        margin-bottom: 1.5rem;
      }

      .meta-icon {
        color: var(--primary);
        font-size: 1.1rem;
        width: 1.5rem;
        text-align: center;
      }

      .points-notice {
        background: #f0f9ff;
        border-left: 4px solid var(--accent);
        padding: 1rem;
        border-radius: 0 8px 8px 0;
        margin: 1rem 0;
        font-size: 0.95rem;
        display: flex;
        align-items: center;
        gap: 0.7rem;
      }

      .modal-cause-content { 
        margin-top: 1.5rem; 
      }

      .content-section { 
        margin-bottom: 2rem; 
      }

      .content-title {
        font-size: 1.3rem;
        font-weight: 600;
        color: var(--primary);
        margin-bottom: 1rem;
        display: flex;
        align-items: center;
        gap: 0.7rem;
      }

      .content-text {
        line-height: 1.7;
        color: #4b5563;
        font-size: 1.05rem;
      }

      /* Responsive */
      @media (max-width: 768px) {
        .causes-grid {
          grid-template-columns: 1fr;
        }
        
        .cause-actions {
          flex-direction: column;
        }
        
        .modal-cause-header { 
          flex-direction: column; 
        }
      }

      @media (max-width: 900px) {
        .causes-grid {
          padding: 1.2rem 0.5rem;
        }
      }
    `;
    document.head.appendChild(style);
  }
}

// Hacer disponible globalmente
window.CausesRenderer = CausesRenderer;

// Instancia global
window.causesRenderer = new CausesRenderer();

// Funciones de compatibilidad globales
window.showCauseModal = (causeId) => window.causesRenderer.showModal(causeId);

// Función para compartir (usa compartir.js si está disponible)
window.mostrarCompartir = function(causeId) {
  const cause = window.causes?.find(c => c.id == causeId);
  if (!cause) {
    console.error('❌ No se encontró la causa con ID:', causeId);
    return;
  }
  
  console.log('🔗 Compartiendo causa:', cause);
  
  if (window.renderCompartir) {
    window.renderCompartir({
      title: cause.title,
      summary: cause.short_description || cause.description?.substring(0, 120) + '...',
      photo_url: cause.photo_url || '/img/causa-default.jpg',
      link: `${window.location.origin}/causes/${cause.id}`,
      type: 'causa'
    }, 'shareSection');
    
    document.getElementById('shareSection').scrollIntoView({ 
      behavior: 'smooth', 
      block: 'center' 
    });
  } else {
    // Fallback si no está compartir.js
    const link = `${window.location.origin}/causes/${cause.id}`;
    navigator.clipboard.writeText(link).then(() => {
      alert('¡Enlace copiado!');
    }).catch(() => {
      prompt('Copia este enlace:', link);
    });
  }
};

// Funciones auxiliares globales
window.donateToCause = function(causeId) {
  alert('Funcionalidad de donación próximamente.');
};

window.joinCause = async function(causeId) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    alert('Debes iniciar sesión para participar.');
    return;
  }
  const userId = session.user.id;
  
  // ✅ CORREGIR: Usar la tabla causes_members como en el código original
  await supabase
    .from('causes_members')
    .insert([{ cause_id: causeId, user_id: userId, role: 'member', status: 'active' }])
    .then(() => {
      alert('¡Ahora eres miembro de esta causa!');
      window.causesRenderer.closeModal();
    })
    .catch(error => {
      console.error('Error al unirse a la causa:', error);
      alert('No se pudo unir a la causa. Inténtalo nuevamente más tarde.');
    });
};