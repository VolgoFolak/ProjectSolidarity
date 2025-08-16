/**
 * Módulo para renderizar tarjetas y modales de causas
 * Template basado EXACTO en views/causes/index.njk
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
    const isAdmin = ['founder','admin','coordinator'].includes(cause.userRole);
    const isDonor = cause.isDonor; // Este campo debe estar en el objeto causa, igual que isParticipating en tareas

    const canDonate = cause.stripe_enabled && !cause.isDonor;

    // Botón "Donar" funcional
    const donateBtn = canDonate
      ? `<button class="btn btn-accent donate-btn" data-cause-id="${cause.id}">
           <i class="fas fa-donate"></i> Donar
         </button>`
      : `<button class="btn btn-outline" disabled>
           ${cause.stripe_enabled ? 'Ya donaste' : 'Donaciones no disponibles'}
         </button>`;

    const card = document.createElement('div');
    card.className = 'cause-card';
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
          ${isAdmin ? `
            <button class="btn btn-accent admin-activity-btn" data-activity-type="cause" data-activity-id="${cause.id}">
              <i class="fas fa-cog"></i> Administrar
            </button>
          ` : donateBtn}
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

    // Obtener donantes de Supabase (usa 'profiles' si tu relación es así)
    const { data: donors, error: donorsError } = await supabase
      .from('causes_members')
      .select('user_id, profiles(username, photo_url)')
      .eq('cause_id', causeId)
      .eq('role', 'donor')
      .eq('status', 'active');

    let donorsHtml = '';
    if (donorsError) {
      donorsHtml = `<div style="color:#e53e3e;">Error al cargar los donantes.</div>`;
    } else if (!donors || donors.length === 0) {
      donorsHtml = `<div style="color:#6b7280;">Aún no hay donantes para esta causa.</div>`;
    } else {
      donorsHtml = `
        <div style="display:flex; flex-wrap:wrap; gap:1rem; margin-top:1rem;">
          ${donors.map(d => `
            <div style="display:flex; align-items:center; gap:0.6rem; background:#f8fafc; border-radius:8px; padding:0.5rem 1rem;">
              <img src="${d.profiles?.photo_url || '/img/avatar-default.png'}" alt="${d.profiles?.username}" style="width:32px; height:32px; border-radius:50%; object-fit:cover;">
              <span style="font-weight:600; color:#4a6fa5;">${d.profiles?.username || 'Usuario'}</span>
            </div>
          `).join('')}
        </div>
      `;
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

    // TEMPLATE EXACTO del modal original, inserta donorsHtml después de la descripción
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
            <p class="content-text" style="line-height:1.7; color:#4b5563; font-size:1rem; margin-left:0; margin-right:0; text-align:justify;">${cause.short_description || 'No hay resumen disponible para esta causa.'}</p>
          </div>
          <div class="content-section" style="margin-bottom:2.2rem;">
            <h3 class="content-title" style="font-size:1.2rem; font-weight:600; color:var(--primary); margin-bottom:0.9rem; display:flex; align-items:center; gap:0.7rem;">
              <i class="fas fa-info-circle"></i> Descripción completa
            </h3>
            <p class="content-text" style="line-height:1.7; color:#4b5563; font-size:1rem; margin-left:0; margin-right:0; text-align:justify;">${cause.description || 'No hay descripción detallada disponible para esta causa.'}</p>
          </div>
          <div class="content-section">
            <h3 class="content-title"><i class="fas fa-users"></i> Donantes</h3>
            ${donorsHtml}
          </div>
          
          ${(cause.contact_email || cause.phone_number) ? `
            <div class="content-section" style="margin-bottom:2.2rem;">
              <h3 class="content-title" style="font-size:1.2rem; font-weight:600; color:var(--primary); margin-bottom:0.9rem; display:flex; align-items:center; gap:0.7rem;">
                <i class="fas fa-address-book"></i> Información de contacto
              </h3>
              <div style="background:#f8fafc; border-radius:12px; padding:1.5rem; border:1px solid #e5e7eb; text-align:left;">
                ${cause.contact_email ? `
                  <div style="display:flex; align-items:center; gap:0.7rem; margin-bottom:${cause.phone_number ? '1rem' : '0'};">
                    <i class="fas fa-envelope" style="color:var(--primary); font-size:1.1rem;"></i>
                    <div>
                      <span style="color:#6b7280; font-size:0.9rem; display:block;">Email de contacto:</span>
                      <a href="mailto:${cause.contact_email}" style="color:var(--primary); font-weight:600; text-decoration:none; font-size:1rem;">
                        ${cause.contact_email}
                      </a>
                    </div>
                  </div>
                ` : ''}
                ${cause.phone_number ? `
                  <div style="display:flex; align-items:center; gap:0.7rem;">
                    <i class="fas fa-phone" style="color:var(--primary); font-size:1.1rem;"></i>
                    <div>
                      <span style="color:#6b7280; font-size:0.9rem; display:block;">Teléfono de contacto:</span>
                      <a href="tel:${cause.phone_number}" style="color:var(--primary); font-weight:600; text-decoration:none; font-size:1rem;">
                        ${cause.phone_number}
                      </a>
                    </div>
                  </div>
                ` : ''}
              </div>
            </div>
          ` : ''}
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
        <div class="share-section" id="shareSection" style="text-align:left;"></div>
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

    // ✅ NUEVO: Event listener para botones de donar
    container.querySelectorAll('.donate-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const causeId = btn.getAttribute('data-cause-id');
        if (window.donateToCause) {
          window.donateToCause(causeId);
        }
      });
    });

    container.querySelectorAll('.admin-activity-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const activityId = btn.getAttribute('data-activity-id');
        if (typeof window.openAdminModal === 'function') {
          const cause = window.causes?.find(c => c.id == activityId);
          if (cause) window.openAdminModal(cause);
        } 
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

    // Obtener información de donaciones del usuario actual
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    let donatedIds = [];
    if (userId) {
      const { data: memberships } = await supabase
        .from('causes_members')
        .select('cause_id')
        .eq('user_id', userId)
        .eq('role', 'donor');
      donatedIds = memberships ? memberships.map(m => m.cause_id) : [];
    }

    // Procesar causas con información adicional
    const causesWithInfo = causes ? causes.map(cause => ({
      ...cause,
      isDonor: donatedIds.includes(cause.id)
    })) : [];

    // Renderizar
    window.causesRenderer.renderGrid(causesWithInfo, causesList);

    return { causes: causesWithInfo, error: null };
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

      /* Nuevos estilos para el formulario de causa */
      .cause-form .form-group input[type="email"],
      .cause-form .form-group input[type="tel"] {
        background: #f8fafc;
        border: 1px solid #e5e7eb;
        transition: all 0.2s ease;
      }

      .cause-form .form-group input[type="email"]:focus,
      .cause-form .form-group input[type="tel"]:focus {
        background: #fff;
        border-color: var(--accent);
        box-shadow: 0 0 0 3px rgba(79, 195, 161, 0.1);
      }

      .cause-form .form-group small {
        font-size: 0.85rem;
        color: #6b7280;
        display: block;
        margin-top: 0.3rem;
      }

      /* Animaciones de entrada y salida para el modal de éxito */
      @keyframes bounceIn {
        0% { opacity: 0; transform: scale(0.3); }
        50% { opacity: 1; transform: scale(1.05); }
        70% { transform: scale(0.9); }
        100% { opacity: 1; transform: scale(1); }
      }
      @keyframes slideInDown {
        from { opacity: 0; transform: translateX(-50%) translateY(-20px); }
        to { opacity: 1; transform: translateX(-50%) translateY(0); }
      }
      @keyframes slideOutUp {
        from { opacity: 1; transform: translateX(-50%) translateY(0); }
        to { opacity: 0; transform: translateX(-50%) translateY(-20px); }
      }
      .modal-bg { display: none; }
      .modal-bg.active { display: flex; }
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
window.donateToCause = async function(causeId) {
  if (!supabase) {
    showNotification('Error: Supabase no está disponible', 'error');
    return;
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      showNotification('Debes iniciar sesión para donar', 'warning');
      setTimeout(() => {
        window.location.href = '/login?return=' + encodeURIComponent(window.location.pathname);
      }, 1500);
      return;
    }

    // Verificar si ya existe registro para este usuario y causa
    const { data: existing, error: existingError } = await supabase
      .from('causes_members')
      .select('id, role')
      .eq('cause_id', causeId)
      .eq('user_id', session.user.id)
      .single();

    // Si el usuario es founder, permitir donar y mostrar modal de éxito sin cambiar el rol ni insertar
    if (existing && existing.role === 'founder') {
      showDonationSuccessModal('¡Donación exitosa!', 50);
      // Puedes sumar puntos aquí si tienes lógica de puntos
      return;
    }

    // Si ya es donante, mostrar info
    if (existing && existing.role === 'donor') {
      showNotification('Ya has donado a esta causa', 'info');
      return;
    }

    // Si no existe registro, insertar como donante
    if (!existing) {
      const { error } = await supabase
        .from('causes_members')
        .insert([{
          cause_id: causeId,
          user_id: session.user.id,
          role: 'donor',
          status: 'active'
        }]);

      if (error) {
        showNotification('Error al donar: ' + error.message, 'error');
        return;
      }

      showDonationSuccessModal('¡Donación exitosa!', 50);

      if (window.loadCausesFromSupabase) {
        await window.loadCausesFromSupabase();
      }
      return;
    }

    // Si existe registro con otro rol (ej: 'member'), puedes decidir si permites donar o no
    // Aquí simplemente mostramos el modal de éxito
    showDonationSuccessModal('¡Donación exitosa!', 50);

  } catch (error) {
    showNotification('Error al procesar la donación', 'error');
  }
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

// AGREGAR al final del archivo causes-renderer.js, después de la línea window.donateToCoause = window.donateToCause;

// Funciones para el modal de éxito elegante
function showDonationSuccessModal(causeTitle, points) {
  // Crear modal si no existe
  let successModal = document.getElementById('donationSuccessModal');
  if (!successModal) {
    successModal = document.createElement('div');
    successModal.id = 'donationSuccessModal';
    successModal.className = 'modal-bg';
    successModal.style.cssText = 'display:none; position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.35); z-index:10000; align-items:center; justify-content:center;';
    successModal.innerHTML = `
      <div class="modal-content" style="max-width:500px; text-align:center; padding:3rem 2rem; background:#fff; border-radius:18px; box-shadow:0 8px 32px rgba(0,0,0,0.15); position:relative; animation:bounceIn 0.5s ease-out;">
        <div style="background: linear-gradient(135deg, #4fc3a1, #4a6fa5); width:80px; height:80px; border-radius:50%; margin:0 auto 2rem; display:flex; align-items:center; justify-content:center; box-shadow:0 8px 25px rgba(79,195,161,0.3);">
          <i class="fas fa-heart" style="color:white; font-size:2.5rem;"></i>
        </div>
        <h2 style="color:var(--primary); font-size:1.8rem; font-weight:700; margin-bottom:1rem;">
          ¡Donación exitosa!
        </h2>
        <p style="color:#4b5563; font-size:1.1rem; line-height:1.6; margin-bottom:1.5rem;">
          Gracias por tu generosidad. Tu contribución a <strong style="color:var(--primary);" id="successCauseTitle"></strong> 
          está marcando la diferencia en la vida de muchas personas.
        </p>
        <div style="background:#f0f9ff; border-radius:12px; padding:1.5rem; margin-bottom:2rem; border:1px solid #e0f2fe;">
          <div style="display:flex; align-items:center; justify-content:center; gap:0.7rem; margin-bottom:0.5rem;">
            <i class="fas fa-star" style="color:var(--accent); font-size:1.2rem;"></i>
            <span style="color:var(--primary); font-weight:600; font-size:1.1rem;">
              Has ganado <span id="successPoints" style="color:var(--accent); font-weight:700;"></span> puntos de impacto
            </span>
          </div>
          <p style="color:#6b7280; font-size:0.95rem; margin:0;">
            ¡Tu generosidad suma puntos para desbloquear nuevos logros!
          </p>
        </div>
        <div style="display:flex; gap:1rem; flex-wrap:wrap; justify-content:center;">
          <button onclick="closeDonationSuccessModal()" class="btn btn-primary" style="flex:1; min-width:140px;">
            <i class="fas fa-seedling"></i> Explorar más causas
          </button>
          <button onclick="closeDonationSuccessModal(); setTimeout(() => document.getElementById('create-cause-btn')?.click(), 300)" class="btn btn-accent" style="flex:1; min-width:140px;">
            <i class="fas fa-plus"></i> Crear nueva causa
          </button>
        </div>
        <div style="margin-top:2rem; padding-top:1.5rem; border-top:1px solid #e5e7eb;">
          <p style="color:#6b7280; font-size:0.9rem; margin-bottom:1rem;">
            ¿Quieres compartir tu buena acción?
          </p>
          <button onclick="shareDonation()" class="btn btn-outline" style="min-width:160px;">
            <i class="fas fa-share-alt"></i> Compartir donación
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(successModal);
  }

  // Actualizar contenido dinámico
  document.getElementById('successCauseTitle').textContent = causeTitle;
  document.getElementById('successPoints').textContent = points;

  // Mostrar modal
  successModal.style.display = 'flex';
  document.body.style.overflow = 'hidden';

  // Cerrar automáticamente después de 10 segundos
  setTimeout(() => {
    if (successModal.style.display === 'flex') {
      closeDonationSuccessModal();
    }
  }, 10000);
}

function closeDonationSuccessModal() {
  const modal = document.getElementById('donationSuccessModal');
  if (modal) {
    modal.style.display = 'none';
    document.body.style.overflow = '';
  }
}

function shareDonation() {
  const causeTitle = document.getElementById('successCauseTitle').textContent;
  const points = document.getElementById('successPoints').textContent;
  
  const shareText = `¡Acabo de donar a "${causeTitle}" en Solidarity! 🌟 He ganado ${points} puntos de impacto ayudando a transformar vidas. ¡Únete y marca la diferencia tú también! 💚`;
  const shareUrl = window.location.origin + '/causes';
  
  if (navigator.share) {
    navigator.share({
      title: 'Mi donación en Solidarity',
      text: shareText,
      url: shareUrl
    });
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(shareText + ' ' + shareUrl).then(() => {
      showNotification('¡Texto copiado! Pégalo donde quieras compartir tu buena acción', 'success');
    });
  } else {
    // Fallback para navegadores antiguos
    const textArea = document.createElement('textarea');
    textArea.value = shareText + ' ' + shareUrl;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    showNotification('¡Texto copiado! Pégalo donde quieras compartir tu buena acción', 'success');
  }
}

function showNotification(message, type = 'info') {
  // Eliminar notificación existente
  const existing = document.querySelector('.notification');
  if (existing) {
    existing.remove();
  }

  const notification = document.createElement('div');
  notification.className = 'notification';
  notification.style.cssText = `
    position: fixed;
    top: 2rem;
    left: 50%;
    transform: translateX(-50%);
    background: ${type === 'error' ? '#fee2e2' : type === 'warning' ? '#fef3c7' : type === 'success' ? '#dcfce7' : '#dbeafe'};
    color: ${type === 'error' ? '#dc2626' : type === 'warning' ? '#d97706' : type === 'success' ? '#16a34a' : '#2563eb'};
    padding: 1rem 1.5rem;
    border-radius: 12px;
    border: 1px solid ${type === 'error' ? '#fca5a5' : type === 'warning' ? '#fde68a' : type === 'success' ? '#bbf7d0' : '#93c5fd'};
    font-weight: 600;
    font-size: 1rem;
    z-index: 10000;
    max-width: 90vw;
    width: auto;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    animation: slideInDown 0.3s ease-out;
  `;

  notification.innerHTML = `
    <div style="display:flex; align-items:center; gap:0.7rem;">
      <i class="fas fa-${type === 'error' ? 'times-circle' : type === 'warning' ? 'exclamation-triangle' : type === 'success' ? 'check-circle' : 'info-circle'}"></i>
      <span>${message}</span>
    </div>
  `;

  document.body.appendChild(notification);

  // Remover después de 4 segundos
  setTimeout(() => {
    notification.style.animation = 'slideOutUp 0.3s ease-in';
    setTimeout(() => notification.remove(), 300);
  }, 4000);
}

// Agregar estilos CSS para las animaciones
if (!document.getElementById('donation-success-styles')) {
  const style = document.createElement('style');
  style.id = 'donation-success-styles';
  style.textContent = `
    @keyframes bounceIn {
      0% { opacity: 0; transform: scale(0.3); }
      50% { opacity: 1; transform: scale(1.05); }
      70% { transform: scale(0.9); }
      100% { opacity: 1; transform: scale(1); }
    }
    @keyframes slideInDown {
      from { opacity: 0; transform: translateX(-50%) translateY(-20px); }
      to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
    @keyframes slideOutUp {
      from { opacity: 1; transform: translateX(-50%) translateY(0); }
      to { opacity: 0; transform: translateX(-50%) translateY(-20px); }
    }
    .modal-bg { display: none; }
    .modal-bg.active { display: flex; }
  `;
  document.head.appendChild(style);
}

// Hacer funciones globales
window.showDonationSuccessModal = showDonationSuccessModal;
window.closeDonationSuccessModal = closeDonationSuccessModal;
window.shareDonation = shareDonation;
window.showNotification = showNotification;

// NUEVO: Función para mostrar el modal de donación
function showDonationModal(causeId, creatorId, donorId) {
  const modal = document.createElement('div');
  modal.className = 'donation-modal';
  modal.innerHTML = `
    <div class="modal-content">
      <h3><i class="fas fa-donate"></i> Apoya esta causa</h3>
      <p class="donation-info">
        <i class="fas fa-info-circle"></i> Montos válidos: 1€ - 10,000€
      </p>
      <div class="donation-options">
        <button class="donation-amount" data-amount="5">5€</button>
        <button class="donation-amount" data-amount="10">10€</button>
        <button class="donation-amount" data-amount="25">25€</button>
        <button class="donation-amount" data-amount="50">50€</button>
        <div class="custom-donation">
          <input type="number" id="custom-amount" min="1" max="10000" placeholder="Otra cantidad" step="0.01">
          <span>€</span>
        </div>
      </div>
      <div class="fee-transparency">
        <div class="fee-item">
          <span>Para la causa:</span>
          <span id="cause-amount">0.00€</span>
        </div>
        <div class="fee-item">
          <span>Comisión de Solidarity (2%):</span>
          <span id="fee-amount">0.00€</span>
        </div>
        <div class="fee-total">
          <span>Total:</span>
          <span id="total-amount">0.00€</span>
        </div>
      </div>
      <button id="confirm-donation" class="btn btn-primary">
        <i class="fas fa-check"></i> Confirmar donación
      </button>
    </div>
  `;
  document.body.appendChild(modal);

  let selectedAmount = 0;
  function updateFeeDisplay(amount) {
    const fee = (amount * 0.02).toFixed(2);
    const net = (amount * 0.98).toFixed(2);
    modal.querySelector('#cause-amount').textContent = `${net}€`;
    modal.querySelector('#fee-amount').textContent = `${fee}€`;
    modal.querySelector('#total-amount').textContent = `${amount.toFixed(2)}€`;
  }

  modal.querySelectorAll('.donation-amount').forEach(btn => {
    btn.addEventListener('click', () => {
      modal.querySelectorAll('.donation-amount').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedAmount = parseFloat(btn.getAttribute('data-amount'));
      modal.querySelector('#custom-amount').value = '';
      updateFeeDisplay(selectedAmount);
    });
  });

  modal.querySelector('#custom-amount').addEventListener('input', (e) => {
    selectedAmount = parseFloat(e.target.value) || 0;
    modal.querySelectorAll('.donation-amount').forEach(b => b.classList.remove('selected'));
    updateFeeDisplay(selectedAmount);
  });

  modal.querySelector('#confirm-donation').addEventListener('click', async () => {
    const amount = selectedAmount;
    if (!amount || amount < 1 || amount > 10000) {
      showNotification('Monto inválido. Debe ser entre 1€ y 10,000€', 'error');
      return;
    }
    try {
      const response = await fetch('/create-donation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, causeId })
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error en la solicitud');
      }
      const { id: sessionId } = await response.json();
      modal.remove();
      const stripe = Stripe('pk_test_51RXeFrRo1sZSKMfJxpwjOeU1CCRIcAmQSX4czwwCsGrQC20m96j0RX6Cw6SH7UffIxcYUAVxpEzcJxy39yojmoIA00Vh28iIGr');
      stripe.redirectToCheckout({ sessionId });
    } catch (error) {
      showNotification('Error al procesar la donación: ' + error.message, 'error');
    }
  });
}