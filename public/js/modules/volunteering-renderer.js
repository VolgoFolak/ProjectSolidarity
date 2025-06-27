// Renderer modular para voluntariado
const VolunteeringRenderer = {
  // Renderizar una sola tarjeta de voluntariado
  renderCard(volunteering) {
    if (!volunteering) return '';

    const urgentBadge = volunteering.is_urgent ? `<div class="volunteering-badge urgent"><i class="fas fa-exclamation-circle"></i> Urgente</div>` : "";
    const pointsBadge = `<div class="volunteering-badge points"><i class="fas fa-star"></i> +${volunteering.points || 0} pts</div>`;
    const location = volunteering.city && volunteering.country ? `${volunteering.city}, ${volunteering.country}` : "";
    
    // Progreso basado en participantes/beneficiarios
    const progress = volunteering.beneficiaries ? Math.min(Math.round((volunteering.participants / volunteering.beneficiaries) * 100), 100) : 0;

    // Causa vinculada
    let causeHtml = '';
    if (volunteering.cause_id && volunteering.linkedCause) {
      const cause = volunteering.linkedCause;
      causeHtml = `
        <div class="linked-cause">
          <img src="${cause.photo_url || '/img/causa-default.jpg'}" alt="${cause.title}">
          <span>${cause.title}</span>
        </div>
      `;
    }

    // ¿El usuario ya participa?
    const isParticipating = volunteering.isParticipating;

    // Renderiza el botón según corresponda
    const participateBtn = isParticipating
      ? `<button class="btn btn-accent participate-btn" data-volunteering-id="${volunteering.id}" disabled style="opacity:0.7;cursor:not-allowed;">Participando</button>`
      : `<button class="btn btn-accent participate-btn" data-volunteering-id="${volunteering.id}">Participar</button>`;

    const card = `
      <div class="volunteering-card">
        <div class="volunteering-image">
          <img src="${volunteering.photo_url || '/img/volunteering-default.jpg'}" alt="${volunteering.title}" onerror="this.src='/img/volunteering-default.jpg'">
          ${urgentBadge}
          ${pointsBadge}
        </div>
        <div class="volunteering-content">
          <h3>${volunteering.title}</h3>
          <p>${volunteering.summary ? volunteering.summary : (volunteering.description.substring(0, 100) + (volunteering.description.length > 100 ? '...' : ''))}</p>
          ${causeHtml}
          <div class="volunteering-meta">
            <div class="meta-item"><i class="fas fa-map-marker-alt"></i> ${location}</div>
            <div class="meta-item"><i class="fas fa-users"></i> ${volunteering.participants || 0} voluntarios</div>
            <div class="beneficiaries-count">
              <i class="fas fa-heart"></i> Beneficia a ${volunteering.beneficiaries || 0} personas
            </div>
          </div>
          <div class="volunteering-progress">
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${progress}%"></div>
            </div>
            <div class="progress-info">
              <span>${volunteering.participants || 0} voluntarios</span>
              <span>Meta: ${volunteering.beneficiaries || 0}</span>
            </div>
          </div>
          <div class="volunteering-actions">
            <button class="btn btn-primary view-volunteering-btn" data-volunteering-id="${volunteering.id}">Ver más</button>
            ${participateBtn}
          </div>
        </div>
      </div>
    `;
    
    return card;
  },

  // Renderizar grid completo de voluntariados
  renderGrid(volunteerings, container) {
    if (!container) return;
    
    container.innerHTML = '';
    
    if (!volunteerings || volunteerings.length === 0) {
      container.innerHTML = '<div style="color:#6b7280;text-align:center;padding:2rem;grid-column:1/-1;">No se encontraron oportunidades de voluntariado.</div>';
      return;
    }

    // Guardar los voluntariados en una variable global para acceder desde el modal
    window.volunteerings = volunteerings;
    
    for (const volunteering of volunteerings) {
      const cardHtml = this.renderCard(volunteering);
      container.innerHTML += cardHtml;
    }
    
    // Agregar event listeners para los botones de ver más
    document.querySelectorAll('.view-volunteering-btn').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        const volunteeringId = this.getAttribute('data-volunteering-id');
        VolunteeringRenderer.showVolunteeringModal(volunteeringId);
      });
    });
    
    // Agregar event listeners para los botones de participar
    document.querySelectorAll('.participate-btn').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        const volunteeringId = this.getAttribute('data-volunteering-id');
        if (window.participateInVolunteering) {
          window.participateInVolunteering(volunteeringId);
        }
      });
    });

    // Verificar si hay que abrir un modal específico desde la URL
    this.checkForModalFromURL();
  },

  // Verificar si hay que abrir modal desde URL
  checkForModalFromURL() {
    const path = window.location.pathname;
    const volunteeringIdMatch = path.match(/\/volunteering\/([a-f0-9-]+)$/);
    
    if (volunteeringIdMatch) {
      const volunteeringId = volunteeringIdMatch[1];
      console.log('🔗 URL detecta voluntariado específico:', volunteeringId);
      
      // Buscar el voluntariado en los cargados
      const volunteering = window.volunteerings?.find(v => v.id === volunteeringId);
      
      if (volunteering) {
        // Si el voluntariado está cargado, abrir modal inmediatamente
        setTimeout(() => {
          this.showVolunteeringModal(volunteeringId);
        }, 100);
      } else {
        // Si no está cargado, intentar cargar desde Supabase
        setTimeout(() => {
          this.loadAndShowVolunteeringFromURL(volunteeringId);
        }, 500);
      }
    }
  },

  // Cargar voluntariado específico desde URL si no está en memoria
  async loadAndShowVolunteeringFromURL(volunteeringId) {
    try {
      const { data: volunteering, error } = await supabase
        .from('volunteering')
        .select('*')
        .eq('id', volunteeringId)
        .single();

      if (error || !volunteering) {
        console.error('❌ Error cargando voluntariado desde URL:', error);
        // Redirigir a la página general de voluntariado
        window.history.replaceState({}, '', '/volunteering');
        return;
      }

      // Añadir el voluntariado a window.volunteerings si no existe
      if (!window.volunteerings) {
        window.volunteerings = [];
      }
      
      // Verificar si ya existe para evitar duplicados
      if (!window.volunteerings.find(v => v.id === volunteeringId)) {
        window.volunteerings.push(volunteering);
      }

      // Abrir el modal
      this.showVolunteeringModal(volunteeringId);
    } catch (error) {
      console.error('❌ Error cargando voluntariado:', error);
      window.history.replaceState({}, '', '/volunteering');
    }
  },

  // Función para mostrar el modal con los detalles del voluntariado
  async showVolunteeringModal(volunteeringId) {
    const { data: volunteering, error } = await supabase
      .from('volunteering')
      .select('*')
      .eq('id', volunteeringId)
      .single();

    if (error) {
      alert('Error al cargar el voluntariado: ' + error.message);
      return;
    }

    // Progreso basado en participants/beneficiaries
    const progress = volunteering.beneficiaries
      ? Math.min(Math.round((volunteering.participants / volunteering.beneficiaries) * 100), 100)
      : 0;

    const createdDate = new Date(volunteering.created_at).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Obtener información de la causa vinculada si existe
    let causeInfo = '';
    if (volunteering.cause_id) {
      const { data: cause } = await supabase
        .from('causes')
        .select('title, short_description, photo_url')
        .eq('id', volunteering.cause_id)
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
              <a href="/causes/${volunteering.cause_id}"
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
      .from('volunteering_members')
      .select('user_id, profiles(username, photo_url)')
      .eq('volunteering_id', volunteeringId);

    let participantsHtml = '';
    if (members && members.length > 0) {
      participantsHtml = `
        <div class="content-section" style="margin-bottom:2.2rem;">
          <h3 class="content-title" style="font-size:1.2rem; font-weight:600; color:var(--primary); margin-bottom:0.9rem;">
            <i class="fas fa-users"></i> Voluntarios
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
    let modal = document.getElementById('volunteeringModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'volunteeringModal';
      modal.className = 'modal';
      modal.style.cssText = 'display:none; position:fixed; z-index:9999; left:0; top:0; width:100vw; height:100vh; background:rgba(0,0,0,0.35); align-items:center; justify-content:center;';
      modal.innerHTML = `
        <div class="modal-content" style="background:#fff; border-radius:18px; max-width:800px; width:95vw; padding:2rem; box-shadow:0 8px 32px rgba(74,111,165,0.13); position:relative; max-height:90vh; overflow-y:auto;">
          <button id="closeVolunteeringModal" style="position:absolute; top:1.5rem; right:1.5rem; background:none; border:none; font-size:1.8rem; color:#6b7280; cursor:pointer;">&times;</button>
          <div id="volunteeringModalBody"></div>
        </div>
      `;
      document.body.appendChild(modal);

      // Event listeners para cerrar
      modal.querySelector('#closeVolunteeringModal').addEventListener('click', () => {
        this.closeModal();
      });
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          this.closeModal();
        }
      });
    }

    // Llenar contenido del modal
    document.getElementById('volunteeringModalBody').innerHTML = `
      <h1 style="font-size:2rem; font-weight:800; color:var(--primary); margin-bottom:2rem; text-align:center;">${volunteering.title}</h1>
      <div style="display:flex; gap:2rem; margin-bottom:2rem;">
        <div style="flex:1; min-width:320px; height:300px; border-radius:12px; overflow:hidden; position:relative;">
          <img src="${volunteering.photo_url || '/img/volunteering-default.jpg'}" 
               alt="Imagen del voluntariado ${volunteering.title}"
               style="width:100%;height:100%;object-fit:cover;"
               onerror="this.src='/img/volunteering-default.jpg'">
          ${volunteering.is_urgent ? `<div style="position:absolute; top:1rem; right:1rem; background:var(--urgent); color:white; padding:0.5rem 1rem; border-radius:50px; font-size:0.9rem; font-weight:600;"><i class="fas fa-exclamation-circle"></i> Urgente</div>` : ''}
        </div>
        <div style="flex:1.5;">
          <div style="background:#f8fafc; padding:1.5rem; border-radius:12px; margin-bottom:1.5rem;">
            <div class="progress-bar" style="height:8px; background:#e5e7eb; border-radius:4px; overflow:hidden; margin-bottom:0.5rem;">
              <div class="progress-fill" style="width:${progress}%; height:100%; background:var(--primary);"></div>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:0.9rem; color:#6b7280;">
              <span>${progress}% completado</span>
              <span>${volunteering.participants || 0} de ${volunteering.beneficiaries || 0} voluntarios</span>
            </div>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.7rem; margin-bottom:1.2rem;">
            <div style="display:flex; align-items:center; gap:0.5rem; color:#6b7280;">
              <i class="fas fa-map-marker-alt" style="color:var(--primary);"></i>
              <span>${volunteering.city || 'Sin ubicación'}${volunteering.country ? ', ' + volunteering.country : ''}</span>
            </div>
            <div style="display:flex; align-items:center; gap:0.5rem; color:#6b7280;">
              <i class="fas fa-users" style="color:var(--primary);"></i>
              <span>${volunteering.participants || 0} voluntarios</span>
            </div>
            <div style="display:flex; align-items:center; gap:0.5rem; color:#6b7280;">
              <i class="fas fa-heart" style="color:var(--primary);"></i>
              <span>${volunteering.beneficiaries || 0} beneficiarios</span>
            </div>
            <div style="display:flex; align-items:center; gap:0.5rem; color:#6b7280;">
              <i class="fas fa-calendar-alt" style="color:var(--primary);"></i>
              <span>${volunteering.end_date ? new Date(volunteering.end_date).toLocaleDateString('es-ES') : 'Sin fecha límite'}</span>
            </div>
          </div>
          <div style="background:#f0f9ff; border-left:4px solid var(--accent); padding:0.8rem; border-radius:0 8px 8px 0;">
            <i class="fas fa-star" style="color:var(--accent);"></i>
            Participar otorgará <strong>${volunteering.points || 20} puntos</strong> de impacto
          </div>
        </div>
      </div>
      ${causeInfo}
      <div style="margin-bottom:2rem;">
        <h3 style="font-size:1.2rem; font-weight:600; color:var(--primary); margin-bottom:0.9rem;">
          <i class="fas fa-align-left"></i> Resumen
        </h3>
        <p style="line-height:1.7; color:#4b5563; margin-bottom:2rem;">
          ${volunteering.summary || 'No hay resumen disponible para este voluntariado.'}
        </p>
        <h3 style="font-size:1.2rem; font-weight:600; color:var(--primary); margin-bottom:0.9rem;">
          <i class="fas fa-info-circle"></i> Descripción completa
        </h3>
        <p style="line-height:1.7; color:#4b5563;">
          ${volunteering.description || 'No hay descripción disponible para este voluntariado.'}
        </p>
      </div>
      ${participantsHtml}
      <div style="display:flex; gap:0.8rem; margin-top:2rem;">
        <button class="btn btn-primary" style="flex:1;" onclick="window.participateInVolunteering('${volunteering.id}')">
          <i class="fas fa-hand-holding-heart"></i> Participar
        </button>
        <button class="btn btn-accent" style="flex:1;" onclick="VolunteeringRenderer.shareVolunteering('${volunteering.id}')">
          <i class="fas fa-share-alt"></i> Compartir
        </button>
      </div>
      <div class="share-section" id="shareSection"></div>
    `;

    // Mostrar modal
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // Actualizar URL si estamos en la página de voluntariado
    if (window.location.pathname === '/volunteering' || window.location.pathname === '/volunteering/') {
      window.history.pushState({}, '', `/volunteering/${volunteeringId}`);
    }
  },

  // Cerrar modal y limpiar URL
  closeModal() {
    const modal = document.getElementById('volunteeringModal');
    if (modal) {
      modal.style.display = 'none';
      document.body.style.overflow = '';
      
      // Limpiar URL si es necesario
      if (window.location.pathname.includes('/volunteering/') && window.location.pathname !== '/volunteering') {
        window.history.pushState({}, '', '/volunteering');
      }
    }
  },

  // Función para compartir voluntariado
  shareVolunteering(volunteeringId) {
    const volunteering = window.volunteerings?.find(v => v.id == volunteeringId);
    if (!volunteering) {
      console.error('❌ No se encontró el voluntariado con ID:', volunteeringId);
      return;
    }
    
    console.log('🔗 Compartiendo voluntariado:', volunteering);
    
    if (window.renderCompartir) {
      window.renderCompartir({
        title: volunteering.title,
        summary: volunteering.summary || volunteering.description?.substring(0, 120) + '...',
        photo_url: volunteering.photo_url || '/img/volunteering-default.jpg',
        link: `${window.location.origin}/volunteering/${volunteering.id}`,
        type: 'voluntariado'
      }, 'shareSection');
      
      document.getElementById('shareSection').scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      });
    } else {
      // Fallback si no está compartir.js
      const link = `${window.location.origin}/volunteering/${volunteering.id}`;
      navigator.clipboard.writeText(link).then(() => {
        alert('¡Enlace copiado!');
      }).catch(() => {
        prompt('Copia este enlace:', link);
      });
    }
  }
};

// Exportar para uso global
window.volunteeringRenderer = VolunteeringRenderer;

// Función para compartir voluntariados
window.mostrarCompartirVolunteering = function(volunteeringId) {
  const volunteering = window.volunteerings?.find(v => v.id == volunteeringId);
  if (!volunteering) {
    console.error('❌ No se encontró el voluntariado con ID:', volunteeringId);
    return;
  }
  
  console.log('🔗 Compartiendo voluntariado:', volunteering);
  
  if (window.renderCompartir) {
    window.renderCompartir({
      title: volunteering.title,
      summary: volunteering.summary || volunteering.description?.substring(0, 120) + '...',
      photo_url: volunteering.photo_url || '/img/volunteering-default.jpg',
      link: `${window.location.origin}/volunteering/${volunteering.id}`,
      type: 'voluntariado'
    }, 'shareSection');
    
    document.getElementById('shareSection').scrollIntoView({ 
      behavior: 'smooth', 
      block: 'center' 
    });
  } else {
    // Fallback si no está compartir.js
    const link = `${window.location.origin}/volunteering/${volunteering.id}`;
    navigator.clipboard.writeText(link).then(() => {
      alert('¡Enlace copiado!');
    }).catch(() => {
      prompt('Copia este enlace:', link);
    });
  }
};

// Función auxiliar para participar en voluntariados
window.participateInVolunteering = async function(volunteeringId) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    alert('Debes iniciar sesión para participar.');
    return;
  }
  const userId = session.user.id;
  
  await supabase
    .from('volunteering_members')
    .insert([{ volunteering_id: volunteeringId, user_id: userId, role: 'volunteer', status: 'active' }])
    .then(() => {
      alert('¡Ahora eres voluntario en esta actividad!');
      VolunteeringRenderer.closeModal();
    })
    .catch(error => {
      console.error('Error al unirse al voluntariado:', error);
      alert('No se pudo unir al voluntariado. Inténtalo nuevamente más tarde.');
    });
};

// Si es un módulo ES6, también exportar
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VolunteeringRenderer;
}