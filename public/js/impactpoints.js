const IMPACT_POINTS = {
  register: 100,
  daily_login: 5,
  weekly_streak: 50,
  post_activity: 50, // causa, tarea, reto, voluntariado
  share: 5,
  per_euro_donated: 5
};

// Suma puntos al usuario
async function addImpactPoints(userId, points) {
  if (!userId || !points) return;
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('impact_points, weekly_points')
    .eq('id', userId)
    .single();
  if (error || !profile) return;
  const newImpactPoints = (profile.impact_points || 0) + points;
  const newWeeklyPoints = (profile.weekly_points || 0) + points;
  await supabase
    .from('profiles')
    .update({
      impact_points: newImpactPoints,
      weekly_points: newWeeklyPoints
    })
    .eq('id', userId);
}

// 1. Al registrarse
async function onUserRegister(userId) {
  await addImpactPoints(userId, IMPACT_POINTS.register);
}

// 2. Al hacer login diario
async function onUserDailyLogin(userId) {
  await addImpactPoints(userId, IMPACT_POINTS.daily_login);
  // Aquí puedes añadir lógica para streak semanal
  // Ejemplo: si es el 7º día seguido, suma bonus
  const streak = await getLoginStreak(userId);
  if (streak && streak % 7 === 0) {
    await addImpactPoints(userId, IMPACT_POINTS.weekly_streak);
  }
}

// 3. Al publicar causa, tarea, reto o voluntariado
async function onPostActivity(userId) {
  await addImpactPoints(userId, IMPACT_POINTS.post_activity);
}

// 4. Al unirse a una actividad (puntos variables)
async function onJoinActivity(userId, activityPoints) {
  await addImpactPoints(userId, activityPoints);
}

// 5. Por cada euro donado
async function onDonate(userId, euros) {
  const points = euros * IMPACT_POINTS.per_euro_donated;
  await addImpactPoints(userId, points);
}

// 6. Por compartir en redes
async function onShare(userId) {
  await addImpactPoints(userId, IMPACT_POINTS.share);
}

// Ejemplo de función para obtener el streak de login semanal (debes implementarla según tu lógica)
async function getLoginStreak(userId) {
  // Aquí deberías consultar una tabla de logins diarios y calcular el streak
  // Por ahora, devuelve 7 para simular un bonus semanal
  return 7;
}