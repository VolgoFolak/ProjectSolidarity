// Usar Supabase global
const supabase = window.supabase;

class CausesRenderer {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.causes = [];
    this.loading = false;
    this.currentPage = 1;
    this.hasMore = true;
    this.filters = {
      category: 'all',
      search: '',
      sortBy: 'created_at'
    };
    
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.loadCauses();
    this.createDonationModal();
    this.createSuccessModal();
  }

  async loadCauses(loadMore = false) {
    if (this.loading) return;
    
    this.loading = true;
    this.showLoading();

    try {
      let query = supabase
        .from('causes')
        .select(`
          *,
          profiles!causes_user_id_fkey(username, photo_url),
          donations(count)
        `)
        .eq('status', 'active')
        .order(this.filters.sortBy, { ascending: false })
        .range((this.currentPage - 1) * 12, this.currentPage * 12 - 1);

      if (this.filters.category !== 'all') {
        query = query.eq('category', this.filters.category);
      }

      if (this.filters.search) {
        query = query.or(`title.ilike.%${this.filters.search}%,description.ilike.%${this.filters.search}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

      if (loadMore) {
        this.causes = [...this.causes, ...data];
      } else {
        this.causes = data;
      }

      this.hasMore = data.length === 12;
      this.renderCauses();
      
    } catch (error) {
      console.error('Error loading causes:', error);
      this.showError('Error al cargar las causas');
    } finally {
      this.loading = false;
      this.hideLoading();
    }
  }

  renderCauses() {
    if (!this.container) return;

    const causesHTML = this.causes.map(cause => this.renderCauseCard(cause)).join('');
    
    this.container.innerHTML = `
      <div class="causes-grid">
        ${causesHTML}
      </div>
      ${this.hasMore ? '<button id="load-more-btn" class="btn-secondary">Cargar más causas</button>' : ''}
    `;

    this.attachCardEventListeners();
  }

  renderCauseCard(cause) {
    const progress = cause.goal > 0 ? (cause.current_amount / cause.goal) * 100 : 0;
    const hasStripeAccount = cause.stripe_account_id ? true : false;
    
    return `
      <div class="cause-card" data-cause-id="${cause.id}">
        <div class="cause-image">
          <img src="${cause.photo_url || '/images/default-cause.jpg'}" alt="${cause.title}" loading="lazy">
          <div class="cause-category">${this.getCategoryName(cause.category)}</div>
        </div>
        
        <div class="cause-content">
          <h3 class="cause-title">${cause.title}</h3>
          <p class="cause-description">${this.truncateText(cause.short_description || cause.description, 120)}</p>
          
          <div class="cause-creator">
            <img src="${cause.profiles?.photo_url || '/images/default-avatar.png'}" alt="${cause.profiles?.username}" class="creator-avatar">
            <span class="creator-name">Por ${cause.profiles?.username || 'Usuario'}</span>
          </div>

          ${hasStripeAccount ? `
            <div class="cause-progress">
              <div class="progress-bar">
                <div class="progress-fill" style="width: ${Math.min(progress, 100)}%"></div>
              </div>
              <div class="progress-text">
                <span class="current-amount">€${cause.current_amount?.toLocaleString() || '0'}</span>
                <span class="goal-amount">Meta: €${cause.goal?.toLocaleString() || '0'}</span>
              </div>
            </div>
          ` : ''}
          
          <div class="cause-actions">
            <button class="btn-view-more" data-cause-id="${cause.id}">
              <i class="fas fa-eye"></i> Ver más
            </button>
            ${hasStripeAccount ? `
              <button class="btn-donate" data-cause-id="${cause.id}" data-stripe-account="${cause.stripe_account_id}">
                <i class="fas fa-heart"></i> Donar
              </button>
            ` : `
              <button class="btn-support" data-cause-id="${cause.id}">
                <i class="fas fa-hands-helping"></i> Apoyar
              </button>
            `}
          </div>
        </div>
      </div>
    `;
  }

  attachCardEventListeners() {
    // Botones "Ver más"
    document.querySelectorAll('.btn-view-more').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const causeId = e.target.dataset.causeId;
        this.openCauseModal(causeId);
      });
    });

    // Botones "Donar"
    document.querySelectorAll('.btn-donate').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const causeId = e.target.dataset.causeId;
        const stripeAccount = e.target.dataset.stripeAccount;
        this.openDonationModal(causeId, stripeAccount);
      });
    });

    // Botones "Apoyar"
    document.querySelectorAll('.btn-support').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const causeId = e.target.dataset.causeId;
        this.openSupportModal(causeId);
      });
    });

    // Cargar más
    document.getElementById('load-more-btn')?.addEventListener('click', () => {
      this.currentPage++;
      this.loadCauses(true);
    });
  }

  async openCauseModal(causeId) {
    try {
      const { data: cause, error } = await supabase
        .from('causes')
        .select(`
          *,
          profiles!causes_user_id_fkey(username, photo_url, first_name, last_name),
          donations(count)
        `)
        .eq('id', causeId)
        .single();

      if (error) throw error;

      // Usar el modal existente del HTML
      if (window.causesRenderer && typeof window.causesRenderer.showModal === 'function') {
        window.causesRenderer.showModal(causeId);
      } else {
        // Fallback al modal existente
        const modal = document.getElementById('causeModal');
        if (modal) {
          const modalBody = modal.querySelector('#modalBody');
          modalBody.innerHTML = this.generateCauseModalContent(cause);
          modal.style.display = 'flex';
          document.body.style.overflow = 'hidden';
        }
      }

    } catch (error) {
      console.error('Error loading cause details:', error);
      this.showError('Error al cargar los detalles de la causa');
    }
  }

  generateCauseModalContent(cause) {
    const progress = cause.goal ? Math.min(Math.round((cause.current_amount / cause.goal) * 100), 100) : 0;
    const createdDate = new Date(cause.created_at).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    return `
      <div class="modal-cause-container">
        <h1 class="modal-cause-title" style="font-size:2rem; font-weight:800; color:var(--primary); margin-bottom:2.7rem; text-align:center; width:100%;">${cause.title}</h1>
        <div class="modal-cause-header" style="display:flex; gap:2.5rem; margin-bottom:2.7rem;">
          <div class="modal-cause-image-wrapper" style="flex:1; min-width:320px; height:300px; border-radius:12px; overflow:hidden; position:relative; box-shadow:0 4px 12px rgba(0,0,0,0.08);">
            <img class="modal-cause-image" src="${cause.photo_url || '/img/causa-default.jpg'}" 
                 alt="Imagen de la causa ${cause.title}"
                 style="width:100%;height:100%;object-fit:cover;"
                 onerror="this.src='/img/causa-default.jpg'">
          </div>
          <div class="modal-cause-info" style="flex:1.5; display:flex; flex-direction:column; justify-content:flex-start;">
            ${cause.stripe_account_id ? `
              <div class="modal-cause-progress-container" style="background:#f8fafc; padding:1.2rem; border-radius:12px; margin-bottom:1.2rem; border:1px solid #e5e7eb;">
                <div class="progress-bar">
                  <div class="progress-fill" style="width: ${progress}%"></div>
                </div>
                <div class="progress-info">
                  <span>${progress}% completado</span>
                  <span>${cause.current_amount || 0} € de ${cause.goal || 0} €</span>
                </div>
              </div>
            ` : ''}
            <div class="modal-cause-meta-grid" style="display:grid; grid-template-columns:1fr 1fr; gap:0.7rem 1.2rem; margin-bottom:1.2rem;">
              <div class="meta-item">
                <span class="meta-icon"><i class="fas fa-map-marker-alt"></i></span>
                <span>${cause.city || 'Sin ubicación'}${cause.country ? ', ' + cause.country : ''}</span>
              </div>
              <div class="meta-item">
                <span class="meta-icon"><i class="fas fa-users"></i></span>
                <span>${cause.beneficiaries || 0} beneficiarios</span>
              </div>
              <div class="meta-item">
                <span class="meta-icon"><i class="fas fa-calendar-alt"></i></span>
                <span>${createdDate}</span>
              </div>
              <div class="meta-item">
                <span class="meta-icon"><i class="fas fa-heart"></i></span>
                <span>${cause.donations?.[0]?.count || 0} donaciones</span>
              </div>
            </div>
          </div>
        </div>
        
        <div class="modal-cause-content" style="margin-top:0;">
          <div class="content-section" style="margin-bottom:2.2rem;">
            <h3 class="content-title" style="font-size:1.2rem; font-weight:600; color:var(--primary); margin-bottom:0.9rem; display:flex; align-items:center; gap:0.7rem;">
              <i class="fas fa-align-left"></i> Descripción
            </h3>
            <p class="content-text" style="line-height:1.7; color:#4b5563; font-size:1rem; text-align:justify;">${cause.description || 'No hay descripción disponible para esta causa.'}</p>
          </div>
          
          ${cause.contact_email || cause.phone_number ? `
            <div class="content-section" style="margin-bottom:2.2rem;">
              <h3 class="content-title" style="font-size:1.2rem; font-weight:600; color:var(--primary); margin-bottom:0.9rem; display:flex; align-items:center; gap:0.7rem;">
                <i class="fas fa-address-book"></i> Información de contacto
              </h3>
              <div style="background:#f8fafc; border-radius:12px; padding:1.5rem; border:1px solid #e5e7eb;">
                ${cause.contact_email ? `
                  <div style="display:flex; align-items:center; gap:0.7rem; margin-bottom:${cause.phone_number ? '1rem' : '0'};">
                    <i class="fas fa-envelope" style="color:var(--primary);"></i>
                    <a href="mailto:${cause.contact_email}" style="color:var(--primary); font-weight:600;">${cause.contact_email}</a>
                  </div>
                ` : ''}
                ${cause.phone_number ? `
                  <div style="display:flex; align-items:center; gap:0.7rem;">
                    <i class="fas fa-phone" style="color:var(--primary);"></i>
                    <a href="tel:${cause.phone_number}" style="color:var(--primary); font-weight:600;">${cause.phone_number}</a>
                  </div>
                ` : ''}
              </div>
            </div>
          ` : ''}
        </div>
        
        <div class="cause-actions" style="display:flex; gap:0.8rem; margin-top:2.2rem;">
          ${cause.stripe_account_id ? `
            <button class="btn btn-primary" style="flex:1;" onclick="window.causesRenderer.openDonationModal('${cause.id}', '${cause.stripe_account_id}')">
              <i class="fas fa-heart"></i> Donar ahora
            </button>
          ` : `
            <button class="btn btn-accent" style="flex:1;" onclick="window.causesRenderer.openSupportModal('${cause.id}')">
              <i class="fas fa-hands-helping"></i> Mostrar apoyo
            </button>
          `}
          <button class="btn btn-outline" style="flex:1;" onclick="window.mostrarCompartir?.('${cause.id}')">
            <i class="fas fa-share-alt"></i> Compartir
          </button>
        </div>
      </div>
    `;
  }

  createDonationModal() {
    const modal = document.createElement('div');
    modal.id = 'donation-modal';
    modal.className = 'donation-modal';
    modal.style.display = 'none';
    modal.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-content donation-content">
          <button class="modal-close">&times;</button>
          
          <div class="donation-header">
            <div class="donation-icon">
              <i class="fas fa-heart"></i>
            </div>
            <h2>Hacer una donación</h2>
            <p class="cause-title-donation"></p>
          </div>
          
          <div class="donation-body">
            <div class="amount-selection">
              <label>Selecciona el monto:</label>
              <div class="amount-buttons">
                <button class="amount-btn" data-amount="5">€5</button>
                <button class="amount-btn" data-amount="10">€10</button>
                <button class="amount-btn" data-amount="25">€25</button>
                <button class="amount-btn" data-amount="50">€50</button>
                <button class="amount-btn" data-amount="100">€100</button>
              </div>
              <div class="custom-amount">
                <input type="number" id="custom-amount" placeholder="Monto personalizado" min="1">
              </div>
            </div>
            
            <div id="stripe-elements">
              <!-- Stripe Elements se insertarán aquí -->
            </div>
            
            <button id="submit-donation" class="btn-primary donate-submit" disabled>
              <i class="fas fa-heart"></i>
              <span>Procesar donación</span>
            </button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
  }

  async openDonationModal(causeId, stripeAccountId) {
    const modal = document.getElementById('donation-modal');
    const cause = this.causes.find(c => c.id === causeId);
    
    if (!cause || !window.supabase) {
      this.showError('Error al cargar el sistema de donaciones');
      return;
    }

    // Verificar si el usuario está autenticado
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      this.showError('Debes iniciar sesión para hacer una donación');
      return;
    }

    // Actualizar información de la causa
    modal.querySelector('.cause-title-donation').textContent = cause.title;
    
    let selectedAmount = 0;

    // Event listeners para montos
    modal.querySelectorAll('.amount-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        modal.querySelectorAll('.amount-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedAmount = parseInt(btn.dataset.amount);
        modal.querySelector('#custom-amount').value = '';
        modal.querySelector('#submit-donation').disabled = false;
        this.setupStripeElements(modal, selectedAmount, stripeAccountId, causeId);
      });
    });

    modal.querySelector('#custom-amount').addEventListener('input', (e) => {
      const amount = parseFloat(e.target.value);
      if (amount >= 1) {
        modal.querySelectorAll('.amount-btn').forEach(b => b.classList.remove('selected'));
        selectedAmount = amount;
        modal.querySelector('#submit-donation').disabled = false;
        this.setupStripeElements(modal, selectedAmount, stripeAccountId, causeId);
      }
    });

    // Cerrar modal
    modal.querySelector('.modal-close').addEventListener('click', () => {
      modal.style.display = 'none';
    });

    modal.querySelector('.modal-overlay').addEventListener('click', (e) => {
      if (e.target === modal.querySelector('.modal-overlay')) {
        modal.style.display = 'none';
      }
    });

    modal.style.display = 'flex';
  }

  async setupStripeElements(modal, amount, stripeAccountId, causeId) {
    try {
      // Crear PaymentIntent
      const response = await fetch('/api/donations/create-payment-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          amount: Math.round(amount * 100), // Convertir a centavos
          stripeAccountId: stripeAccountId
        })
      });

      if (!response.ok) {
        throw new Error('Error creando el pago');
      }

      const { client_secret } = await response.json();

      // Configurar Stripe Elements
      const elements = window.stripe.elements({
        clientSecret: client_secret,
        appearance: {
          theme: 'stripe',
          variables: {
            colorPrimary: '#2dd4bf',
            colorBackground: '#ffffff',
            colorText: '#424770',
            colorDanger: '#df1b41',
            borderRadius: '8px',
          }
        }
      });

      const paymentElement = elements.create('payment');
      const stripeContainer = modal.querySelector('#stripe-elements');
      stripeContainer.innerHTML = '';
      paymentElement.mount(stripeContainer);

      // Manejar envío
      modal.querySelector('#submit-donation').onclick = async () => {
        const submitBtn = modal.querySelector('#submit-donation');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';

        const { error, paymentIntent } = await window.stripe.confirmPayment({
          elements,
          redirect: 'if_required'
        });

        if (error) {
          this.showError(error.message);
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<i class="fas fa-heart"></i> Procesar donación';
        } else if (paymentIntent.status === 'succeeded') {
          modal.style.display = 'none';
          
          // Confirmar donación en el backend
          await this.confirmDonation(causeId, amount, paymentIntent.id);
          
          this.showSuccessModal(amount, causeId);
          
          // Recargar las causas para actualizar los montos
          this.loadCauses();
        }
      };

    } catch (error) {
      console.error('Error setting up Stripe:', error);
      this.showError('Error al configurar el sistema de pagos');
    }
  }

  async confirmDonation(causeId, amount, paymentIntentId) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch('/api/donations/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          causeId,
          amount: amount * 100, // Convertir a centavos
          paymentIntentId,
          donorId: session.user.id
        })
      });

      if (!response.ok) {
        throw new Error('Error confirmando la donación');
      }

      const result = await response.json();
      console.log('Donación confirmada:', result);
      
    } catch (error) {
      console.error('Error confirming donation:', error);
    }
  }

  createSuccessModal() {
    const modal = document.createElement('div');
    modal.id = 'success-modal';
    modal.className = 'success-modal';
    modal.style.display = 'none';
    modal.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-content success-content">
          <div class="success-animation">
            <div class="success-icon">
              <i class="fas fa-heart"></i>
            </div>
            <div class="success-particles">
              <span></span><span></span><span></span><span></span><span></span>
            </div>
          </div>
          
          <div class="success-message">
            <h2>¡Donación realizada!</h2>
            <p class="donation-details">
              Has donado <strong class="donated-amount"></strong> a 
              <strong class="cause-name"></strong>
            </p>
            <p class="thank-you-message">
              Tu generosidad hace la diferencia. Gracias por ser parte del cambio positivo en el mundo.
            </p>
          </div>
          
          <div class="success-actions">
            <button class="btn-primary continue-btn">
              <i class="fas fa-arrow-right"></i>
              Continuar explorando
            </button>
            <button class="btn-secondary share-btn">
              <i class="fas fa-share"></i>
              Compartir mi donación
            </button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
  }

  showSuccessModal(amount, causeId) {
    const modal = document.getElementById('success-modal');
    const cause = this.causes.find(c => c.id === causeId);
    
    modal.querySelector('.donated-amount').textContent = `€${amount}`;
    modal.querySelector('.cause-name').textContent = cause.title;
    
    modal.querySelector('.continue-btn').onclick = () => {
      modal.style.display = 'none';
    };
    
    modal.querySelector('.share-btn').onclick = () => {
      this.shareSuccess(amount, cause.title);
    };
    
    modal.style.display = 'flex';
  }

  openSupportModal(causeId) {
    const cause = this.causes.find(c => c.id === causeId);
    alert(`Gracias por tu interés en apoyar "${cause.title}". ¡Contacta directamente con el creador para más formas de colaborar!`);
  }

  shareSuccess(amount, causeName) {
    const text = `¡Acabo de donar €${amount} a "${causeName}" en Solidarity! 💚 #SolidarityPlatform #Donacion`;
    
    if (navigator.share) {
      navigator.share({
        title: 'Mi donación en Solidarity',
        text: text,
        url: window.location.href
      });
    } else {
      navigator.clipboard.writeText(text).then(() => {
        this.showSuccess('Mensaje copiado al portapapeles');
      });
    }
  }

  getCategoryName(category) {
    const categories = {
      education: 'Educación',
      health: 'Salud',
      environment: 'Medio Ambiente',
      poverty: 'Pobreza',
      animals: 'Animales',
      disaster: 'Desastres',
      other: 'Otros'
    };
    return categories[category] || 'Otros';
  }

  truncateText(text, length) {
    if (!text) return '';
    return text.length > length ? text.substring(0, length) + '...' : text;
  }

  showLoading() {
    if (this.container) {
      this.container.innerHTML = '<div class="loading-causes">Cargando causas...</div>';
    }
  }

  hideLoading() {
    // El loading se oculta al renderizar las causas
  }

  showError(message) {
    if (window.showErrorNotification) {
      window.showErrorNotification(message);
    } else {
      alert(message);
    }
  }

  showSuccess(message) {
    const notifications = document.getElementById('notifications');
    if (notifications) {
      const notification = document.createElement('div');
      notification.className = 'notification success';
      notification.innerHTML = `<i class="fas fa-check-circle"></i><span>${message}</span>`;
      notifications.appendChild(notification);
      setTimeout(() => notification.remove(), 5000);
    }
  }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('causes-container')) {
    window.causesRenderer = new CausesRenderer('causes-container');
  }
});

// Funciones globales para compatibilidad
window.donateToCause = function(causeId) {
  if (window.causesRenderer) {
    const cause = window.causesRenderer.causes.find(c => c.id === causeId);
    if (cause && cause.stripe_account_id) {
      window.causesRenderer.openDonationModal(causeId, cause.stripe_account_id);
    }
  }
};

window.joinCause = function(causeId) {
  if (window.causesRenderer) {
    window.causesRenderer.openSupportModal(causeId);
  }
};