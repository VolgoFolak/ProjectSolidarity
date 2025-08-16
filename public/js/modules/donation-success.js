class DonationSuccess {
  constructor() {
    this.init();
  }

  init() {
    // Verificar si estamos en página de éxito de donación
    const urlParams = new URLSearchParams(window.location.search);
    const donationStatus = urlParams.get('donation');
    const sessionId = urlParams.get('session_id');
    const causeId = urlParams.get('cause_id');

    if (donationStatus === 'success' && sessionId) {
      this.handleSuccessfulDonation(sessionId);
    } else if (donationStatus === 'cancelled' && causeId) {
      this.handleCancelledDonation(causeId);
    }
  }

  async handleSuccessfulDonation(sessionId) {
    try {
      // Obtener detalles de la donación
      const response = await fetch(`/api/donations/session/${sessionId}`, {
        credentials: 'include'
      });

      if (response.ok) {
        const donation = await response.json();
        this.showSuccessModal(donation);
        
        // Limpiar datos temporales
        sessionStorage.removeItem('pendingDonation');
        
        // Actualizar URL para quitar parámetros
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, '', cleanUrl);
      } else {
        // Fallback si no se puede obtener detalles
        this.showGenericSuccessModal();
      }
    } catch (error) {
      console.error('Error obteniendo detalles de donación:', error);
      this.showGenericSuccessModal();
    }
  }

  handleCancelledDonation(causeId) {
    this.showCancelledModal(causeId);
    
    // Limpiar URL
    const cleanUrl = window.location.pathname;
    window.history.replaceState({}, '', cleanUrl);
  }

  showSuccessModal(donation) {
    const modal = document.createElement('div');
    modal.className = 'modal-bg active';
    modal.innerHTML = `
      <div class="success-modal">
        <div class="success-header">
          <div class="success-icon">
            <i class="fas fa-check-circle"></i>
          </div>
          <h2>¡Donación exitosa!</h2>
          <p>Tu donación de <strong>€${donation.amount}</strong> ha sido procesada correctamente</p>
        </div>
        
        <div class="donation-details">
          <div class="detail-item">
            <span class="label">Causa:</span>
            <span class="value">${donation.cause_title}</span>
          </div>
          <div class="detail-item">
            <span class="label">Cantidad:</span>
            <span class="value">€${donation.amount}</span>
          </div>
          <div class="detail-item">
            <span class="label">Donante:</span>
            <span class="value">${donation.donor_name}</span>
          </div>
          <div class="detail-item">
            <span class="label">Fecha:</span>
            <span class="value">${new Date(donation.created_at).toLocaleDateString('es-ES')}</span>
          </div>
          ${donation.message ? `
            <div class="detail-item">
              <span class="label">Mensaje:</span>
              <span class="value">"${donation.message}"</span>
            </div>
          ` : ''}
        </div>

        <div class="success-actions">
          <button class="btn btn-primary" onclick="this.closest('.modal-bg').remove(); document.body.style.overflow='';">
            <i class="fas fa-home"></i> Continuar
          </button>
          <button class="btn btn-outline" onclick="window.causesRenderer?.shareCause?.('${donation.cause_id}')">
            <i class="fas fa-share-alt"></i> Compartir causa
          </button>
        </div>

        <div class="success-footer">
          <p><i class="fas fa-heart"></i> ¡Gracias por tu generosidad!</p>
          <small>Recibirás un email de confirmación en breve</small>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';

    // Auto-cerrar después de 10 segundos
    setTimeout(() => {
      if (modal.parentNode) {
        modal.remove();
        document.body.style.overflow = '';
      }
    }, 10000);
  }

  showGenericSuccessModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-bg active';
    modal.innerHTML = `
      <div class="success-modal">
        <div class="success-header">
          <div class="success-icon">
            <i class="fas fa-check-circle"></i>
          </div>
          <h2>¡Donación procesada!</h2>
          <p>Tu donación ha sido procesada correctamente. ¡Gracias por tu apoyo!</p>
        </div>
        
        <div class="success-actions">
          <button class="btn btn-primary" onclick="this.closest('.modal-bg').remove(); document.body.style.overflow='';">
            <i class="fas fa-home"></i> Continuar
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
  }

  showCancelledModal(causeId) {
    const modal = document.createElement('div');
    modal.className = 'modal-bg active';
    modal.innerHTML = `
      <div class="cancelled-modal">
        <div class="cancelled-header">
          <div class="cancelled-icon">
            <i class="fas fa-times-circle"></i>
          </div>
          <h2>Donación cancelada</h2>
          <p>No se ha procesado ningún pago. Puedes intentar donar nuevamente cuando lo desees.</p>
        </div>
        
        <div class="cancelled-actions">
          <button class="btn btn-primary" onclick="window.openDonationModal('${causeId}'); this.closest('.modal-bg').remove();">
            <i class="fas fa-heart"></i> Intentar de nuevo
          </button>
          <button class="btn btn-outline" onclick="this.closest('.modal-bg').remove(); document.body.style.overflow='';">
            <i class="fas fa-arrow-left"></i> Volver
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
  }
}

// Inicializar automáticamente
document.addEventListener('DOMContentLoaded', () => {
  new DonationSuccess();
});