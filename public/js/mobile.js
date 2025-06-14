// mobile.js
document.addEventListener('DOMContentLoaded', function() {
  // Elementos del menú móvil
  const menuButton = document.querySelector('.mobile-menu-btn');
  const mobileMenu = document.getElementById('mobile-menu');
  const overlay = document.getElementById('mobile-menu-overlay');
  
  // Función para abrir/cerrar menú
  function toggleMenu() {
    const isActive = mobileMenu.classList.toggle('active');
    overlay.classList.toggle('active', isActive);
    document.body.classList.toggle('no-scroll', isActive);
  }
  
  // Evento del botón menú
  if (menuButton) {
    menuButton.addEventListener('click', toggleMenu);
  }
  
  // Evento del overlay
  if (overlay) {
    overlay.addEventListener('click', toggleMenu);
  }
  
  // Cerrar menú al hacer clic en enlaces
  document.querySelectorAll('#mobile-menu a').forEach(item => {
    item.addEventListener('click', toggleMenu);
  });
  
  // Cargar tarjetas dinámicas
  if (typeof loadActivities === 'function') {
    loadActivities();
  } else {
    console.log("loadActivities no está definido");
    // Cargar tarjetas por defecto si no hay función
    document.querySelectorAll('.activity-card').forEach(card => {
      card.style.display = 'block';
    });
  }
  
  // Optimizar tarjetas para touch
  document.querySelectorAll('.card, .activity-card').forEach(card => {
    card.addEventListener('click', function(e) {
      if (!e.target.matches('button, a, .btn')) {
        const link = this.querySelector('a');
        if (link) link.click();
      }
    });
  });
});