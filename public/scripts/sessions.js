document.addEventListener('DOMContentLoaded', async () => {
  const { data: { user } } = await supabase.auth.getUser();

  // Redirige si la página requiere autenticación y el usuario NO está logueado
  const publicPaths = ["/", "/login", "/register"];
  if (!user && !publicPaths.includes(window.location.pathname)) {
    window.location.href = "/";
  }

  // Guarda datos útiles en sessionStorage si quieres usarlos en otras páginas
  if (user) {
    sessionStorage.setItem('user', JSON.stringify({
      id: user.id,
      email: user.email,
      name: user.user_metadata?.name,
      avatar: user.user_metadata?.avatar_url
    }));
  } else {
    sessionStorage.removeItem('user');
  }
});