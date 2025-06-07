document.addEventListener('DOMContentLoaded', () => {
  window.waitForSupabase(async (supabase) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const authButtons = document.getElementById('auth-buttons');
      const userMenu = document.getElementById('user-menu');
      
      if (user) {
        const { data: perfil } = await supabase
          .from('profiles')
          .select('username, photo_url')
          .eq('id', user.id)
          .single();

        document.getElementById('user-avatar').src = perfil?.photo_url || '/images/default-avatar.png';
        document.getElementById('user-name').textContent = perfil?.username || user.email;
        authButtons.style.display = 'none';
        userMenu.style.display = 'flex';
        
        document.getElementById('logout-btn').onclick = async () => {
          await supabase.auth.signOut();
          window.location.reload();
        };
      } else {
        authButtons.style.display = 'flex';
        userMenu.style.display = 'none';
      }
    } catch (error) {
      console.error("Error en navbar:", error);
    }
  });
});