// Teams Renderer: lógica reutilizable para mostrar y gestionar tarjetas de comunidades

window.initTeamsRenderer = function(options) {
  // Destructuring de las opciones con valores por defecto
  const {
    gridSelector = '#teamsGrid',
    paginationSelector = '#pagination',
    prevPageSelector = '#prevPage',
    nextPageSelector = '#nextPage',
    pageInfoSelector = '#pageInfo',
    tabSelector = '.tab',
    searchInputSelector = '#search-input',
    onShowTeamModal = null,
    supabase,
    session
  } = options;

  let currentPage = 1;
  const itemsPerPage = 9;
  let allTeams = [];
  let filteredTeams = [];

  // --- Renderizado de tarjetas ---
  async function renderTeams() {
    const userId = session?.user?.id;
    const startIdx = (currentPage - 1) * itemsPerPage;
    const endIdx = startIdx + itemsPerPage;
    const paginatedTeams = filteredTeams.slice(startIdx, endIdx);

    const container = document.querySelector(gridSelector);
    container.className = 'teams-grid-classic';
    container.innerHTML = '';

    if (paginatedTeams.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-users-slash"></i>
          <h3>No se encontraron comunidades</h3>
          <p>No hay comunidades que coincidan con tu búsqueda.</p>
          <button id="createTeamEmptyBtn" class="btn btn-primary">
            <i class="fas fa-plus"></i> Crear primera comunidad
          </button>
        </div>
      `;
      document.getElementById('createTeamEmptyBtn')?.addEventListener('click', () => {
        document.getElementById('create-team-btn')?.click();
      });
      document.querySelector(paginationSelector).style.display = 'none';
      return;
    }

    document.querySelector(paginationSelector).style.display = 'flex';

    paginatedTeams.forEach(team => {
      const membersCount = team.members_count || 0;
      const tagsHtml = team.tags?.length
        ? `<div class="team-tags-classic" style="margin-bottom:0.8em;">${team.tags.slice(0, 4).map(tag => `<span class="team-tag-classic">${tag}</span>`).join('')}${team.tags.length > 4 ? `<span class="team-tag-classic tag-more">+${team.tags.length - 4}</span>` : ''}</div>`
        : '';
      const isTrending = membersCount >= 20 || (team.impact || 0) >= 1000;
      const recaudado = team.funds_raised || 0;
      const meta = team.goal || 1000;
      const porcentaje = meta ? Math.min(100, Math.round((recaudado / meta) * 100)) : 0;
      let badgePrivada = team.privacy === 'private'
        ? `<div class="team-badge-classic" style="top:1rem;right:1rem;background:var(--gray);color:var(--primary-dark);"><i class="fas fa-lock"></i> Privada</div>`
        : '';
      let badgeTrending = isTrending
        ? `<div class="team-badge-classic" style="top:${team.privacy === 'private' ? '3.2rem' : '1rem'};right:1rem;background:#ffe600;color:#b8860b;"><i class="fas fa-arrow-trend-up"></i> Trending</div>`
        : '';

      const isMember = team.team_members?.some(m => m.user_id === userId);

      const joinBtnHtml = isMember
        ? `<button class="btn btn-outline join-team-btn" data-team-id="${team.id}" disabled>
            <i class="fas fa-user-check"></i> Miembro
          </button>`
        : `<button class="btn btn-accent join-team-btn" data-team-id="${team.id}">
            <i class="fas fa-user-plus"></i> Unirse
          </button>`;

      const card = document.createElement('div');
      card.className = 'team-card-classic';
      card.setAttribute('data-team-id', team.id);
      card.innerHTML = `
        <div class="team-image-classic">
          <img src="${team.photo_url || 'https://via.placeholder.com/350x180?text=Comunidad'}" alt="${team.name}">
          <div class="team-badge-classic points" style="top:1rem;left:1rem;right:auto;background:var(--primary);color:#fff;">
            <i class="fas fa-bolt"></i> +${team.impact || 0} pts
          </div>
          ${badgePrivada}${badgeTrending}
        </div>
        <div class="team-content-classic">
          <h3>${team.name}</h3>
          <p>${team.summary || 'Esta comunidad no tiene resumen aún.'}</p>
          <div class="team-meta-classic" style="margin-bottom:1em;">
            <div class="meta-item-classic"><i class="fas fa-layer-group"></i> ${getCategoryName(team.category)}</div>
            <div class="meta-item-classic"><i class="fas fa-tasks"></i> ${team.activities_count || 0} actividades</div>
            <div class="meta-item-classic"><i class="fas fa-heart"></i> ${team.beneficiaries || 0} beneficiarios</div>
            <div class="meta-item-classic">
              <i class="fas fa-users"></i> <span class="members-count-classic">${membersCount}</span> miembros
            </div>
          </div>
          ${tagsHtml}
          <div class="team-progress-classic" style="margin-bottom:1.2em;">
            <div class="progress-bar">
              <div class="progress-fill" style="width:${porcentaje}%;">${porcentaje > 10 ? porcentaje + '%' : ''}</div>
            </div>
            <div class="progress-info">
              <span>${porcentaje}% completado</span>
              <span>${recaudado} € de ${meta} €</span>
            </div>
          </div>
          <div class="team-actions-classic" style="margin-top:1.2em;">
            <button class="btn btn-primary btn-vermas-team" data-team-id="${team.id}">
              Ver más
            </button>
            ${joinBtnHtml}
          </div>
        </div>
      `;
      container.appendChild(card);
    });

    updatePagination();
  }

  function updatePagination() {
    const totalPages = Math.max(1, Math.ceil(filteredTeams.length / itemsPerPage));
    document.querySelector(pageInfoSelector).textContent = `${currentPage} / ${totalPages}`;
    document.querySelector(prevPageSelector).disabled = currentPage <= 1;
    document.querySelector(nextPageSelector).disabled = currentPage >= totalPages;
  }

  function getCategoryName(category) {
    const categories = {
      'medio_ambiente': 'Medio Ambiente',
      'educacion': 'Educación',
      'salud': 'Salud',
      'animales': 'Animales',
      'comunidad': 'Comunidad',
      'otros': 'Otros'
    };
    return categories[category] || 'General';
  }

  // --- Carga de equipos ---
  async function loadTeams() {
    const { data: teams, error } = await supabase
      .from('teams')
      .select('*, team_members(user_id)')
      .order('created_at', { ascending: false });

    if (error) {
      allTeams = [];
      filteredTeams = [];
      renderTeams();
      throw error;
    }

    allTeams = teams || [];
    filteredTeams = [...allTeams];
    currentPage = 1;
    renderTeams();
  }

  // --- Filtros y búsqueda ---
  function filterAndRenderTeams() {
    const activeFilter = document.querySelector(tabSelector + '.active')?.getAttribute('data-filter') || 'all';
    const searchTerm = document.querySelector(searchInputSelector)?.value.toLowerCase() || '';

    filteredTeams = allTeams.filter(team => {
      if (activeFilter !== 'all' && team.category !== activeFilter) return false;
      if (searchTerm) {
        const matchesName = team.name && team.name.toLowerCase().includes(searchTerm);
        const matchesDesc = team.description && team.description.toLowerCase().includes(searchTerm);
        const matchesTags = team.tags && team.tags.some(tag => tag && tag.toLowerCase().includes(searchTerm));
        return matchesName || matchesDesc || matchesTags;
      }
      return true;
    });

    renderTeams();
  }

  // --- Eventos UI ---
  document.querySelectorAll(tabSelector).forEach(tab => {
    tab.addEventListener('click', function () {
      document.querySelector(tabSelector + '.active')?.classList.remove('active');
      this.classList.add('active');
      currentPage = 1;
      filterAndRenderTeams();
    });
  });

  document.querySelector(searchInputSelector)?.addEventListener('input', function () {
    currentPage = 1;
    filterAndRenderTeams();
  });

  document.querySelector(prevPageSelector)?.addEventListener('click', function () {
    if (currentPage > 1) {
      currentPage--;
      renderTeams();
    }
  });

  document.querySelector(nextPageSelector)?.addEventListener('click', function () {
    const totalPages = Math.ceil(filteredTeams.length / itemsPerPage);
    if (currentPage < totalPages) {
      currentPage++;
      renderTeams();
    }
  });

  // --- Botón Ver más ---
  document.addEventListener('click', function (e) {
    const verMasBtn = e.target.closest('.btn-vermas-team');
    if (verMasBtn) {
      e.preventDefault();
      e.stopPropagation();
      const teamId = verMasBtn.dataset.teamId;
      if (onShowTeamModal) {
        onShowTeamModal(teamId);
      }
    }
  });

  // --- Botón Unirse ---
  document.addEventListener('click', async (e) => {
    const joinBtn = e.target.closest('.join-team-btn');
    if (!joinBtn || joinBtn.disabled) return;
    const teamId = joinBtn.dataset.teamId;
    const { data: { session: currentSession } } = await supabase.auth.getSession();

    if (!currentSession?.user) {
      document.getElementById('loginModal')?.classList.add('active');
      return;
    }

    // Bloquear UI para evitar dobles clics
    const originalText = joinBtn.innerHTML;
    joinBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    joinBtn.disabled = true;

    try {
      const { error: insertError } = await supabase
        .from('team_members')
        .insert({
          team_id: teamId,
          user_id: currentSession.user.id,
          role: 'member',
          joined_at: new Date().toISOString()
        });

      if (insertError && insertError.code !== '23505') throw insertError;

      // Actualizar contador de miembros
      const { data: updatedTeam, error: fetchError } = await supabase
        .from('teams')
        .select('members_count')
        .eq('id', teamId)
        .single();

      if (fetchError) throw fetchError;

      document.querySelectorAll(`.team-card-classic[data-team-id="${teamId}"] .members-count-classic`).forEach(el => {
        el.textContent = updatedTeam.members_count;
      });

      joinBtn.innerHTML = '<i class="fas fa-user-check"></i> Miembro';
      joinBtn.classList.remove('btn-accent');
      joinBtn.classList.add('btn-outline');
      joinBtn.disabled = true;

    } catch (error) {
      joinBtn.innerHTML = originalText;
      joinBtn.disabled = false;
      alert(error.message || 'Error al unirse');
    }
  });

  // --- Inicialización ---
  loadTeams();

  // Exponer funciones útiles si se requiere
  return {
    loadTeams,
    renderTeams,
    filterAndRenderTeams,
    getCategoryName,
    allTeams,
    filteredTeams
  };
}

// Función para mostrar el modal de detalle de comunidad
async function showTeamModal(teamId) {
  // 1. Carga la comunidad
  const { data: team, error } = await supabase
    .from('teams')
    .select('*')
    .eq('id', teamId)
    .single();

  if (error || !team) {
    alert('Error al cargar la comunidad');
    return;
  }

  // 2. Prepara datos
  const createdDate = new Date(team.created_at).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const recaudado = team.funds_raised || 0;
  const meta = team.goal || 0;
  const porcentaje = meta ? Math.min(100, Math.round((recaudado / meta) * 100)) : 0;
  const beneficiaries = team.beneficiaries || 0;
  const impact = team.impact || 0;
  const category = getCategoryName(team.category);
  const privacy = team.privacy === 'private' ? 'Privada' : 'Pública';

  // 2.1 Cargar miembros de la comunidad con perfil
  const { data: members } = await supabase
    .from('team_members')
    .select(`
      id,
      role,
      joined_at,
      profiles:user_id (
        id,
        username,
        photo_url
      )
    `)
    .eq('team_id', teamId)
    .order('joined_at', { ascending: true });

  // 3. Renderiza el modal (estructura igual que causas)
  document.getElementById('teamModalBody').innerHTML = `
    <div class="modal-cause-container">
      <h1 class="modal-cause-title" style="font-size:2rem; font-weight:800; color:var(--primary); margin-bottom:2.7rem; text-align:center; width:100%;">${team.name}</h1>
      <div class="modal-cause-header" style="display:flex; gap:2.5rem; margin-bottom:2.7rem;">
        <div class="modal-cause-image-wrapper" style="flex:1; min-width:320px; height:300px; border-radius:12px; overflow:hidden; position:relative; box-shadow:0 4px 12px rgba(0,0,0,0.08);">
          <div class="modal-cause-badge" style="top:1.5rem; left:1.5rem; right:auto; background:var(--accent); color:white; position:absolute; padding:0.5rem 1rem; border-radius:50px; font-size:0.9rem; font-weight:600; display:flex; align-items:center; gap:0.6rem; box-shadow:0 2px 8px rgba(0,0,0,0.1); z-index:2;">
            <i class="fas fa-users"></i> Comunidad
          </div>
          ${team.privacy === 'private' ? `
          <div class="modal-cause-badge" style="right:1.5rem; left:auto; top:1.5rem; background:var(--gray); color:var(--primary-dark); position:absolute; padding:0.5rem 1rem; border-radius:50px; font-size:0.9rem; font-weight:600; display:flex; align-items:center; gap:0.6rem; box-shadow:0 2px 8px rgba(0,0,0,0.1); z-index:2;">
            <i class="fas fa-lock"></i> Privada
          </div>` : ''}
          <img class="modal-cause-image" src="${team.photo_url || 'https://via.placeholder.com/350x180?text=Comunidad'}"
               alt="Imagen de la comunidad ${team.name}"
               style="width:100%;height:100%;object-fit:cover;"
               onerror="this.src='https://via.placeholder.com/350x180?text=Comunidad'">
        </div>
        <div class="modal-cause-info" style="flex:1.5; display:flex; flex-direction:column; justify-content:flex-start;">
          <div class="modal-cause-progress-container" style="background:#f8fafc; padding:1.2rem; border-radius:12px; margin-bottom:1.2rem; border:1px solid #e5e7eb;">
            <div class="progress-bar">
              <div class="progress-fill" style="width:${porcentaje}%"></div>
            </div>
            <div class="progress-info">
              <span>${porcentaje}% completado</span>
              <span>${recaudado} € de ${meta} €</span>
            </div>
          </div>
          <div class="modal-cause-meta-grid" style="display:grid; grid-template-columns:1fr 1fr; gap:1.2rem; margin-bottom:1.5rem;">
            <div class="meta-item">
              <span class="meta-icon" style="color:var(--primary);font-size:1.1rem;width:1.5rem;text-align:center;"><i class="fas fa-users"></i></span>
              <span style="color:#6b7280;font-size:0.95rem;">${members?.length || 0} miembros</span>
            </div>
            <div class="meta-item">
              <span class="meta-icon" style="color:var(--primary);font-size:1.1rem;width:1.5rem;text-align:center;"><i class="fas fa-heart"></i></span>
              <span style="color:#6b7280;font-size:0.95rem;">${beneficiaries} beneficiarios</span>
            </div>
            <div class="meta-item">
              <span class="meta-icon" style="color:var(--primary);font-size:1.1rem;width:1.5rem;text-align:center;"><i class="fas fa-layer-group"></i></span>
              <span style="color:#6b7280;font-size:0.95rem;">${category}</span>
            </div>
            <div class="meta-item">
              <span class="meta-icon" style="color:var(--primary);font-size:1.1rem;width:1.5rem;text-align:center;"><i class="fas fa-calendar-alt"></i></span>
              <span style="color:#6b7280;font-size:0.95rem;">${createdDate}</span>
            </div>
          </div>
          <div class="points-notice" style="background:#f0f9ff; border-left:4px solid var(--accent); padding:1rem; border-radius:0 8px 8px 0; font-size:0.95rem; display:flex; align-items:center; gap:0.7rem;">
            <i class="fas fa-bolt" style="color: var(--accent);"></i>
            Participar en esta comunidad otorgará <strong>${impact} puntos</strong> de impacto
          </div>
        </div>
      </div>
      <div class="modal-cause-content" style="margin-top:0;">
        <div class="content-section" style="margin-bottom:2.2rem;">
          <h3 class="content-title" style="font-size:1.2rem; font-weight:600; color:var(--primary); margin-bottom:0.9rem; display:flex; align-items:center; gap:0.7rem;">
            <i class="fas fa-quote-left"></i> Resumen
          </h3>
          <p class="content-text" style="line-height:1.7; color:#4b5563; font-size:1.05rem; margin-left:0; margin-right:0; text-align:justify;">${team.summary || 'Sin resumen.'}</p>
        </div>
        <div class="content-section" style="margin-bottom:2.2rem;">
          <h3 class="content-title" style="font-size:1.2rem; font-weight:600; color:var(--primary); margin-bottom:0.9rem; display:flex; align-items:center; gap:0.7rem;">
            <i class="fas fa-align-left"></i> Descripción
          </h3>
          <p class="content-text" style="line-height:1.7; color:#4b5563; font-size:1.05rem; margin-left:0; margin-right:0; text-align:justify;">${team.description || 'Esta comunidad no tiene descripción.'}</p>
        </div>
        <div class="content-section" style="margin-bottom:2.2rem;">
          <h3 class="content-title" style="font-size:1.1rem;font-weight:600;color:var(--primary);margin-bottom:1rem;display:flex;align-items:center;gap:0.7rem;">
            <i class="fas fa-users"></i> Miembros (${members?.length || 0})
          </h3>
          <div class="members-grid" style="display:grid;grid-template-columns:repeat(auto-fill, minmax(140px, 1fr));gap:1.2rem;">
            ${
              members && members.length > 0
                ? members.map(member => `
                  <div class="member-card" style="display:flex;flex-direction:column;align-items:center;gap:0.5rem;">
                    <img src="${member.profiles?.photo_url || ("https://ui-avatars.com/api/?name=" + encodeURIComponent(member.profiles?.username || "U") + "&background=4a6fa5&color=fff&size=64")}"
                         alt="${member.profiles?.username || "Usuario"}"
                         style="width:60px;height:60px;border-radius:50%;object-fit:cover;border:2px solid #e2e8f0;">
                    <div style="text-align:center;">
                      <div style="font-weight:600;font-size:0.95rem;">
                        ${member.profiles?.username || 'Usuario'}
                      </div>
                      <div style="font-size:0.85rem;color:#6b7280;">
                        ${member.role === 'admin' ? 'Administrador' : member.role === 'moderator' ? 'Moderador' : 'Miembro'}
                      </div>
                    </div>
                  </div>
                `).join('')
                : `<div style="text-align:center;color:#6b7280;grid-column:1/-1;padding:1rem;">
                    Esta comunidad aún no tiene miembros
                  </div>`
            }
          </div>
        </div>
        <div class="content-section" style="margin-bottom:2.2rem;">
          <h3 class="content-title" style="font-size:1.1rem;font-weight:600;color:var(--primary);margin-bottom:0.5rem;display:flex;align-items:center;gap:0.7rem;">
            <i class="fas fa-info-circle"></i> Detalles adicionales
          </h3>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
            <div>
              <p style="font-weight:600;color:var(--primary);margin-bottom:0.3rem;">Privacidad</p>
              <p style="color:#6b7280;">${privacy}</p>
            </div>
            <div>
              <p style="font-weight:600;color:var(--primary);margin-bottom:0.3rem;">Meta de recaudación</p>
              <p style="color:#6b7280;">${meta} €</p>
            </div>
            <div>
              <p style="font-weight:600;color:var(--primary);margin-bottom:0.3rem;">ID</p>
              <p style="color:#6b7280;">${team.id}</p>
            </div>
          </div>
        </div>
      </div>
      <div class="cause-actions" style="display:flex; gap:0.8rem; margin-top:2.2rem;">
        <button class="btn btn-primary" style="flex:1;" id="joinTeamBtn">
          <i class="fas fa-user-plus"></i> Unirse
        </button>
        <button class="btn btn-accent" style="flex:1;" id="shareTeamBtn">
          <i class="fas fa-share-alt"></i> Compartir
        </button>
      </div>
      <div class="share-section" id="shareSectionTeam"></div>
    </div>
  `;

  document.getElementById('teamModal').classList.add('active');
  document.body.style.overflow = 'hidden';

  // Botón Unirse
  document.getElementById('joinTeamBtn').onclick = async function() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      alert('Debes iniciar sesión para unirte a la comunidad.');
      return;
    }
    alert('¡Solicitud de unión enviada! (Aquí puedes poner tu lógica real)');
  };

  // Botón Compartir
  document.getElementById('shareTeamBtn').onclick = function() {
    showShareOptionsTeam(team.id, team);
  };
}

// Cerrar modal de ver más
document.getElementById('closeTeamModal').onclick = function() {
  document.getElementById('teamModal').classList.remove('active');
  document.body.style.overflow = '';
};
document.getElementById('teamModal').onclick = function(e) {
  if (e.target === this) {
    this.classList.remove('active');
    document.body.style.overflow = '';
  }
};