class SolidarityMobileAvatar extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.isOpen = false;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: none !important;
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          z-index: 999999 !important;
          min-width: 60px !important;
          min-height: 60px !important;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        @media (max-width: 992px) {
          :host {
            display: block !important;
          }
        }
        .menu-toggle {
          width: 56px;
          height: 56px;
          margin: 15px;
          background: var(--white, #fff);
          border: none;
          border-radius: 50%;
          box-shadow: 0 4px 12px rgba(74, 111, 165, 0.2);
          display: flex;
          justify-content: center;
          align-items: center;
          cursor: pointer;
          transition: all 0.3s ease;
          z-index: 1000001;
        }
        .menu-toggle:hover {
          transform: scale(1.05);
          box-shadow: 0 6px 18px rgba(74, 111, 165, 0.3);
        }
        .menu-toggle img {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: 2px solid #fff;
          background: #fff;
          object-fit: cover;
          display: block;
        }
      </style>
      <button class="menu-toggle" aria-label="Abrir menú de usuario">
        <img src="/img/default-user.png" alt="Avatar" id="avatarImg">
      </button>
    `;
    this.updateAvatar();
  }

  async updateAvatar() {
    try {
      if (typeof supabase !== 'undefined') {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('photo_url')
            .eq('id', user.id)
            .single();
          const avatarImg = this.shadowRoot.getElementById('avatarImg');
          if (avatarImg) avatarImg.src = profile?.photo_url || '/img/default-user.png';
        }
      }
    } catch (error) {
      // Silenciar error
    }
  }
}

if (!customElements.get('solidarity-mobile-avatar')) {
  customElements.define('solidarity-mobile-avatar', SolidarityMobileAvatar);
}

window.updateMobileAvatar = function() {
  const avatar = document.querySelector('solidarity-mobile-avatar');
  if (avatar && avatar.updateAvatar) avatar.updateAvatar();
};