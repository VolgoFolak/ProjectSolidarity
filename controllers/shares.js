const { supabase } = require('../config/supabase');

/**
 * Registrar compartido y otorgar puntos
 */
exports.registerShare = async (req, res) => {
  try {
    const { activityId, activityType, platform } = req.body;
    
    // Obtener usuario autenticado
    const { data: { user }, error: authError } = await supabase.auth.getUser(req.headers.authorization?.replace('Bearer ', ''));
    
    if (authError || !user) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    // Validar datos
    const validTypes = ['cause', 'task', 'challenge', 'volunteering', 'team'];
    const validPlatforms = ['whatsapp', 'telegram', 'facebook', 'twitter', 'linkedin', 'email', 'copy'];
    
    if (!activityId || !activityType || !validTypes.includes(activityType)) {
      return res.status(400).json({ error: 'Datos inválidos' });
    }

    if (platform && !validPlatforms.includes(platform)) {
      return res.status(400).json({ error: 'Plataforma no válida' });
    }

    // Verificar que la actividad existe
    let activityExists = false;
    const tableMap = {
      'cause': 'causes',
      'task': 'tasks', 
      'challenge': 'challenges',
      'volunteering': 'volunteering',
      'team': 'teams'
    };

    const { data: activity, error: activityError } = await supabase
      .from(tableMap[activityType])
      .select('id')
      .eq('id', activityId)
      .single();

    if (activityError || !activity) {
      return res.status(404).json({ error: 'Actividad no encontrada' });
    }

    // Registrar el compartido (evitar duplicados con UPSERT)
    const { data: shareData, error: shareError } = await supabase
      .from('shares')
      .upsert({
        user_id: user.id,
        activity_id: activityId,
        activity_type: activityType,
        platform: platform || 'unknown',
        points_awarded: 5
      }, {
        onConflict: 'user_id,activity_id,activity_type,platform',
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (shareError) {
      // Si es error de duplicado, no dar puntos pero confirmar acción
      if (shareError.code === '23505') {
        return res.json({ 
          success: true, 
          points: 0, 
          message: 'Ya compartiste esta actividad en esta plataforma' 
        });
      }
      throw shareError;
    }

    // Actualizar puntos del usuario (+5 puntos por compartir)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('impact_points, weekly_points, actions_count')
      .eq('id', user.id)
      .single();

    if (profileError) {
      throw profileError;
    }

    const newImpactPoints = (profile.impact_points || 0) + 5;
    const newWeeklyPoints = (profile.weekly_points || 0) + 5;
    const newActionsCount = (profile.actions_count || 0) + 1;

    // Calcular nueva liga
    function getLeague(points) {
      if (points >= 5000) return 5; // Diamante
      if (points >= 3000) return 4; // Platino  
      if (points >= 2000) return 3; // Oro
      if (points >= 1000) return 2; // Plata
      return 1; // Bronce
    }

    const newLeague = getLeague(newImpactPoints);

    // Actualizar perfil del usuario
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        impact_points: newImpactPoints,
        weekly_points: newWeeklyPoints,
        actions_count: newActionsCount,
        current_league: newLeague,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (updateError) {
      throw updateError;
    }

    console.log(`✅ Compartido registrado: Usuario ${user.id} compartió ${activityType} ${activityId} en ${platform}`);

    res.json({
      success: true,
      points: 5,
      totalPoints: newImpactPoints,
      message: '¡Gracias por compartir! +5 puntos de impacto',
      shareId: shareData.id
    });

  } catch (error) {
    console.error('❌ Error registrando compartido:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Obtener estadísticas de compartidos del usuario
 */
exports.getUserShares = async (req, res) => {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser(req.headers.authorization?.replace('Bearer ', ''));
    
    if (authError || !user) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    // Contar compartidos por tipo
    const { data: shares, error: sharesError } = await supabase
      .from('shares')
      .select('activity_type, platform, points_awarded, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (sharesError) {
      throw sharesError;
    }

    // Estadísticas
    const totalShares = shares.length;
    const totalPointsFromShares = shares.reduce((sum, share) => sum + (share.points_awarded || 0), 0);
    
    const sharesByType = shares.reduce((acc, share) => {
      acc[share.activity_type] = (acc[share.activity_type] || 0) + 1;
      return acc;
    }, {});

    const sharesByPlatform = shares.reduce((acc, share) => {
      acc[share.platform] = (acc[share.platform] || 0) + 1;
      return acc;
    }, {});

    res.json({
      success: true,
      totalShares,
      totalPointsFromShares,
      sharesByType,
      sharesByPlatform,
      recentShares: shares.slice(0, 10) // Últimos 10 compartidos
    });

  } catch (error) {
    console.error('❌ Error obteniendo compartidos:', error);
    res.status(500).json({ error: error.message });
  }
};