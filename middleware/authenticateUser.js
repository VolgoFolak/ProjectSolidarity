const { supabase } = require('../app');

module.exports = async function authenticateUser(req, res, next) {
  // 1. Verificar sesión local primero
  if (req.session && req.session.user) {
    // Verificar inactividad (30 minutos máximo)
    if (req.session.lastActivity && 
        (new Date() - new Date(req.session.lastActivity)) > 30 * 60 * 1000) {
      
      req.session.destroy((err) => {
        if (err) console.error('Error destroying inactive session:', err);
      });
      
      if (req.accepts('json')) {
        return res.status(401).json({ 
          error: 'Sesión expirada por inactividad',
          code: 'SESSION_EXPIRED'
        });
      }
      return res.redirect('/login?reason=inactive');
    }
    
    // Actualizar actividad y continuar
    req.session.lastActivity = new Date();
    req.user = req.session.user;
    return next();
  }

  // 2. Verificar token de Authorization header
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      const { data: { user }, error } = await supabase.auth.getUser(token);
      
      if (error || !user) throw new Error('Invalid token');

      // Obtener perfil completo
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, username, first_name, email, photo_url, user_type')
        .eq('id', user.id)
        .single();

      if (profileError || !profile) {
        throw new Error('Profile not found');
      }

      // Crear nueva sesión segura
      req.session.regenerate((err) => {
        if (err) throw err;

        req.session.user = {
          id: profile.id,
          name: profile.first_name,
          photo_url: profile.photo_url || '',
          username: profile.username,
          email: profile.email,
          type: profile.user_type || 'user'
        };
        req.session.lastActivity = new Date();

        req.session.save((saveErr) => {
          if (saveErr) {
            console.error('Error saving session:', saveErr);
            throw saveErr;
          }
          
          req.user = req.session.user;
          next();
        });
      });
      
    } catch (error) {
      console.error('Error en autenticación con token:', error);
      
      if (req.accepts('json')) {
        return res.status(401).json({ 
          error: 'Token inválido',
          code: 'INVALID_TOKEN'
        });
      }
      return res.redirect('/login?reason=invalid_token');
    }
  } else {
    // 3. No hay autenticación válida
    if (req.accepts('json')) {
      return res.status(401).json({ 
        error: 'No autorizado',
        code: 'NO_AUTH'
      });
    }
    res.redirect('/login?return=' + encodeURIComponent(req.originalUrl));
  }
}