/**
 * Módulo de funcionalidades avanzadas de Solidarity
 * Integra todas las características modernas sin romper el flujo básico
 */

(function() {
  'use strict';
  
  let isInitialized = false;
  
  // ✅ 1. CONFIGURACIÓN INICIAL Y DETECCIÓN DE DATOS DE SESIÓN
  function createSessionDataIfMissing() {
    let sessionData = document.getElementById('session-data');
    
    if (!sessionData) {
      sessionData = document.createElement('div');
      sessionData.id = 'session-data';
      sessionData.setAttribute('data-user-id', '');
      sessionData.setAttribute('data-user-type', 'anonymous');
      sessionData.setAttribute('data-lang', 'es');
      sessionData.setAttribute('data-csrf-token', '');
      sessionData.setAttribute('data-stripe-key', '');
      sessionData.setAttribute('data-supabase-url', 'https://cyftasxlrzuynzbrfgkd.supabase.co');
      sessionData.setAttribute('data-supabase-key', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5ZnRhc3hscnp1eW56YnJmZ2tkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgwMzUzMTksImV4cCI6MjA2MzYxMTMxOX0.I56ZqFTfLgdwWlcozMVncGNGBZ4A2_5VpAbHeNmtDhA');
      sessionData.hidden = true;
      document.body.appendChild(sessionData);
    }
    
    return sessionData;
  }
  
  // ✅ 2. GOOGLE ANALYTICS 4 AVANZADO
  function initGoogleAnalytics() {
    // Solo inicializar si no existe ya
    if (window.gtag) return;
    
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    window.gtag = gtag;
    
    gtag('js', new Date());

    // Configuración para desarrollo y producción
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      gtag('config', 'G-KLTQ612VGL', {
        send_page_view: false,
        debug_mode: true,
        transport_url: 'https://project-solidarity.com',
        anonymize_ip: true
      });
      console.log('🔧 Google Analytics en modo debug para localhost');
    } else {
      gtag('config', 'G-KLTQ612VGL', {
        transport_url: 'https://project-solidarity.com',
        first_party_collection: true,
        anonymize_ip: true,
        allow_google_signals: true,
        allow_ad_personalization_signals: false,
        send_page_view: true,
        enhanced_conversions: true,
        debug_mode: false
      });
    }

    const sessionData = document.getElementById('session-data');
    const lang = sessionData?.dataset.lang || 'es';
    
    // Datos extendidos del usuario
    gtag('set', {
      user_properties: {
        user_type: sessionData?.dataset.userType || 'anonymous',
        preferred_language: lang,
        platform_version: '1.0'
      }
    });

    // Cargar script de Analytics
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=G-KLTQ612VGL';
    document.head.appendChild(script);
  }
  
  // ✅ 3. GOOGLE FONTS
  function loadGoogleFonts() {
    // Solo cargar si no existen ya
    if (document.querySelector('link[href*="fonts.googleapis.com"]')) return;
    
    const preconnect1 = document.createElement('link');
    preconnect1.rel = 'preconnect';
    preconnect1.href = 'https://fonts.googleapis.com';
    document.head.appendChild(preconnect1);
    
    const preconnect2 = document.createElement('link');
    preconnect2.rel = 'preconnect';
    preconnect2.href = 'https://fonts.gstatic.com';
    preconnect2.crossOrigin = 'anonymous';
    document.head.appendChild(preconnect2);
    
    const fontLink = document.createElement('link');
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap';
    fontLink.rel = 'stylesheet';
    document.head.appendChild(fontLink);
  }
  
  // ✅ 4. SEO META TAGS
  function addSEOMetaTags() {
    const metaTags = [
      { property: 'og:title', content: 'Solidarity - Create Social Impact' },
      { property: 'og:description', content: 'Join our platform to support causes, volunteer, and make a difference' },
      { property: 'og:image', content: 'https://project-solidarity.com/images/social-share.jpg' },
      { property: 'og:url', content: 'https://project-solidarity.com' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary_large_image' }
    ];
    
    metaTags.forEach(({ property, name, content }) => {
      const selector = property ? `meta[property="${property}"]` : `meta[name="${name}"]`;
      if (!document.querySelector(selector)) {
        const meta = document.createElement('meta');
        if (property) meta.setAttribute('property', property);
        if (name) meta.setAttribute('name', name);
        meta.setAttribute('content', content);
        document.head.appendChild(meta);
      }
    });
    
    // Apple touch icon
    if (!document.querySelector('link[rel="apple-touch-icon"]')) {
      const appleIcon = document.createElement('link');
      appleIcon.rel = 'apple-touch-icon';
      appleIcon.href = '/images/apple-touch-icon.png';
      document.head.appendChild(appleIcon);
    }
  }
  
  // ✅ 5. NOTIFICACIONES MEJORADAS
  function showErrorNotification(message, type = 'error') {
    const notifications = document.getElementById('notifications');
    if (notifications) {
      const notification = document.createElement('div');
      notification.className = `notification ${type}`;
      
      const icon = type === 'error' ? 'fas fa-exclamation-circle' : 
                   type === 'success' ? 'fas fa-check-circle' : 
                   'fas fa-info-circle';
      
      notification.innerHTML = `
        <i class="${icon}"></i>
        <span>${message}</span>
      `;
      notifications.appendChild(notification);
      setTimeout(() => notification.remove(), 5000);
    } else {
      console.error('Advanced Features Error:', message);
    }
  }
  
  // ✅ 6. CONFIGURACIÓN DE AXIOS MEJORADA
  function initAxios() {
    // Solo si Axios está disponible
    if (!window.axios) {
      // Cargar Axios dinámicamente
      const script = document.createElement('script');
      script.src = '/js/lib/axios.min.js';
      script.onload = () => setupAxios();
      document.head.appendChild(script);
      return;
    }
    
    setupAxios();
  }
  
  function setupAxios() {
    const sessionData = document.getElementById('session-data');
    const csrfToken = sessionData?.dataset.csrfToken;
    
    if (window.axios && csrfToken) {
      axios.defaults.headers.common['X-CSRF-Token'] = csrfToken;
      axios.defaults.withCredentials = true;
      
      axios.interceptors.response.use(
        response => response,
        error => {
          if (error.response?.status === 401) {
            showSessionExpiredModal();
          } else if (error.response) {
            showErrorNotification('Error en la solicitud. Por favor intenta nuevamente.');
          } else {
            showErrorNotification('Error de conexión. Por favor verifica tu conexión a Internet.');
          }
          return Promise.reject(error);
        }
      );
    }
  }
  
  // ✅ 7. SISTEMA DE TRADUCCIÓN
  function initTranslationSystem() {
    // Cargar i18n.js si no existe
    if (!window.t) {
      const script = document.createElement('script');
      script.src = '/js/i18n.js';
      script.onload = () => {
        document.addEventListener('i18nReady', translateElements);
      };
      document.head.appendChild(script);
    } else {
      translateElements();
    }
  }
  
  function translateElements() {
    const elements = document.querySelectorAll('[data-i18n], [data-i18n-title]');
    elements.forEach(el => {
      const key = el.getAttribute('data-i18n') || el.getAttribute('data-i18n-title');
      if (key && window.t) {
        const translation = window.t(key);
        if (el.hasAttribute('data-i18n-title')) {
          el.setAttribute('title', translation);
        } else {
          el.textContent = translation;
        }
      }
    });
  }
  
  // ✅ 8. SESSION MANAGER AVANZADO
  class SessionManager {
    constructor() {
      this.keepAliveInterval = null;
      this.inactivityTimeout = null;
      this.maxInactivity = 30 * 60 * 1000; // 30 minutos
      this.keepAliveFrequency = 5 * 60 * 1000; // 5 minutos
      this.retryCount = 0;
      this.maxRetries = 3;
      
      this.initEventListeners();
      
      const sessionData = document.getElementById('session-data');
      if (sessionData?.dataset.userId) {
        this.startSessionMonitoring();
      }
    }
    
    initEventListeners() {
      ['click', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(event => {
        document.addEventListener(event, this.resetInactivityTimer.bind(this), { passive: true });
      });
    }
    
    startSessionMonitoring() {
      this.startKeepAlive();
      this.resetInactivityTimer();
      console.log('🔒 Session monitoring started');
    }
    
    startKeepAlive() {
      if (this.keepAliveInterval) clearInterval(this.keepAliveInterval);
      
      this.keepAliveInterval = setInterval(() => {
        this.sendKeepAlive();
      }, this.keepAliveFrequency);
      
      this.sendKeepAlive();
    }
    
    async sendKeepAlive() {
      try {
        const sessionData = document.getElementById('session-data');
        const response = await fetch('/api/session/keep-alive', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': sessionData?.dataset.csrfToken || ''
          },
          body: JSON.stringify({
            currentPath: window.location.pathname,
            lastActivity: new Date().toISOString()
          })
        });
        
        if (response.ok) {
          this.retryCount = 0;
          const data = await response.json();
          console.log('🔄 Session keep-alive success', data);
        } else {
          this.handleSessionError();
        }
      } catch (error) {
        console.error('Keep-alive error:', error);
        this.handleSessionError();
      }
    }
    
    resetInactivityTimer() {
      if (this.inactivityTimeout) clearTimeout(this.inactivityTimeout);
      
      this.inactivityTimeout = setTimeout(() => {
        this.handleInactiveSession();
      }, this.maxInactivity);
    }
    
    handleInactiveSession() {
      console.log('🕒 Session inactive, checking status...');
      this.sendKeepAlive();
    }
    
    handleSessionError() {
      this.retryCount++;
      
      if (this.retryCount >= this.maxRetries) {
        this.expireSession();
      } else {
        console.warn(`Session check failed (${this.retryCount}/${this.maxRetries})`);
      }
    }
    
    expireSession() {
      console.log('🔐 Session expired');
      clearInterval(this.keepAliveInterval);
      clearTimeout(this.inactivityTimeout);
      
      showSessionExpiredModal();
      document.dispatchEvent(new CustomEvent('sessionExpired'));
    }
  }
  
  // ✅ 9. STRIPE INTEGRATION AVANZADA
  class StripeIntegration {
    static async initialize() {
      const sessionData = document.getElementById('session-data');
      const stripeKey = sessionData?.dataset.stripeKey;
      
      if (stripeKey) {
        // Cargar Stripe si no está disponible
        if (!window.Stripe) {
          const script = document.createElement('script');
          script.src = 'https://js.stripe.com/v3/';
          script.onload = () => {
            try {
              window.stripe = Stripe(stripeKey);
              console.log('✅ Stripe initialized');
            } catch (error) {
              console.warn('⚠️ Stripe initialization failed:', error);
            }
          };
          document.head.appendChild(script);
        } else {
          try {
            window.stripe = Stripe(stripeKey);
            console.log('✅ Stripe initialized');
          } catch (error) {
            console.warn('⚠️ Stripe initialization failed:', error);
          }
        }
      }
    }
    
    static async verifyStripeStatus(userId) {
      if (!userId) return { connected: false };
      
      try {
        const response = await fetch('/api/stripe/status?userId=' + userId, {
          credentials: 'include'
        });
        
        if (response.ok) {
          return await response.json();
        }
        return { connected: false };
      } catch (error) {
        console.error('Stripe status check failed:', error);
        return { connected: false };
      }
    }
  }
  
  // ✅ 10. GOOGLE TRANSLATE
  function initGoogleTranslate() {
    // Crear elemento si no existe
    if (!document.getElementById('google_translate_element')) {
      const translateDiv = document.createElement('div');
      translateDiv.id = 'google_translate_element';
      translateDiv.style.display = 'none';
      document.body.appendChild(translateDiv);
    }
    
    // Función de inicialización
    window.googleTranslateElementInit = function() {
      if (window.autoTranslate) {
        window.autoTranslate.init();
      } else {
        new google.translate.TranslateElement({
          pageLanguage: 'es',
          includedLanguages: 'en,es,fr,de,it,pt,ru,zh-CN,ar,ja,ko,hi,tr,pl,nl,sv,da,no,fi,he,th,vi,id,ms,tl,uk,cs,hu,ro,bg,hr,sk,sl,et,lv,lt,mt,el,ca,eu,gl',
          layout: google.translate.TranslateElement.InlineLayout.SIMPLE,
          autoDisplay: false
        }, 'google_translate_element');
      }
    };
    
    // Cargar script de Google Translate
    const script = document.createElement('script');
    script.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    document.head.appendChild(script);
  }
  
  // ✅ 11. COMPONENTES MÓVILES
  function loadMobileComponents() {
    const mobileScripts = [
      '/js/components/mobile-bottom-nav.js',
      '/js/components/mobile-hamburger-menu.js',
      '/js/components/mobile-header.js',
      '/js/components/mobile-avatar.js'
    ];
    
    let loadedCount = 0;
    
    mobileScripts.forEach(src => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => {
        loadedCount++;
        if (loadedCount === mobileScripts.length) {
          createMobileComponents();
        }
      };
      script.onerror = () => {
        console.warn(`⚠️ Failed to load mobile component: ${src}`);
        loadedCount++;
        if (loadedCount === mobileScripts.length) {
          createMobileComponents();
        }
      };
      document.head.appendChild(script);
    });
  }
  
  function createMobileComponents() {
    // Solo crear si no existen ya
    if (!document.querySelector('solidarity-bottom-nav')) {
      const bottomNav = document.createElement('solidarity-bottom-nav');
      document.body.appendChild(bottomNav);
    }
    
    if (!document.querySelector('solidarity-mobile-header')) {
      const mobileHeader = document.createElement('solidarity-mobile-header');
      
      const hamburger = document.createElement('solidarity-hamburger-menu');
      hamburger.setAttribute('slot', 'hamburger');
      mobileHeader.appendChild(hamburger);
      
      const avatar = document.createElement('solidarity-mobile-avatar');
      avatar.setAttribute('slot', 'avatar');
      mobileHeader.appendChild(avatar);
      
      document.body.appendChild(mobileHeader);
    }
  }
  
  // ✅ 12. LOADING OVERLAY Y MODALS
  function createUIElements() {
    createLoadingOverlay();
    createSessionExpiredModal();
    addAdvancedStyles();
  }
  
  function createLoadingOverlay() {
    if (document.getElementById('loading-overlay')) return;
    
    const overlay = document.createElement('div');
    overlay.id = 'loading-overlay';
    overlay.className = 'loading-overlay';
    overlay.innerHTML = `
      <div class="loading-spinner"></div>
      <p class="loading-text" data-i18n="loading.message">Cargando aplicación...</p>
    `;
    overlay.style.display = 'none';
    document.body.appendChild(overlay);
  }
  
  function showSessionExpiredModal() {
    let modal = document.getElementById('session-expired-modal');
    
    if (!modal) {
      createSessionExpiredModal();
      modal = document.getElementById('session-expired-modal');
    }
    
    modal.style.display = 'flex';
  }
  
  function createSessionExpiredModal() {
    if (document.getElementById('session-expired-modal')) return;
    
    const modal = document.createElement('div');
    modal.id = 'session-expired-modal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <h3 data-i18n="session.expired_title">Sesión Expirada</h3>
        <p data-i18n="session.expired_message">Tu sesión ha expirado por inactividad. Por favor inicia sesión nuevamente.</p>
        <button id="session-relogin-btn" class="btn-primary" data-i18n="session.return_login">Volver al Login</button>
      </div>
    `;
    modal.style.display = 'none';
    document.body.appendChild(modal);
    
    modal.querySelector('#session-relogin-btn').addEventListener('click', () => {
      window.location.href = '/login?return=' + encodeURIComponent(window.location.pathname);
    });
  }
  
  // ✅ 13. ESTILOS AVANZADOS
  function addAdvancedStyles() {
    if (document.getElementById('advanced-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'advanced-styles';
    style.textContent = `
      .notifications-container {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999;
      }
      
      .notification {
        padding: 15px;
        margin-bottom: 10px;
        border-radius: 5px;
        color: white;
        display: flex;
        align-items: center;
        animation: slideIn 0.3s ease-out;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      }
      
      .notification.error {
        background-color: #ff4444;
      }
      
      .notification.success {
        background-color: #00C851;
      }
      
      .notification.info {
        background-color: #2196F3;
      }
      
      .notification i {
        margin-right: 10px;
      }
      
      @keyframes slideIn {
        from { transform: translateX(100%); }
        to { transform: translateX(0); }
      }
      
      .loading-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(255, 255, 255, 0.8);
        display: none;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        z-index: 9998;
      }
      
      .loading-spinner {
        border: 5px solid #f3f3f3;
        border-top: 5px solid #2dd4bf;
        border-radius: 50%;
        width: 50px;
        height: 50px;
        animation: spin 1s linear infinite;
      }
      
      .loading-text {
        margin-top: 15px;
        color: #333;
        font-size: 1.1rem;
      }
      
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      
      .modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: none;
        justify-content: center;
        align-items: center;
        z-index: 9999;
      }
      
      .modal-content {
        background: white;
        padding: 2rem;
        border-radius: 10px;
        max-width: 500px;
        width: 90%;
        text-align: center;
        box-shadow: 0 8px 32px rgba(0,0,0,0.2);
      }
    `;
    document.head.appendChild(style);
  }
  
  // ✅ 14. CARGAR SCRIPTS ADICIONALES
  function loadAdditionalScripts() {
    const additionalScripts = [
      '/js/analytics.js',
      '/js/auto-translate.js'
    ];
    
    additionalScripts.forEach(src => {
      const script = document.createElement('script');
      script.src = src;
      script.onerror = () => console.warn(`⚠️ Failed to load: ${src}`);
      document.head.appendChild(script);
    });
  }
  
  // ✅ 15. INICIALIZACIÓN PRINCIPAL
  async function initAdvancedFeatures() {
    if (isInitialized) return;
    
    console.log('🚀 Initializing Advanced Features...');
    
    try {
      // 1. Crear datos de sesión si no existen
      createSessionDataIfMissing();
      
      // 2. Inicializar Google Analytics
      initGoogleAnalytics();
      
      // 3. Cargar Google Fonts
      loadGoogleFonts();
      
      // 4. Agregar meta tags SEO
      addSEOMetaTags();
      
      // 5. Crear elementos de UI
      createUIElements();
      
      // 6. Inicializar Axios
      initAxios();
      
      // 7. Sistema de traducción
      initTranslationSystem();
      
      // 8. Google Translate
      initGoogleTranslate();
      
      // 9. Cargar componentes móviles
      loadMobileComponents();
      
      // 10. Cargar scripts adicionales
      loadAdditionalScripts();
      
      // 11. Inicializar Session Manager
      window.sessionManager = new SessionManager();
      
      // 12. Inicializar Stripe
      await StripeIntegration.initialize();
      
      // 13. Verificar primer login y mostrar modal de bienvenida
      const sessionData = document.getElementById('session-data');
      const userId = sessionData?.dataset.userId;
      
      if (userId) {
        // Verificar estado de Stripe si es relevante
        if (window.location.pathname.includes('/causes')) {
          await StripeIntegration.verifyStripeStatus(userId);
        }
        
        // Modal de bienvenida para primer login
        const isFirstLogin = new URLSearchParams(window.location.search).has('firstLogin');
        if (isFirstLogin && document.getElementById('welcomeModal')) {
          document.getElementById('welcomeModal').style.display = 'flex';
        }
      }
      
      isInitialized = true;
      console.log('✅ Advanced Features initialized successfully');
      
    } catch (error) {
      console.error('❌ Error initializing Advanced Features:', error);
      showErrorNotification('Error al cargar funcionalidades avanzadas.');
    }
  }
  
  // ✅ 16. AUTO-INICIALIZACIÓN
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAdvancedFeatures);
  } else {
    // Pequeño delay para asegurar que Supabase del layout esté listo
    setTimeout(initAdvancedFeatures, 100);
  }
  
  // ✅ 17. EXPONER FUNCIONES GLOBALES
  window.AdvancedFeatures = {
    SessionManager,
    StripeIntegration,
    showErrorNotification,
    showSessionExpiredModal,
    translateElements,
    createLoadingOverlay,
    initGoogleAnalytics,
    loadGoogleFonts
  };
  
})();