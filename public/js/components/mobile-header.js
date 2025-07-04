class SolidarityMobileHeader extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: none !important;
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          width: 100vw !important;
          height: 80px !important;
          z-index: 999998 !important;
          background: rgba(255, 255, 255, 0.95) !important;
          backdrop-filter: blur(10px) !important;
          border-bottom: 1px solid rgba(74, 111, 165, 0.1) !important;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          padding-left: 18px !important;   /* Añadido */
          padding-right: 18px !important;  /* Añadido */
        }

        @media (max-width: 992px) {
          :host {
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            padding-left: 18px !important;   /* Añadido */
            padding-right: 18px !important;  /* Añadido */
          }
        }

        /* Contenedor izquierdo - hamburguesa */
        .left-section {
          display: flex;
          align-items: center;
          gap: 10px;
          padding-left: 2px; /* Opcional, para más separación */
        }

        /* Contenedor centro - logo */
        .center-section {
          display: flex;
          align-items: center;
          justify-content: center;
          flex: 1;
        }

        /* Contenedor derecho - avatar */
        .right-section {
          display: flex;
          align-items: center;
          gap: 10px;
          padding-right: 2px; /* Opcional, para más separación */
        }

        /* Logo */
        .logo {
          height: 40px;
          width: auto;
          cursor: pointer;
          transition: transform 0.2s ease;
        }
        .logo:hover {
          transform: scale(1.05);
        }

        /* Icono y texto del logo */
        .logo-icon {
          color: var(--primary, #4a6fa5);
          width: 44px !important;
          height: 44px !important;
          max-width: 44px !important;
          max-height: 44px !important;
          object-fit: contain !important;
          flex-shrink: 0 !important;
          display: block !important;
        }
        .logo-text {
          font-family: 'Poppins', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          font-weight: 700;
          font-size: 1.5rem;
          color: var(--primary, #4a6fa5);
          letter-spacing: -0.5px;
          line-height: 1;
        }

        /* Responsive para móviles muy pequeños */
        @media (max-width: 360px) {
          .logo-icon {
            width: 36px !important;
            height: 36px !important;
            max-width: 36px !important;
            max-height: 36px !important;
          }
        }

        /* Ajustes para que los componentes internos no usen position fixed */
        ::slotted(solidarity-mobile-hamburger),
        ::slotted(solidarity-mobile-avatar) {
          position: static !important;
          top: auto !important;
          left: auto !important;
          right: auto !important;
          margin: 0 !important;
        }

        :host([menu-open]) .right-section {
          display: none !important;
        }
      </style>
      
      <div class="left-section">
        <slot name="hamburger"></slot>
      </div>
      
      <div class="center-section">
        <a href="/" class="logo" style="display:flex;align-items:center;gap:12px;text-decoration:none;">
          <img src="${window.location.origin}/img/logo.jpg" 
               alt="Solidarity Logo" 
               class="logo-icon" 
               onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDQiIGhlaWdodD0iNDQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJMMTMuMDkgOC4yNkwyMCA5TDEzLjA5IDE1Ljc0TDEyIDIyTDEwLjkxIDE1Ljc0TDQgOUwxMC45MSA4LjI2TDEyIDJaIiBmaWxsPSIjNGE2ZmE1Ii8+Cjwvc3ZnPgo='; this.onerror=null;"
               style="width:44px;height:44px;object-fit:contain;">
          <span class="logo-text">Solidarity</span>
        </a>
      </div>
      
      <div class="right-section">
        <slot name="avatar"></slot>
      </div>
    `;
  }

  setMenuOpen(open) {
    if (open) {
      this.setAttribute('menu-open', '');
    } else {
      this.removeAttribute('menu-open');
    }
  }
}

if (!customElements.get('solidarity-mobile-header')) {
  customElements.define('solidarity-mobile-header', SolidarityMobileHeader);
}

document.querySelector('solidarity-mobile-header').setMenuOpen(true); // Para abrir
document.querySelector('solidarity-mobile-header').setMenuOpen(false); // Para cerrar