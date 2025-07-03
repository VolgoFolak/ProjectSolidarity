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

        /* Botón elegante alargado (usuario no logueado) */
        .login-button {
          background: linear-gradient(135deg, #4a6fa5 0%, #166088 100%);
          color: white;
          border: none;
          border-radius: 25px;
          padding: 12px 20px;
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 4px 12px rgba(74, 111, 165, 0.3);
          white-space: nowrap;
          display: flex;
          align-items: center;
          gap: 8px;
          z-index: 1000001;
          min-width: 120px;
          justify-content: center;
        }
        .login-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 18px rgba(74, 111, 165, 0.4);
          background: linear-gradient(135deg, #166088 0%, #4a6fa5 100%);
        }
        .login-button:active {
          transform: translateY(0);
        }
        .login-button i {
          font-size: 16px;
        }

        /* Ocultar elementos según estado */
        .hidden {
          display: none !important;
        }

        .logo-icon {
          font-size: 1.7rem;
          color: #4a6fa5;
        }
        .logo-text {
          font-weight: 700;
          font-size: 1.15rem;
          color: #1a202c;
        }
      </style>
      
      <!-- Avatar para usuario logueado -->
      <button class="menu-toggle hidden" id="avatarButton" aria-label="Abrir menú de usuario">
        <img src="/img/default-user.png" alt="Avatar" id="avatarImg">
      </button>
      
      <!-- Botón para usuario no logueado -->
      <button class="login-button hidden" id="loginButton" aria-label="Iniciar sesión">
        <i class="fas fa-user"></i>
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

    // Mantener la funcionalidad del avatar si tienes un menú desplegable
    const avatarButton = this.shadowRoot.getElementById('avatarButton');
    if (avatarButton) {
      avatarButton.addEventListener('click', () => {
        // Aquí puedes agregar la lógica para abrir el menú de usuario
        // Por ejemplo, disparar un evento o abrir un dropdown
        this.toggleUserMenu();
      });
    }
  }

  toggleUserMenu() {
    // Lógica para el menú de usuario (si lo tienes)
    // Por ejemplo, abrir un dropdown o modal
    console.log('Abrir menú de usuario');
  }

  async updateAuthState() {
    try {
      if (typeof supabase !== 'undefined') {
        const { data: { user } } = await supabase.auth.getUser();
        
        const avatarButton = this.shadowRoot.getElementById('avatarButton');
        const loginButton = this.shadowRoot.getElementById('loginButton');
        
        if (user) {
          // Usuario logueado - mostrar avatar
          loginButton.classList.add('hidden');
          avatarButton.classList.remove('hidden');
          
          // Actualizar imagen del avatar
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
          // Usuario no logueado - mostrar botón de login
          avatarButton.classList.add('hidden');
          loginButton.classList.remove('hidden');
        }
      } else {
        // Sin Supabase - mostrar botón de login
        const avatarButton = this.shadowRoot.getElementById('avatarButton');
        const loginButton = this.shadowRoot.getElementById('loginButton');
        avatarButton.classList.add('hidden');
        loginButton.classList.remove('hidden');
      }
    } catch (error) {
      // En caso de error, mostrar botón de login
      console.error('Error checking auth state:', error);
      const avatarButton = this.shadowRoot.getElementById('avatarButton');
      const loginButton = this.shadowRoot.getElementById('loginButton');
      avatarButton.classList.add('hidden');
      loginButton.classList.remove('hidden');
    }
  }

  // Método público para actualizar desde fuera
  async updateAvatar() {
    await this.updateAuthState();
  }
}

if (!customElements.get('solidarity-mobile-avatar')) {
  customElements.define('solidarity-mobile-avatar', SolidarityMobileAvatar);
}

// Función global para actualizar el componente
window.updateMobileAvatar = function() {
  const avatar = document.querySelector('solidarity-mobile-avatar');
  if (avatar && avatar.updateAvatar) avatar.updateAvatar();
};

// Escuchar cambios de autenticación
if (typeof supabase !== 'undefined') {
  supabase.auth.onAuthStateChange((event, session) => {
    window.updateMobileAvatar();
  });
}