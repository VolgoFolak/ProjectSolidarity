/**
 * Módulo para renderizar tarjetas y modales de retos/challenges
 * Con soporte completo para administración y funcionalidades unificadas
 */

const ChallengesRenderer = {
  // Renderizar una sola tarjeta de desafío
  renderCard(challenge) {
    if (!challenge) return '';

    const urgentBadge = challenge.is_urgent ? `<div class="challenge-badge urgent"><i class="fas fa-exclamation-circle"></i> Urgente</div>` : "";
    const pointsBadge = `<div class="challenge-badge points"><i class="fas fa-star"></i> +${challenge.points || 0} pts</div>`;
    const location = challenge.city && challenge.country ? `${challenge.city}, ${challenge.country}` : "";
    
    // Progreso basado en participantes/beneficiarios
    const progress = challenge.beneficiaries ? Math.min(Math.round((challenge.participants / challenge.beneficiaries) * 100), 100) : 0;

    // Causa vinculada
    let causeHtml = '';
    if (challenge.cause_id && challenge.linkedCause) {
      const cause = challenge.linkedCause;
      causeHtml = `
        <div class="linked-cause">
          <img src="${cause.photo_url || '/img/causa-default.jpg'}" alt="${cause.title}">
          <span>${cause.title}</span>
        </div>
      `;
    }

    // ✅ VERIFICAR ROL DE ADMINISTRADOR PRIMERO
    const isAdmin = ['founder','admin','coordinator','creator'].includes(challenge.userRole) || challenge.isCreator;
    const isParticipating = challenge.isParticipating;

    // ✅ BOTONES CON CLASES CSS CORRECTAS Y FUNCIONALIDAD PRESERVADA
    let actionButtons = '';
    if (isAdmin) {
      actionButtons = `
        <button class="btn btn-primary view-challenge-btn" data-challenge-id="${challenge.id}">Ver más</button>
        <button class="btn btn-accent admin-activity-btn" data-activity-type="challenge" data-activity-id="${challenge.id}">
          <i class="fas fa-cog"></i> Administrar
        </button>
      `;
    } else if (isParticipating) {
      actionButtons = `
        <button class="btn btn-primary view-challenge-btn" data-challenge-id="${challenge.id}">Ver más</button>
        <button class="btn btn-accent participate-btn" data-challenge-id="${challenge.id}" disabled style="opacity:0.7;cursor:not-allowed;">
          <i class="fas fa-check"></i> Reto Aceptado!
        </button>
      `;
    } else {
      actionButtons = `
        <button class="btn btn-primary view-challenge-btn" data-challenge-id="${challenge.id}">Ver más</button>
        <button class="btn btn-warning participate-btn" data-challenge-id="${challenge.id}">
          <i class="fas fa-bolt"></i> Aceptar Reto
        </button>
      `;
    }

    const card = `
      <div class="challenge-card">
        <div class="challenge-image">
          <img src="${challenge.photo_url || '/img/challenge-default.jpg'}" alt="${challenge.title}" onerror="this.src='/img/challenge-default.jpg'">
          ${urgentBadge}
          ${pointsBadge}
        </div>
        <div class="challenge-content">
          <h3>${challenge.title}</h3>
          <p>${challenge.summary ? challenge.summary : (challenge.description.substring(0, 100) + (challenge.description.length > 100 ? '...' : ''))}</p>
          ${causeHtml}
          <div class="challenge-meta">
            <div class="meta-item"><i class="fas fa-map-marker-alt"></i> ${location}</div>
            <span class="meta-item">
              <i class="fas fa-users"></i>
              ${challenge.participants || 0} participantes
            </span>
            <div class="beneficiaries-count">
              <i class="fas fa-heart"></i> Beneficia a ${challenge.beneficiaries || 0} personas
            </div>
          </div>
          <div class="challenge-progress">
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${progress}%"></div>
            </div>
            <div class="progress-info">
              <span>${challenge.participants || 0} participantes</span>
              <span>Meta: ${challenge.beneficiaries || 0}</span>
            </div>
          </div>
          <div class="challenge-actions">
            ${actionButtons}
          </div>
        </div>
      </div>
    `;
    
    return card;
  },

  // Renderizar grid completo de desafíos
  renderGrid(challenges, container) {
    if (!container) return;
    
    container.innerHTML = '';
    
    if (!challenges || challenges.length === 0) {
      container.innerHTML = '<div style="color:#6b7280;text-align:center;padding:2rem;grid-column:1/-1;">No se encontraron desafíos.</div>';
      return;
    }

    // ✅ INYECTAR ESTILOS CSS ANTES DE RENDERIZAR
    this.injectStyles();

    // Guardar los desafíos en una variable global para acceder desde el modal
    window.challenges = challenges;
    
    for (const challenge of challenges) {
      const cardHtml = this.renderCard(challenge);
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
    container.querySelectorAll('.view-challenge-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const challengeId = btn.getAttribute('data-challenge-id');
        this.showChallengeModal(challengeId);
      });
    });
    
    // ✅ EVENT LISTENERS PARA BOTÓN ADMINISTRAR (igual que causes-renderer.js)
    container.querySelectorAll('.admin-activity-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const activityId = btn.getAttribute('data-activity-id');
        if (typeof window.openAdminActivityModal === 'function') {
          const challenge = window.challenges?.find(c => c.id == activityId);
          if (challenge) window.openAdminActivityModal(challenge);
        } else if (typeof window.openAdminModal === 'function') {
          // Fallback para compatibilidad
          const challenge = window.challenges?.find(c => c.id == activityId);
          if (challenge) window.openAdminModal(challenge);
        }
      });
    });
    
    // Event listeners para botones "Participar"
    container.querySelectorAll('.participate-btn').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        const challengeId = this.getAttribute('data-challenge-id');
        if (window.participateInChallenge) {
          window.participateInChallenge(challengeId, this); // <-- PASA EL BOTÓN
        }
      });
    });
  },

  // ✅ INYECTAR ESTILOS CSS NECESARIOS
  injectStyles() {
    if (document.getElementById('challenges-renderer-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'challenges-renderer-styles';
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
        --challenge: #ffe066;
        --challenge-dark: #a67c00;
        --success: #10b981;
        --success-dark: #059669;
      }

      .challenges-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
        gap: 2rem;
      }

      .challenge-card {
        background: white;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.05);
        transition: all 0.3s ease;
        border: 1px solid var(--gray);
        display: flex;
        flex-direction: column;
      }

      .challenge-card:hover {
        transform: translateY(-5px);
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
      }

      .challenge-image {
        height: 180px;
        overflow: hidden;
        position: relative;
      }

      .challenge-image img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        transition: transform 0.3s ease;
      }

      .challenge-card:hover .challenge-image img {
        transform: scale(1.05);
      }

      .challenge-badge {
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

      .challenge-badge.urgent {
        background: var(--urgent);
        color: white;
      }

      .challenge-badge.points {
        background: var(--challenge-dark);
        color: white;
        left: 1rem;
        right: auto;
      }

      .challenge-content {
        padding: 1.5rem;
        display: flex;
        flex-direction: column;
        flex: 1;
      }

      .challenge-content h3 {
        font-size: 1.3rem;
        margin-bottom: 0.8rem;
        color: #2d3748;
      }

      .challenge-content p {
        color: #6b7280;
        margin-bottom: 1.5rem;
        font-size: 0.95rem;
        line-height: 1.6;
        flex-grow: 1;
      }

      .challenge-meta {
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
        color: var(--challenge-dark);
      }

      .beneficiaries-count {
        display: inline-flex;
        align-items: center;
        background: #f0f0ff;
        color: var(--primary);
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

      .challenge-progress {
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
        background: var(--challenge-dark);
        border-radius: 4px;
      }

      .progress-info {
        display: flex;
        justify-content: space-between;
        font-size: 0.9rem;
        color: #6b7280;
      }

      .challenge-actions {
        display: flex;
        gap: 0.8rem;
      }

      .challenge-actions .btn {
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
        background: var(--challenge);
        color: #333;
      }

      .btn-warning:hover {
        background: var(--challenge-dark);
        color: white;
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
        .challenges-grid {
          grid-template-columns: 1fr;
        }
        
        .challenge-actions {
          flex-direction: column;
        }
      }
    `;
    document.head.appendChild(style);
  },

  // Verificar si hay que abrir modal desde URL
  checkForModalFromURL() {
    const path = window.location.pathname;
    const challengeIdMatch = path.match(/\/challenges\/([a-f0-9-]+)$/);
    
    if (challengeIdMatch) {
      const challengeId = challengeIdMatch[1];
      console.log('🔗 URL detecta desafío específico:', challengeId);
      
      // Buscar el desafío en los cargados
      const challenge = window.challenges?.find(c => c.id === challengeId);
      
      if (challenge) {
        // Si el desafío está cargado, abrir modal inmediatamente
        setTimeout(() => {
          this.showChallengeModal(challengeId);
        }, 100);
      } else {
        // Si no está cargado, intentar cargar desde Supabase
        setTimeout(() => {
          this.loadAndShowChallengeFromURL(challengeId);
        }, 500);
      }
    }
  },

  // Cargar desafío específico desde URL si no está en memoria
  async loadAndShowChallengeFromURL(challengeId) {
    try {
      const { data: challenge, error } = await supabase
        .from('challenges')
        .select('*')
        .eq('id', challengeId)
        .single();

      if (error || !challenge) {
        console.error('❌ Error cargando desafío desde URL:', error);
        // Redirigir a la página general de desafíos
        window.history.replaceState({}, '', '/challenges');
        return;
      }

      // Añadir el desafío a window.challenges si no existe
      if (!window.challenges) {
        window.challenges = [];
      }
      
      // Verificar si ya existe para evitar duplicados
      if (!window.challenges.find(c => c.id === challengeId)) {
        window.challenges.push(challenge);
      }

      // Abrir el modal
      this.showChallengeModal(challengeId);
    } catch (error) {
      console.error('❌ Error cargando desafío:', error);
      window.history.replaceState({}, '', '/challenges');
    }
  },

  // Función para mostrar el modal con los detalles del desafío
  async showChallengeModal(challengeId) {
    const { data: challenge, error } = await supabase
      .from('challenges')
      .select('*')
      .eq('id', challengeId)
      .single();

    if (error) {
      alert('Error al cargar el desafío: ' + error.message);
      return;
    }

    // Progreso basado en participants/beneficiaries
    const progress = challenge.beneficiaries
      ? Math.min(Math.round((challenge.participants / challenge.beneficiaries) * 100), 100)
      : 0;

    const createdDate = new Date(challenge.created_at).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Obtener información de la causa vinculada si existe
    let causeInfo = '';
    if (challenge.cause_id) {
      const { data: cause } = await supabase
        .from('causes')
        .select('title, short_description, photo_url')
        .eq('id', challenge.cause_id)
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
              <a href="/causes/${challenge.cause_id}"
                 class="btn btn-primary"
                 style="margin-left:1.2rem; white-space:nowrap; font-size:0.97rem; padding:0.5rem 1.1rem;">
                <i class="fas fa-arrow-right"></i> Ver causa
              </a>
            </div>
          </div>
        `;
      }
    }

    // Obtener participantes
    const { data: members } = await supabase
      .from('challenges_members')
      .select('user_id, role, profiles:profiles(username, photo_url)')
      .eq('challenge_id', challengeId)
      .eq('status', 'active');

    let participantsHtml = '';
    if (members && members.length > 0) {
      participantsHtml = `
        <div class="content-section" style="margin-bottom:2.2rem;">
          <h3 class="content-title" style="font-size:1.2rem; font-weight:600; color:var(--primary); margin-bottom:0.9rem;">
            <i class="fas fa-users"></i> Participantes
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
    let modal = document.getElementById('challengeModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'challengeModal';
      modal.className = 'modal';
      modal.style.cssText = 'display:none; position:fixed; z-index:9999; left:0; top:0; width:100vw; height:100vh; background:rgba(0,0,0,0.35); align-items:center; justify-content:center;';
      modal.innerHTML = `
        <div class="modal-content" style="background:#fff; border-radius:18px; max-width:800px; width:95vw; padding:2rem; box-shadow:0 8px 32px rgba(74,111,165,0.13); position:relative; max-height:90vh; overflow-y:auto;">
          <button id="closeChallengeModal" style="position:absolute; top:1.5rem; right:1.5rem; background:none; border:none; font-size:1.8rem; color:#6b7280; cursor:pointer;">&times;</button>
          <div id="challengeModalBody"></div>
        </div>
      `;
      document.body.appendChild(modal);

      // Event listeners para cerrar
      modal.querySelector('#closeChallengeModal').addEventListener('click', () => {
        this.closeModal();
      });
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          this.closeModal();
        }
      });
    }

    // Llenar contenido del modal
    document.getElementById('challengeModalBody').innerHTML = `
      <h1 style="font-size:2rem; font-weight:800; color:var(--primary); margin-bottom:2rem; text-align:center;">${challenge.title}</h1>
      <div style="display:flex; gap:2rem; margin-bottom:2rem;">
        <div style="flex:1; min-width:320px; height:300px; border-radius:12px; overflow:hidden; position:relative;">
          <img src="${challenge.photo_url || '/img/challenge-default.jpg'}" 
               alt="Imagen del desafío ${challenge.title}"
               style="width:100%;height:100%;object-fit:cover;"
               onerror="this.src='/img/challenge-default.jpg'">
          ${challenge.is_urgent ? `<div style="position:absolute; top:1rem; right:1rem; background:var(--urgent); color:white; padding:0.5rem 1rem; border-radius:50px; font-size:0.9rem; font-weight:600;"><i class="fas fa-exclamation-circle"></i> Urgente</div>` : ''}
        </div>
        <div style="flex:1.5;">
          <div style="background:#f8fafc; padding:1.5rem; border-radius:12px; margin-bottom:1.5rem;">
            <div class="progress-bar" style="height:8px; background:#e5e7eb; border-radius:4px; overflow:hidden; margin-bottom:0.5rem;">
              <div class="progress-fill" style="width:${progress}%; height:100%; background:var(--primary);"></div>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:0.9rem; color:#6b7280;">
              <span>${progress}% completado</span>
              <span>${challenge.participants || 0} de ${challenge.beneficiaries || 0} participantes</span>
            </div>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.7rem; margin-bottom:1.2rem;">
            <div style="display:flex; align-items:center; gap:0.5rem; color:#6b7280;">
              <i class="fas fa-map-marker-alt" style="color:var(--primary);"></i>
              <span>${challenge.city || 'Sin ubicación'}${challenge.country ? ', ' + challenge.country : ''}</span>
            </div>
            <div style="display:flex; align-items:center; gap:0.5rem; color:#6b7280;">
              <i class="fas fa-users" style="color:var(--primary);"></i>
              <span>${challenge.participants || 0} participantes</span>
            </div>
            <div style="display:flex; align-items:center; gap:0.5rem; color:#6b7280;">
              <i class="fas fa-heart" style="color:var(--primary);"></i>
              <span>${challenge.beneficiaries || 0} beneficiarios</span>
            </div>
            <div style="display:flex; align-items:center; gap:0.5rem; color:#6b7280;">
              <i class="fas fa-calendar-alt" style="color:var(--primary);"></i>
              <span>${challenge.end_date ? new Date(challenge.end_date).toLocaleDateString('es-ES') : 'Sin fecha límite'}</span>
            </div>
          </div>
          <div style="background:#f0f9ff; border-left:4px solid var(--accent); padding:0.8rem; border-radius:0 8px 8px 0;">
            <i class="fas fa-star" style="color:var(--accent);"></i>
            Participar otorgará <strong>${challenge.points || 20} puntos</strong> de impacto
          </div>
        </div>
      </div>
      ${causeInfo}
      <div style="margin-bottom:2rem;">
        <h3 style="font-size:1.2rem; font-weight:600; color:var(--primary); margin-bottom:0.9rem;">
          <i class="fas fa-align-left"></i> Resumen
        </h3>
        <p style="line-height:1.7; color:#4b5563; margin-bottom:2rem;">
          ${challenge.summary || 'No hay resumen disponible para este desafío.'}
        </p>
        <h3 style="font-size:1.2rem; font-weight:600; color:var(--primary); margin-bottom:0.9rem;">
          <i class="fas fa-info-circle"></i> Descripción completa
        </h3>
        <p style="line-height:1.7; color:#4b5563;">
          ${challenge.description || 'No hay descripción disponible para este desafío.'}
        </p>
      </div>
      ${participantsHtml}
      <div style="display:flex; gap:0.8rem; margin-top:2rem;">
        <button class="btn btn-primary" style="flex:1;" onclick="window.participateInChallenge('${challenge.id}')">
          <i class="fas fa-hand-holding-heart"></i> Participar
        </button>
        <button class="btn btn-outline share-btn-challenge" style="flex:1;" data-type="challenge" data-id="${challenge.id}" data-title="${challenge.title}" data-url="/challenges/${challenge.id}">
          <i class="fas fa-share-alt"></i> Compartir
        </button>
      </div>
      <div class="share-section" id="shareSection" style="text-align:left;"></div>
    `;

    // ✅ AGREGAR EVENT LISTENER PARA COMPARTIR EN EL MODAL
    const shareBtn = modal.querySelector('.share-btn-challenge');
    if (shareBtn) {
      shareBtn.addEventListener('click', () => {
        this.shareChallenge(challengeId);
      });
    }

    // Mostrar modal
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // Actualizar URL si estamos en la página de desafíos
    if (window.location.pathname === '/challenges' || window.location.pathname === '/challenges/') {
      window.history.pushState({}, '', `/challenges/${challengeId}`);
    }
  },

  // Cerrar modal y limpiar URL
  closeModal() {
    const modal = document.getElementById('challengeModal');
    if (modal) {
      modal.style.display = 'none';
      document.body.style.overflow = '';
      
      // Limpiar URL si es necesario
      if (window.location.pathname.includes('/challenges/') && window.location.pathname !== '/challenges') {
        window.history.pushState({}, '', '/challenges');
      }
    }
  },

  // ✅ FUNCIÓN PARA COMPARTIR DESAFÍO USANDO COMPARTIR.JS
  shareChallenge(challengeId) {
    const challenge = window.challenges?.find(c => c.id == challengeId);
    if (!challenge) {
      console.error('❌ No se encontró el desafío con ID:', challengeId);
      return;
    }
    
    console.log('🔗 Compartiendo desafío:', challenge);
    
    // ✅ USAR COMPARTIR.JS SIGUIENDO EL PATRÓN HOMOGÉNEO
    if (window.renderCompartir) {
      window.renderCompartir({
        title: challenge.title,
        summary: challenge.summary || challenge.description?.substring(0, 120) + '...',
        photo_url: challenge.photo_url || '/img/challenge-default.jpg',
        link: `${window.location.origin}/challenges/${challenge.id}`,
        type: 'desafío'
      }, 'shareSection');
      
      document.getElementById('shareSection').scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      });
    } else {
      // Fallback si no está compartir.js
      const link = `${window.location.origin}/challenges/${challenge.id}`;
      navigator.clipboard.writeText(link).then(() => {
        alert('¡Enlace copiado!');
      }).catch(() => {
        prompt('Copia este enlace:', link);
      });
    }
  }
};

// Exportar para uso global
window.challengesRenderer = ChallengesRenderer;
window.ChallengesRenderer = ChallengesRenderer;

// ✅ FUNCIÓN GLOBAL PARA COMPARTIR DESAFÍOS (HOMOGÉNEA CON TODA LA PÁGINA)
window.mostrarCompartirChallenge = function(challengeId) {
  ChallengesRenderer.shareChallenge(challengeId);
};

// ✅ FUNCIÓN AUXILIAR PARA PARTICIPAR EN DESAFÍOS
window.participateInChallenge = async function(challengeId, btnElement) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    alert('Debes iniciar sesión para participar.');
    return;
  }
  const userId = session.user.id;
  
  const { data, error } = await supabase
    .from('challenge_members')  // ✅ CORREGIDO: era 'challenges_members'
    .insert([{ challenge_id: challengeId, user_id: userId, role: 'member', status: 'active' }]);

  if (error) {
    console.error('Error al unirse al desafío:', error);
    if (error.code === '23505') {
      alert('Ya estás participando en este desafío.');
    } else {
      alert('No se pudo unir al desafío. Inténtalo nuevamente más tarde.');
    }
    return;
  }

  alert('¡Ahora participas en este desafío!');
  ChallengesRenderer.closeModal();
  
  // Recargar página si hay función disponible
  if (window.loadChallengesFromSupabase) {
    window.loadChallengesFromSupabase();
  }
};

// Si es un módulo ES6, también exportar
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ChallengesRenderer;
}