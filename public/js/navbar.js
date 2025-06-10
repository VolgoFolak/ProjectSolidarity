document.addEventListener('DOMContentLoaded', async () => {
  const { data: { user } } = await supabase.auth.getUser();
  const authButtons = document.getElementById('auth-buttons');
  const userMenu = document.getElementById('user-menu');
  if (user) {
    // Consulta el perfil del usuario
    const { data: perfil } = await supabase
      .from('profiles')
      .select('username, photo_url')
      .eq('id', user.id)
      .single();

    document.getElementById('user-avatar').src = perfil?.photo_url || '/images/default-avatar.png';
    document.getElementById('user-name').textContent = perfil?.username || user.email;
    authButtons.style.display = 'none';
    userMenu.style.display = 'flex';
  } else {
    authButtons.style.display = 'flex';
    userMenu.style.display = 'none';
  }

  // Usa el id correcto
  const logoutBtn = document.getElementById('logout-btn-link');
  if (logoutBtn) {
    logoutBtn.onclick = async (e) => {
      e.preventDefault();
      await supabase.auth.signOut();
      window.location.reload();
    };
  }
});

document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('mobile-menu-toggle');
  const navLinks = document.getElementById('nav-links');
  const overlay = document.getElementById('nav-overlay');
  if (toggle && navLinks && overlay) {
    toggle.addEventListener('click', () => {
      navLinks.classList.toggle('active');
      toggle.classList.toggle('active');
      overlay.classList.toggle('active');
      document.body.classList.toggle('no-scroll');
    });
    overlay.addEventListener('click', () => {
      navLinks.classList.remove('active');
      toggle.classList.remove('active');
      overlay.classList.remove('active');
      document.body.classList.remove('no-scroll');
    });
    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('active');
        toggle.classList.remove('active');
        overlay.classList.remove('active');
        document.body.classList.remove('no-scroll');
      });
    });
  }
});