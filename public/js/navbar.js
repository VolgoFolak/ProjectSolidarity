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