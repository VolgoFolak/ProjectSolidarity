document.addEventListener('DOMContentLoaded', async () => {
<<<<<<< HEAD
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

    document.getElementById('user-avatar').src = perfil?.photo_url || '/img/default-avatar.jpg';
    document.getElementById('user-name').textContent = perfil?.username || user.email;
    authButtons.style.display = 'none';
    userMenu.style.display = 'flex';
  } else {
=======
  const authButtons = document.getElementById('auth-buttons');
  const userMenu = document.getElementById('user-menu');
  const userAvatar = document.getElementById('user-avatar');
  const userName = document.getElementById('user-name');

  try {
    const resp = await fetch('/api/check-session', { credentials: 'include' });
    if (resp.ok) {
      const user = await resp.json();
      userAvatar.src = user.photo_url || '/img/default-avatar.jpg';
      userName.textContent = user.username || user.email || 'Usuario';
      authButtons.style.display = 'none';
      userMenu.style.display = 'flex';
    } else {
      authButtons.style.display = 'flex';
      userMenu.style.display = 'none';
    }
  } catch (e) {
>>>>>>> 59461df1b33d25c65c9221b39256b8f9c62636c9
    authButtons.style.display = 'flex';
    userMenu.style.display = 'none';
  }

<<<<<<< HEAD
  // Usa el id correcto
=======
  // Logout
>>>>>>> 59461df1b33d25c65c9221b39256b8f9c62636c9
  const logoutBtn = document.getElementById('logout-btn-link');
  if (logoutBtn) {
    logoutBtn.onclick = async (e) => {
      e.preventDefault();
<<<<<<< HEAD
      await supabase.auth.signOut();
      window.location.reload();
=======
      await fetch('/logout', { method: 'POST', credentials: 'include' });
      window.location.href = '/';
>>>>>>> 59461df1b33d25c65c9221b39256b8f9c62636c9
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

// Esto se ejecuta al cargar la app
(async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    // Intenta un endpoint protegido para ver si tienes sesión backend
    const resp = await fetch('/api/check-session', { credentials: 'include' });
    if (resp.status === 401) {
      // No hay sesión backend, sincroniza
      await fetch('/login-supabase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token: session.access_token })
      });
      // Ahora ya tienes sesión backend
    }
  }
})();