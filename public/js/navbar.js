document.addEventListener('DOMContentLoaded', async () => {
  // --- Autenticación y usuario ---
  const { data: { user } } = await supabase.auth.getUser();

  const updateAuthUI = (isLoggedIn, userData) => {
    const authContainers = document.querySelectorAll('#auth-buttons, #mobile-auth-buttons');
    const userMenus = document.querySelectorAll('#user-menu, #mobile-user-menu');

    authContainers.forEach(container => {
      container.style.display = isLoggedIn ? 'none' : 'flex';
    });

    userMenus.forEach(menu => {
      menu.style.display = isLoggedIn ? 'flex' : 'none';

      if (isLoggedIn && userData) {
        const avatar = menu.querySelector('.user-avatar');
        const name = menu.querySelector('.user-name');
        if (avatar) avatar.src = userData.photo_url || '/images/default-avatar.png';
        if (name) name.textContent = userData.username || userData.email;
      }
    });
  };

  if (user) {
    const { data: perfil } = await supabase
      .from('profiles')
      .select('username, photo_url')
      .eq('id', user.id)
      .single();

    updateAuthUI(true, {
      photo_url: (perfil && perfil.photo_url) ? perfil.photo_url : '/images/default-avatar.png',
      username: (perfil && perfil.username) ? perfil.username : user.email,
      email: user.email
    });
  } else {
    updateAuthUI(false);
  }

  // Logout para ambas versiones
  const logoutButtons = document.querySelectorAll('#logout-btn-link, #mobile-logout-btn-link');
  logoutButtons.forEach(button => {
    button.onclick = async (e) => {
      e.preventDefault();
      await supabase.auth.signOut();
      window.location.reload();
    };
  });

  // --- Menú hamburguesa y overlay SOLO para móvil ---
  const toggle = document.getElementById('mobile-menu-toggle');
  const navLinks = document.getElementById('mobile-nav-links');
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

  // --- Dropdowns móviles ---
  const dropdowns = navLinks ? navLinks.querySelectorAll('.dropdown') : [];
  dropdowns.forEach(dropdown => {
    const dropbtn = dropdown.querySelector('.dropbtn');
    if (dropbtn) {
      dropbtn.addEventListener('click', (e) => {
        if (window.innerWidth <= 991) {
          e.preventDefault();
          dropdown.classList.toggle('active');
        }
      });
    }
  });

  // --- Menú usuario móvil ---
  const mobileUserTrigger = document.getElementById('mobile-user-trigger');
  const mobileUserMenu = document.getElementById('mobile-user-menu');
  if (mobileUserTrigger && mobileUserMenu) {
    mobileUserTrigger.addEventListener('click', () => {
      if (window.innerWidth <= 991) {
        mobileUserMenu.classList.toggle('active');
      }
    });
  }

  // --- Menú usuario desktop ---
  const userTrigger = document.getElementById('user-trigger');
  const userMenu = document.getElementById('user-menu');
  if (userTrigger && userMenu) {
    userTrigger.addEventListener('click', () => {
      if (window.innerWidth > 991) {
        userMenu.classList.toggle('active');
      }
    });
  }
});