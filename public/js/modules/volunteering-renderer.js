/**
 * Módulo para renderizar tarjetas y modales de voluntariado
 * Con soporte completo para administración y funcionalidades unificadas
 */

const VolunteeringRenderer = {
  // Renderizar una sola tarjeta de voluntariado
  renderCard(volunteering) {
    if (!volunteering) return '';

    const urgentBadge = volunteering.is_urgent ? `<div class="volunteering-badge urgent"><i class="fas fa-exclamation-circle"></i> Urgente</div>` : "";
    const pointsBadge = `<div class="volunteering-badge points"><i class="fas fa-star"></i> +${volunteering.points || 0} pts</div>`;
    const location = volunteering.city && volunteering.country ? `${volunteering.city}, ${volunteering.country}` : "";
    
    // Progreso basado en voluntarios/meta
    const progress = volunteering.max_volunteers ? Math.min(Math.round((volunteering.current_volunteers / volunteering.max_volunteers) * 100), 100) : 0;

    // Causa vinculada
    let causeHtml = '';
    if (volunteering.cause_id && volunteering.linkedCause) {
      const cause = volunteering.linkedCause;
      causeHtml = `
        <div class="linked-cause">
          <img src="${cause.photo_url || '/img/causa-default.jpg'}" alt="${cause.title}">
          <span>${cause.title}</span>
        </div>
      `;
    }

    // ✅ VERIFICAR ROL DE ADMINISTRADOR PRIMERO
    const isAdmin = ['founder','admin','coordinator','creator'].includes(volunteering.userRole) || volunteering.isCreator;
    const isVolunteering = volunteering.isVolunteering;

    // ✅ BOTONES CON CLASES CSS CORRECTAS Y FUNCIONALIDAD PRESERVADA
    let actionButtons = '';
    if (isAdmin) {
      actionButtons = `
        <button class="btn btn-primary view-volunteering-btn" data-volunteering-id="${volunteering.id}">Ver más</button>
        <button class="btn btn-accent admin-activity-btn" data-activity-type="volunteering" data-activity-id="${volunteering.id}">
          <i class="fas fa-cog"></i> Administrar
        </button>
      `;
    } else if (isVolunteering) {
      actionButtons = `
        <button class="btn btn-primary view-volunteering-btn" data-volunteering-id="${volunteering.id}">Ver más</button>
        <button class="btn btn-success volunteer-btn" data-volunteering-id="${volunteering.id}" disabled style="opacity:0.7;cursor:not-allowed;">
          <i class="fas fa-check"></i> Voluntario
        </button>
      `;
    } else {
      actionButtons = `
        <button class="btn btn-primary view-volunteering-btn" data-volunteering-id="${volunteering.id}">Ver más</button>
        <button class="btn btn-accent volunteer-btn" data-volunteering-id="${volunteering.id}">
          <i class="fas fa-hand-holding-heart"></i> Ser voluntario
        </button>
      `;
    }

    const card = `
      <div class="volunteering-card">
        <div class="volunteering-image">
          <img src="${volunteering.photo_url || '/img/volunteering-default.jpg'}" alt="${volunteering.title}" onerror="this.src='/img/volunteering-default.jpg'">
          ${urgentBadge}
          ${pointsBadge}
        </div>
        <div class="volunteering-content">
          <h3>${volunteering.title}</h3>
          <p>${volunteering.summary ? volunteering.summary : (volunteering.description.substring(0, 100) + (volunteering.description.length > 100 ? '...' : ''))}</p>
          ${causeHtml}
          <div class="volunteering-meta">
            <div class="meta-item"><i class="fas fa-map-marker-alt"></i> ${location}</div>
            <div class="meta-item"><i class="fas fa-users"></i> ${volunteering.current_volunteers || 0} voluntarios</div>
            <div class="beneficiaries-count">
              <i class="fas fa-heart"></i> Beneficia a ${volunteering.beneficiaries || 0} personas
            </div>
          </div>
          <div class="volunteering-progress">
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${progress}%"></div>
            </div>
            <div class="progress-info">
              <span>${volunteering.current_volunteers || 0} voluntarios</span>
              <span>Meta: ${volunteering.max_volunteers || 0}</span>
            </div>
          </div>
          <div class="volunteering-actions">
            ${actionButtons}
          </div>
        </div>
      </div>
    `;
    
    return card;
  },

  // Renderizar grid completo de voluntariados
  renderGrid(volunteeringList, container) {
    if (!container) return;
    
    container.innerHTML = '';
    
    if (!volunteeringList || volunteeringList.length === 0) {
      container.innerHTML = '<div style="color:#6b7280;text-align:center;padding:2rem;grid-column:1/-1;">No se encontraron oportunidades de voluntariado.</div>';
      return;
    }

    // ✅ INYECTAR ESTILOS CSS ANTES DE RENDERIZAR
    this.injectStyles();

    // Guardar los voluntariados en una variable global para acceder desde el modal
    window.volunteering = volunteeringList;
    
    for (const volunteering of volunteeringList) {
      const cardHtml = this.renderCard(volunteering);
      container.innerHTML += cardHtml;
    }
    
    // ✅ AGREGAR TODOS LOS EVENT LISTENERS CORRECTAMENTE
    this.attachEventListeners(container);

    // Verificar si hay que abrir un modal específico desde la URL
    this.checkForModalFromURL();
  },

  // ✅ FUNCTION SEPARADA PARA ADJUNTAR EVENT LISTENERS
  attachEventListeners(container) {
    // Event listeners para botones "Ver más"
    container.querySelectorAll('.view-volunteering-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const volunteeringId = btn.getAttribute('data-volunteering-id');
        this.showVolunteeringModal(volunteeringId);
      });
    });
    
    // ✅ EVENT LISTENERS PARA BOTÓN ADMINISTRAR (igual que causes-renderer.js)
    container.querySelectorAll('.admin-activity-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const activityId = btn.getAttribute('data-activity-id');
        if (typeof window.openAdminActivityModal === 'function') {
          const volunteering = window.volunteering?.find(v => v.id == activityId);
          if (volunteering) window.openAdminActivityModal(volunteering);
        } else if (typeof window.openAdminModal === 'function') {
          // Fallback para compatibilidad
          const volunteering = window.volunteering?.find(v => v.id == activityId);
          if (volunteering) window.openAdminModal(volunteering);
        }
      });
    });
    
    // Event listeners para botones "Ser voluntario"
    container.querySelectorAll('.volunteer-btn:not([disabled])').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const volunteeringId = btn.getAttribute('data-volunteering-id');
        if (window.joinVolunteering) {
          window.joinVolunteering(volunteeringId);
        }
      });
    });
  },

  // ✅ INYECTAR ESTILOS CSS NECESARIOS
  injectStyles() {
    if (document.getElementById('volunteering-renderer-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'volunteering-renderer-styles';
    style.textContent = `
      /* Variables CSS */
      :root {
        --primary: #4a6fa5;
        --primary-dark: #166088;
        --gray: #e2e8f0;
        --white: #fff;
        --accent: #4fc3a1;
        --accent-dark: #3da58a;
        --urgent: #e53e3e;
        --volunteering: #38b2ac;
        --volunteering-dark: #2c7a7b;
        --success: #10b981;
        --success-dark: #059669;
      }

      .volunteering-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
        gap: 2rem;
      }

      .volunteering-card {
        background: white;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.05);
        transition: all 0.3s ease;
        border: 1px solid var(--gray);
        display: flex;
        flex-direction: column;
      }

      .volunteering-card:hover {
        transform: translateY(-5px);
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
      }

      .volunteering-image {
        height: 180px;
        overflow: hidden;
        position: relative;
      }

      .volunteering-image img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        transition: transform 0.3s ease;
      }

      .volunteering-card:hover .volunteering-image img {
        transform: scale(1.05);
      }

      .volunteering-badge {
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

      .volunteering-badge.urgent {
        background: var(--urgent);
        color: white;
      }

      .volunteering-badge.points {
        background: var(--volunteering-dark);
        color: white;
        left: 1rem;
        right: auto;
      }

      .volunteering-content {
        padding: 1.5rem;
        display: flex;
        flex-direction: column;
        flex: 1;
      }

      .volunteering-content h3 {
        font-size: 1.3rem;
        margin-bottom: 0.8rem;
        color: #2d3748;
      }

      .volunteering-content p {
        color: #6b7280;
        margin-bottom: 1.5rem;
        font-size: 0.95rem;
        line-height: 1.6;
        flex-grow: 1;
      }

      .volunteering-meta {
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
        color: var(--volunteering-dark);
      }

      .beneficiaries-count {
        display: inline-flex;
        align-items: center;
        background: #e6fffa;
        color: var(--volunteering-dark);
        padding: 0.3rem 0.8rem;
        border-radius: 50px;
        font-size: 0.85rem;
        font-weight: 600;
      }

      .beneficiaries-count i {
        margin-right: 0.3rem;
      }

      .linked-cause {
        display: inline-flex;
        align-items: center;
        background: #f0f9ff;
        color: var(--primary);
        padding: 0.3rem 0.8rem;
        border-radius: 50px;
        font-size: 0.85rem;
        font-weight: 600;
        margin-bottom: 1rem;
      }

      .linked-cause img {
        width: 22px;
        height: 22px;
        object-fit: cover;
        border-radius: 50%;
        border: 1px solid #e5e7eb;
        margin-right: 0.4em;
      }

      .volunteering-progress {
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
        background: var(--volunteering);
        border-radius: 4px;
      }

      .progress-info {
        display: flex;
        justify-content: space-between;
        font-size: 0.9rem;
        color: #6b7280;
      }

      .volunteering-actions {
        display: flex;
        gap: 0.8rem;
      }

      .volunteering-actions .btn {
        flex: 1;
        text-align: center;
        justify-content: center;
      }

      /* ✅ ESTILOS DE BOTONES COMPLETOS Y CORRECTOS */
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
        justify-content: center;
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

      .btn-success {
        background: var(--success);
        color: white;
      }

      .btn-success:hover {
        background: var(--success-dark);
        transform: translateY(-2px);
      }

      .btn-warning {
        background: var(--volunteering);
        color: white;
      }

      .btn-warning:hover {
        background: var(--volunteering-dark);
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

      /* Responsive */
      @media (max-width: 768px) {
        .volunteering-grid {
          grid-template-columns: 1fr;
        }
        
        .volunteering-actions {
          flex-direction: column;
        }
      }
    `;
    document.head.appendChild(style);
  },

  // Verificar si hay que abrir modal desde URL
  checkForModalFromURL() {
    const path = window.location.pathname;
    const volunteeringIdMatch = path.match(/\/volunteering\/([a-f0-9-]+)$/);
    
    if (volunteeringIdMatch) {
      const volunteeringId = volunteeringIdMatch[1];
      console.log('🔗 URL detecta voluntariado específico:', volunteeringId);
      
      // Buscar el voluntariado en los cargados
      const volunteering = window.volunteering?.find(v => v.id === volunteeringId);
      
      if (volunteering) {
        // Si el voluntariado está cargado, abrir modal inmediatamente
        setTimeout(() => {
          this.showVolunteeringModal(volunteeringId);
        }, 100);
      } else {
        // Si no está cargado, intentar cargar desde Supabase
        setTimeout(() => {
          this.loadAndShowVolunteeringFromURL(volunteeringId);
        }, 500);
      }
    }
  },

  // Cargar voluntariado específico desde URL si no está en memoria
  async loadAndShowVolunteeringFromURL(volunteeringId) {
    try {
      const { data: volunteering, error } = await supabase
        .from('volunteering')
        .select('*')
        .eq('id', volunteeringId)
        .single();

      if (error || !volunteering) {
        console.error('❌ Error cargando voluntariado desde URL:', error);
        // Redirigir a la página general de voluntariado
        window.history.replaceState({}, '', '/volunteering');
        return;
      }

      // Añadir el voluntariado a window.volunteering si no existe
      if (!window.volunteering) {
        window.volunteering = [];
      }
      
      // Verificar si ya existe para evitar duplicados
      if (!window.volunteering.find(v => v.id === volunteeringId)) {
        window.volunteering.push(volunteering);
      }

      // Abrir el modal
      this.showVolunteeringModal(volunteeringId);
    } catch (error) {
      console.error('❌ Error cargando voluntariado:', error);
      window.history.replaceState({}, '', '/volunteering');
    }
  },

  // Función para mostrar el modal con los detalles del voluntariado
  async showVolunteeringModal(volunteeringId) {
    const { data: volunteering, error } = await supabase
      .from('volunteering')
      .select('*')
      .eq('id', volunteeringId)
      .single();

    if (error) {
      alert('Error al cargar el voluntariado: ' + error.message);
      return;
    }

    // Progreso basado en current_volunteers/max_volunteers
    const progress = volunteering.max_volunteers
      ? Math.min(Math.round((volunteering.current_volunteers / volunteering.max_volunteers) * 100), 100)
      : 0;

    const createdDate = new Date(volunteering.created_at).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Obtener información de la causa vinculada si existe
    let causeInfo = '';
    if (volunteering.cause_id) {
      const { data: cause } = await supabase
        .from('causes')
        .select('title, short_description, photo_url')
        .eq('id', volunteering.cause_id)
        .single();

      if (cause) {
        causeInfo = `
          <div class="linked-cause-section" style="margin-bottom:1.5rem;">
            <h3 class="content-title" style="font-size:1.2rem; font-weight:600; color:var(--primary); margin-bottom:0.9rem; display:flex; align-items:center; gap:0.7rem;">
              <i class="fas fa-link"></i> Vinculado a la causa
            </h3>
            <div style="display:flex; align-items:center; gap:1.2rem; background:#f8fafc; padding:1rem; border-radius:8px; border:1px solid #e5e7eb;">
              <img src="${cause.photo_url || '/img/causa-default.jpg'}"
                   alt="Imagen de la causa vinculada"
                   style="width:80px; height:80px; object-fit:cover; border-radius:6px;"
                   onerror="this.src='/img/causa-default.jpg'">
              <div style="flex:1; min-width:0;">
                <div style="font-weight:700; color:var(--primary); font-size:1.05rem; margin-bottom:0.2rem;">
                  ${cause.title}
                </div>
                <div style="color:#6b7280; font-size:0.97rem;">
                  ${cause.short_description || 'Sin resumen disponible'}
                </div>
              </div>
              <a href="/causes/${volunteering.cause_id}"
                 class="btn btn-primary"
                 style="margin-left:1.2rem; white-space:nowrap; font-size:0.97rem; padding:0.5rem 1.1rem;">
                <i class="fas fa-arrow-right"></i> Ver causa
              </a>
            </div>
          </div>
        `;
      }
    }

    // Obtener voluntarios
    const { data: members } = await supabase
      .from('volunteering_members')
      .select('user_id, profiles(username, photo_url)')
      .eq('volunteering_id', volunteeringId);

    let volunteersHtml = '';
    if (members && members.length > 0) {
      volunteersHtml = `
        <div class="content-section" style="margin-bottom:2.2rem;">
          <h3 class="content-title" style="font-size:1.2rem; font-weight:600; color:var(--primary); margin-bottom:0.9rem;">
            <i class="fas fa-users"></i> Voluntarios
          </h3>
          <div style="display:flex; flex-wrap:wrap; gap:1rem;">
            ${members.map(m => `
              <div style="display:flex; align-items:center; gap:0.6rem; background:#f8fafc; border-radius:8px; padding:0.5rem 1rem;">
                <img src="${m.profiles?.photo_url || '/img/avatar-default.png'}" alt="${m.profiles?.username || 'Usuario'}" style="width:36px; height:36px; border-radius:50%; object-fit:cover;">
                <span style="font-weight:600; color:var(--primary);">${m.profiles?.username || 'Usuario'}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    // Crear modal si no existe
    let modal = document.getElementById('volunteeringModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'volunteeringModal';
      modal.className = 'modal';
      modal.style.cssText = 'display:none; position:fixed; z-index:9999; left:0; top:0; width:100vw; height:100vh; background:rgba(0,0,0,0.35); align-items:center; justify-content:center;';
      modal.innerHTML = `
        <div class="modal-content" style="background:#fff; border-radius:18px; max-width:800px; width:95vw; padding:2rem; box-shadow:0 8px 32px rgba(74,111,165,0.13); position:relative; max-height:90vh; overflow-y:auto;">
          <button id="closeVolunteeringModal" style="position:absolute; top:1.5rem; right:1.5rem; background:none; border:none; font-size:1.8rem; color:#6b7280; cursor:pointer;">&times;</button>
          <div id="volunteeringModalBody"></div>
        </div>
      `;
      document.body.appendChild(modal);

      // Event listeners para cerrar
      modal.querySelector('#closeVolunteeringModal').addEventListener('click', () => {
        this.closeModal();
      });
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          this.closeModal();
        }
      });
    }

    // Llenar contenido del modal
    document.getElementById('volunteeringModalBody').innerHTML = `
      <h1 style="font-size:2rem; font-weight:800; color:var(--primary); margin-bottom:2rem; text-align:center;">${volunteering.title}</h1>
      <div style="display:flex; gap:2rem; margin-bottom:2rem;">
        <div style="flex:1; min-width:320px; height:300px; border-radius:12px; overflow:hidden; position:relative;">
          <img src="${volunteering.photo_url || '/img/volunteering-default.jpg'}" 
               alt="Imagen del voluntariado ${volunteering.title}"
               style="width:100%;height:100%;object-fit:cover;"
               onerror="this.src='/img/volunteering-default.jpg'">
          ${volunteering.is_urgent ? `<div style="position:absolute; top:1rem; right:1rem; background:var(--urgent); color:white; padding:0.5rem 1rem; border-radius:50px; font-size:0.9rem; font-weight:600;"><i class="fas fa-exclamation-circle"></i> Urgente</div>` : ''}
        </div>
        <div style="flex:1.5;">
          <div style="background:#f8fafc; padding:1.5rem; border-radius:12px; margin-bottom:1.5rem;">
            <div class="progress-bar" style="height:8px; background:#e5e7eb; border-radius:4px; overflow:hidden; margin-bottom:0.5rem;">
              <div class="progress-fill" style="width:${progress}%; height:100%; background:var(--volunteering);"></div>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:0.9rem; color:#6b7280;">
              <span>${progress}% completado</span>
              <span>${volunteering.current_volunteers || 0} de ${volunteering.max_volunteers || 0} voluntarios</span>
            </div>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.7rem; margin-bottom:1.2rem;">
            <div style="display:flex; align-items:center; gap:0.5rem; color:#6b7280;">
              <i class="fas fa-map-marker-alt" style="color:var(--primary);"></i>
              <span>${volunteering.city || 'Sin ubicación'}${volunteering.country ? ', ' + volunteering.country : ''}</span>
            </div>
            <div style="display:flex; align-items:center; gap:0.5rem; color:#6b7280;">
              <i class="fas fa-users" style="color:var(--primary);"></i>
              <span>${volunteering.current_volunteers || 0} voluntarios</span>
            </div>
            <div style="display:flex; align-items:center; gap:0.5rem; color:#6b7280;">
              <i class="fas fa-heart" style="color:var(--primary);"></i>
              <span>${volunteering.beneficiaries || 0} beneficiarios</span>
            </div>
            <div style="display:flex; align-items:center; gap:0.5rem; color:#6b7280;">
              <i class="fas fa-calendar-alt" style="color:var(--primary);"></i>
              <span>${volunteering.start_date ? new Date(volunteering.start_date).toLocaleDateString('es-ES') : 'Sin fecha'}</span>
            </div>
          </div>
          <div style="background:#e6fffa; border-left:4px solid var(--volunteering); padding:0.8rem; border-radius:0 8px 8px 0;">
            <i class="fas fa-star" style="color:var(--volunteering);"></i>
            Ser voluntario otorgará <strong>${volunteering.points || 20} puntos</strong> de impacto
          </div>
        </div>
      </div>
      ${causeInfo}
      <div style="margin-bottom:2rem;">
        <h3 style="font-size:1.2rem; font-weight:600; color:var(--primary); margin-bottom:0.9rem;">
          <i class="fas fa-align-left"></i> Resumen
        </h3>
        <p style="line-height:1.7; color:#4b5563; margin-bottom:2rem;">
          ${volunteering.summary || 'No hay resumen disponible para este voluntariado.'}
        </p>
        <h3 style="font-size:1.2rem; font-weight:600; color:var(--primary); margin-bottom:0.9rem;">
          <i class="fas fa-info-circle"></i> Descripción completa
        </h3>
        <p style="line-height:1.7; color:#4b5563;">
          ${volunteering.description || 'No hay descripción disponible para este voluntariado.'}
        </p>
      </div>
      ${volunteersHtml}
      <div style="display:flex; gap:0.8rem; margin-top:2rem;">
        <button class="btn btn-primary" style="flex:1;" onclick="window.joinVolunteering('${volunteering.id}')">
          <i class="fas fa-hand-holding-heart"></i> Ser voluntario
        </button>
        <button class="btn btn-outline share-btn-volunteering" style="flex:1;" data-type="volunteering" data-id="${volunteering.id}" data-title="${volunteering.title}" data-url="/volunteering/${volunteering.id}">
          <i class="fas fa-share-alt"></i> Compartir
        </button>
      </div>
      <div class="share-section" id="shareSection" style="text-align:left;"></div>
    `;

    // ✅ AGREGAR EVENT LISTENER PARA COMPARTIR EN EL MODAL
    const shareBtn = modal.querySelector('.share-btn-volunteering');
    if (shareBtn) {
      shareBtn.addEventListener('click', () => {
        this.shareVolunteering(volunteeringId);
      });
    }

    // Mostrar modal
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // Actualizar URL si estamos en la página de voluntariado
    if (window.location.pathname === '/volunteering' || window.location.pathname === '/volunteering/') {
      window.history.pushState({}, '', `/volunteering/${volunteeringId}`);
    }
  },

  // Cerrar modal y limpiar URL
  closeModal() {
    const modal = document.getElementById('volunteeringModal');
    if (modal) {
      modal.style.display = 'none';
      document.body.style.overflow = '';
      
      // Limpiar URL si es necesario
      if (window.location.pathname.includes('/volunteering/') && window.location.pathname !== '/volunteering') {
        window.history.pushState({}, '', '/volunteering');
      }
    }
  },

  // ✅ FUNCIÓN PARA COMPARTIR VOLUNTARIADO USANDO COMPARTIR.JS
  shareVolunteering(volunteeringId) {
    const volunteering = window.volunteering?.find(v => v.id == volunteeringId);
    if (!volunteering) {
      console.error('❌ No se encontró el voluntariado con ID:', volunteeringId);
      return;
    }
    
    console.log('🔗 Compartiendo voluntariado:', volunteering);
    
    // ✅ USAR COMPARTIR.JS SIGUIENDO EL PATRÓN HOMOGÉNEO
    if (window.renderCompartir) {
      window.renderCompartir({
        title: volunteering.title,
        summary: volunteering.summary || volunteering.description?.substring(0, 120) + '...',
        photo_url: volunteering.photo_url || '/img/volunteering-default.jpg',
        link: `${window.location.origin}/volunteering/${volunteering.id}`,
        type: 'voluntariado'
      }, 'shareSection');
      
      document.getElementById('shareSection').scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      });
    } else {
      // Fallback si no está compartir.js
      const link = `${window.location.origin}/volunteering/${volunteering.id}`;
      navigator.clipboard.writeText(link).then(() => {
        alert('¡Enlace copiado!');
      }).catch(() => {
        prompt('Copia este enlace:', link);
      });
    }
  }
};

// Exportar para uso global
window.volunteeringRenderer = VolunteeringRenderer;
window.VolunteeringRenderer = VolunteeringRenderer;

// ✅ FUNCIÓN GLOBAL PARA COMPARTIR VOLUNTARIADO (HOMOGÉNEA CON TODA LA PÁGINA)
window.mostrarCompartirVolunteering = function(volunteeringId) {
  VolunteeringRenderer.shareVolunteering(volunteeringId);
};

// ✅ FUNCIÓN AUXILIAR PARA UNIRSE A VOLUNTARIADO
window.joinVolunteering = async function(volunteeringId) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    alert('Debes iniciar sesión para ser voluntario.');
    return;
  }
  const userId = session.user.id;
  
  const { data, error } = await supabase
    .from('volunteering_members')
    .insert([{ volunteering_id: volunteeringId, user_id: userId, role: 'member', status: 'active' }]);

  if (error) {
    console.error('Error al unirse al voluntariado:', error);
    if (error.code === '23505') {
      alert('Ya eres voluntario en esta actividad.');
    } else {
      alert('No se pudo unir al voluntariado. Inténtalo nuevamente más tarde.');
    }
    return;
  }

  alert('¡Ahora eres voluntario en esta actividad!');
  VolunteeringRenderer.closeModal();
  
  // Recargar página si hay función disponible
  if (window.loadVolunteeringFromSupabase) {
    window.loadVolunteeringFromSupabase();
  }
};

// Si es un módulo ES6, también exportar
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VolunteeringRenderer;
}