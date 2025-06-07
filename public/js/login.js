document.getElementById('loginForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  const loginValue = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errorDiv = document.getElementById('loginError');
  errorDiv.style.display = 'none';

  let user = null;
  let error = null;

  if (loginValue.includes('@')) {
    // Login por email
    const res = await supabase.auth.signInWithPassword({ email: loginValue, password });
    user = res.data?.user;
    error = res.error;
  } else {
    // Login por username
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('username', loginValue)
      .maybeSingle();
    if (!profile) {
      errorDiv.textContent = 'Usuario no encontrado';
      errorDiv.style.display = 'block';
      return;
    }
    const res = await supabase.auth.signInWithPassword({ email: profile.email, password });
    user = res.data?.user;
    error = res.error;
  }

  if (error) {
    errorDiv.textContent = error.message || 'No se pudo iniciar sesión';
    errorDiv.style.display = 'block';
  } else {
    window.location.href = '/profile';
  }
});