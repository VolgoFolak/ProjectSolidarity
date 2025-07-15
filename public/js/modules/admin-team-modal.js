export function initAdminTeamModal({ supabase }) {
  let currentAdminTeam = null;

  // --- Abrir el modal de administración ---
  window.openAdminTeamModal = async function(team) {
    currentAdminTeam = team;
    // Título
    document.getElementById('adminModalTitle').textContent = `Administrar ${team.name}`;
    document.getElementById('adminModal').classList.add('active');
    document.body.style.overflow = 'hidden';

    // Resetear tabs
    document.querySelectorAll('.admin-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.admin-tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelector('.admin-tab[data-tab="overview"]').classList.add('active');
    document.getElementById('overviewTab').classList.add('active');

    // Cargar datos resumen
    await loadTeamStats(team);

    // Cargar configuración
    fillSettingsForm(team);

    // Cargar miembros
    await loadTeamMembers(team.id);

    // Cargar actividades recientes
    await loadRecentActivities(team.id);

    // Limpiar mensaje
    document.getElementById('teamMessage').value = team.message || '';
  };

  // --- Cerrar modal ---
  document.getElementById('closeAdminModal').onclick = function() {
    document.getElementById('adminModal').classList.remove('active');
    document.body.style.overflow = '';
  };
  document.getElementById('adminModal').onclick = function(e) {
    if (e.target === this) {
      document.getElementById('adminModal').classList.remove('active');
      document.body.style.overflow = '';
    }
  };

  // --- Tabs ---
  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.onclick = function() {
      document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
      this.classList.add('active');
      const tabId = this.getAttribute('data-tab');
      document.getElementById(tabId + 'Tab').classList.add('active');
      if (tabId === 'members' && currentAdminTeam) loadTeamMembers(currentAdminTeam.id);
      if (tabId === 'content' && currentAdminTeam) loadRecentActivities(currentAdminTeam.id);
    };
  });

  // --- Formulario de configuración ---
  function fillSettingsForm(team) {
    document.getElementById('editTeamName').value = team.name || '';
    document.getElementById('editTeamDesc').value = team.description || '';
    document.getElementById('editTeamCategory').value = team.category || 'otros';
    document.getElementById('editTeamPrivacy').value = team.privacy || 'public';
    document.getElementById('editTeamTags').value = (team.tags || []).join(', ');
    document.getElementById('editTeamGoal').value = team.goal || '';
    if (team.photo) {
      document.getElementById('editTeamPhotoPreview').src = team.photo;
      document.getElementById('editTeamPhotoPreview').style.display = 'block';
    } else {
      document.getElementById('editTeamPhotoPreview').style.display = 'none';
    }
  }

  // Preview de imagen
  document.getElementById('editTeamPhoto').addEventListener('change', function(e) {
    const file = e.target.files[0];
    const preview = document.getElementById('editTeamPhotoPreview');
    if (file) {
      const reader = new FileReader();
      reader.onload = function(evt) {
        preview.src = evt.target.result;
        preview.style.display = 'block';
      };
      reader.readAsDataURL(file);
    } else {
      preview.src = '';
      preview.style.display = 'none';
    }
  });

  // Guardar cambios de configuración
  document.getElementById('activitySettingsForm').onsubmit = async function(e) {
    e.preventDefault();
    if (!currentAdminTeam) return;
    const updates = {
      name: document.getElementById('editTeamName').value.trim(),
      description: document.getElementById('editTeamDesc').value.trim(),
      category: document.getElementById('editTeamCategory').value,
      privacy: document.getElementById('editTeamPrivacy').value,
      tags: document.getElementById('editTeamTags').value.split(',').map(t => t.trim()).filter(Boolean),
      goal: parseFloat(document.getElementById('editTeamGoal').value) || 0
    };
    // Imagen: solo si se selecciona una nueva
    const fileInput = document.getElementById('editTeamPhoto');
    if (fileInput.files[0]) {
      const file = fileInput.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
      const filePath = `public/${fileName}`;
      const { error: uploadError } = await supabase.storage
        .from('teams')
        .upload(filePath, file, { upsert: true });
      if (uploadError) {
        alert('Error subiendo la foto: ' + uploadError.message);
        return;
      }
      const { data } = supabase.storage.from('teams').getPublicUrl(filePath);
      updates.photo = data.publicUrl;
    }
    // Actualiza en Supabase
    const { error } = await supabase
      .from('teams')
      .update(updates)
      .eq('id', currentAdminTeam.id);
    if (!error) {
      alert('Comunidad actualizada correctamente');
      document.getElementById('adminModal').classList.remove('active');
      document.body.style.overflow = '';
      // Opcional: recargar equipos en la página principal
      if (typeof window.loadUserTeams === 'function') window.loadUserTeams();
    } else {
      alert('Error al guardar cambios: ' + error.message);
    }
  };

  // --- Cargar stats resumen ---
  async function loadTeamStats(team) {
    // Miembros
    const { count: membersCount, error: membersError } = await supabase
      .from('team_members')
      .select('user_id', { count: 'exact', head: true })
      .eq('team_id', team.id)
      .neq('role', 'pending');
    document.getElementById('membersCount').textContent = membersError ? (team.members_count || 0) : membersCount;

    // Actividades
    const { count: activitiesCount, error: activitiesError } = await supabase
      .from('activities')
      .select('id', { count: 'exact', head: true })
      .eq('team_id', team.id);
    document.getElementById('activitiesCount').textContent =
      (activitiesError || typeof activitiesCount === 'undefined') ? (team.activities_count || 0) : activitiesCount;

    // Beneficiarios
    const { count: beneficiariesCount, error: beneficiariesError } = await supabase
      .from('beneficiaries')
      .select('id', { count: 'exact', head: true })
      .eq('team_id', team.id);
    document.getElementById('beneficiariesCount').textContent = beneficiariesError ? (team.beneficiaries || 0) : beneficiariesCount;

    // Puntos de impacto (suma de campo "impact" en activities)
    const { data: impactData, error: impactError } = await supabase
      .from('activities')
      .select('impact')
      .eq('team_id', team.id);
    let impactPoints = 0;
    if (!impactError && impactData) {
      impactPoints = impactData.reduce((sum, act) => sum + (act.impact || 0), 0);
    } else {
      impactPoints = team.impact || 0;
    }
    document.getElementById('impactPoints').textContent = impactPoints;

    // Progreso de recaudación
    const recaudado = team.funds_raised || 0;
    const meta = team.goal || 0;
    const porcentaje = meta ? Math.min(100, Math.round((recaudado / meta) * 100)) : 0;
    document.getElementById('communityProgress').style.width = porcentaje + '%';
    document.getElementById('progressPercent').textContent = `${porcentaje}% completado`;
    document.getElementById('progressAmount').textContent = `${recaudado} € de ${meta} €`;
  }

  // --- Cargar miembros ---
  async function loadTeamMembers(teamId) {
    try {
      // 1. Obtener los miembros
      const { data: members, error: membersError } = await supabase
        .from('team_members')
        .select('user_id, role')
        .eq('team_id', teamId)
        .neq('role', 'pending');

      if (membersError) {
        console.error('Error cargando miembros:', membersError);
        return;
      }

      // 2. Añadir el founder si no está
      let membersList = members ? [...members] : [];
      if (currentAdminTeam.creator_id && !membersList.some(m => m.user_id === currentAdminTeam.creator_id)) {
        membersList.unshift({
          user_id: currentAdminTeam.creator_id,
          role: 'founder'
        });
      }

      // 3. Cargar avatares y usernames
      const userIds = membersList.map(m => m.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', userIds);

      // 4. Renderizar miembros
      const container = document.getElementById('membersList');
      container.innerHTML = '';
      membersList.forEach(member => {
        const isFounder = member.role === 'founder';
        const profile = profiles?.find(a => a.id === member.user_id) || {};
        const avatar = profile.avatar_url || 'https://via.placeholder.com/40?text=No+Img';
        const username = profile.username || member.user_id;
        const memberItem = document.createElement('div');
        memberItem.className = 'member-item';
        memberItem.innerHTML = `
          <div class="member-info">
            <img src="${avatar}" alt="${username}" class="member-avatar">
            <span class="member-name">${username}</span>
          </div>
          <div class="member-actions">
            ${isFounder ? `
              <span class="role-badge admin" style="font-size:0.8rem;">
                <i class="fas fa-crown"></i> Fundador
              </span>
            ` : `
              <button class="btn btn-outline" data-remove-user="${member.user_id}">
                <i class="fas fa-user-minus"></i> Quitar
              </button>
            `}
          </div>
        `;
        container.appendChild(memberItem);
      });

      // Listener para quitar miembro
      container.querySelectorAll('[data-remove-user]').forEach(btn => {
        btn.onclick = async function() {
          const userId = this.getAttribute('data-remove-user');
          if (confirm('¿Estás seguro de que quieres quitar a este miembro de la comunidad?')) {
            try {
              const { error } = await supabase
                .from('team_members')
                .delete()
                .eq('user_id', userId)
                .eq('team_id', teamId);
              if (error) throw error;
              alert('Miembro quitado de la comunidad.');
              loadTeamMembers(teamId);
            } catch (error) {
              console.error('Error removing member:', error);
              alert('Error al quitar miembro: ' + error.message);
            }
          }
        };
      });
    } catch (error) {
      console.error('Error loading team members:', error);
    }
  }

  // --- Actividades recientes ---
  async function loadRecentActivities(teamId) {
    try {
      const { data: activities, error } = await supabase
        .from('activities')
        .select('*')
        .eq('team_id', teamId)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;

      const container = document.getElementById('recentActivities');
      container.innerHTML = '';
      activities.forEach(activity => {
        const activityItem = document.createElement('div');
        activityItem.className = 'activity-item';
        activityItem.style = 'background:#f8fafc; border-radius:12px; padding:1rem; margin-bottom:0.8rem; display:flex; align-items:center; gap:0.8rem;';
        activityItem.innerHTML = `
          <div style="flex-shrink: 0;">
            <i class="fas fa-bolt" style="font-size:1.5rem; color:#4a6fa5;"></i>
          </div>
          <div style="flex-grow: 1;">
            <div style="font-weight: 600; color:#2d3748;">${activity.title}</div>
            <div style="font-size: 0.9rem; color:#4a5568;">${activity.description}</div>
          </div>
          <div style="white-space: nowrap;">
            <span class="badge" style="background:#4a6fa5; color:white; padding:0.4rem 0.8rem; border-radius:10px; font-size:0.85rem;">${activity.type}</span>
          </div>
        `;
        container.appendChild(activityItem);
      });

      if (activities.length === 0) {
        container.innerHTML = '<div style="color:#718096; text-align:center; padding:1rem;">No hay actividades recientes en esta comunidad.</div>';
      }
    } catch (error) {
      console.error('Error loading recent activities:', error);
    }
  }

  // --- Crear actividades desde el modal ---
  document.getElementById('createCauseBtnTab').onclick = function() {
    if (currentAdminTeam) createActivity(currentAdminTeam.id, 'cause');
  };
  document.getElementById('createTaskBtnTab').onclick = function() {
    if (currentAdminTeam) createActivity(currentAdminTeam.id, 'task');
  };
  document.getElementById('createChallengeBtnTab').onclick = function() {
    if (currentAdminTeam) createActivity(currentAdminTeam.id, 'challenge');
  };
  document.getElementById('createVolunteeringBtnTab').onclick = function() {
    if (currentAdminTeam) createActivity(currentAdminTeam.id, 'volunteering');
  };

  async function createActivity(teamId, type) {
    const title = prompt('Ingrese el título de la actividad:');
    if (!title) return;
    const description = prompt('Ingrese la descripción de la actividad:');
    if (!description) return;
    try {
      const { error } = await supabase
        .from('activities')
        .insert([{
          team_id: teamId,
          title,
          description,
          type,
          created_at: new Date()
        }]);
      if (error) throw error;
      alert('Actividad creada exitosamente.');
      loadRecentActivities(teamId);
    } catch (error) {
      console.error('Error creating activity:', error);
      alert('Error al crear actividad: ' + error.message);
    }
  }

  // --- Guardar mensaje para participantes ---
  document.getElementById('saveMessageBtn').onclick = async function() {
    if (!currentAdminTeam) return;
    const message = document.getElementById('teamMessage').value.trim();
    const { error } = await supabase
      .from('teams')
      .update({ message })
      .eq('id', currentAdminTeam.id);
    if (!error) {
      alert('Mensaje publicado correctamente.');
    } else {
      alert('Error al guardar mensaje: ' + error.message);
    }
  };

  // --- Invitar miembros (solo ejemplo, debes implementar el backend de invitación) ---
  document.getElementById('sendInviteBtn').onclick = async function() {
    const email = document.getElementById('inviteEmail').value.trim();
    const role = document.getElementById('inviteRole').value;
    if (!email) {
      alert('Introduce un correo electrónico.');
      return;
    }
    // Aquí deberías llamar a tu backend para enviar la invitación.
    alert(`Invitación enviada a ${email} como ${role}. (Implementa la lógica real en el backend)`);
    document.getElementById('inviteEmail').value = '';
  };
}