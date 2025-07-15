/**
 * Mobile Bottom Navigation - Componente aislado para Solidarity
 * Solo aparece en móviles y tablets (≤ 992px)
 * 5 botones: Home | Mis Actividades | Take Action | Mis Comunidades | Mi Perfil
 */

class SolidarityBottomNav extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          --primary: #4a6fa5;
          --primary-light: #6d8fc7;
          --accent: #4fc3a1;
          --white: #ffffff;
          --light: #f8f9fa;
          --darker: #1a202c;
          --gray: #6b7280;
          
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 999998;
          display: none;
          background: var(--white);
          box-shadow: 0 -2px 15px rgba(0,0,0,0.1);
          border-top: 1px solid rgba(0,0,0,0.05);
          padding-bottom: max(8px, env(safe-area-inset-bottom));
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        
        /* 📱 Solo mostrar en móviles y tablets */
        @media (max-width: 992px) {
          :host {
            display: block;
          }
        }
        
        .nav-container {
          display: flex;
          justify-content: space-around;
          align-items: center;
          height: 65px;
          max-width: 600px;
          margin: 0 auto;
          padding: 0 8px;
        }
        
        .nav-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-decoration: none;
          color: var(--gray);
          position: relative;
          padding: 8px 4px;
          border-radius: 12px;
          transition: all 0.3s ease;
          flex: 1;
          max-width: 80px;
          min-height: 50px;
        }
        
        .nav-item:hover {
          background: var(--light);
          transform: translateY(-2px);
        }
        
        .nav-item.active {
          color: var(--primary);
          background: rgba(74, 111, 165, 0.08);
        }
        
        .nav-icon {
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 4px;
          transition: all 0.3s ease;
        }
        
        .nav-item.active .nav-icon {
          transform: translateY(-2px) scale(1.1);
          color: var(--primary);
        }
        
        .nav-label {
          font-size: 9px;
          font-weight: 500;
          text-align: center;
          line-height: 1.2;
          letter-spacing: 0.3px;
          opacity: 0.9;
          max-width: 70px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        
        .nav-item.active .nav-label {
          font-weight: 600;
          opacity: 1;
        }
        
        /* 🔔 Badge de notificaciones */
        .nav-badge {
          position: absolute;
          top: 2px;
          right: 8px;
          background: var(--accent);
          color: var(--white);
          border-radius: 50%;
          width: 16px;
          height: 16px;
          font-size: 9px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          transform: scale(0);
          transition: transform 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
          border: 2px solid var(--white);
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .nav-badge.show {
          transform: scale(1);
        }
        
        /* ✨ Indicador activo */
        .nav-item.active::before {
          content: '';
          position: absolute;
          top: -1px;
          left: 50%;
          transform: translateX(-50%);
          width: 4px;
          height: 4px;
          background: var(--accent);
          border-radius: 50%;
          box-shadow: 0 0 8px var(--accent);
          animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
            transform: translateX(-50%) scale(1);
          }
          50% {
            opacity: 0.7;
            transform: translateX(-50%) scale(1.2);
          }
        }
        
        /* 🎨 Animación de entrada */
        @keyframes slideUp {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        
        :host {
          animation: slideUp 0.4s cubic-bezier(0.22, 1, 0.36, 1);
        }
        
        /* 📱 Responsive para móviles pequeños */
        @media (max-width: 480px) {
          .nav-container {
            height: 60px;
            padding: 0 4px;
          }
          
          .nav-label {
            font-size: 8px;
          }
          
          .nav-icon {
            width: 22px;
            height: 22px;
          }
          
          .nav-item {
            max-width: 70px;
            padding: 6px 2px;
          }
        }
        
        /* 🎯 Efecto de clic */
        .nav-item:active {
          transform: scale(0.95);
        }
        
        .nav-item:active .nav-icon {
          transform: scale(0.9);
        }
      </style>
      
      <!-- 📱 HTML DE LA BARRA DE NAVEGACIÓN -->
      <div class="nav-container">
        <!-- 1. Home -->
        <a href="/" class="nav-item" data-page="home">
          <div class="nav-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
          </div>
          <span class="nav-label">Home</span>
        </a>
        
        <!-- 2. Mis Actividades -->
        <a href="/profile/myactivities" class="nav-item" data-page="myactivities">
          <div class="nav-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
          </div>
          <span class="nav-label">Mis Actividades</span>
          <span class="nav-badge" id="myactivitiesBadge"></span>
        </a>
        
        <!-- 3. Take Action -->
        <a href="/takeaction" class="nav-item" data-page="takeaction">
          <div class="nav-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
            </svg>
          </div>
          <span class="nav-label">Take Action</span>
          <span class="nav-badge" id="takeactionBadge"></span>
        </a>
        
        <!-- 4. Mis Comunidades -->
        <a href="/teams" class="nav-item" data-page="teams">
          <div class="nav-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          </div>
          <span class="nav-label">Comunidades</span>
          <span class="nav-badge" id="teamsBadge"></span>
        </a>
        
        <!-- 5. Mi Perfil -->
        <a href="/profile" class="nav-item" data-page="profile">
          <div class="nav-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          </div>
          <span class="nav-label">Mi Perfil</span>
          <span class="nav-badge" id="profileBadge"></span>
        </a>
      </div>
    `;
    
    this.setupEventListeners();
    this.updateActiveItem();
  }
  
  setupEventListeners() {
    // 🔄 Actualizar item activo cuando cambia la URL
    window.addEventListener('popstate', () => {
      this.updateActiveItem();
    });
    
    // 🔄 También actualizar en navegación normal
    window.addEventListener('load', () => {
      this.updateActiveItem();
    });
    
    // 🎯 Efecto visual al hacer clic
    this.shadowRoot.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        // Efecto de clic inmediato
        const icon = item.querySelector('.nav-icon');
        icon.style.transform = 'translateY(-6px) scale(1.2)';
        
        // Restaurar después de la animación
        setTimeout(() => {
          this.updateActiveItem(); // Actualizar estado activo
        }, 150);
        
        setTimeout(() => {
          if (item.classList.contains('active')) {
            icon.style.transform = 'translateY(-2px) scale(1.1)';
          } else {
            icon.style.transform = '';
          }
        }, 300);
      });
    });
  }
  
  updateActiveItem() {
    const currentPath = window.location.pathname;
    let activePage = 'home';
    
    // 🎯 Determinar página actual con lógica mejorada
    if (currentPath === '/' || currentPath === '/home') {
      activePage = 'home';
    } else if (currentPath.includes('/profile/myactivities')) {
      activePage = 'myactivities';
    } else if (currentPath.includes('/takeaction') || 
               currentPath.includes('/causes') || 
               currentPath.includes('/tasks') || 
               currentPath.includes('/challenges') || 
               currentPath.includes('/volunteering')) {
      activePage = 'takeaction';
    } else if (currentPath.includes('/teams') || currentPath.includes('/communities')) {
      activePage = 'teams';
    } else if (currentPath.includes('/profile')) {
      activePage = 'profile';
    }
    
    // ✅ Actualizar items activos
    this.shadowRoot.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('active');
      if (item.dataset.page === activePage) {
        item.classList.add('active');
      }
    });
  }
  
  // 🔔 Método público para mostrar badges
  showBadge(item, count) {
    const badge = this.shadowRoot.getElementById(`${item}Badge`);
    if (badge) {
      badge.textContent = count;
      badge.classList.toggle('show', count > 0);
    }
  }
  
  // 🎯 Método público para actualizar activo manualmente
  updateActive() {
    this.updateActiveItem();
  }
  
  // 🎨 Método público para animar badge
  animateBadge(item) {
    const badge = this.shadowRoot.getElementById(`${item}Badge`);
    if (badge && badge.classList.contains('show')) {
      badge.style.animation = 'none';
      setTimeout(() => {
        badge.style.animation = 'pulse 0.6s ease-out';
      }, 10);
    }
  }
}

// 🚀 REGISTRAR EL COMPONENTE
if (!customElements.get('solidarity-bottom-nav')) {
  customElements.define('solidarity-bottom-nav', SolidarityBottomNav);
}

// 🔧 Funciones helper globales
window.updateBottomNav = function() {
  const nav = document.querySelector('solidarity-bottom-nav');
  if (nav) nav.updateActive();
};

window.setBottomNavBadge = function(item, count) {
  const nav = document.querySelector('solidarity-bottom-nav');
  if (nav) {
    nav.showBadge(item, count);
    if (count > 0) nav.animateBadge(item);
  }
};

// 📱 Auto-actualizar cuando cambia la página (para SPAs)
if (typeof window !== 'undefined') {
  let lastPath = window.location.pathname;
  setInterval(() => {
    if (window.location.pathname !== lastPath) {
      lastPath = window.location.pathname;
      window.updateBottomNav?.();
    }
  }, 1000);
}