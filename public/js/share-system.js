/**
 * Sistema de compartidos con puntos
 */
class ShareSystem {
  constructor() {
    this.supabase = window.supabase;
  }

  /**
   * Registrar compartido y otorgar puntos
   */
  async registerShare(activityId, activityType, platform = 'unknown') {
    try {
      // Obtener token de usuario
      const { data: { session } } = await this.supabase.auth.getSession();
      if (!session) {
        throw new Error('Usuario no autenticado');
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

      // Mostrar notificación de puntos
      if (result.points > 0) {
        this.showPointsNotification(result.points, result.message);
      }

      return result;

    } catch (error) {
      console.error('Error registrando compartido:', error);
      throw error;
    }
  }

  /**
   * Compartir en WhatsApp
   */
  async shareWhatsApp(activityId, activityType, title, url) {
    const text = `¡Mira esta ${activityType === 'cause' ? 'causa' : activityType}! ${title} ${url}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    
    window.open(whatsappUrl, '_blank');
    
    // Registrar compartido después de un delay (asumiendo que el usuario compartió)
    setTimeout(() => {
      this.registerShare(activityId, activityType, 'whatsapp');
    }, 2000);
  }

  /**
   * Compartir en Telegram
   */
  async shareTelegram(activityId, activityType, title, url) {
    const text = `¡Mira esta ${activityType === 'cause' ? 'causa' : activityType}! ${title}`;
    const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
    
    window.open(telegramUrl, '_blank');
    
    setTimeout(() => {
      this.registerShare(activityId, activityType, 'telegram');
    }, 2000);
  }

  /**
   * Compartir en Facebook
   */
  async shareFacebook(activityId, activityType, url) {
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
    
    window.open(facebookUrl, '_blank');
    
    setTimeout(() => {
      this.registerShare(activityId, activityType, 'facebook');
    }, 2000);
  }

  /**
   * Compartir en Twitter
   */
  async shareTwitter(activityId, activityType, title, url) {
    const text = `¡Mira esta ${activityType === 'cause' ? 'causa' : activityType}! ${title}`;
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    
    window.open(twitterUrl, '_blank');
    
    setTimeout(() => {
      this.registerShare(activityId, activityType, 'twitter');
    }, 2000);
  }

  /**
   * Compartir en LinkedIn
   */
  async shareLinkedIn(activityId, activityType, url) {
    const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
    
    window.open(linkedinUrl, '_blank');
    
    setTimeout(() => {
      this.registerShare(activityId, activityType, 'linkedin');
    }, 2000);
  }

  /**
   * Copiar enlace
   */
  async copyLink(activityId, activityType, url) {
    try {
      await navigator.clipboard.writeText(url);
      this.showNotification('¡Enlace copiado al portapapeles!', 'success');
      
      // Registrar compartido por copia de enlace
      await this.registerShare(activityId, activityType, 'copy');
      
    } catch (error) {
      console.error('Error copiando enlace:', error);
      this.showNotification('Error copiando enlace', 'error');
    }
  }

  /**
   * Compartir por email
   */
  async shareEmail(activityId, activityType, title, url) {
    const subject = `Te comparto esta ${activityType === 'cause' ? 'causa' : activityType}: ${title}`;
    const body = `Hola,\n\nTe comparto esta ${activityType === 'cause' ? 'causa' : activityType} que me parece interesante:\n\n${title}\n\n${url}\n\n¡Échale un vistazo!`;
    
    const emailUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = emailUrl;
    
    setTimeout(() => {
      this.registerShare(activityId, activityType, 'email');
    }, 1000);
  }

  /**
   * Mostrar notificación de puntos ganados
   */
  showPointsNotification(points, message) {
    // Crear notificación temporal
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
   * Mostrar notificación general
   */
  showNotification(message, type = 'info') {
    const colors = {
      success: '#4CAF50',
      error: '#f44336',
      info: '#2196F3'
    };

    const notification = document.createElement('div');
    notification.innerHTML = `
      <div style="
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${colors[type]};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 10px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        z-index: 10000;
      ">
        ${message}
      </div>
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, 2000);
  }

  /**
   * Crear modal de compartir
   */
  createShareModal(activityId, activityType, title, url) {
    const modal = document.createElement('div');
    modal.className = 'share-modal';
    modal.innerHTML = `
      <div style="
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
      ">
        <div style="
          background: white;
          border-radius: 15px;
          padding: 2rem;
          max-width: 400px;
          width: 90vw;
          box-shadow: 0 10px 25px rgba(0,0,0,0.2);
        ">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
            <h3 style="margin: 0; color: #333;">Compartir</h3>
            <button class="close-modal" style="background: none; border: none; font-size: 1.5rem; cursor: pointer;">&times;</button>
          </div>
          
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1.5rem;">
            <button class="share-btn whatsapp" style="background: #25D366; color: white; border: none; padding: 1rem; border-radius: 10px; cursor: pointer;">
              <i class="fab fa-whatsapp" style="font-size: 1.5rem;"></i>
              <div style="font-size: 0.8rem; margin-top: 0.5rem;">WhatsApp</div>
            </button>
            
            <button class="share-btn telegram" style="background: #0088cc; color: white; border: none; padding: 1rem; border-radius: 10px; cursor: pointer;">
              <i class="fab fa-telegram-plane" style="font-size: 1.5rem;"></i>
              <div style="font-size: 0.8rem; margin-top: 0.5rem;">Telegram</div>
            </button>
            
            <button class="share-btn facebook" style="background: #4267B2; color: white; border: none; padding: 1rem; border-radius: 10px; cursor: pointer;">
              <i class="fab fa-facebook-f" style="font-size: 1.5rem;"></i>
              <div style="font-size: 0.8rem; margin-top: 0.5rem;">Facebook</div>
            </button>
            
            <button class="share-btn twitter" style="background: #1DA1F2; color: white; border: none; padding: 1rem; border-radius: 10px; cursor: pointer;">
              <i class="fab fa-twitter" style="font-size: 1.5rem;"></i>
              <div style="font-size: 0.8rem; margin-top: 0.5rem;">Twitter</div>
            </button>
            
            <button class="share-btn linkedin" style="background: #0077b5; color: white; border: none; padding: 1rem; border-radius: 10px; cursor: pointer;">
              <i class="fab fa-linkedin-in" style="font-size: 1.5rem;"></i>
              <div style="font-size: 0.8rem; margin-top: 0.5rem;">LinkedIn</div>
            </button>
            
            <button class="share-btn email" style="background: #EA4335; color: white; border: none; padding: 1rem; border-radius: 10px; cursor: pointer;">
              <i class="fas fa-envelope" style="font-size: 1.5rem;"></i>
              <div style="font-size: 0.8rem; margin-top: 0.5rem;">Email</div>
            </button>
          </div>
          
          <button class="share-btn copy" style="background: #6c757d; color: white; border: none; padding: 1rem; border-radius: 10px; cursor: pointer; width: 100%;">
            <i class="fas fa-link" style="margin-right: 0.5rem;"></i>
            Copiar enlace
          </button>
          
          <div style="margin-top: 1rem; padding: 0.8rem; background: #f8f9fa; border-radius: 8px; text-align: center; font-size: 0.9rem; color: #666;">
            <i class="fas fa-star" style="color: #FFD700; margin-right: 0.3rem;"></i>
            ¡Gana 5 puntos por cada compartido!
          </div>
        </div>
      </div>
    `;

    // Event listeners
    modal.querySelector('.close-modal').onclick = () => modal.remove();
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

    modal.querySelector('.whatsapp').onclick = () => {
      this.shareWhatsApp(activityId, activityType, title, url);
      modal.remove();
    };

    modal.querySelector('.telegram').onclick = () => {
      this.shareTelegram(activityId, activityType, title, url);
      modal.remove();
    };

    modal.querySelector('.facebook').onclick = () => {
      this.shareFacebook(activityId, activityType, url);
      modal.remove();
    };

    modal.querySelector('.twitter').onclick = () => {
      this.shareTwitter(activityId, activityType, title, url);
      modal.remove();
    };

    modal.querySelector('.linkedin').onclick = () => {
      this.shareLinkedIn(activityId, activityType, url);
      modal.remove();
    };

    modal.querySelector('.email').onclick = () => {
      this.shareEmail(activityId, activityType, title, url);
      modal.remove();
    };

    modal.querySelector('.copy').onclick = () => {
      this.copyLink(activityId, activityType, url);
      modal.remove();
    };

    document.body.appendChild(modal);
  }
}

// Instancia global
window.shareSystem = new ShareSystem();