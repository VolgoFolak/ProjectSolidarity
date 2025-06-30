// Renderer modular para tareas
const TasksRenderer = {
  // Renderizar una sola tarjeta de tarea
  renderCard(task) {
    if (!task) return '';

    const urgentBadge = task.is_urgent ? `<div class="task-badge urgent"><i class="fas fa-exclamation-circle"></i> Urgente</div>` : "";
    const pointsBadge = `<div class="task-badge points"><i class="fas fa-star"></i> +${task.points || 0} pts</div>`;
    const location = task.city && task.country ? `${task.city}, ${task.country}` : "";

    // Progreso basado en participantes/beneficiarios
    const progress = task.beneficiaries ? Math.min(Math.round((task.participants / task.beneficiaries) * 100), 100) : 0;

    // Causa vinculada
    let causeHtml = '';
    if (task.cause_id && task.linkedCause) {
      const cause = task.linkedCause;
      causeHtml = `
        <div class="linked-cause">
          <img src="${cause.photo_url || '/img/causa-default.jpg'}" alt="${cause.title}">
          <span>${cause.title}</span>
        </div>
      `;
    }

    // ¿El usuario ya participa?
    const isParticipating = task.isParticipating;

    // ¿Es admin?
    const isAdmin = ['owner', 'admin', 'coordinator', 'founder'].includes(task.userRole);

    // Botón participar o participando
    const participateBtn = isParticipating
      ? `<button class="btn btn-accent participate-btn" data-task-id="${task.id}" disabled style="opacity:0.7;cursor:not-allowed;">Participando</button>`
      : `<button class="btn btn-accent participate-btn" data-task-id="${task.id}">Participar</button>`;

    // Botón administrar solo si es admin
    const adminBtn = isAdmin
      ? `<button class="btn btn-accent admin-activity-btn" data-activity-type="task" data-activity-id="${task.id}">
          <i class="fas fa-cog"></i> Administrar
        </button>`
      : '';

    // Mostrar solo los botones según el rol
    let actionsHtml = '';
    if (isAdmin) {
      actionsHtml = `
        <button class="btn btn-primary view-task-btn" data-task-id="${task.id}">Ver más</button>
        ${adminBtn}
      `;
    } else {
      actionsHtml = `
        <button class="btn btn-primary view-task-btn" data-task-id="${task.id}">Ver más</button>
        ${participateBtn}
      `;
    }

    return `
      <div class="task-card">
        <div class="task-image">
          <img src="${task.photo_url || '/img/task-default.jpg'}" alt="${task.title}" onerror="this.src='/img/task-default.jpg'">
          ${urgentBadge}
          ${pointsBadge}
        </div>
        <div class="task-content">
          <h3>${task.title}</h3>
          <p>${task.summary ? task.summary : (task.description.substring(0, 100) + (task.description.length > 100 ? '...' : ''))}</p>
          ${causeHtml}
          <div class="task-meta">
            <div class="meta-item"><i class="fas fa-map-marker-alt"></i> ${location}</div>
            <div class="meta-item"><i class="fas fa-users"></i> ${task.participants || 0} participantes</div>
            <div class="beneficiaries-count">
              <i class="fas fa-heart"></i> Beneficia a ${task.beneficiaries || 0} personas
            </div>
          </div>
          <div class="task-progress">
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${progress}%"></div>
            </div>
            <div class="progress-info">
              <span>${task.participants || 0} participantes</span>
              <span>Meta: ${task.beneficiaries || 0}</span>
            </div>
          </div>
          <div class="task-actions">
            ${actionsHtml}
          </div>
        </div>
      </div>
    `;
  },

  // Renderizar grid completo de tareas
  renderGrid(tasks, container) {
    if (!container) return;

    container.innerHTML = '';

    if (!tasks || tasks.length === 0) {
      container.innerHTML = '<div style="color:#6b7280;text-align:center;padding:2rem;grid-column:1/-1;">No se encontraron tareas.</div>';
      return;
    }

    window.tasks = tasks;

    for (const task of tasks) {
      const cardHtml = this.renderCard(task);
      container.innerHTML += cardHtml;
    }

    // Botón ver más
    document.querySelectorAll('.view-task-btn').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        const taskId = this.getAttribute('data-task-id');
        TasksRenderer.showTaskModal(taskId);
      });
    });

    // Botón participar
    document.querySelectorAll('.participate-btn').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        const taskId = this.getAttribute('data-task-id');
        if (window.participateInTask) {
          window.participateInTask(taskId);
        }
      });
    });

    // Botón administrar (idéntico a causes)
    document.querySelectorAll('.admin-activity-btn').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        const activityId = this.getAttribute('data-activity-id');
        if (typeof window.openAdminTaskModal === 'function') {
          const task = window.tasks?.find(t => t.id == activityId);
          if (task) window.openAdminTaskModal(task);
        }
      });
    });

    // Modal desde URL
    this.checkForModalFromURL();
  },

  // Verificar si hay que abrir modal desde URL
  checkForModalFromURL() {
    const path = window.location.pathname;
    const taskIdMatch = path.match(/\/tasks\/([a-f0-9-]+)$/);
    
    if (taskIdMatch) {
      const taskId = taskIdMatch[1];
      console.log('🔗 URL detecta tarea específica:', taskId);
      
      // Buscar la tarea en las cargadas
      const task = window.tasks?.find(t => t.id === taskId);
      
      if (task) {
        // Si la tarea está cargada, abrir modal inmediatamente
        setTimeout(() => {
          this.showTaskModal(taskId);
        }, 100);
      } else {
        // Si no está cargada, intentar cargar desde Supabase
        setTimeout(() => {
          this.loadAndShowTaskFromURL(taskId);
        }, 500);
      }
    }
  },

  // Cargar tarea específica desde URL si no está en memoria
  async loadAndShowTaskFromURL(taskId) {
    try {
      const { data: task, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .single();

      if (error || !task) {
        console.error('❌ Error cargando tarea desde URL:', error);
        window.history.replaceState({}, '', '/tasks');
        return;
      }

      if (!window.tasks) {
        window.tasks = [];
      }
      if (!window.tasks.find(t => t.id === taskId)) {
        window.tasks.push(task);
      }

      this.showTaskModal(taskId);
    } catch (error) {
      console.error('❌ Error cargando tarea:', error);
      window.history.replaceState({}, '', '/tasks');
    }
  },

  // Función para mostrar el modal con los detalles de la tarea
  async showTaskModal(taskId) {
    const { data: task, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (error) {
      alert('Error al cargar la tarea: ' + error.message);
      return;
    }

    // Progreso basado en participants/beneficiaries
    const progress = task.beneficiaries
      ? Math.min(Math.round((task.participants / task.beneficiaries) * 100), 100)
      : 0;

    const createdDate = new Date(task.created_at).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Obtener información de la causa vinculada si existe
    let causeInfo = '';
    if (task.cause_id) {
      const { data: cause } = await supabase
        .from('causes')
        .select('title, short_description, photo_url')
        .eq('id', task.cause_id)
        .single();

      if (cause) {
        causeInfo = `
          <div class="linked-cause-section" style="margin-bottom:1.5rem;">
            <h3 class="content-title" style="font-size:1.2rem; font-weight:600; color:var(--primary); margin-bottom:0.9rem; display:flex; align-items:center; gap:0.7rem;">
              <i class="fas fa-link"></i> Vinculado a la causa
            </h3>
            <div style="display:flex; align-items:center; gap:1.2rem; background:#f8fafc; padding:1rem; border-radius:8px; border:1px solid #e5e7eb;">
              <img src="${cause.photo_url || '/img/causa-default.jpg'}"
                   alt="Imagen de la causa vinculada"
                   style="width:80px; height:80px; object-fit:cover; border-radius:6px;"
                   onerror="this.src='/img/causa-default.jpg'">
              <div style="flex:1; min-width:0;">
                <div style="font-weight:700; color:var(--primary); font-size:1.05rem; margin-bottom:0.2rem;">
                  ${cause.title}
                </div>
                <div style="color:#6b7280; font-size:0.97rem;">
                  ${cause.short_description || 'Sin resumen disponible'}
                </div>
              </div>
              <a href="/causes/${task.cause_id}"
                 class="btn btn-primary"
                 style="margin-left:1.2rem; white-space:nowrap; font-size:0.97rem; padding:0.5rem 1.1rem;">
                <i class="fas fa-arrow-right"></i> Ver causa
              </a>
            </div>
          </div>
        `;
      }
    }

    // Obtener participantes
    const { data: members } = await supabase
      .from('task_members')
      .select('user_id, profiles(username, photo_url)')
      .eq('task_id', taskId);

    let participantsHtml = '';
    if (members && members.length > 0) {
      participantsHtml = `
        <div class="content-section" style="margin-bottom:2.2rem;">
          <h3 class="content-title" style="font-size:1.2rem; font-weight:600; color:var(--primary); margin-bottom:0.9rem;">
            <i class="fas fa-users"></i> Participantes
          </h3>
          <div style="display:flex; flex-wrap:wrap; gap:1rem;">
            ${members.map(m => `
              <div style="display:flex; align-items:center; gap:0.6rem; background:#f8fafc; border-radius:8px; padding:0.5rem 1rem;">
                <img src="${m.profiles?.photo_url || '/img/avatar-default.png'}" alt="${m.profiles?.username || 'Usuario'}" style="width:36px; height:36px; border-radius:50%; object-fit:cover;">
                <span style="font-weight:600; color:var(--primary);">${m.profiles?.username || 'Usuario'}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    // Crear modal si no existe
    let modal = document.getElementById('taskModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'taskModal';
      modal.className = 'modal';
      modal.style.cssText = 'display:none; position:fixed; z-index:9999; left:0; top:0; width:100vw; height:100vh; background:rgba(0,0,0,0.35); align-items:center; justify-content:center;';
      modal.innerHTML = `
        <div class="modal-content" style="background:#fff; border-radius:18px; max-width:800px; width:95vw; padding:2rem; box-shadow:0 8px 32px rgba(74,111,165,0.13); position:relative; max-height:90vh; overflow-y:auto;">
          <button id="closeTaskModal" style="position:absolute; top:1.5rem; right:1.5rem; background:none; border:none; font-size:1.8rem; color:#6b7280; cursor:pointer;">&times;</button>
          <div id="taskModalBody"></div>
        </div>
      `;
      document.body.appendChild(modal);

      // Event listeners para cerrar
      modal.querySelector('#closeTaskModal').addEventListener('click', () => {
        this.closeModal();
      });
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          this.closeModal();
        }
      });
    }

    // Llenar contenido del modal
    document.getElementById('taskModalBody').innerHTML = `
    <h1 style="font-size:2rem; font-weight:800; color:var(--primary); margin-bottom:2rem; text-align:left !important;">${task.title}</h1>
      <div style="display:flex; gap:2rem; margin-bottom:2rem;">
        <div style="flex:1; min-width:320px; height:300px; border-radius:12px; overflow:hidden; position:relative;">
          <img src="${task.photo_url || '/img/task-default.jpg'}" 
               alt="Imagen de la tarea ${task.title}"
               style="width:100%;height:100%;object-fit:cover;"
               onerror="this.src='/img/task-default.jpg'">
          ${task.is_urgent ? `<div style="position:absolute; top:1rem; right:1rem; background:var(--urgent); color:white; padding:0.5rem 1rem; border-radius:50px; font-size:0.9rem; font-weight:600;"><i class="fas fa-exclamation-circle"></i> Urgente</div>` : ''}
        </div>
        <div style="flex:1.5;">
          <div style="background:#f8fafc; padding:1.5rem; border-radius:12px; margin-bottom:1.5rem;">
            <div class="progress-bar" style="height:8px; background:#e5e7eb; border-radius:4px; overflow:hidden; margin-bottom:0.5rem;">
              <div class="progress-fill" style="width:${progress}%; height:100%; background:var(--primary);"></div>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:0.9rem; color:#6b7280;">
              <span>${progress}% completado</span>
              <span>${task.participants || 0} de ${task.beneficiaries || 0} participantes</span>
            </div>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.7rem; margin-bottom:1.2rem;">
            <div style="display:flex; align-items:center; gap:0.5rem; color:#6b7280;">
              <i class="fas fa-map-marker-alt" style="color:var(--primary);"></i>
              <span>${task.city || 'Sin ubicación'}${task.country ? ', ' + task.country : ''}</span>
            </div>
            <div style="display:flex; align-items:center; gap:0.5rem; color:#6b7280;">
              <i class="fas fa-users" style="color:var(--primary);"></i>
              <span>${task.participants || 0} participantes</span>
            </div>
            <div style="display:flex; align-items:center; gap:0.5rem; color:#6b7280;">
              <i class="fas fa-heart" style="color:var(--primary);"></i>
              <span>${task.beneficiaries || 0} beneficiarios</span>
            </div>
            <div style="display:flex; align-items:center; gap:0.5rem; color:#6b7280;">
              <i class="fas fa-calendar-alt" style="color:var(--primary);"></i>
              <span>${task.end_date ? new Date(task.end_date).toLocaleDateString('es-ES') : 'Sin fecha límite'}</span>
            </div>
          </div>
          <div style="background:#f0f9ff; border-left:4px solid var(--accent); padding:0.8rem; border-radius:0 8px 8px 0;">
            <i class="fas fa-star" style="color:var(--accent);"></i>
            Participar otorgará <strong>${task.points || 20} puntos</strong> de impacto
          </div>
        </div>
      </div>
      ${causeInfo}
      <div style="margin-bottom:2rem;">
        <h3 style="font-size:1.2rem; font-weight:600; color:var(--primary); margin-bottom:0.9rem;">
          <i class="fas fa-align-left"></i> Resumen
        </h3>
        <p style="line-height:1.7; color:#4b5563; margin-bottom:2rem;">
          ${task.summary || 'No hay resumen disponible para esta tarea.'}
        </p>
        <h3 style="font-size:1.2rem; font-weight:600; color:var(--primary); margin-bottom:0.9rem;">
          <i class="fas fa-info-circle"></i> Descripción completa
        </h3>
        <p style="line-height:1.7; color:#4b5563;">
          ${task.description || 'No hay descripción disponible para esta tarea.'}
        </p>
      </div>
      ${participantsHtml}
      <div style="display:flex; gap:0.8rem; margin-top:2rem;">
        <button class="btn btn-primary" style="flex:1;" onclick="window.participateInTask('${task.id}')">
          <i class="fas fa-hand-holding-heart"></i> Participar
        </button>
        <button class="btn btn-accent" style="flex:1;" onclick="TasksRenderer.shareTask('${task.id}')">
          <i class="fas fa-share-alt"></i> Compartir
        </button>
      </div>
      <div class="share-section" id="shareSection"></div>
    `;

    // Mostrar modal
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // Actualizar URL si estamos en la página de tareas
    if (window.location.pathname === '/tasks' || window.location.pathname === '/tasks/') {
      window.history.pushState({}, '', `/tasks/${taskId}`);
    }
  },

  // Cerrar modal y limpiar URL
  closeModal() {
    const modal = document.getElementById('taskModal');
    if (modal) {
      modal.style.display = 'none';
      document.body.style.overflow = '';
      if (window.location.pathname.includes('/tasks/') && window.location.pathname !== '/tasks') {
        window.history.pushState({}, '', '/tasks');
      }
    }
  },

  // Función para compartir tarea (usando renderCompartir como causes)
  shareTask(taskId) {
    const task = window.tasks?.find(t => t.id == taskId);
    if (!task) {
      console.error('❌ No se encontró la tarea con ID:', taskId);
      return;
    }
    console.log('🔗 Compartiendo tarea:', task);
    if (window.renderCompartir) {
      window.renderCompartir({
        title: task.title,
        summary: task.summary || task.description?.substring(0, 120) + '...',
        photo_url: task.photo_url || '/img/task-default.jpg',
        link: `${window.location.origin}/tasks/${task.id}`,
        type: 'tarea'
      }, 'shareSection');
      
      // 🚀 FORZAR ALINEACIÓN IZQUIERDA DESPUÉS DEL RENDER 🚀
      setTimeout(() => {
        const shareSection = document.getElementById('shareSection');
        if (shareSection) {
          const allElements = shareSection.querySelectorAll('*');
          allElements.forEach(el => {
            el.style.textAlign = 'left';
          });
        }
      }, 100);
      
      document.getElementById('shareSection').scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      });
    } else {
      const link = `${window.location.origin}/tasks/${task.id}`;
      navigator.clipboard.writeText(link).then(() => {
        alert('¡Enlace copiado!');
      }).catch(() => {
        prompt('Copia este enlace:', link);
      });
    }
  }
};

// Exportar para uso global
window.tasksRenderer = TasksRenderer;

// Función para compartir tareas (igual que causes)
window.mostrarCompartirTarea = function(taskId) {
  const task = window.tasks?.find(t => t.id == taskId);
  if (!task) {
    console.error('❌ No se encontró la tarea con ID:', taskId);
    return;
  }
  if (window.renderCompartir) {
    window.renderCompartir({
      title: task.title,
      summary: task.summary || task.description?.substring(0, 120) + '...',
      photo_url: task.photo_url || '/img/task-default.jpg',
      link: `${window.location.origin}/tasks/${task.id}`,
      type: 'tarea'
    }, 'shareSection');
    document.getElementById('shareSection').scrollIntoView({ 
      behavior: 'smooth', 
      block: 'center' 
    });
  } else {
    const link = `${window.location.origin}/tasks/${task.id}`;
    navigator.clipboard.writeText(link).then(() => {
      alert('¡Enlace copiado!');
    }).catch(() => {
      prompt('Copia este enlace:', link);
    });
  }
};

// Si es un módulo ES6, también exportar
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TasksRenderer;
}

// Modal de administración de tareas: función para abrir y cargar miembros
window.openAdminTaskModal = function(task) {
  // Eliminar modal anterior si existe para evitar duplicados
  const existingModal = document.getElementById('adminTaskModal');
  if (existingModal) {
    existingModal.remove();
  }

    // Cerrar modal
  modal.querySelector('#closeAdminTaskModal').addEventListener('click', () => {
    modal.remove();
    document.body.style.overflow = '';
  });

  // Cerrar al hacer clic fuera
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
      document.body.style.overflow = '';
    }
  });

  // Tab único
  modal.querySelector('#tabMiembrosBtn').addEventListener('click', () => {
    window.loadTaskMembersAdminTab(task.id);
  });

  document.body.style.overflow = 'hidden';

  // Cargar miembros al abrir el modal
  window.loadTaskMembersAdminTab(task.id);
};

// Solo rellena el contenido, nunca crea modales ni HTML fuera del tab
window.loadTaskMembersAdminTab = async function(taskId) {
  const membersContainer = document.getElementById('adminTaskMembersTab');
  if (!membersContainer) {
    console.warn('⚠️ No existe el contenedor adminTaskMembersTab en el DOM');
    return;
  }

  membersContainer.innerHTML = `<div style="color:#6b7280; padding:1rem; text-align:center;">Cargando miembros...</div>`;

  try {
    const { data: members, error } = await supabase
      .from('task_members')
      .select('user_id, role, profiles:profiles(username, photo_url)')
      .eq('task_id', taskId);

    if (error) {
      console.error('❌ Error cargando miembros:', error);
      membersContainer.innerHTML = `<div style="color:red; padding:1rem; text-align:center;">Error al cargar miembros: ${error.message}</div>`;
      return;
    }

    if (!members || members.length === 0) {
      membersContainer.innerHTML = `<div style="color:#6b7280; padding:1rem; text-align:center;">No hay miembros en esta tarea.</div>`;
      return;
    }

    membersContainer.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:1rem;">
        ${members.map(m => `
          <div style="display:flex; align-items:center; gap:1rem; background:#f8fafc; border-radius:8px; padding:0.7rem 1rem;">
            <img src="${m.profiles?.photo_url || '/img/avatar-default.png'}" 
                 alt="${m.profiles?.username || 'Usuario'}" 
                 style="width:38px; height:38px; border-radius:50%; object-fit:cover;"
                 onerror="this.src='/img/avatar-default.png'">
            <span style="font-weight:600; color:var(--primary);">${m.profiles?.username || 'Usuario desconocido'}</span>
            <span style="margin-left:auto; background:#e5e7eb; color:#4a6fa5; border-radius:6px; padding:0.2rem 0.7rem; font-size:0.95rem;">${m.role || 'Sin rol'}</span>
          </div>
        `).join('')}
      </div>
    `;
  } catch (error) {
    console.error('❌ Error inesperado:', error);
    membersContainer.innerHTML = `<div style="color:red; padding:1rem; text-align:center;">Error inesperado al cargar miembros.</div>`;
  }
};