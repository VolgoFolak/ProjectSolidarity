class SolidarityMobileAvatar extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.isOpen = false;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block !important;
          z-index: 999999 !important;
          min-width: 60px !important;
          min-height: 60px !important;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        
        /* Botón avatar circular (usuario logueado) */
        .menu-toggle {
          width: 56px;
          height: 56px;
          margin: 0;
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

        /* Botón de login circular - mismo formato que avatar */
        .login-button {
          width: 56px !important;
          height: 56px !important;
          margin: 0 !important;
          background: var(--white, #fff) !important;
          border: none !important;
          border-radius: 50% !important;
          box-shadow: 0 4px 12px rgba(74, 111, 165, 0.2) !important;
          display: flex !important;
          justify-content: center !important;
          align-items: center !important;
          cursor: pointer !important;
          transition: all 0.3s ease !important;
          z-index: 1000001 !important;
          color: var(--primary, #4a6fa5) !important;
        }

        .login-button:hover {
          transform: scale(1.05) !important;
          box-shadow: 0 6px 18px rgba(74, 111, 165, 0.3) !important;
          background: var(--primary, #4a6fa5) !important;
        }

        .login-button:active {
          transform: scale(1) !important;
        }

        .login-button svg {
  width: 32px !important;
  height: 32px !important;
  color: var(--primary, #4a6fa5) !important;
  stroke: var(--primary, #4a6fa5) !important;
  stroke-width: 2.5 !important;
  fill: none !important;
  transition: all 0.3s ease !important;
}

.login-button:hover svg {
  stroke: #ffffff !important;
  transform: scale(1.05) !important;
}

        .login-button i {
          font-size: 24px !important;
          color: var(--primary, #4a6fa5) !important;
        }

        .login-button span {
          display: none !important; /* Ocultar texto */
        }

        .login-button img {
  width: 40px !important;
  height: 40px !important;
  border-radius: 50% !important;
  object-fit: cover !important;
  display: none;
  box-shadow: none !important;
  margin: 0 !important;
  padding: 0 !important;
}
@media (max-width: 768px) {
  .login-button img {
    display: none !important;
  }
  .login-button #solidarityUserIcon {
    display: block !important;
  }
  .login-button svg:not(#solidarityUserIcon),
  .login-button i {
    display: none !important;
  }
}
@media (min-width: 769px) {
  .login-button #solidarityUserIcon {
    display: none !important;
  }
  .login-button svg:not(#solidarityUserIcon),
  .login-button i {
    display: block !important;
  }
}

        /* Ocultar elementos según estado */
        .hidden {
          display: none !important;
        }

        </style>
      
      <!-- Avatar para usuario logueado -->
      <button class="menu-toggle hidden" id="avatarButton" aria-label="Abrir menú de usuario">
        <img src="/img/default-user.png" alt="Avatar" id="avatarImg">
      </button>
      
      <!-- Botón para usuario no logueado - formato circular como avatar -->
      <button class="login-button hidden" id="loginButton" aria-label="Iniciar sesión">
        <svg id="solidarityUserIcon" width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="20" cy="20" r="18" fill="#fff" stroke="#e2e8f0" stroke-width="2"/>
    <!-- Signo + centrado, mismo grosor y color que menú hamburguesa -->
    <line x1="20" y1="13" x2="20" y2="27" stroke="#4a6fa5" stroke-width="3" stroke-linecap="round"/>
    <line x1="13" y1="20" x2="27" y2="20" stroke="#4a6fa5" stroke-width="3" stroke-linecap="round"/>
  </svg>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="8" r="3.5"></circle>
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <line x1="18" y1="6" x2="18" y2="12"></line>
          <line x1="21" y1="9" x2="15" y2="9"></line>
        </svg>
        <span>Iniciar Sesión</span>
      </button>
    `;

    this.setupEventListeners();
    this.updateAuthState();
  }

  setupEventListeners() {
    const loginButton = this.shadowRoot.getElementById('loginButton');
    if (loginButton) {
      loginButton.addEventListener('click', () => {
        window.location.href = '/login';
      });
    }

    const avatarButton = this.shadowRoot.getElementById('avatarButton');
    if (avatarButton) {
      avatarButton.addEventListener('click', () => {
        this.toggleUserMenu();
      });
    }
  }

  toggleUserMenu() {
    console.log('Abrir menú de usuario');
  }

  async updateAuthState() {
    try {
      if (typeof supabase !== 'undefined') {
        const { data: { user } } = await supabase.auth.getUser();
        
        const avatarButton = this.shadowRoot.getElementById('avatarButton');
        const loginButton = this.shadowRoot.getElementById('loginButton');
        
        if (user) {
          loginButton.classList.add('hidden');
          avatarButton.classList.remove('hidden');
          
          const { data: profile } = await supabase
            .from('profiles')
            .select('photo_url')
            .eq('id', user.id)
            .single();
          
          const avatarImg = this.shadowRoot.getElementById('avatarImg');
          if (avatarImg) {
            avatarImg.src = profile?.photo_url || '/img/default-user.png';
          }
        } else {
          avatarButton.classList.add('hidden');
          loginButton.classList.remove('hidden');
        }
      } else {
        const avatarButton = this.shadowRoot.getElementById('avatarButton');
        const loginButton = this.shadowRoot.getElementById('loginButton');
        avatarButton.classList.add('hidden');
        loginButton.classList.remove('hidden');
      }
    } catch (error) {
      console.error('Error checking auth state:', error);
      const avatarButton = this.shadowRoot.getElementById('avatarButton');
      const loginButton = this.shadowRoot.getElementById('loginButton');
      avatarButton.classList.add('hidden');
      loginButton.classList.remove('hidden');
    }
  }

  async updateAvatar() {
    await this.updateAuthState();
  }
}

if (!customElements.get('solidarity-mobile-avatar')) {
  customElements.define('solidarity-mobile-avatar', SolidarityMobileAvatar);
}

window.updateMobileAvatar = function() {
  const avatar = document.querySelector('solidarity-mobile-avatar');
  if (avatar && avatar.updateAvatar) avatar.updateAvatar();
};

if (typeof supabase !== 'undefined') {
  supabase.auth.onAuthStateChange((event, session) => {
    window.updateMobileAvatar();
  });
}