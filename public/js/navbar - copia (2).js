document.addEventListener('DOMContentLoaded', async () => {
  // Autenticación (ajusta según tu lógica)
  const { data: { user } } = await supabase.auth.getUser();
  const authButtons = document.getElementById('auth-buttons');
  const userMenu = document.getElementById('user-menu');

  if (user) {
    const { data: perfil } = await supabase
      .from('profiles')
      .select('username, photo_url')
      .eq('id', user.id)
      .single();

    document.getElementById('user-avatar').src = perfil?.photo_url || '/img/default-user.png';
    document.getElementById('user-name').textContent = perfil?.username || user.email;
    authButtons.style.display = 'none';
    userMenu.style.display = 'flex';
  } else {
    authButtons.style.display = 'flex';
    userMenu.style.display = 'none';
  }

  // Logout
  const logoutBtn = document.getElementById('logout-btn-link');
  if (logoutBtn) {
    logoutBtn.onclick = async (e) => {
      e.preventDefault();
      await supabase.auth.signOut();
      window.location.reload();
    };
  }

  // Menú móvil hamburguesa
  const toggle = document.getElementById('mobile-menu-toggle');
  const navContainer = document.querySelector('.nav-links-container');

  if (toggle && navContainer) {
    toggle.addEventListener('click', () => {
      toggle.classList.toggle('active');
      navContainer.classList.toggle('active');
      document.body.classList.toggle('no-scroll');
    });
  }

  // Cerrar menú al hacer clic en un enlace
  document.querySelectorAll('.nav-links a').forEach(link => {
    link.addEventListener('click', () => {
      if (toggle && navContainer) {
        toggle.classList.remove('active');
        navContainer.classList.remove('active');
        document.body.classList.remove('no-scroll');
      }
    });
  });
});