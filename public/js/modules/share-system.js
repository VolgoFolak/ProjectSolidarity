// Sistema universal de compartir
console.log('🔗 Cargando Sistema de Compartir Universal');

// Función principal para renderizar opciones de compartir
window.renderCompartir = function(item, containerId) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error('❌ No se encontró el contenedor:', containerId);
    return;
  }

  const shareUrl = item.link || window.location.href;
  const shareTitle = item.title || 'Solidarity';
  const shareText = item.summary || '';
  const shareImage = item.photo_url || '';
  const itemType = item.type || 'contenido';

  // Limpiar contenedor
  container.innerHTML = '';

  // HTML del sistema de compartir
  const shareHtml = `
    <div class="share-container" style="background:#f8fafc; border-radius:12px; padding:1.5rem; margin-top:1.5rem; border:1px solid #e5e7eb;">
      <h4 style="color:var(--primary); font-weight:700; margin-bottom:1rem; display:flex; align-items:center; gap:0.5rem;">
        <i class="fas fa-share-alt"></i> Compartir este ${itemType}
      </h4>
      
      <!-- Preview del contenido -->
      <div class="share-preview" style="background:white; border-radius:8px; padding:1rem; margin-bottom:1.5rem; border:1px solid #e5e7eb; display:flex; gap:1rem; align-items:center;">
        ${shareImage ? `<img src="${shareImage}" alt="Preview" style="width:60px; height:60px; border-radius:6px; object-fit:cover; flex-shrink:0;">` : ''}
        <div style="flex:1; min-width:0;">
          <div style="font-weight:600; color:var(--dark); margin-bottom:0.3rem; font-size:0.95rem;">${shareTitle}</div>
          <div style="color:#6b7280; font-size:0.85rem; line-height:1.4;">${shareText}</div>
        </div>
      </div>

      <!-- Botones de redes sociales -->
      <div class="share-buttons" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:0.8rem; margin-bottom:1.5rem;">
        <button onclick="shareToFacebook('${shareUrl}')" class="share-btn facebook" style="background:#1877f2; color:white; border:none; padding:0.7rem 1rem; border-radius:8px; font-weight:600; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:0.5rem; transition:all 0.3s ease;">
          <i class="fab fa-facebook-f"></i> Facebook
        </button>
        <button onclick="shareToTwitter('${shareUrl}', '${shareTitle.replace(/'/g, "\\'")}', '${shareText.replace(/'/g, "\\'")}')" class="share-btn twitter" style="background:#1da1f2; color:white; border:none; padding:0.7rem 1rem; border-radius:8px; font-weight:600; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:0.5rem; transition:all 0.3s ease;">
          <i class="fab fa-twitter"></i> Twitter
        </button>
        <button onclick="shareToLinkedIn('${shareUrl}', '${shareTitle.replace(/'/g, "\\'")}', '${shareText.replace(/'/g, "\\'")}')" class="share-btn linkedin" style="background:#0077b5; color:white; border:none; padding:0.7rem 1rem; border-radius:8px; font-weight:600; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:0.5rem; transition:all 0.3s ease;">
          <i class="fab fa-linkedin-in"></i> LinkedIn
        </button>
        <button onclick="shareToWhatsApp('${shareUrl}', '${shareTitle.replace(/'/g, "\\'")} - ${shareText.replace(/'/g, "\\'")}')" class="share-btn whatsapp" style="background:#25d366; color:white; border:none; padding:0.7rem 1rem; border-radius:8px; font-weight:600; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:0.5rem; transition:all 0.3s ease;">
          <i class="fab fa-whatsapp"></i> WhatsApp
        </button>
        <button onclick="shareToTelegram('${shareUrl}', '${shareTitle.replace(/'/g, "\\'")} - ${shareText.replace(/'/g, "\\'")}')" class="share-btn telegram" style="background:#0088cc; color:white; border:none; padding:0.7rem 1rem; border-radius:8px; font-weight:600; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:0.5rem; transition:all 0.3s ease;">
          <i class="fab fa-telegram-plane"></i> Telegram
        </button>
        <button onclick="shareByEmail('${shareTitle.replace(/'/g, "\\'")}', '${shareText.replace(/'/g, "\\'")}', '${shareUrl}')" class="share-btn email" style="background:#6b7280; color:white; border:none; padding:0.7rem 1rem; border-radius:8px; font-weight:600; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:0.5rem; transition:all 0.3s ease;">
          <i class="fas fa-envelope"></i> Email
        </button>
      </div>

      <!-- Copiar enlace -->
      <div class="copy-link-section" style="background:white; border-radius:8px; padding:1rem; border:1px solid #e5e7eb;">
        <label style="font-weight:600; color:var(--dark); margin-bottom:0.5rem; display:block; font-size:0.9rem;">
          <i class="fas fa-link"></i> Enlace directo:
        </label>
        <div style="display:flex; gap:0.5rem;">
          <input type="text" id="shareUrlInput-${containerId}" value="${shareUrl}" readonly style="flex:1; padding:0.7rem; border:1px solid #e5e7eb; border-radius:6px; background:#f8fafc; font-size:0.85rem; color:#4b5563;">
          <button onclick="copyShareUrl('${containerId}')" class="copy-btn" style="background:var(--accent); color:white; border:none; padding:0.7rem 1rem; border-radius:6px; font-weight:600; cursor:pointer; white-space:nowrap; transition:all 0.3s ease;">
            <i class="fas fa-copy"></i> Copiar
          </button>
        </div>
      </div>
    </div>
  `;

  container.innerHTML = shareHtml;
  console.log('✅ Sistema de compartir renderizado para:', shareTitle);
};

// Funciones específicas para cada red social
window.shareToFacebook = function(url) {
  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
  window.open(facebookUrl, '_blank', 'width=600,height=400,scrollbars=yes,resizable=yes');
};

window.shareToTwitter = function(url, title, text) {
  const twitterUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title + ' - ' + text)}`;
  window.open(twitterUrl, '_blank', 'width=600,height=400,scrollbars=yes,resizable=yes');
};

window.shareToLinkedIn = function(url, title, summary) {
  const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}&summary=${encodeURIComponent(summary)}`;
  window.open(linkedinUrl, '_blank', 'width=600,height=400,scrollbars=yes,resizable=yes');
};

window.shareToWhatsApp = function(url, text) {
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`;
  window.open(whatsappUrl, '_blank');
};

window.shareToTelegram = function(url, text) {
  const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
  window.open(telegramUrl, '_blank');
};

window.shareByEmail = function(subject, body, url) {
  const emailUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body + '\n\n' + url)}`;
  window.location.href = emailUrl;
};

// Función para copiar URL
window.copyShareUrl = function(containerId) {
  const input = document.getElementById(`shareUrlInput-${containerId}`);
  if (input) {
    input.select();
    input.setSelectionRange(0, 99999); // Para móviles
    
    navigator.clipboard.writeText(input.value).then(() => {
      // Cambiar texto del botón temporalmente
      const copyBtn = input.parentElement.querySelector('.copy-btn');
      const originalText = copyBtn.innerHTML;
      copyBtn.innerHTML = '<i class="fas fa-check"></i> ¡Copiado!';
      copyBtn.style.background = '#10b981';
      
      setTimeout(() => {
        copyBtn.innerHTML = originalText;
        copyBtn.style.background = 'var(--accent)';
      }, 2000);
    }).catch(() => {
      // Fallback para navegadores que no soportan clipboard API
      alert('Enlace copiado: ' + input.value);
    });
  }
};

// Función universal de compartir (fallback)
window.universalShare = function(item) {
  if (navigator.share) {
    navigator.share({
      title: item.title,
      text: item.summary,
      url: item.link
    }).catch(console.error);
  } else {
    // Fallback: copiar al portapapeles
    const url = item.link || window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      alert('¡Enlace copiado al portapapeles!');
    }).catch(() => {
      prompt('Copia este enlace:', url);
    });
  }
};

// Estilos adicionales para botones hover
const shareStyles = `
<style>
.share-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

.copy-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

@media (max-width: 768px) {
  .share-buttons {
    grid-template-columns: 1fr 1fr !important;
  }
}
</style>
`;

// Inyectar estilos
if (!document.querySelector('#share-system-styles')) {
  const styleElement = document.createElement('div');
  styleElement.id = 'share-system-styles';
  styleElement.innerHTML = shareStyles;
  document.head.appendChild(styleElement);
}

console.log('✅ Sistema de Compartir Universal cargado');