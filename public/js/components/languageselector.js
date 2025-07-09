// public/js/components/LanguageSelector.js
import { setLanguage } from '../i18n.js';

class LanguageSelector extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.render();
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: inline-block;
          margin-left: 15px;
        }
        select {
          padding: 8px 12px;
          border-radius: 8px;
          border: 1px solid #ddd;
          background: white;
          font-size: 14px;
          cursor: pointer;
          transition: border-color 0.2s ease;
        }
        select:hover {
          border-color: #2dd4bf;
        }
        select:focus {
          outline: none;
          border-color: #2dd4bf;
          box-shadow: 0 0 0 2px rgba(45, 212, 191, 0.1);
        }
      </style>
      <select id="lang-select">
        <option value="es">🇪🇸 Español</option>
        <option value="en">🇬🇧 English</option>
        <option value="fr">🇫🇷 Français</option>
        <option value="de">🇩🇪 Deutsch</option>
        <option value="pt">🇵🇹 Português</option>
        <option value="it">🇮🇹 Italiano</option>
        <option value="nl">🇳🇱 Nederlands</option>
        <option value="pl">🇵🇱 Polski</option>
        <option value="ru">🇷🇺 Русский</option>
      </select>
    `;

    const select = this.shadowRoot.getElementById('lang-select');
    
    // ✅ DETECTAR IDIOMA ACTUAL
    const currentLang = window.currentLang || document.documentElement.lang || 'es';
    select.value = currentLang;
    
    select.addEventListener('change', async (e) => {
      const newLang = e.target.value;
      
      try {
        // ✅ USAR LA FUNCIÓN GLOBAL (SIN IMPORT)
        if (window.setLanguage && typeof window.setLanguage === 'function') {
          await window.setLanguage(newLang);
          
          // ✅ MOSTRAR FEEDBACK VISUAL
          select.style.opacity = '0.7';
          
          // ✅ RECARGAR PÁGINA
          setTimeout(() => {
            location.reload();
          }, 100);
        } else {
          console.error('setLanguage function not available');
          // ✅ FALLBACK: Cambiar solo cookie y recargar
          document.cookie = `userLang=${newLang}; max-age=31536000; path=/; SameSite=Lax`;
          location.reload();
        }
      } catch (error) {
        console.error('Error changing language:', error);
        // ✅ FALLBACK EN CASO DE ERROR
        document.cookie = `userLang=${newLang}; max-age=31536000; path=/; SameSite=Lax`;
        location.reload();
      }
    });
  }
}

customElements.define('language-selector', LanguageSelector);