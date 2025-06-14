// mobile.js
document.addEventListener('DOMContentLoaded', function() {
  // Toggle del menú móvil
  const menuButton = document.querySelector('.mobile-menu-btn');
  const mobileMenu = document.getElementById('mobile-menu');
  const overlay = document.querySelector('.mobile-menu-overlay');
  
  if (menuButton) {
    menuButton.addEventListener('click', function() {
      mobileMenu.classList.toggle('active');
      overlay.classList.toggle('active');
      document.body.classList.toggle('no-scroll');
    });
  }

  // Cerrar menú al hacer clic en overlay
  if (overlay) {
    overlay.addEventListener('click', function() {
      mobileMenu.classList.remove('active');
      overlay.classList.remove('active');
      document.body.classList.remove('no-scroll');
    });
  }

  // Cerrar menú al seleccionar item
  document.querySelectorAll('.mobile-menu a').forEach(item => {
    item.addEventListener('click', () => {
      mobileMenu.classList.remove('active');
      overlay.classList.remove('active');
      document.body.classList.remove('no-scroll');
    });
  });
});

/* mobile.css */
@media (max-width: 768px) {
  /* Ocultar elementos desktop */
  .desktop-only {
    display: none !important;
  }
  
  /* Mostrar elementos móvil */
  .mobile-only {
    display: block !important;
  }
  
  /* Ajustes específicos para móvil */
  .navbar {
    padding: 0 15px !important;
    height: 60px;
  }
  
  .mobile-menu-btn {
    display: block !important;
    font-size: 1.8rem;
    background: none;
    border: none;
    color: var(--primary);
    margin-right: 15px;
  }
  
  .bottom-nav {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
    background: white;
    box-shadow: 0 -2px 10px rgba(0,0,0,0.1);
    z-index: 1000;
    padding: 8px 0;
  }

  /* ... resto de estilos móvil ... */
}

@media (min-width: 769px) {
  /* Ocultar elementos móvil en desktop */
  .mobile-only {
    display: none !important;
  }
  
  /* Mostrar elementos desktop */
  .desktop-only {
    display: flex !important; /* Mantener flex en desktop */
  }
}