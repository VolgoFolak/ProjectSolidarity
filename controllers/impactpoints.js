const { supabase } = require('../app');
const cron = require('node-cron');

// Configuración de puntos
const IMPACT_POINTS = {
  register: 100,
  daily_login: 5,
  weekly_streak: 50,
  create_cause: 100,
  create_task: 75,
  create_challenge: 75,
  create_volunteering: 75,
  create_team: 50,
  join_cause: 25,
  join_task: 20,
  join_challenge: 20,
  join_volunteering: 20,
  join_team: 15,
  per_euro_donated: 10,
  receive_donation: 5,
  share_content: 10,
  member_joins_team: 20,
  member_joins_cause: 15,
  complete_task: 30,
  complete_challenge: 40,
  first_cause: 50,
  first_donation: 25,
  verified_profile: 30,
  profile_completion: 20
};

// Configuración de ligas y promoción/descenso
const LEAGUES = [
  { name: "Bronce", level: 1, icon: "fas fa-seedling", color: "#cd7f32", min_points: 0 },
  { name: "Plata", level: 2, icon: "fas fa-star", color: "#c0c0c0", min_points: 1000 },
  { name: "Oro", level: 3, icon: "fas fa-award", color: "#ffd700", min_points: 2000 },
  { name: "Platino", level: 4, icon: "fas fa-gem", color: "#e5e7eb", min_points: 3000 },
  { name: "Diamante", level: 5, icon: "fas fa-crown", color: "#00c3ff", min_points: 5000 }
];

// Función para determinar liga por puntos totales
function getLeague(points) {
  for (let i = LEAGUES.length - 1; i >= 0; i--) {
    if (points >= LEAGUES[i].min_points) {
      return LEAGUES[i];
    }
  }
  return LEAGUES[0]; // Bronce por defecto
}

// Función para determinar liga por nivel
function getLeagueByLevel(level) {
  return LEAGUES.find(league => league.level === level) || LEAGUES[0];
}

// Cron job para reset semanal (domingos a las 23:59)
cron.schedule('59 23 * * 0', async () => {
  console.log('🔄 Iniciando reset semanal de puntos y clasificaciones...');
  await processWeeklyReset();
});

// Función principal de reset semanal
async function processWeeklyReset() {
  try {
    console.log('📊 Procesando clasificaciones semanales...');

    // Obtener todas las ligas con usuarios activos
    for (let leagueLevel = 1; leagueLevel <= 5; leagueLevel++) {
      await processLeagueWeeklyReset(leagueLevel);
    }

    // Reset de puntos semanales para todos los usuarios
    const { error: resetError } = await supabase
      .from('profiles')
      .update({
        weekly_points: 0,
        updated_at: new Date().toISOString()
      })
      .gt('weekly_points', 0);

    if (resetError) {
      console.error('❌ Error reseteando puntos semanales:', resetError);
    } else {
      console.log('✅ Puntos semanales reseteados');
    }

    // Registrar evento de reset
    await supabase
      .from('system_events')
      .insert({
        event_type: 'weekly_reset',
        data: { timestamp: new Date().toISOString() },
        created_at: new Date().toISOString()
      });

    console.log('🏆 Reset semanal completado exitosamente');

  } catch (error) {
    console.error('❌ Error en reset semanal:', error);
  }
}

// Procesar reset para una liga específica
async function processLeagueWeeklyReset(leagueLevel) {
  try {
    const league = getLeagueByLevel(leagueLevel);
    const nextLeague = getLeagueByLevel(leagueLevel + 1);
    const prevLeague = getLeagueByLevel(leagueLevel - 1);

    console.log(`📈 Procesando Liga ${league.name} (Nivel ${leagueLevel})`);

    // Obtener usuarios de esta liga ordenados por puntos semanales
    const { data: users, error } = await supabase
      .from('profiles')
      .select('id, username, weekly_points, current_league, impact_points')
      .eq('current_league', leagueLevel)
      .gt('weekly_points', 0) // Solo usuarios activos esta semana
      .order('weekly_points', { ascending: false });

    if (error || !users || users.length === 0) {
      console.log(`⚠️ No hay usuarios activos en Liga ${league.name}`);
      return;
    }

    console.log(`👥 ${users.length} usuarios activos en Liga ${league.name}`);

    // Determinar ascensos y descensos
    const promotions = [];
    const relegations = [];

    // Ascensos: 2 primeros (si hay liga superior)
    if (nextLeague && users.length >= 3) {
      promotions.push(...users.slice(0, 2));
    }

    // Descensos: 2 últimos (si hay liga inferior y suficientes usuarios)
    if (prevLeague && users.length >= 5) {
      relegations.push(...users.slice(-2));
    }

    // Procesar ascensos
    for (const user of promotions) {
      await promoteUser(user, nextLeague);
    }

    // Procesar descensos
    for (const user of relegations) {
      await relegateUser(user, prevLeague);
    }

    // Registrar clasificación de la semana
    await supabase
      .from('weekly_rankings')
      .insert({
        league_level: leagueLevel,
        week_ending: new Date().toISOString(),
        rankings: users.map((user, index) => ({
          user_id: user.id,
          position: index + 1,
          weekly_points: user.weekly_points,
          promoted: promotions.includes(user),
          relegated: relegations.includes(user)
        })),
        created_at: new Date().toISOString()
      });

  } catch (error) {
    console.error(`❌ Error procesando Liga ${leagueLevel}:`, error);
  }
}

// Promover usuario a liga superior
async function promoteUser(user, targetLeague) {
  try {
    console.log(`⬆️ Promoviendo ${user.username} a Liga ${targetLeague.name}`);

    const { error } = await supabase
      .from('profiles')
      .update({
        current_league: targetLeague.level,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (error) throw error;

    // Registrar promoción en actividades
    await supabase
      .from('user_activities')
      .insert({
        user_id: user.id,
        action: 'weekly_promotion',
        points: 0,
        description: `Promovido a Liga ${targetLeague.name} por clasificación semanal`,
        metadata: {
          from_league: user.current_league,
          to_league: targetLeague.level,
          weekly_points: user.weekly_points
        },
        created_at: new Date().toISOString()
      });

    // Enviar notificación
    await sendPromotionNotification(user, targetLeague);

  } catch (error) {
    console.error(`❌ Error promoviendo usuario ${user.id}:`, error);
  }
}

// Relegar usuario a liga inferior
async function relegateUser(user, targetLeague) {
  try {
    console.log(`⬇️ Relegando ${user.username} a Liga ${targetLeague.name}`);

    const { error } = await supabase
      .from('profiles')
      .update({
        current_league: targetLeague.level,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (error) throw error;

    // Registrar relegación en actividades
    await supabase
      .from('user_activities')
      .insert({
        user_id: user.id,
        action: 'weekly_relegation',
        points: 0,
        description: `Relegado a Liga ${targetLeague.name} por clasificación semanal`,
        metadata: {
          from_league: user.current_league,
          to_league: targetLeague.level,
          weekly_points: user.weekly_points
        },
        created_at: new Date().toISOString()
      });

    // Enviar notificación
    await sendRelegationNotification(user, targetLeague);

  } catch (error) {
    console.error(`❌ Error relegando usuario ${user.id}:`, error);
  }
}

// Enviar notificación de promoción
async function sendPromotionNotification(user, newLeague) {
  try {
    await supabase
      .from('notifications')
      .insert({
        user_id: user.id,
        type: 'weekly_promotion',
        title: '🎉 ¡Promoción Semanal!',
        message: `¡Felicidades! Has sido promovido a la Liga ${newLeague.name} por tu excelente rendimiento esta semana.`,
        data: {
          new_league: newLeague.name,
          new_level: newLeague.level,
          weekly_points: user.weekly_points
        },
        created_at: new Date().toISOString()
      });
  } catch (error) {
    console.error('Error enviando notificación de promoción:', error);
  }
}

// Enviar notificación de relegación
async function sendRelegationNotification(user, newLeague) {
  try {
    await supabase
      .from('notifications')
      .insert({
        user_id: user.id,
        type: 'weekly_relegation',
        title: '📉 Relegación Semanal',
        message: `Has descendido a la Liga ${newLeague.name}. ¡La próxima semana puedes volver a ascender!`,
        data: {
          new_league: newLeague.name,
          new_level: newLeague.level,
          weekly_points: user.weekly_points
        },
        created_at: new Date().toISOString()
      });
  } catch (error) {
    console.error('Error enviando notificación de relegación:', error);
  }
}

// Añadir puntos de impacto (función existente mejorada)
exports.addImpactPoints = async (req, res) => {
  try {
    console.log('🎯 Añadiendo puntos de impacto:', req.body);
    
    const { userId, action, amount, relatedId, metadata } = req.body;
    
    if (!userId || !action) {
      return res.status(400).json({ error: 'userId y action son requeridos' });
    }

    // Verificar que el usuario existe
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('id, impact_points, weekly_points, actions_count, current_league')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      console.error('❌ Usuario no encontrado:', userError);
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Calcular puntos según la acción (lógica existente)
    let points = 0;
    let description = '';
    
    switch (action) {
      case 'register':
        points = IMPACT_POINTS.register;
        description = 'Registro en la plataforma';
        break;
        
      case 'daily_login':
        // Verificar que no haya hecho login hoy
        const today = new Date().toISOString().split('T')[0];
        const { data: todayLogin } = await supabase
          .from('user_activities')
          .select('id')
          .eq('user_id', userId)
          .eq('action', 'daily_login')
          .gte('created_at', today + 'T00:00:00.000Z')
          .limit(1);
        
        if (todayLogin && todayLogin.length > 0) {
          return res.json({ success: true, points: 0, message: 'Ya has recibido puntos por login hoy' });
        }
        
        points = IMPACT_POINTS.daily_login;
        description = 'Login diario';
        break;
        
      case 'weekly_streak':
        points = IMPACT_POINTS.weekly_streak;
        description = 'Racha semanal de login';
        break;
        
      case 'create_cause':
        points = IMPACT_POINTS.create_cause;
        // Bonus por primera causa
        const { data: userCauses } = await supabase
          .from('causes')
          .select('id')
          .eq('user_id', userId);
        
        if (userCauses && userCauses.length === 1) {
          points += IMPACT_POINTS.first_cause;
          description = 'Primera causa creada (bonus incluido)';
        } else {
          description = 'Causa creada';
        }
        break;
        
      case 'create_task':
        points = IMPACT_POINTS.create_task;
        description = 'Tarea creada';
        break;
        
      case 'create_challenge':
        points = IMPACT_POINTS.create_challenge;
        description = 'Reto creado';
        break;
        
      case 'create_volunteering':
        points = IMPACT_POINTS.create_volunteering;
        description = 'Voluntariado creado';
        break;
        
      case 'create_team':
        points = IMPACT_POINTS.create_team;
        description = 'Equipo creado';
        break;
        
      case 'join_cause':
      case 'join_task':
      case 'join_challenge':
      case 'join_volunteering':
      case 'join_team':
        points = IMPACT_POINTS[action];
        description = `Participación en ${action.split('_')[1]}`;
        break;
        
      case 'donate':
        points = Math.round((amount || 0) * IMPACT_POINTS.per_euro_donated);
        description = `Donación de €${amount}`;
        
        // Bonus por primera donación
        const { data: userDonations } = await supabase
          .from('donations')
          .select('id')
          .eq('user_id', userId);
        
        if (userDonations && userDonations.length === 1) {
          points += IMPACT_POINTS.first_donation;
          description += ' (primera donación, bonus incluido)';
        }
        break;
        
      case 'receive_donation':
        points = Math.round((amount || 0) * IMPACT_POINTS.receive_donation);
        description = `Donación recibida de €${amount}`;
        break;
        
      case 'share_content':
        points = IMPACT_POINTS.share_content;
        description = 'Contenido compartido';
        break;
        
      case 'member_joins_team':
        points = IMPACT_POINTS.member_joins_team;
        description = 'Nuevo miembro en tu equipo';
        break;
        
      case 'member_joins_cause':
        points = IMPACT_POINTS.member_joins_cause;
        description = 'Nuevo apoyo a tu causa';
        break;
        
      case 'complete_task':
        points = IMPACT_POINTS.complete_task;
        description = 'Tarea completada';
        break;
        
      case 'complete_challenge':
        points = IMPACT_POINTS.complete_challenge;
        description = 'Reto completado';
        break;
        
      case 'profile_completion':
        points = IMPACT_POINTS.profile_completion;
        description = 'Perfil completado';
        break;
        
      case 'verified_profile':
        points = IMPACT_POINTS.verified_profile;
        description = 'Perfil verificado';
        break;
        
      default:
        return res.status(400).json({ error: 'Acción no reconocida' });
    }

    if (points <= 0) {
      return res.json({ success: true, points: 0, message: 'No se otorgaron puntos' });
    }

    // Actualizar puntos del usuario
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        impact_points: user.impact_points + points,
        weekly_points: user.weekly_points + points,
        actions_count: user.actions_count + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (updateError) {
      console.error('❌ Error actualizando puntos:', updateError);
      throw updateError;
    }

    // Registrar la actividad
    await supabase
      .from('user_activities')
      .insert({
        user_id: userId,
        action,
        points,
        description,
        related_id: relatedId,
        metadata,
        created_at: new Date().toISOString()
      });

    // Verificar si subió de liga por puntos totales
    const newTotal = user.impact_points + points;
    const oldLeague = getLeague(user.impact_points);
    const newLeague = getLeague(newTotal);
    
    let leagueUp = false;
    if (newLeague.level > oldLeague.level) {
      leagueUp = true;
      
      // Actualizar liga actual
      await supabase
        .from('profiles')
        .update({ current_league: newLeague.level })
        .eq('id', userId);
      
      // Registrar subida de liga
      await supabase
        .from('user_activities')
        .insert({
          user_id: userId,
          action: 'league_promotion',
          points: 0,
          description: `Ascendido a Liga ${newLeague.name} por puntos totales`,
          created_at: new Date().toISOString()
        });
    }

    console.log('✅ Puntos añadidos exitosamente:', points);

    res.json({
      success: true,
      points,
      description,
      newTotal,
      leagueUp,
      newLeague: leagueUp ? newLeague : null,
      currentWeeklyPoints: user.weekly_points + points
    });

  } catch (error) {
    console.error('❌ Error en sistema de puntos:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Obtener estadísticas de impacto de un usuario
exports.getImpactStats = async (req, res) => {
  try {
    const { userId } = req.params;

    const { data: user, error } = await supabase
      .from('profiles')
      .select('impact_points, weekly_points, actions_count, current_league, created_at')
      .eq('id', userId)
      .single();

    if (error || !user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Actividades recientes
    const { data: recentActivities } = await supabase
      .from('user_activities')
      .select('action, points, description, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    const league = getLeague(user.impact_points);
    const currentLeague = getLeagueByLevel(user.current_league || league.level);
    const nextLeague = getLeagueByLevel((user.current_league || league.level) + 1);

    // Ranking semanal en su liga actual
    const { data: weeklyRanking } = await supabase
      .from('profiles')
      .select('id, weekly_points')
      .eq('current_league', user.current_league || league.level)
      .order('weekly_points', { ascending: false });

    const userWeeklyPosition = weeklyRanking?.findIndex(u => u.id === userId) + 1 || 0;

    res.json({
      user: {
        impact_points: user.impact_points,
        weekly_points: user.weekly_points,
        actions_count: user.actions_count,
        member_since: user.created_at,
        weekly_position: userWeeklyPosition,
        weekly_total_users: weeklyRanking?.length || 0
      },
      league,
      currentLeague,
      nextLeague,
      recentActivities: recentActivities || [],
      weeklyCompetitors: weeklyRanking?.slice(0, 10) || []
    });

  } catch (error) {
    console.error('❌ Error obteniendo estadísticas:', error);
    res.status(500).json({ error: error.message });
  }
};

// Obtener clasificación semanal por liga
exports.getWeeklyRanking = async (req, res) => {
  try {
    const { leagueLevel } = req.params;
    const level = parseInt(leagueLevel) || 1;

    const { data: users, error } = await supabase
      .from('profiles')
      .select('id, username, weekly_points, photo_url')
      .eq('current_league', level)
      .order('weekly_points', { ascending: false })
      .limit(50);

    if (error) throw error;

    const league = getLeagueByLevel(level);

    res.json({
      league,
      users: users || [],
      promotion_zone: users?.slice(0, 2) || [],
      relegation_zone: users?.slice(-2) || [],
      reset_info: {
        next_reset: getNextSundayNight(),
        current_week: getCurrentWeekNumber()
      }
    });

  } catch (error) {
    console.error('❌ Error obteniendo ranking semanal:', error);
    res.status(500).json({ error: error.message });
  }
};

// Funciones auxiliares
function getNextSundayNight() {
  const now = new Date();
  const daysUntilSunday = (7 - now.getDay()) % 7;
  const nextSunday = new Date(now);
  nextSunday.setDate(now.getDate() + daysUntilSunday);
  nextSunday.setHours(23, 59, 0, 0);
  return nextSunday.toISOString();
}

function getCurrentWeekNumber() {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const pastDaysOfYear = (now - startOfYear) / 86400000;
  return Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7);
}

// Calcular puntos históricos para usuarios existentes (función existente)
exports.calculateHistoricPoints = async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId requerido' });
    }

    console.log('🔄 Calculando puntos históricos para usuario:', userId);
    let totalPoints = 0;
    let activities = [];

    // Puntos por causas creadas
    const { data: causes } = await supabase
      .from('causes')
      .select('id, created_at')
      .eq('user_id', userId);

    if (causes && causes.length > 0) {
      const causesPoints = causes.length * IMPACT_POINTS.create_cause;
      totalPoints += causesPoints;
      // Bonus por primera causa
      totalPoints += IMPACT_POINTS.first_cause;
      activities.push(`${causes.length} causas creadas: +${causesPoints + IMPACT_POINTS.first_cause} pts`);
    }

    // Puntos por donaciones realizadas
    const { data: donations } = await supabase
      .from('donations')
      .select('amount')
      .eq('user_id', userId);

    if (donations && donations.length > 0) {
      const totalDonated = donations.reduce((sum, d) => sum + (d.amount || 0), 0);
      const donationPoints = Math.round(totalDonated * IMPACT_POINTS.per_euro_donated);
      totalPoints += donationPoints;
      // Bonus por primera donación
      totalPoints += IMPACT_POINTS.first_donation;
      activities.push(`€${totalDonated} donados: +${donationPoints + IMPACT_POINTS.first_donation} pts`);
    }

    const league = getLeague(totalPoints);

    // Actualizar puntos Y liga actual del usuario
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        impact_points: totalPoints,
        weekly_points: Math.min(totalPoints, 500),
        actions_count: activities.length,
        current_league: league.level, // ← AÑADIR ESTA LÍNEA
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (updateError) {
      throw updateError;
    }

    console.log('✅ Puntos y liga calculados:', totalPoints, 'Liga:', league.name);

    res.json({
      success: true,
      totalPoints,
      activities,
      league
    });

  } catch (error) {
    console.error('❌ Error calculando puntos históricos:', error);
    res.status(500).json({ error: error.message });
  }
};

// Forzar reset semanal manualmente (para testing)
exports.forceWeeklyReset = async (req, res) => {
  try {
    console.log('🔧 Forzando reset semanal manual...');
    await processWeeklyReset();
    res.json({ success: true, message: 'Reset semanal ejecutado manualmente' });
  } catch (error) {
    console.error('❌ Error en reset manual:', error);
    res.status(500).json({ error: error.message });
  }
};