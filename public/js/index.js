document.addEventListener('DOMContentLoaded', async () => {
  // Cargar causas desde Supabase
  const { data: causas, error } = await supabase
    .from('causas')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(3);

  if (error) {
    // Muestra un mensaje de error en la UI si quieres
    return;
  }

  const grid = document.querySelector('.causes-grid');
  if (!grid) return;

  grid.innerHTML = '';
  causas.forEach(causa => {
    grid.innerHTML += `
      <div class="cause-card">
        <div class="cause-image">
          <img src="${causa.imagen_url}" alt="${causa.titulo}">
        </div>
        <div class="cause-content">
          <h3>${causa.titulo}</h3>
          <p>${causa.descripcion}</p>
          <div class="progress-container">
            <div class="progress-bar">
              <div class="progress" style="width: ${causa.progreso || 0}%;"></div>
            </div>
            <div class="progress-info">
              <span>${causa.recaudado || 0} recaudados</span>
              <span>${causa.progreso || 0}%</span>
            </div>
          </div>
          <a href="#" class="btn btn-primary btn-sm">
            <i class="fas fa-heart"></i> Apoyar
          </a>
        </div>
      </div>
    `;
  });
});