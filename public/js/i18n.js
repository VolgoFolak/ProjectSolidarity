// public/js/i18n.js
class I18nSystem {
  constructor() {
    this.translations = {};
    this.currentLang = 'es';
    this.cache = new Map();
    this.supportedLangs = ['es', 'en', 'fr', 'de', 'pt', 'it', 'nl', 'pl', 'ru', 'sv', 'no', 'en-US', 'ja', 'ko'];
  }

  async init(lang) {
    this.currentLang = lang;
    
    if (lang === 'es') {
      this.translations = {};
      document.dispatchEvent(new CustomEvent('i18nReady'));
      return;
    }
    
    await this.loadLanguage(lang);
    document.dispatchEvent(new CustomEvent('i18nReady'));
  }

  async loadLanguage(lang) {
    if (lang === 'es') {
      this.translations = {};
      return;
    }

    if (this.cache.has(lang)) {
      this.translations = this.cache.get(lang);
      return;
    }

    try {
      const response = await fetch(`/i18n/${lang}.json`);
      if (!response.ok) throw new Error(`Language ${lang} not found`);
      
      const data = await response.json();
      this.cache.set(lang, data);
      this.translations = data;
    } catch (error) {
      console.warn(`Failed to load language ${lang}:`, error);
      if (lang !== 'es') {
        this.translations = {};
      }
    }
  }

  t(key, params = {}) {
    const keys = key.split('.');
    let current = this.translations;
    
    for (const k of keys) {
      if (current && typeof current === 'object' && current[k] !== undefined) {
        current = current[k];
      } else {
        current = null;
        break;
      }
    }
    
    let result = current || key;
    
    if (typeof result === 'string' && params) {
      Object.keys(params).forEach(param => {
        result = result.replace(new RegExp(`\\{\\{${param}\\}\\}`, 'g'), params[param]);
      });
    }
    
    return result;
  }

  async setLanguage(lang) {
    if (!this.supportedLangs.includes(lang)) {
      console.error(`❌ Idioma ${lang} no soportado`);
      return false;
    }
    
    try {
      await this.init(lang);
      
      document.cookie = `userLang=${lang}; max-age=31536000; path=/; SameSite=Lax`;
      
      document.documentElement.lang = lang;
      document.body.className = document.body.className.replace(/lang-\w+/g, '').trim() + ` lang-${lang}`;
      document.body.setAttribute('data-lang', lang);
      
      translateElements();
      
      try {
        await fetch('/set-language', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lang })
        });
      } catch (error) {
        console.warn('⚠️ No se pudo guardar preferencia en servidor:', error);
      }
      
      document.dispatchEvent(new CustomEvent('languageChanged', { 
        detail: { lang, previousLang: this.currentLang } 
      }));
      
      return true;
    } catch (error) {
      console.error(`❌ Error cambiando idioma a ${lang}:`, error);
      return false;
    }
  }

  getCurrentLanguage() {
    return this.currentLang;
  }
}

function translateElement(element, key, params = {}) {
  if (window.i18n.currentLang === 'es') {
    return;
  }
  
  let text = window.t(key, params);
  
  if (element.tagName === 'INPUT') {
    if (element.type === 'submit' || element.type === 'button') {
      element.value = text;
    } else {
      element.placeholder = text;
    }
  } else if (element.hasAttribute('title')) {
    element.title = text;
  } else {
    if (text.includes('<') && text.includes('>')) {
      element.innerHTML = text;
    } else {
      element.textContent = text;
    }
  }
}

function translateElements() {
  if (window.i18n.currentLang === 'es') {
    return;
  }
  
  const elementsToTranslate = document.querySelectorAll('[data-i18n]');
  
  elementsToTranslate.forEach(element => {
    const key = element.getAttribute('data-i18n');
    const params = element.dataset.i18nParams ? JSON.parse(element.dataset.i18nParams) : {};
    translateElement(element, key, params);
  });
}

// Instancia global
const i18n = new I18nSystem();
window.t = (key, params) => i18n.t(key, params);
window.i18n = i18n;
window.translateElement = translateElement;
window.translateElements = translateElements;
window.setLanguage = (lang) => i18n.setLanguage(lang);

// Auto-inicializar
document.addEventListener('DOMContentLoaded', async () => {
  const currentLang = 
    window.currentLang || 
    document.documentElement.lang || 
    document.body.getAttribute('data-lang') ||
    localStorage.getItem('userLang') ||
    'es';
    
  await i18n.init(currentLang);
  translateElements();
});

// Observador para contenido dinámico
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.type === 'childList') {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const elementsToTranslate = node.querySelectorAll ? 
            node.querySelectorAll('[data-i18n]') : [];
          elementsToTranslate.forEach(element => {
            const key = element.getAttribute('data-i18n');
            const params = element.dataset.i18nParams ? 
              JSON.parse(element.dataset.i18nParams) : {};
            translateElement(element, key, params);
          });
        }
      });
    }
  });
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { i18n, translateElement, translateElements };
}