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

// Suma puntos llamando al backend modular
async function addImpactPoints(action, amount = null, relatedId = null, metadata = null) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await fetch('/api/impact-points', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: user.id,
      action,
      amount,
      relatedId,
      metadata
    })
  });
}

// Ejemplo de uso para cada acción
async function onUserRegister() {
  await addImpactPoints('register');
}
async function onUserDailyLogin() {
  await addImpactPoints('daily_login');
  // Lógica para streak semanal
  const streak = await getLoginStreak();
  if (streak && streak % 7 === 0) {
    await addImpactPoints('weekly_streak');
  }
}
async function onCreateCause(causeId) {
  await addImpactPoints('create_cause', null, causeId);
}
async function onCreateTask(taskId) {
  await addImpactPoints('create_task', null, taskId);
}
async function onCreateChallenge(challengeId) {
  await addImpactPoints('create_challenge', null, challengeId);
}
async function onCreateVolunteering(volunteeringId) {
  await addImpactPoints('create_volunteering', null, volunteeringId);
}
async function onCreateTeam(teamId) {
  await addImpactPoints('create_team', null, teamId);
}
async function onJoinCause(causeId) {
  await addImpactPoints('join_cause', null, causeId);
}
async function onDonate(euros, causeId) {
  await addImpactPoints('donate', euros, causeId);
}
async function onShare(contentType, contentId) {
  await addImpactPoints('share_content', null, contentId, { contentType });
}
async function onMemberJoinsTeam(teamId, memberId) {
  await addImpactPoints('member_joins_team', null, teamId, { memberId });
}
async function onMemberJoinsCause(causeId, memberId) {
  await addImpactPoints('member_joins_cause', null, causeId, { memberId });
}
async function onCompleteTask(taskId) {
  await addImpactPoints('complete_task', null, taskId);
}
async function onCompleteChallenge(challengeId) {
  await addImpactPoints('complete_challenge', null, challengeId);
}
async function onProfileCompletion() {
  await addImpactPoints('profile_completion');
}
async function onProfileVerification() {
  await addImpactPoints('verified_profile');
}
async function getLoginStreak() {
  // Implementa esto en el backend si lo necesitas realmente
  return 7;
}