document.addEventListener('DOMContentLoaded', async () => {
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
    authButtons.style.display = 'flex';
    userMenu.style.display = 'none';
  }

  // Logout
  const logoutBtn = document.getElementById('logout-btn-link');
  if (logoutBtn) {
    logoutBtn.onclick = async (e) => {
      e.preventDefault();
      await fetch('/logout', { method: 'POST', credentials: 'include' });
      window.location.href = '/';
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