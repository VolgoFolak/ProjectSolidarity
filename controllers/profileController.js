const { supabase } = require('../app'); // O mejor: require('../config/supabase')

// Mostrar perfil público de un usuario
exports.showPublicProfile = async (req, res) => {
  try {
    const { identifier } = req.params; // Puede ser username o ID
    
    // Buscar usuario por username o ID
    let { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .or(`username.eq.${identifier},id.eq.${identifier}`)
      .single();

    if (error || !profile) {
      return res.status(404).render('errors/404', {
        title: 'Usuario no encontrado',
        message: 'El perfil que buscas no existe o ha sido eliminado.'
      });
    }

    // Obtener estadísticas del usuario
    const [
      { data: causeMembers },
      { data: taskMemberships },
      { data: challengeMemberships },
      { data: volunteeringMemberships },
      { data: teamMembers },
      { data: sharesData }
    ] = await Promise.all([
      supabase.from('causes_members').select('cause_id').eq('user_id', profile.id),
      supabase.from('task_members').select('task_id, role, status').eq('user_id', profile.id),
      supabase.from('challenges_members').select('challenge_id, role, status').eq('user_id', profile.id),
      supabase.from('volunteering_members').select('volunteering_id, role, status').eq('user_id', profile.id),
      supabase.from('team_members').select('team_id').eq('user_id', profile.id),
      supabase.from('shares').select('points_awarded').eq('user_id', profile.id)
    ]);

    // Obtener datos de actividades
    const causeIds = (causeMembers || []).map(m => m.cause_id);
    const taskIds = (taskMemberships || []).map(m => m.task_id);
    const challengeIds = (challengeMemberships || []).map(m => m.challenge_id);
    const volunteeringIds = (volunteeringMemberships || []).map(m => m.volunteering_id);
    const teamIds = (teamMembers || []).map(m => m.team_id);

    const [
      { data: causes },
      { data: tasks },
      { data: challenges },
      { data: volunteerings },
      { data: teams }
    ] = await Promise.all([
      causeIds.length > 0 ? supabase.from('causes').select('*').in('id', causeIds) : { data: [] },
      taskIds.length > 0 ? supabase.from('tasks').select('*').in('id', taskIds) : { data: [] },
      challengeIds.length > 0 ? supabase.from('challenges').select('*').in('id', challengeIds) : { data: [] },
      volunteeringIds.length > 0 ? supabase.from('volunteering').select('*').in('id', volunteeringIds) : { data: [] },
      teamIds.length > 0 ? supabase.from('teams').select('*').in('id', teamIds) : { data: [] }
    ]);

    // Calcular estadísticas
    const stats = {
      causes: causes?.length || 0,
      tasks: tasks?.length || 0,
      challenges: challenges?.length || 0,
      volunteerings: volunteerings?.length || 0,
      teams: teams?.length || 0,
      shares: sharesData?.length || 0,
      impactedPeople: (causes || []).reduce((sum, c) => sum + (c.beneficiaries || 0), 0),
      donated: (causes || []).reduce((sum, c) => sum + (c.raised || 0), 0)
    };

    // Verificar si es el propio perfil del usuario
    const { data: { user } } = await supabase.auth.getUser();
    const isOwnProfile = user && user.id === profile.id;

    res.render('profile/public', {
      title: `${profile.first_name || ''} ${profile.last_name || ''} - Solidarity`,
      profile,
      stats,
      activities: {
        causes: causes || [],
        tasks: tasks || [],
        challenges: challenges || [],
        volunteerings: volunteerings || [],
        teams: teams || []
      },
      isOwnProfile,
      user: user || null
    });

  } catch (error) {
    console.error('Error loading public profile:', error);
    res.status(500).render('errors/500', {
      title: 'Error del servidor',
      message: 'Ha ocurrido un error al cargar el perfil.'
    });
  }
};