/**
 * Mobile Hamburger Menu - Componente aislado para Solidarity
 * Solo aparece en móviles y tablets (≤ 992px)
 */

class SolidarityHamburgerMenu extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.isOpen = false; // Inicializar estado

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          --primary: #4a6fa5;
          --primary-light: #6d8fc7;
          --accent: #4fc3a1;
          --white: #ffffff;
          --light: #f8f9fa;
          --darker: #1a202c;

          display: block !important;
          z-index: 999999 !important;
          min-width: 60px !important;
          min-height: 60px !important;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          /* ✅ AÑADIR ESTA LÍNEA */
          overflow: hidden;
        }

        @media (max-width: 992px) {
          :host {
            display: block;
          }
        }

        /* Botón hamburguesa circular */
        .menu-toggle {
          width: 56px;
          height: 56px;
          margin: 0;
          background: var(--white, #fff);
          border: none;
          border-radius: 50%;
          box-shadow: 0 4px 12px rgba(74, 111, 165, 0.2);
          display: flex;
          flex-direction: column; /* <-- Esto apila las líneas verticalmente */
          justify-content: center;
          align-items: center;
          cursor: pointer;
          transition: all 0.3s ease;
          z-index: 1000001;
          position: relative;
        }
        .menu-toggle:hover {
          transform: scale(1.05);
          box-shadow: 0 6px 18px rgba(74, 111, 165, 0.3);
        }
        /* Líneas del icono hamburguesa */
        .menu-line {
          width: 24px;
          height: 3px;
          background: #4a6fa5;
          margin: 2px 0;
          border-radius: 2px;
          transition: all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
          display: block;
        }
        .menu-toggle.open .menu-line {
          background: #fff;
        }
        .menu-toggle.open .menu-line:nth-child(1) {
          transform: translateY(7px) rotate(45deg);
        }
        .menu-toggle.open .menu-line:nth-child(2) {
          opacity: 0;
          transform: scale(0);
        }
        .menu-toggle.open .menu-line:nth-child(3) {
          transform: translateY(-7px) rotate(-45deg);
        }

        /* Overlay */
        .menu-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(5px);
          opacity: 0;
          visibility: hidden;
          transition: all 0.3s ease;
          z-index: 1000000;
        }

        .menu-overlay.open {
          opacity: 1;
          visibility: visible;
        }

        /* Panel del menú */
        .menu-panel {
          position: fixed;
          top: 0;
          right: 0;
          width: min(320px, 85vw);
          height: 100vh;
          background: var(--white);
          transform: translateX(100%);
          transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1);
          box-shadow: -5px 0 25px rgba(0,0,0,0.15);
          display: flex;
          flex-direction: column;
          z-index: 1000000;
          overflow-y: auto;
          /* ✅ AÑADIR ESTAS LÍNEAS */
          right: -5px; /* Offset para asegurar que esté completamente oculto */
        }

        .menu-panel.open {
          transform: translateX(0);
          right: 0; /* ✅ AÑADIR ESTA LÍNEA */
        }

        /* Contenido del menú */
        .menu-header {
          padding: 2rem 1.5rem 1.5rem;
          background: linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%);
          color: var(--white);
          margin-top: 60px; /* Espacio para el botón */
        }

        .user-avatar {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          object-fit: cover;
          border: 3px solid var(--white);
          margin-bottom: 12px;
        }

        .user-name {
          font-weight: 600;
          font-size: 1.1rem;
          margin-bottom: 4px;
        }

        .user-status {
          font-size: 0.85rem;
          opacity: 0.9;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .status-dot {
          width: 8px;
          height: 8px;
          background: var(--accent);
          border-radius: 50%;
          box-shadow: 0 0 0 2px rgba(79, 195, 161, 0.3);
        }

        /* Items del menú */
        .menu-items {
          flex: 1;
          padding: 1.5rem 0;
        }

        .menu-section {
          margin-bottom: 2rem;
        }

        .section-title {
          padding: 0 1.5rem 0.8rem;
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #9ca3af;
          font-weight: 600;
        }

        .menu-item {
          display: flex;
          align-items: center;
          padding: 1rem 1.5rem;
          color: var(--darker);
          text-decoration: none;
          transition: all 0.2s ease;
          position: relative;
        }

        .menu-item:hover {
          background: var(--light);
          transform: translateX(4px);
        }

        .menu-item.active {
          background: rgba(74, 111, 165, 0.08);
          color: var(--primary);
          font-weight: 600;
        }

        .menu-item.active::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 4px;
          background: var(--accent);
        }

        .item-icon {
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-right: 16px;
          color: currentColor;
        }

        .item-text {
          flex: 1;
          font-weight: 500;
          font-size: 0.95rem;
        }

        .item-badge {
          background: var(--accent);
          color: white;
          border-radius: 12px;
          padding: 3px 8px;
          font-size: 0.7rem;
          font-weight: 600;
          min-width: 18px;
          text-align: center;
        }

        /* Footer del menú */
        .menu-footer {
          padding: 1.5rem;
          border-top: 1px solid #e5e7eb;
          background: #f9fafb;
        }

        .footer-link {
          display: flex;
          align-items: center;
          gap: 12px;
          color: #6b7280;
          font-size: 0.9rem;
          text-decoration: none;
          padding: 0.8rem;
          border-radius: 8px;
          transition: all 0.2s;
          margin-bottom: 8px;
        }

        .footer-link:hover {
          color: var(--primary);
          background: var(--white);
        }

        .footer-link:last-child {
          margin-bottom: 0;
        }

        /* Animaciones */
        @keyframes slideIn {
          from { 
            opacity: 0; 
            transform: translateX(20px); 
          }
          to { 
            opacity: 1; 
            transform: translateX(0); 
          }
        }

        .menu-item {
          animation: slideIn 0.3s ease-out forwards;
        }

        .menu-item:nth-child(1) { animation-delay: 0.1s; }
        .menu-item:nth-child(2) { animation-delay: 0.15s; }
        .menu-item:nth-child(3) { animation-delay: 0.2s; }
        .menu-item:nth-child(4) { animation-delay: 0.25s; }
        .menu-item:nth-child(5) { animation-delay: 0.3s; }

        /* Responsive */
        @media (max-width: 480px) {
          .menu-panel {
            width: 90vw;
          }

          .menu-header {
            padding: 1.5rem 1rem 1rem;
          }

          .item-text {
            font-size: 0.9rem;
          }
        }
           @media (max-width: 480px) {
          .menu-panel {
            width: 90vw;
            right: -10px;
          }

          .menu-panel.open {
            right: 0;
          }
        }

        @media (max-width: 360px) {
          .menu-panel {
            width: 95vw;
            right: -15px;
          }
        }
      </style>
      
      <!-- Botón hamburguesa -->
      <button class="menu-toggle" id="hamburgerButton" aria-label="Abrir menú de navegación">
        <span class="menu-line"></span>
        <span class="menu-line"></span>
        <span class="menu-line"></span>
      </button>
      
      <!-- Overlay -->
      <div class="menu-overlay"></div>
      
      <!-- Panel del menú -->
      <div class="menu-panel">
        <!-- Cabecera con info usuario -->
        <div class="menu-header">
          <img src="/img/default-user.png" alt="Avatar de usuario" class="user-avatar" id="menuUserAvatar">
          <div class="user-name" id="menuUserName">Invitado</div>
          <div class="user-status">
            <span class="status-dot"></span>
            <span id="menuUserStatus">No autenticado</span>
          </div>
        </div>
        
        <!-- Items de navegación -->
        <div class="menu-items">
          <!-- 👤 SECCIÓN MI PERFIL -->
          <div class="menu-section">
            <div class="section-title">Mi Perfil</div>
            
            <a href="/profile" class="menu-item" data-page="profile">
              <div class="item-icon">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
              </div>
              <div class="item-text">Mi Perfil</div>
              <div class="item-badge" id="profileBadge" style="display: none;">2</div>
            </a>
            
            <a href="/profile/myactivities" class="menu-item" data-page="myactivities">
              <div class="item-icon">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
              </div>
              <div class="item-text">Mis Actividades</div>
              <div class="item-badge" id="activitiesBadge" style="display: none;">5</div>
            </a>
            
            <a href="/myteams" class="menu-item" data-page="myteams">
              <div class="item-icon">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
              </div>
              <div class="item-text">Mis Comunidades</div>
              <div class="item-badge" id="myteamsBadge" style="display: none;">3</div>
            </a>
          </div>
          
          <!-- ⚡ SECCIÓN TAKE ACTION -->
          <div class="menu-section">
            <div class="section-title">Take Action</div>
            
            <a href="/causes" class="menu-item" data-page="causes">
              <div class="item-icon">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                </svg>
              </div>
              <div class="item-text">Causas</div>
            </a>
            
            <a href="/tasks" class="menu-item" data-page="tasks">
              <div class="item-icon">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="9 11 12 14 22 4"></polyline>
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                </svg>
              </div>
              <div class="item-text">Tareas</div>
              <div class="item-badge" id="tasksBadge" style="display: none;">7</div>
            </a>
            
            <a href="/challenges" class="menu-item" data-page="challenges">
              <div class="item-icon">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="8" r="7"></circle>
                  <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline>
                </svg>
              </div>
              <div class="item-text">Retos</div>
            </a>
            
            <a href="/volunteering" class="menu-item" data-page="volunteering">
              <div class="item-icon">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="8.5" cy="7" r="4"></circle>
                  <line x1="20" y1="8" x2="20" y2="14"></line>
                  <line x1="23" y1="11" x2="17" y2="11"></line>
                </svg>
              </div>
              <div class="item-text">Voluntariados</div>
            </a>
          </div>
          
          <!-- 🌍 SECCIÓN COMUNIDADES -->
          <div class="menu-section">
            <div class="section-title">Comunidades</div>
            
            <a href="/teams" class="menu-item" data-page="teams">
              <div class="item-icon">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
              </div>
              <div class="item-text">Comunidades</div>
            </a>
            
            <a href="/members" class="menu-item" data-page="members">
              <div class="item-icon">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
              </div>
              <div class="item-text">Miembros</div>
            </a>
            
            <a href="/maps" class="menu-item" data-page="maps">
              <div class="item-icon">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                  <circle cx="12" cy="10" r="3"></circle>
                </svg>
              </div>
              <div class="item-text">Mapa de Ayudas</div>
            </a>
            
            <a href="/ranking" class="menu-item" data-page="ranking">
              <div class="item-icon">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path>
                  <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path>
                  <path d="M4 22h16"></path>
                  <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path>
                  <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path>
                  <path d="M18 2H6v7a6 6 0 0 0 12 0V2z"></path>
                </svg>
              </div>
              <div class="item-text">Ranking</div>
            </a>
            
            <a href="/messages" class="menu-item" data-page="messages">
              <div class="item-icon">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
              </div>
              <div class="item-text">Mensajes</div>
              <div class="item-badge" id="messagesBadge" style="display: none;">4</div>
            </a>
          </div>
        </div>
        
        <!-- Footer -->
        <div class="menu-footer">
          <a href="/editprofile" class="footer-link">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
            Configuración
          </a>
          
          <a href="#" id="menuLogout" class="footer-link">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            Cerrar Sesión
          </a>
        </div>
      </div>
    `;

    this.setupEventListeners();
    this.updateActiveItem();
    this.checkAuth();
  }

  setupEventListeners() {
    const toggle = this.shadowRoot.getElementById('hamburgerButton');
    const overlay = this.shadowRoot.querySelector('.menu-overlay');
    const logoutBtn = this.shadowRoot.getElementById('menuLogout');

    // Toggle del menú
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleMenu();
    });

    // Cerrar al hacer clic en overlay
    overlay.addEventListener('click', () => {
      this.closeMenu();
    });

    // Event listeners para enlaces del menú
    this.shadowRoot.querySelectorAll('.menu-item').forEach(item => {
      item.addEventListener('click', () => {
        // Cerrar menú al navegar
        setTimeout(() => this.closeMenu(), 200);
      });
    });

    // Logout
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      this.logout();
    });

    // Cerrar con ESC
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.closeMenu();
      }
    });

    // Actualizar item activo cuando cambia la URL
    window.addEventListener('popstate', () => {
      this.updateActiveItem();
    });
  }

  toggleMenu() {
    const toggle = this.shadowRoot.getElementById('hamburgerButton');
    const overlay = this.shadowRoot.querySelector('.menu-overlay');
    const panel = this.shadowRoot.querySelector('.menu-panel');

    this.isOpen = !this.isOpen;

    if (this.isOpen) {
      toggle.classList.add('open');
      overlay.classList.add('open');
      panel.classList.add('open');
      document.body.style.overflow = 'hidden';
    } else {
      toggle.classList.remove('open');
      overlay.classList.remove('open');
      panel.classList.remove('open');
      document.body.style.overflow = '';
    }

    const header = document.querySelector('solidarity-mobile-header');
    if (header && header.setMenuOpen) {
      header.setMenuOpen(this.isOpen);
    }
  }

  closeMenu() {
    if (this.isOpen) {
      this.toggleMenu();
    }
  }

  async checkAuth() {
    try {
      // Verificar si Supabase está disponible
      if (typeof supabase !== 'undefined') {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('username, photo_url')
            .eq('id', user.id)
            .single();

          const avatar = this.shadowRoot.getElementById('menuUserAvatar');
          const name = this.shadowRoot.getElementById('menuUserName');
          const status = this.shadowRoot.getElementById('menuUserStatus');

          if (avatar) avatar.src = profile?.photo_url || '/img/default-user.png';
          if (name) name.textContent = profile?.username || 'Usuario';
          if (status) status.textContent = 'En línea';
        }
      }
    } catch (error) {
      console.error('Error checking auth:', error);
    }
  }

  updateActiveItem() {
    const currentPath = window.location.pathname;
    let activePage = 'home';

    if (currentPath === '/') {
      activePage = 'home';
    } else if (currentPath.includes('/profile/myactivities')) {
      activePage = 'myactivities';
    } else if (currentPath.includes('/profile')) {
      activePage = 'profile';
    } else if (currentPath.includes('/causes')) {
      activePage = 'causes';
    } else if (currentPath.includes('/tasks')) {
      activePage = 'tasks';
    } else if (currentPath.includes('/challenges')) {
      activePage = 'challenges';
    } else if (currentPath.includes('/volunteering')) {
      activePage = 'volunteering';
    } else if (currentPath.includes('/teams')) {
      activePage = 'teams';
    } else if (currentPath.includes('/ranking')) {
      activePage = 'ranking';
    }

    // Actualizar items activos
    this.shadowRoot.querySelectorAll('.menu-item').forEach(item => {
      item.classList.remove('active');
      if (item.dataset.page === activePage) {
        item.classList.add('active');
      }
    });
  }

  async logout() {
    try {
      if (typeof supabase !== 'undefined') {
        await supabase.auth.signOut();
      }
      window.location.href = '/login';
    } catch (error) {
      console.error('Error logging out:', error);
      // Fallback: redirigir anyway
      window.location.href = '/login';
    }
  }

  // Métodos públicos
  showBadge(item, count) {
    const badge = this.shadowRoot.getElementById(`${item}Badge`);
    if (badge) {
      badge.textContent = count;
      badge.style.display = count > 0 ? 'flex' : 'none';
    }
  }

  updateActive() {
    this.updateActiveItem();
  }
}

// Registrar el componente
if (!customElements.get('solidarity-hamburger-menu')) {
  customElements.define('solidarity-hamburger-menu', SolidarityHamburgerMenu);
}

// Funciones helper globales
window.updateMobileHamburgerMenu = function() {
  const menu = document.querySelector('solidarity-hamburger-menu');
  if (menu) menu.updateActive();
};

window.setHamburgerBadge = function(item, count) {
  const menu = document.querySelector('solidarity-hamburger-menu');
  if (menu) menu.showBadge(item, count);
};

window.closeHamburgerMenu = function() {
  const menu = document.querySelector('solidarity-hamburger-menu');
  if (menu) menu.closeMenu();
};