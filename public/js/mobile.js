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