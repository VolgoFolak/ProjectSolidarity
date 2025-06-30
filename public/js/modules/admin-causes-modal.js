export function initAdminCausesModal({ supabase }) {
  let currentCause = null;

  // --- Abrir el modal de administración ---
  window.openAdminCauseModal = async function(cause) {
    currentCause = cause;
    
    const modal = document.getElementById('adminCauseModal');
    const title = document.getElementById('adminCauseModalTitle');
    
    if (!modal || !title) {
      console.error('Admin cause modal elements not found');
      return;
    }

    title.textContent = `Administrar ${cause.title}`;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Resetear tabs con verificación de existencia
    document.querySelectorAll('.admin-cause-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.admin-cause-tab-content').forEach(tab => tab.classList.remove('active'));
    
    const overviewTab = document.querySelector('.admin-cause-tab[data-tab="overview"]');
    const overviewContent = document.getElementById('overviewCauseTab');
    if (overviewTab) overviewTab.classList.add('active');
    if (overviewContent) overviewContent.classList.add('active');

    // Cargar datos de forma segura
    await loadCauseStats(cause);
    fillSettingsForm(cause);
    await loadCauseMembers(cause.id);
    
    const messageField = document.getElementById('causeMessage');
    if (messageField) messageField.value = cause.message || '';
  };

  // --- Función global para cerrar modal ---
  window.closeAdminCauseModal = function() {
    const modal = document.getElementById('adminCauseModal');
    if (modal) {
      modal.classList.remove('active');
      document.body.style.overflow = '';
    }
  };

  // --- Event listeners para cerrar modal ---
  const closeBtn = document.getElementById('closeAdminCauseModal');
  const modal = document.getElementById('adminCauseModal');
  
  if (closeBtn) {
    closeBtn.onclick = window.closeAdminCauseModal;
  }
  
  if (modal) {
    modal.onclick = function(e) {
      if (e.target === this) {
        window.closeAdminCauseModal();
      }
    };
  }

  // --- Tabs ---
  document.querySelectorAll('.admin-cause-tab').forEach(tab => {
    tab.onclick = function() {
      document.querySelectorAll('.admin-cause-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.admin-cause-tab-content').forEach(c => c.classList.remove('active'));
      
      this.classList.add('active');
      const tabId = this.getAttribute('data-tab');
      const tabContent = document.getElementById(tabId + 'CauseTab');
      
      if (tabContent) tabContent.classList.add('active');
      if (tabId === 'members' && currentCause) loadCauseMembers(currentCause.id);
    };
  });

  // --- Formulario de configuración optimizado ---
  function fillSettingsForm(cause) {
    const fields = {
      'editCauseTitle': cause.title || '',
      'editCauseSummary': cause.short_description || '',
      'editCauseDesc': cause.description || '',
      'editCauseGoal': cause.goal || '',
      'editCauseBeneficiaries': cause.beneficiaries || '',
      'editCauseCity': cause.city || '',
      'editCauseCountry': cause.country || '',
      'editCausePoints': cause.points || 50
    };

    Object.entries(fields).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) element.value = value;
    });

    // Manejar preview de imagen
    const preview = document.getElementById('editCausePhotoPreview');
    if (preview) {
      if (cause.photo_url) {
        preview.src = cause.photo_url;
        preview.style.display = 'block';
      } else {
        preview.style.display = 'none';
      }
    }

    updatePointsText(cause.points || 50);
  }

  function updatePointsText(points) {
    const pointsText = document.getElementById('editPointsText');
    if (pointsText) {
      pointsText.innerHTML = `<i class="fas fa-star"></i> Colaborar en esta causa otorgará <strong>${points} puntos</strong> a cada participante.`;
    }
  }

  // Event listeners con verificación de existencia y prevención de duplicados
  const photoInput = document.getElementById('editCausePhoto');
  if (photoInput && !photoInput.hasAttribute('data-listener-added')) {
    photoInput.setAttribute('data-listener-added', 'true');
    photoInput.addEventListener('change', function(e) {
      const file = e.target.files[0];
      const preview = document.getElementById('editCausePhotoPreview');
      if (file && preview) {
        const reader = new FileReader();
        reader.onload = function(evt) {
          preview.src = evt.target.result;
          preview.style.display = 'block';
        };
        reader.readAsDataURL(file);
      } else if (preview) {
        preview.style.display = 'none';
      }
    });
  }

  const pointsInput = document.getElementById('editCausePoints');
  if (pointsInput && !pointsInput.hasAttribute('data-listener-added')) {
    pointsInput.setAttribute('data-listener-added', 'true');
    pointsInput.addEventListener('input', function() {
      updatePointsText(this.value || 0);
    });
  }

  // Formulario de configuración con mejor manejo de errores
  const settingsForm = document.getElementById('causeSettingsForm');
  if (settingsForm && !settingsForm.hasAttribute('data-listener-added')) {
    settingsForm.setAttribute('data-listener-added', 'true');
    settingsForm.onsubmit = async function(e) {
      e.preventDefault();
      if (!currentCause) return;

      try {
        const updates = {
          title: document.getElementById('editCauseTitle')?.value?.trim() || '',
          short_description: document.getElementById('editCauseSummary')?.value?.trim() || '',
          description: document.getElementById('editCauseDesc')?.value?.trim() || '',
          goal: parseFloat(document.getElementById('editCauseGoal')?.value || 0),
          beneficiaries: parseInt(document.getElementById('editCauseBeneficiaries')?.value || 0, 10),
          city: document.getElementById('editCauseCity')?.value?.trim() || '',
          country: document.getElementById('editCauseCountry')?.value?.trim() || '',
          points: parseInt(document.getElementById('editCausePoints')?.value || 50, 10)
        };

        // Manejo de imagen
        const fileInput = document.getElementById('editCausePhoto');
        if (fileInput?.files[0]) {
          const file = fileInput.files[0];
          const fileExt = file.name.split('.').pop();
          const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
          const filePath = `public/${fileName}`;
          
          const { error: uploadError } = await supabase.storage
            .from('causes')
            .upload(filePath, file, { upsert: true });
            
          if (uploadError) {
            alert('Error subiendo la foto: ' + uploadError.message);
            return;
          }
          
          const { data } = supabase.storage.from('causes').getPublicUrl(filePath);
          updates.photo_url = data.publicUrl;
        }

        const { error } = await supabase
          .from('causes')
          .update(updates)
          .eq('id', currentCause.id);

        if (!error) {
          alert('Causa actualizada correctamente');
          window.closeAdminCauseModal();
          if (typeof window.loadUserActivities === 'function') window.loadUserActivities();
        } else {
          alert('Error al guardar cambios: ' + error.message);
        }
      } catch (error) {
        console.error('Error updating cause:', error);
        alert('Error al actualizar la causa');
      }
    };
  }

  // --- Cargar stats resumen con manejo seguro ---
  async function loadCauseStats(cause) {
    try {
      // Miembros
      const { count: membersCount, error: membersError } = await supabase
        .from('causes_members')
        .select('user_id', { count: 'exact', head: true })
        .eq('cause_id', cause.id)
        .neq('role', 'pending');

      const membersCountEl = document.getElementById('membersCount');
      if (membersCountEl) {
        membersCountEl.textContent = membersError ? (cause.members_count || 0) : membersCount;
      }

      // Beneficiarios
      const beneficiariesEl = document.getElementById('beneficiariesCount');
      if (beneficiariesEl) {
        beneficiariesEl.textContent = cause.beneficiaries || 0;
      }

      // Puntos de impacto
      const impactEl = document.getElementById('impactPoints');
      if (impactEl) {
        impactEl.textContent = cause.points || 0;
      }

      // Progreso de recaudación
      const recaudado = cause.raised || 0;
      const meta = cause.goal || 0;
      const porcentaje = meta ? Math.min(100, Math.round((recaudado / meta) * 100)) : 0;
      
      const progressBar = document.getElementById('causeProgress');
      const progressPercent = document.getElementById('progressPercent');
      const progressAmount = document.getElementById('progressAmount');
      
      if (progressBar) progressBar.style.width = porcentaje + '%';
      if (progressPercent) progressPercent.textContent = `${porcentaje}% completado`;
      if (progressAmount) progressAmount.textContent = `${recaudado} € de ${meta} €`;
    } catch (error) {
      console.error('Error loading cause stats:', error);
    }
  }

  // --- Cargar miembros ---
  async function loadCauseMembers(causeId) {
    try {
      const { data: members, error: membersError } = await supabase
        .from('causes_members')
        .select('user_id, role')
        .eq('cause_id', causeId)
        .neq('role', 'pending');

      if (membersError) {
        console.error('Error cargando miembros:', membersError);
        return;
      }

      const container = document.getElementById('membersList');
      if (!container) return;

      if (!members || members.length === 0) {
        container.innerHTML = '<div style="color:#888;">No hay miembros en esta causa.</div>';
        return;
      }

      // Cargar avatares y usernames
      const userIds = members.map(m => m.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, photo_url')
        .in('id', userIds);

      // Renderizar miembros
      container.innerHTML = '';
      members.forEach(member => {
        const profile = profiles?.find(a => a.id === member.user_id) || {};
        const avatar = profile.photo_url || 'https://via.placeholder.com/40?text=U';
        const username = profile.username || member.user_id;
        const memberItem = document.createElement('div');
        memberItem.className = 'member-item';
        memberItem.innerHTML = `
          <div class="member-info">
            <img src="${avatar}" alt="${username}" class="member-avatar" loading="lazy">
            <span class="member-name">${username}</span>
          </div>
          <div class="member-actions">
            <span class="role-badge ${member.role === 'founder' ? 'admin' : 'member'}">
              <i class="fas fa-user"></i> ${member.role}
            </span>
          </div>
        `;
        container.appendChild(memberItem);
      });
    } catch (error) {
      console.error('Error loading cause members:', error);
    }
  }

  // --- Event listeners para botones con prevención de duplicados ---
  const saveMessageBtn = document.getElementById('saveCauseMessageBtn');
  if (saveMessageBtn && !saveMessageBtn.hasAttribute('data-listener-added')) {
    saveMessageBtn.setAttribute('data-listener-added', 'true');
    saveMessageBtn.onclick = async function() {
      if (!currentCause) return;
      
      try {
        const message = document.getElementById('causeMessage')?.value?.trim() || '';
        const { error } = await supabase
          .from('causes')
          .update({ message })
          .eq('id', currentCause.id);
        
        if (!error) {
          alert('Mensaje publicado correctamente.');
        } else {
          alert('Error al guardar mensaje: ' + error.message);
        }
      } catch (error) {
        console.error('Error saving message:', error);
        alert('Error al guardar el mensaje');
      }
    };
  }

  const inviteBtn = document.getElementById('sendCauseInviteBtn');
  if (inviteBtn && !inviteBtn.hasAttribute('data-listener-added')) {
    inviteBtn.setAttribute('data-listener-added', 'true');
    inviteBtn.onclick = async function() {
      const email = document.getElementById('inviteCauseEmail')?.value?.trim();
      const role = document.getElementById('inviteCauseRole')?.value;
      
      if (!email) {
        alert('Introduce un correo electrónico.');
        return;
      }
      
      // TODO: Implementar lógica real de invitación
      alert(`Invitación enviada a ${email} como ${role}. (Implementa la lógica real en el backend)`);
      
      const emailField = document.getElementById('inviteCauseEmail');
      if (emailField) emailField.value = '';
    };
  }
}
