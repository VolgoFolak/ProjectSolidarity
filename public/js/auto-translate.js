/**
 * Sistema de traducción automática EXPANDIDO
 * Soporta 40+ idiomas mayoritarios mundiales
 */

class AutoTranslate {
  constructor() {
    // ✅ IDIOMAS MAYORITARIOS MUNDIALES (40+ idiomas)
    this.supportedLangs = [
      // Idiomas principales (100M+ hablantes)
      'en', 'zh-CN', 'hi', 'ar', 'pt', 'ru', 'ja', 'fr', 'de', 'ko', 'tr', 'vi', 'it', 'th', 'pl',
      
      // Idiomas europeos importantes
      'nl', 'sv', 'da', 'no', 'fi', 'he', 'cs', 'hu', 'ro', 'bg', 'hr', 'sk', 'sl', 'et', 'lv', 'lt', 'mt', 'el',
      
      // Idiomas asiáticos importantes
      'id', 'ms', 'tl', 'uk',
      
      // Idiomas regionales españoles
      'ca', 'eu', 'gl'
    ];
    
    // ✅ NOMBRES DE IDIOMAS EXPANDIDOS
    this.langNames = {
      // Principales idiomas mundiales
      'en': 'English', 'zh-CN': '中文 (简体)', 'hi': 'हिन्दी', 'ar': 'العربية',
      'pt': 'Português', 'ru': 'Русский', 'ja': '日本語', 'fr': 'Français',
      'de': 'Deutsch', 'ko': '한국어', 'tr': 'Türkçe', 'vi': 'Tiếng Việt',
      'it': 'Italiano', 'th': 'ไทย', 'pl': 'Polski',
      
      // Idiomas europeos
      'nl': 'Nederlands', 'sv': 'Svenska', 'da': 'Dansk', 'no': 'Norsk',
      'fi': 'Suomi', 'he': 'עברית', 'cs': 'Čeština', 'hu': 'Magyar',
      'ro': 'Română', 'bg': 'Български', 'hr': 'Hrvatski', 'sk': 'Slovenčina',
      'sl': 'Slovenščina', 'et': 'Eesti', 'lv': 'Latviešu', 'lt': 'Lietuvių',
      'mt': 'Malti', 'el': 'Ελληνικά',
      
      // Idiomas asiáticos
      'id': 'Bahasa Indonesia', 'ms': 'Bahasa Melayu', 'tl': 'Filipino',
      'uk': 'Українська',
      
      // Idiomas regionales españoles
      'ca': 'Català', 'eu': 'Euskera', 'gl': 'Galego'
    };
    
    // ✅ REGIONES POR IDIOMA (para mejor detección)
    this.regionMap = {
      // Inglés
      'en-US': 'en', 'en-GB': 'en', 'en-CA': 'en', 'en-AU': 'en', 'en-NZ': 'en', 'en-ZA': 'en',
      
      // Chino
      'zh-CN': 'zh-CN', 'zh-TW': 'zh-CN', 'zh-HK': 'zh-CN', 'zh-SG': 'zh-CN',
      
      // Árabe
      'ar-SA': 'ar', 'ar-EG': 'ar', 'ar-AE': 'ar', 'ar-MA': 'ar', 'ar-IQ': 'ar', 'ar-DZ': 'ar',
      
      // Portugués
      'pt-BR': 'pt', 'pt-PT': 'pt', 'pt-AO': 'pt', 'pt-MZ': 'pt',
      
      // Francés
      'fr-FR': 'fr', 'fr-CA': 'fr', 'fr-BE': 'fr', 'fr-CH': 'fr', 'fr-DZ': 'fr',
      
      // Alemán
      'de-DE': 'de', 'de-AT': 'de', 'de-CH': 'de', 'de-LU': 'de',
      
      // Español regional
      'es-ES': 'es', 'es-MX': 'es', 'es-AR': 'es', 'es-CO': 'es', 'es-CL': 'es',
      
      // Otros
      'nl-NL': 'nl', 'nl-BE': 'nl', 'sv-SE': 'sv', 'da-DK': 'da', 'no-NO': 'no',
      'fi-FI': 'fi', 'pl-PL': 'pl', 'cs-CZ': 'cs', 'hu-HU': 'hu', 'ro-RO': 'ro'
    };
    
    this.hasTranslated = sessionStorage.getItem('solidarity-auto-translated');
  }

  init() {
    if (this.hasTranslated) {
      console.log('🌍 Ya se tradujo automáticamente en esta sesión');
      return;
    }
    
    const userLang = this.detectUserLanguage();
    console.log('🌍 Idioma detectado:', userLang);
    
    if (userLang && userLang !== 'es') {
      console.log('🔄 Iniciando traducción automática a:', userLang);
      setTimeout(() => this.translateTo(userLang), 1500);
    }
  }

  // ✅ DETECCIÓN MEJORADA CON MÁS IDIOMAS
  detectUserLanguage() {
    try {
      // 1. Idioma completo del navegador
      const browserLang = navigator.language || navigator.userLanguage || navigator.systemLanguage;
      console.log('📱 Idioma del navegador:', browserLang);
      
      // 2. Verificar mapeo directo de región
      if (this.regionMap[browserLang]) {
        const mappedLang = this.regionMap[browserLang];
        if (this.supportedLangs.includes(mappedLang)) {
          return mappedLang;
        }
      }
      
      // 3. Extraer código de idioma base
      const langCode = browserLang.split('-')[0];
      
      // 4. Verificar si el código base está soportado
      if (this.supportedLangs.includes(langCode)) {
        return langCode;
      }
      
      // 5. Fallback: verificar idiomas alternativos del navegador
      if (navigator.languages) {
        for (const lang of navigator.languages) {
          const mappedLang = this.regionMap[lang] || lang.split('-')[0];
          if (this.supportedLangs.includes(mappedLang)) {
            console.log('🌍 Idioma alternativo encontrado:', mappedLang);
            return mappedLang;
          }
        }
      }
      
      console.log('⚠️ Idioma no soportado:', browserLang);
      return null;
      
    } catch (error) {
      console.error('❌ Error detectando idioma:', error);
      return null;
    }
  }

  // ✅ REST OF METHODS (translateTo, showNotification, etc.) remain the same...
  translateTo(targetLang) {
    try {
      console.log('🔄 Intentando traducir a:', targetLang);
      
      setTimeout(() => {
        const selector = document.querySelector('.goog-te-combo');
        if (selector) {
          console.log('✅ Selector encontrado, traduciendo...');
          selector.value = targetLang;
          selector.dispatchEvent(new Event('change'));
          this.markAsTranslated();
          this.showNotification(targetLang);
          return;
        }
        this.tryIframeTranslation(targetLang);
      }, 500);
      
      setTimeout(() => {
        if (!this.hasTranslated) {
          this.forceTranslation(targetLang);
        }
      }, 3000);
      
    } catch (error) {
      console.error('❌ Error en traducción:', error);
    }
  }

  tryIframeTranslation(targetLang) {
    try {
      const frames = document.querySelectorAll('iframe');
      frames.forEach(frame => {
        try {
          const frameDoc = frame.contentDocument || frame.contentWindow?.document;
          if (frameDoc) {
            const selector = frameDoc.querySelector('.goog-te-combo');
            if (selector) {
              console.log('✅ Selector en iframe encontrado');
              selector.value = targetLang;
              selector.dispatchEvent(new Event('change'));
              this.markAsTranslated();
              this.showNotification(targetLang);
            }
          }
        } catch (e) {
          // Iframe de diferente origen, ignorar
        }
      });
    } catch (error) {
      console.error('❌ Error en iframe:', error);
    }
  }

  forceTranslation(targetLang) {
    try {
      if (window.google && window.google.translate) {
        console.log('🔄 Forzando traducción...');
        setTimeout(() => {
          const selector = document.querySelector('.goog-te-combo');
          if (selector) {
            selector.value = targetLang;
            selector.dispatchEvent(new Event('change'));
            this.markAsTranslated();
            this.showNotification(targetLang);
          }
        }, 1000);
      }
    } catch (error) {
      console.error('❌ Error forzando traducción:', error);
    }
  }

  markAsTranslated() {
    sessionStorage.setItem('solidarity-auto-translated', 'true');
    this.hasTranslated = true;
  }

  // ✅ NOTIFICACIÓN MEJORADA CON MÁS IDIOMAS
  showNotification(lang) {
    const langName = this.langNames[lang] || lang.toUpperCase();
    
    const notification = document.createElement('div');
    notification.id = 'auto-translate-notification';
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #4a6fa5 0%, #166088 100%);
      color: white;
      padding: 16px 20px;
      border-radius: 12px;
      font-size: 14px;
      z-index: 10000;
      box-shadow: 0 8px 32px rgba(0,0,0,0.2);
      animation: slideInRight 0.5s ease;
      max-width: 380px;
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255,255,255,0.1);
    `;
    
    notification.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <div style="background: rgba(79,195,161,0.2); border-radius: 50%; padding: 10px; min-width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;">
          <i class="fas fa-globe" style="color: #4fc3a1; font-size: 18px;"></i>
        </div>
        <div style="flex: 1;">
          <div style="font-weight: 700; margin-bottom: 4px; font-size: 15px;">Translated to ${langName}</div>
          <div style="font-size: 12px; opacity: 0.9;">Auto-detected • Google Translate</div>
        </div>
        <button onclick="this.parentElement.parentElement.remove()" 
                style="background: rgba(255,255,255,0.15); border: none; color: white; cursor: pointer; padding: 8px; border-radius: 50%; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; transition: all 0.2s;"
                onmouseover="this.style.background='rgba(255,255,255,0.25)'"
                onmouseout="this.style.background='rgba(255,255,255,0.15)'">
          <i class="fas fa-times" style="font-size: 12px;"></i>
        </button>
      </div>
    `;
    
    this.addNotificationStyles();
    document.body.appendChild(notification);
    
    setTimeout(() => {
      if (notification.parentElement) {
        notification.style.animation = 'slideOutRight 0.5s ease';
        setTimeout(() => {
          if (notification.parentElement) {
            notification.remove();
          }
        }, 500);
      }
    }, 8000);
  }

  addNotificationStyles() {
    if (document.getElementById('auto-translate-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'auto-translate-styles';
    style.textContent = `
      @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  reset() {
    sessionStorage.removeItem('solidarity-auto-translated');
    const notification = document.getElementById('auto-translate-notification');
    if (notification) notification.remove();
    console.log('🔄 Auto-translate reseteado');
  }
}

window.autoTranslate = new AutoTranslate();
window.resetAutoTranslate = function() {
  window.autoTranslate.reset();
  location.reload();
};

console.log('🌍 AutoTranslate EXPANDIDO cargado con 40+ idiomas');