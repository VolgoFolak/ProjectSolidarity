const IMPACT_POINTS = {
  register: 100,
  daily_login: 5,
  weekly_streak: 50,
  post_activity: 50,
  share: 5,
  per_euro_donated: 5
};

// Suma puntos al usuario llamando a tu backend
async function addImpactPoints(points, { weekly = false, communityId = null } = {}) {
  const user = await supabase.auth.getUser();
  await fetch('/api/impact-points', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: user.data.user.id,
      points,
      weekly,
      communityId
    })
  });
}

// Ejemplo de uso:
async function onUserRegister() {
  await addImpactPoints(IMPACT_POINTS.register);
}
async function onUserDailyLogin() {
  await addImpactPoints(IMPACT_POINTS.daily_login);
  // Aquí puedes añadir lógica para streak semanal
  const streak = await getLoginStreak();
  if (streak && streak % 7 === 0) {
    await addImpactPoints(IMPACT_POINTS.weekly_streak);
  }
}
async function onPostActivity() {
  await addImpactPoints(IMPACT_POINTS.post_activity);
}
async function onJoinActivity(activityPoints) {
  await addImpactPoints(activityPoints);
}
async function onDonate(euros) {
  const points = euros * IMPACT_POINTS.per_euro_donated;
  await addImpactPoints(points);
}
async function onShare() {
  await addImpactPoints(IMPACT_POINTS.share);
}
async function getLoginStreak() {
  // Implementa esto en el backend si lo necesitas realmente
  return 7;
}