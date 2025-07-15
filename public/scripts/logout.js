// logout.js - Código super sencillo
document.addEventListener('DOMContentLoaded', () => {
  const logoutBtn = document.getElementById('logout-btn');
  
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      const { error } = await supabase.auth.signOut();
      if (!error) {
        // Limpiar datos locales
        sessionStorage.removeItem('user');
        // Redirigir al home
        window.location.href = "/";
      } else {
        alert('Error al cerrar sesión: ' + error.message);
      }
    });
  }
});
