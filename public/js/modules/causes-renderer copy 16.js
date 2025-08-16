/**
 * Módulo para renderizar tarjetas y modales de causas
 * Template basado EXACTO en views/causes/index.njk
 */

class CausesRenderer {
  constructor() {
    this.causes = [];
    this.currentFilter = "all";
    this.supabase = null;
    this.initSupabase();
  }

  /**
   * Inicializa la conexión con Supabase
   */
  async initSupabase() {
    if (window.supabase) {
      this.supabase = window.supabase;
      return;
    }

    return new Promise((resolve) => {
      if (window.supabaseReady) {
        this.supabase = window.supabase;
        resolve();
      } else {
        document.addEventListener('supabaseReady', () => {
          this.supabase = window.supabase;
          resolve();
        }, { once: true });
      }
    });
  }

  /**
   * Verifica que Supabase esté listo
   */
  async ensureSupabase() {
    if (!this.supabase) {
      await this.initSupabase();
    }
    return this.supabase;
  }

  /**
   * Renderiza una grilla de tarjetas de causas
   */
  renderGrid(causes, container, options = {}) {
    this.causes = causes;
    container.innerHTML = '';

    if (!causes || causes.length === 0) {
      container.innerHTML = '<div style="color:#6b7280;text-align:center;padding:2rem;grid-column:1/-1;">No se encontraron causas.</div>';
      return;
    }

    if (!container.classList.contains('causes-grid')) {
      container.className = 'causes-grid';
      this.injectGridStyles();
    }

    causes.forEach(cause => {
      const card = this.createCauseCard(cause, options);
      container.appendChild(card);
    });

    window.causes = causes;
    this.attachEventListeners(container);
  }

  /**
   * Crea una tarjeta individual de causa
   */
  createCauseCard(cause, options = {}) {
    const progress = cause.goal ? Math.min(Math.round((cause.raised / cause.goal) * 100), 100) : 0;
    const urgentBadge = cause.urgent ? `<div class="cause-badge urgent"><i class="fas fa-exclamation-circle"></i> Urgente</div>` : "";
    const pointsBadge = `<div class="cause-badge points"><i class="fas fa-star"></i> +${cause.points || 0} pts</div>`;
    const location = cause.city && cause.country ? `${cause.city}, ${cause.country}` : "";
    const isAdmin = ['founder','admin','coordinator'].includes(cause.userRole);

    const viewMoreBtn = `
      <button class="btn btn-primary view-more-btn" data-cause-id="${cause.id}">
        Ver más
      </button>
    `;

    const actionBtn = isAdmin ? `
      <button class="btn btn-accent admin-activity-btn" data-activity-type="cause" data-activity-id="${cause.id}">
        Administrar
      </button>
    ` : `
      <button class="btn btn-accent donate-btn" data-cause-id="${cause.id}" data-stripe-enabled="${cause.stripe_accounts?.[0]?.charges_enabled ? 'true' : 'false'}" data-stripe-account="${cause.stripe_accounts?.[0]?.stripe_account_id || ''}">
        Donar
      </button>
    `;

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
          ${viewMoreBtn}
          ${actionBtn}
        </div>
      </div>
    `;

    return card;
  }

  /**
   * Muestra el modal de causa
   */
  async showModal(causeId, activeTab = 'details') {
    const cause = window.causes?.find(c => c.id == causeId);
    if (!cause) {
      console.error('❌ Causa no encontrada:', causeId);
      return;
    }

    await this.ensureSupabase();

    const { data: donors, error: donorsError } = await this.supabase
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

    const modal = this.getOrCreateModal();
    const modalBody = modal.querySelector('#modalBody');

    modalBody.innerHTML = `
      <div class="modal-cause-container">
        <h1 class="modal-cause-title" style="font-size:2rem; font-weight:800; color:var(--primary); margin-bottom:2rem; text-align:center;">${cause.title}</h1>
        <div class="modal-cause-header" style="display:flex; gap:2rem; margin-bottom:2rem; flex-wrap:wrap;">
          <div class="modal-cause-image-wrapper" style="flex:1; min-width:320px; height:280px; border-radius:12px; overflow:hidden; position:relative; box-shadow:0 4px 12px rgba(0,0,0,0.08);">
            <img class="modal-cause-image" src="${cause.photo_url || '/img/causa-default.jpg'}" 
                 alt="Imagen de la causa ${cause.title}"
                 style="width:100%;height:100%;object-fit:cover;"
                 onerror="this.src='/img/causa-default.jpg'">
            ${cause.urgent ? `<div class="modal-cause-badge urgent" style="position:absolute; top:1.5rem; right:1.5rem; background:var(--urgent); color:white; padding:0.5rem 1rem; border-radius:50px; font-size:0.9rem; font-weight:600; display:flex; align-items:center; gap:0.6rem; box-shadow:0 2px 8px rgba(0,0,0,0.1); z-index:2;"><i class="fas fa-exclamation-circle"></i> Urgente</div>` : ''}
          </div>
          <div class="modal-cause-info" style="flex:1.5; display:flex; flex-direction:column;">
            <div class="modal-cause-progress-container" style="background:#f8fafc; padding:1.5rem; border-radius:12px; margin-bottom:1.5rem; border:1px solid #e5e7eb;">
              <div class="progress-bar">
                <div class="progress-fill" style="width: ${progress}%"></div>
              </div>
              <div class="progress-info">
                <span>${progress}% completado</span>
                <span>${cause.raised || 0} € de ${cause.goal || 0} €</span>
              </div>
            </div>
            <div class="modal-cause-meta-grid" style="display:grid; grid-template-columns:1fr 1fr; gap:1.2rem; margin-bottom:1.5rem;">
              <div class="meta-item"><i class="fas fa-map-marker-alt" style="color:var(--primary);"></i> ${cause.city || 'Sin ubicación'}${cause.country ? ', ' + cause.country : ''}</div>
              <div class="meta-item"><i class="fas fa-users" style="color:var(--primary);"></i> ${cause.donors || 0} donantes</div>
              <div class="meta-item"><i class="fas fa-heart" style="color:var(--primary);"></i> ${cause.beneficiaries || 0} beneficiarios</div>
              <div class="meta-item"><i class="fas fa-calendar-alt" style="color:var(--primary);"></i> ${createdDate}</div>
            </div>
            <div class="points-notice" style="background:#f0f9ff; border-left:4px solid var(--accent); padding:1rem; border-radius:0 8px 8px 0; font-size:0.95rem; display:flex; align-items:center; gap:0.7rem;">
              <i class="fas fa-star" style="color:var(--accent);"></i>
              Cada euro donado recibirá <strong>${cause.points || 20} puntos</strong> de impacto
            </div>
          </div>
        </div>
        <div class="modal-tabs">
          <button class="tab-btn ${activeTab === 'details' ? 'active' : ''}" data-tab="details">
            <i class="fas fa-info-circle"></i> Detalles
          </button>
          <button class="tab-btn ${activeTab === 'donations' ? 'active' : ''}" data-tab="donations">
            <i class="fas fa-donate"></i> Donaciones
          </button>
          <button class="tab-btn ${activeTab === 'participants' ? 'active' : ''}" data-tab="participants">
            <i class="fas fa-users"></i> Participantes
          </button>
        </div>
        <div class="tab-content ${activeTab === 'details' ? 'active' : ''}" id="detailsTab">
          <div class="modal-cause-content">
            <div class="content-section">
              <h3 class="content-title"><i class="fas fa-align-left"></i> Resumen</h3>
              <p class="content-text">${cause.short_description || 'No hay resumen disponible para esta causa.'}</p>
            </div>
            <div class="content-section">
              <h3 class="content-title"><i class="fas fa-info-circle"></i> Descripción completa</h3>
              <p class="content-text">${cause.description || 'No hay descripción detallada disponible para esta causa.'}</p>
            </div>
            ${(cause.contact_email || cause.phone_number) ? `
              <div class="content-section">
                <h3 class="content-title"><i class="fas fa-address-book"></i> Información de contacto</h3>
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
        </div>
        <div class="tab-content ${activeTab === 'donations' ? 'active' : ''}" id="donationsTab">
          <div class="content-section">
            <h3 class="content-title"><i class="fas fa-donate"></i> Cómo donar</h3>
            ${cause.stripe_accounts?.[0]?.charges_enabled ? `
              <div class="stripe-donation-section">
                <p>Puedes donar de forma segura con tarjeta de crédito/débito:</p>
                <div class="donation-amount-selector" style="margin:1.5rem 0;">
                  <div class="amount-buttons" style="display:flex; gap:0.8rem; margin-bottom:1rem; flex-wrap:wrap;">
                    <button class="amount-btn" data-amount="5">5€</button>
                    <button class="amount-btn" data-amount="10">10€</button>
                    <button class="amount-btn" data-amount="20">20€</button>
                    <button class="amount-btn" data-amount="50">50€</button>
                    <button class="amount-btn" data-amount="100">100€</button>
                  </div>
                  <div class="custom-amount" style="display:flex; gap:0.5rem; margin-bottom:1rem;">
                    <input type="number" id="customAmount" placeholder="Otra cantidad" min="1" max="10000" style="flex:1; padding:0.7rem; border:1px solid #e5e7eb; border-radius:6px;">
                    <span style="display:flex; align-items:center; color:#6b7280;">€</span>
                  </div>
                  <button id="donateCauseBtn" class="btn btn-primary" style="width:100%;" data-cause-id="${cause.id}">
                    <i class="fas fa-credit-card"></i> Donar con tarjeta
                  </button>
                </div>
              </div>
            ` : ''}
            ${cause.how_to_donate ? `
              <div class="other-donation-methods">
                <h4>Métodos de donación:</h4>
                <div class="donation-method">${cause.how_to_donate}</div>
              </div>
            ` : `
              <p>No hay métodos de donación especificados para esta causa.</p>
            `}
          </div>
        </div>
        <div class="tab-content ${activeTab === 'participants' ? 'active' : ''}" id="participantsTab">
          <div class="content-section">
            <h3 class="content-title"><i class="fas fa-users"></i> Donantes</h3>
            ${donorsHtml}
          </div>
        </div>
        <div class="cause-actions" style="display:flex; gap:0.8rem; margin-top:2rem;">
          ${cause.stripe_enabled ? `
            <button class="btn btn-primary" style="flex:1;" onclick="window.causesRenderer.openDonationModal('${cause.id}')">
              <i class="fas fa-donate"></i> Donar ahora
            </button>
          ` : ''}
          <button class="btn btn-accent" style="flex:1;" onclick="window.joinCause('${cause.id}')">
            <i class="fas fa-hands-helping"></i> Participar
          </button>
          <button class="btn btn-outline" style="flex:1;" onclick="window.causesRenderer.shareCause('${cause.id}')">
            <i class="fas fa-share-alt"></i> Compartir
          </button>
        </div>
        <div class="share-section" id="shareSection" style="text-align:left;"></div>
      </div>
    `;

    modal.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tabName = btn.dataset.tab;
        modal.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        modal.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        modal.querySelector(`#${tabName}Tab`).classList.add('active');
      });
    });

    this.attachDonationEvents(modal, cause);
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    if (window.location.pathname === '/causes' || window.location.pathname === '/causes/') {
      window.history.pushState({}, '', `/causes/${causeId}`);
    }
  }

  /**
   * Modal profesional de donación con Stripe
   */
  openDonationModal(causeId) {
    const cause = window.causes?.find(c => c.id == causeId);
    if (!cause) {
      this.showNotification('Causa no encontrada', 'error');
      return;
    }

    const existingModal = document.getElementById('stripeDonationModal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'stripeDonationModal';
    modal.className = 'modal-bg';
    modal.style.cssText = `
      display: flex;
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.5);
      z-index: 10000;
      align-items: center;
      justify-content: center;
    `;
    
    modal.innerHTML = `
      <div class="modal-content donation-modal">
        <button class="close-modal" id="closeDonationModal">&times;</button>
        
        <div class="donation-header">
          <div class="donation-cause-image">
            <img src="${cause.photo_url || '/img/causa-default.jpg'}" alt="${cause.title}">
          </div>
          <div class="donation-cause-info">
            <h2>${cause.title}</h2>
            <p>${cause.short_description || ''}</p>
            <div class="cause-progress-mini">
              <div class="progress-bar-mini">
                <div class="progress-fill-mini" style="width: ${cause.goal ? Math.min((cause.raised || 0) / cause.goal * 100, 100) : 0}%"></div>
              </div>
              <span class="progress-text-mini">${cause.raised || 0}€ recaudados de ${cause.goal || 0}€</span>
            </div>
          </div>
        </div>

        <div class="donation-form">
          <h3><i class="fas fa-heart"></i> Tu donación</h3>
          
          <div class="amount-buttons">
            <button class="amount-btn" data-amount="5">5€</button>
            <button class="amount-btn" data-amount="10">10€</button>
            <button class="amount-btn" data-amount="25">25€</button>
            <button class="amount-btn" data-amount="50">50€</button>
            <button class="amount-btn" data-amount="100">100€</button>
          </div>
          
          <div class="custom-amount-section">
            <label for="customAmount">Otra cantidad:</label>
            <div class="amount-input-wrapper">
              <input type="number" id="customAmount" min="1" max="10000" step="0.01" placeholder="0.00">
              <span class="currency">€</span>
            </div>
          </div>

          <div class="donor-info-section">
            <h4><i class="fas fa-user"></i> Información del donante (opcional)</h4>
            <div class="form-row">
              <input type="text" id="donorName" placeholder="Tu nombre" maxlength="100">
              <input type="email" id="donorEmail" placeholder="Tu email (para recibo)" maxlength="150">
            </div>
            <textarea id="donorMessage" placeholder="Mensaje de apoyo (opcional)" maxlength="500" rows="3"></textarea>
          </div>

          <div class="payment-info">
            <div class="stripe-badge">
              <i class="fab fa-stripe"></i>
              <span>Procesado de forma segura por Stripe</span>
            </div>
            <div class="fee-info">
              <i class="fas fa-info-circle"></i>
              <span>Comisión de procesamiento: 2.9% + €0.30</span>
            </div>
          </div>

          <button id="proceedToDonationBtn" class="btn btn-donation" disabled>
            <i class="fas fa-credit-card"></i>
            <span>Proceder al pago seguro</span>
          </button>
        </div>

        <div class="donation-footer">
          <div class="security-badges">
            <div class="security-item">
              <i class="fas fa-shield-alt"></i>
              <span>Pago seguro SSL</span>
            </div>
            <div class="security-item">
              <i class="fas fa-lock"></i>
              <span>Datos protegidos</span>
            </div>
            <div class="security-item">
              <i class="fas fa-receipt"></i>
              <span>Recibo automático</span>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
    this.setupDonationModalEvents(modal, cause);
  }

  /**
   * Procesar donación con Stripe
   * Usado por ambos modales
   */
  async processDonation(causeOrId, amount, modal = null) {
    try {
      // Permite recibir cause o causeId
      const causeId = typeof causeOrId === 'object' ? causeOrId.id : causeOrId;
      const cause = typeof causeOrId === 'object' ? causeOrId : window.causes?.find(c => c.id == causeId);

      // Recoge datos del modal si existe
      let donorName = '', donorEmail = '', donorMessage = '';
      if (modal) {
        donorName = modal.querySelector('#donorName')?.value || '';
        donorEmail = modal.querySelector('#donorEmail')?.value || '';
        donorMessage = modal.querySelector('#donorMessage')?.value || '';
      }

      console.log('[FRONTEND] Enviando donación:', { causeId, amount });

      const response = await fetch('/api/stripe/donation-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          causeId,
          amount,
          currency: 'eur',
          donorName: donorName || undefined,
          donorEmail: donorEmail || undefined,
          message: donorMessage || undefined
        })
      });

      console.log('[FRONTEND] Respuesta recibida:', response);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[FRONTEND] Error en respuesta:', errorData);
        throw new Error(errorData.error || 'Endpoint no encontrado');
      }

      const data = await response.json();
      console.log('[FRONTEND] Datos de Stripe:', data);

      if (!data.url) {
        throw new Error('No se recibió URL de pago de Stripe');
      }

      localStorage.setItem('pendingDonation', JSON.stringify({
        causeId,
        causeTitle: cause?.title || '',
        amount: amount,
        timestamp: Date.now()
      }));

      window.location.href = data.url;

    } catch (error) {
      console.error('[FRONTEND] Error procesando donación:', error);
      if (modal) {
        const proceedBtn = modal.querySelector('#proceedToDonationBtn');
        if (proceedBtn) {
          proceedBtn.disabled = false;
          proceedBtn.innerHTML = `
            <i class="fas fa-credit-card"></i>
            <span>Donar ${amount.toFixed(2)}€ de forma segura</span>
          `;
        }
      }
      let errorMessage = 'Error procesando la donación. Por favor, inténtalo de nuevo.';
      if (error.message.includes('NO_STRIPE_ACCOUNT')) {
        errorMessage = 'Esta causa no tiene configurado el sistema de pagos.';
      } else if (error.message.includes('STRIPE_NOT_ACTIVE')) {
        errorMessage = 'El sistema de pagos de esta causa está pendiente de activación.';
      } else if (error.message.includes('email')) {
        errorMessage = error.message;
      }
      this.showNotification(errorMessage, 'error');
    }
  }

  /**
   * Configurar eventos del modal de donación
   */
  setupDonationModalEvents(modal, cause) {
    let selectedAmount = 0;
    const closeBtn = modal.querySelector('#closeDonationModal');
    closeBtn.onclick = () => this.closeDonationModal();
    modal.onclick = (e) => {
      if (e.target === modal) this.closeDonationModal();
    };

    const amountButtons = modal.querySelectorAll('.amount-btn');
    amountButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        amountButtons.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedAmount = parseFloat(btn.dataset.amount);
        modal.querySelector('#customAmount').value = '';
        this.updateDonationButton(modal, selectedAmount);
      });
    });

    const customAmountInput = modal.querySelector('#customAmount');
    customAmountInput.addEventListener('input', (e) => {
      selectedAmount = parseFloat(e.target.value) || 0;
      amountButtons.forEach(b => b.classList.remove('selected'));
      this.updateDonationButton(modal, selectedAmount);
    });

    const proceedBtn = modal.querySelector('#proceedToDonationBtn');
    proceedBtn.addEventListener('click', async () => {
      const amount = selectedAmount;
      if (!amount || amount < 1 || amount > 10000) {
        this.showNotification('Por favor, introduce una cantidad válida entre €1 y €10,000', 'error');
        return;
      }
      await this.processDonation(cause, amount, modal);
    });
  }

  /**
   * Obtiene o crea el modal reutilizable
   */
  getOrCreateModal() {
    let modal = document.getElementById('causeModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'causeModal';
      modal.className = 'modal';
      modal.style.cssText = 'display:none; position:fixed; z-index:9999; left:0; top:0; width:100vw; height:100vh; background:rgba(0,0,0,0.35); align-items:center; justify-content:center;';
      
      modal.innerHTML = `
        <div class="modal-content" style="background:#fff; border-radius:18px; max-width:900px; width:95vw; padding:2rem; box-shadow:0 8px 32px rgba(74,111,165,0.13); position:relative; max-height:90vh; overflow-y:auto;">
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
    const closeBtn = modal.querySelector('#closeModal');
    if (closeBtn) {
      closeBtn.onclick = () => this.closeModal();
    }

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
      
      if (window.location.pathname.includes('/causes/') && window.location.pathname !== '/causes') {
        window.history.pushState({}, '', '/causes');
      }
    }
  }

  /**
   * Cerrar modal de donación
   */
  closeDonationModal() {
    const modal = document.getElementById('stripeDonationModal');
    if (modal) {
      modal.remove();
      document.body.style.overflow = '';
    }
  }

  /**
   * Actualizar estado del botón de donación
   */
  updateDonationButton(modal, amount) {
    const btn = modal.querySelector('#proceedToDonationBtn');
    const isValid = amount >= 1 && amount <= 10000;
    
    btn.disabled = !isValid;
    
    if (isValid) {
      btn.innerHTML = `
        <i class="fas fa-credit-card"></i>
        <span>Donar ${amount.toFixed(2)}€ de forma segura</span>
      `;
      btn.classList.remove('disabled');
    } else {
      btn.innerHTML = `
        <i class="fas fa-credit-card"></i>
        <span>Introduce una cantidad válida</span>
      `;
      btn.classList.add('disabled');
    }
  }

  /**
   * Adjunta event listeners a las tarjetas
   */
  attachEventListeners(container) {
    container.querySelectorAll('.view-more-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const causeId = btn.getAttribute('data-cause-id');
        this.showModal(causeId);
      });
    });

    container.querySelectorAll('.donate-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const causeId = btn.getAttribute('data-cause-id');
        this.openDonationModal(causeId);
      });
    });

    container.querySelectorAll('.admin-activity-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const activityId = btn.getAttribute('data-activity-id');
        if (typeof window.openAdminModal === 'function') {
          const cause = this.causes?.find(c => c.id == activityId);
          if (cause) window.openAdminModal(cause);
        } else {
          this.showModal(activityId);
        }
      });
    });
  }

  /**
   * Compartir causa
   */
  shareCause(causeId) {
    const cause = window.causes?.find(c => c.id == causeId);
    if (!cause) {
      console.error('❌ No se encontró la causa con ID:', causeId);
      return;
    }
    
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
      const link = `${window.location.origin}/causes/${cause.id}`;
      navigator.clipboard.writeText(link).then(() => {
        this.showNotification('¡Enlace copiado al portapapeles!', 'success');
      }).catch(() => {
        prompt('Copia este enlace:', link);
      });
    }
  }

  /**
   * Validar email
   */
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Muestra notificaciones
   */
  showNotification(message, type = 'info', duration = 3000) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 1rem 1.5rem;
      border-radius: 8px;
      color: white;
      font-weight: 600;
      z-index: 10001;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      ${type === 'success' ? 'background: #10b981;' : ''}
      ${type === 'error' ? 'background: #ef4444;' : ''}
      ${type === 'info' ? 'background: #3b82f6;' : ''}
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, duration);
  }

  /**
   * Inyecta estilos CSS necesarios
   */
  injectGridStyles() {
    if (document.getElementById('causes-renderer-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'causes-renderer-styles';
    style.textContent = `
      :root {
        --primary: #4a6fa5;
        --primary-dark: #3a5a7a;
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

      .modal-tabs {
        display: flex;
        gap: 0.5rem;
        margin-bottom: 1.5rem;
        border-bottom: 1px solid #e5e7eb;
        padding-bottom: 0.5rem;
      }

      .tab-btn {
        padding: 0.7rem 1.2rem;
        border-radius: 6px;
        background: none;
        border: none;
        cursor: pointer;
        font-weight: 600;
        color: #6b7280;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        transition: all 0.2s;
      }

      .tab-btn:hover {
        background: #f8fafc;
        color: var(--primary);
      }

      .tab-btn.active {
        background: var(--primary);
        color: white;
      }

      .tab-content {
        display: none;
      }

      .tab-content.active {
        display: block;
      }

      .stripe-donation-section {
        background: #f8fafc;
        border-radius: 12px;
        padding: 1.5rem;
        margin-bottom: 1.5rem;
        border: 1px solid #e5e7eb;
      }

      .other-donation-methods {
        background: #f0f9ff;
        border-radius: 12px;
        padding: 1.5rem;
        margin-top: 1.5rem;
        border-left: 4px solid var(--accent);
      }

      .donation-method {
        white-space: pre-line;
        line-height: 1.6;
      }

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

      .amount-btn {
        padding: 0.8rem 1.2rem;
        border: 2px solid #e5e7eb;
        background: white;
        border-radius: 8px;
        cursor: pointer;
        font-weight: 600;
        transition: all 0.2s;
        flex: 1;
        min-width: 60px;
      }
      
      .amount-btn:hover {
        border-color: var(--primary);
        background: #f8fafc;
      }
      
      .amount-btn.selected {
        border-color: var(--primary);
        background: var(--primary);
        color: white;
      }
      
      .notification {
        animation: slideInRight 0.3s ease-out;
      }
      
      @keyframes slideInRight {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }

      .modal-bg {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
      }

      .close-modal {
        position: absolute;
        top: 1rem;
        right: 1rem;
        background: none;
        border: none;
        font-size: 1.5rem;
        color: #6b7280;
        cursor: pointer;
        z-index: 1;
      }

      .close-modal:hover {
        color: #374151;
      }

      /* Estilos específicos para el modal de donación */
      .donation-modal {
        max-width: 500px;
        width: 95%;
        background: white;
        border-radius: 12px;
        padding: 1.5rem;
        position: relative;
      }   

      .cause-progress-mini {
        margin-top: 0.5rem;
      }

      .progress-bar-mini {
        height: 6px;
        background: #e5e7eb;
        border-radius: 3px;
        overflow: hidden;
        margin-bottom: 0.3rem;
      }

      .progress-fill-mini {
        height: 100%;
        background: var(--primary);
      }

      .progress-text-mini {
        font-size: 0.8rem;
        color: #6b7280;
      }

      .donation-form {
        margin-top: 1.5rem;
      }

      .donation-form h3 {
        font-size: 1.1rem;
        color: var(--primary);
        margin-bottom: 1rem;
        text-align: left;
      }

      .amount-buttons {
        display: flex;
        gap: 0.5rem;
        margin-bottom: 1rem;
        flex-wrap: wrap;
      }

      .custom-amount-section {
        margin-bottom: 1.5rem;
      }

      .custom-amount-section label {
        display: block;
        margin-bottom: 0.5rem;
        font-size: 0.9rem;
        color: #6b7280;
        text-align: left;
      }

      .amount-input-wrapper {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .amount-input-wrapper input {
        flex: 1;
        padding: 0.8rem;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        font-size: 1rem;
      }

      .currency {
        font-weight: 600;
      }

      .donor-info-section {
        margin-bottom: 1.5rem;
      }

      .donor-info-section h4 {
        font-size: 1rem;
        color: var(--primary);
        margin-bottom: 0.8rem;
        text-align: left;
      }

      .form-row {
        display: flex;
        gap: 0.5rem;
        margin-bottom: 0.8rem;
      }

      .form-row input {
        flex: 1;
        padding: 0.8rem;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        font-size: 0.9rem;
      }

      textarea {
        width: 100%;
        padding: 0.8rem;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        font-size: 0.9rem;
        resize: vertical;
      }

      .payment-info {
        margin-bottom: 1.5rem;
        font-size: 0.8rem;
        color: #6b7280;
      }

      .stripe-badge {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 0.5rem;
      }

      .stripe-badge i {
        color: #635bff;
        font-size: 1.2rem;
      }

      .fee-info {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .btn-donation {
        width: 100%;
        padding: 1rem;
        background: var(--primary);
        color: white;
        border: none;
        border-radius: 8px;
        font-weight: 600;
        font-size: 1rem;
        cursor: pointer;
        transition: all 0.2s;
      }

      .btn-donation:hover {
        background: var(--primary-dark);
      }

      .btn-donation.disabled {
        background: #e5e7eb;
        cursor: not-allowed;
      }

      .donation-footer {
        margin-top: 1.5rem;
        padding-top: 1rem;
        border-top: 1px solid #e5e7eb;
      }

      .security-badges {
        display: flex;
        justify-content: center;
        gap: 1rem;
        flex-wrap: wrap;
      }

      .security-item {
        display: flex;
        align-items: center;
        gap: 0.3rem;
        font-size: 0.8rem;
        color: #6b7280;
      }

      .security-item i {
        color: var(--primary);
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
window.openDonationModal = function(causeId) {
  if (window.causesRenderer && typeof window.causesRenderer.openDonationModal === 'function') {
    window.causesRenderer.openDonationModal(causeId);
  }
};

window.joinCause = function(causeId) {
  const cause = window.causes?.find(c => c.id == causeId);
  if (cause) {
    if (window.causesRenderer) {
      window.causesRenderer.showNotification(`¡Gracias por tu interés en "${cause.title}"!`, 'success');
    } else {
      alert(`¡Gracias por tu interés en "${cause.title}"! Contáctanos para saber cómo puedes colaborar.`);
    }
  }
};

window.mostrarCompartir = function(causeId) {
  if (window.causesRenderer && typeof window.causesRenderer.shareCause === 'function') {
    window.causesRenderer.shareCause(causeId);
  }
};

// Esperar a que Supabase esté listo antes de inicializar
document.addEventListener('DOMContentLoaded', () => {
  if (window.supabaseReady) {
    console.log('✅ Inicializando causes renderer con Supabase listo');
  } else {
    document.addEventListener('supabaseReady', () => {
      console.log('✅ Supabase ready, causes renderer disponible');
    }, { once: true });
  }
});

// Manejar redirección después de donación
const urlParams = new URLSearchParams(window.location.search);
const donationStatus = urlParams.get('donation');
const sessionId = urlParams.get('session_id');

if (donationStatus === 'success' && sessionId) {
  showDonationSuccess(sessionId);
  window.history.replaceState({}, document.title, window.location.pathname);
}

async function showDonationSuccess(sessionId) {
  try {
    const response = await fetch(`/api/donations/session/${sessionId}`);
    if (!response.ok) throw new Error('No se pudo verificar la donación');
    const donation = await response.json();
    const modal = document.createElement('div');
    modal.className = 'modal-bg';
    modal.innerHTML = `
      <div class="modal-content">
        <h3><i class="fas fa-check-circle"></i> ¡Donación exitosa!</h3>
        <p>Gracias por tu donación de ${donation.amount}€ a "${donation.cause_title}".</p>
        <p>Recibirás un correo de confirmación con los detalles.</p>
        <button class="btn btn-primary" onclick="this.closest('.modal-bg').style.display='none'">
          Aceptar
        </button>
      </div>
    `;
    document.body.appendChild(modal);
  } catch (error) {
    console.error('Error mostrando confirmación:', error);
    alert('Gracias por tu donación. Recibirás un correo de confirmación.');
  }
}