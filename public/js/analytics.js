// filepath: c:\Users\gabi2\Desktop\Solidarity-web\public\js\analytics.js
/**
 * Sistema de Analytics Avanzado para Solidarity
 * Recopila datos detallados de comportamiento del usuario
 */

class SolidarityAnalytics {
  constructor() {
    this.sessionStartTime = Date.now();
    this.pageStartTime = Date.now();
    this.scrollDepth = 0;
    this.maxScrollDepth = 0;
    this.clickCount = 0;
    this.formInteractions = 0;
    this.userId = window.currentUserId || null;
    this.userType = window.userType || 'anonymous';
    
    this.init();
  }

  init() {
    this.setupPageTracking();
    this.setupUserEngagement();
    this.setupCustomEvents();
    this.setupPerformanceTracking();
    this.setupErrorTracking();
    this.setupSocialInteractions();
  }

  // ✅ SEGUIMIENTO DE PÁGINAS AVANZADO
  setupPageTracking() {
    // Tiempo en página
    window.addEventListener('beforeunload', () => {
      const timeOnPage = Date.now() - this.pageStartTime;
      this.trackEvent('page_engagement', {
        engagement_time_msec: timeOnPage,
        page_title: document.title,
        page_location: window.location.href,
        max_scroll_depth: this.maxScrollDepth,
        click_count: this.clickCount,
        form_interactions: this.formInteractions
      });
    });

    // Cambios de visibilidad
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.trackEvent('page_hidden', {
          time_visible: Date.now() - this.pageStartTime
        });
      } else {
        this.pageStartTime = Date.now();
        this.trackEvent('page_visible', {});
      }
    });
  }

  // ✅ SEGUIMIENTO DE ENGAGEMENT
  setupUserEngagement() {
    // Scroll depth tracking
    let ticking = false;
    const updateScrollDepth = () => {
      this.scrollDepth = Math.round((window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100);
      this.maxScrollDepth = Math.max(this.maxScrollDepth, this.scrollDepth);
      ticking = false;
    };

    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(updateScrollDepth);
        ticking = true;
      }
    });

    // Click tracking general
    document.addEventListener('click', (e) => {
      this.clickCount++;
      
      // Trackear clicks específicos
      const element = e.target.closest('button, a, [role="button"]');
      if (element) {
        this.trackEvent('button_click', {
          button_text: element.textContent?.trim().substring(0, 50) || '',
          button_id: element.id || '',
          button_class: element.className || '',
          page_section: this.getPageSection(element)
        });
      }
    });

    // Form interactions
    document.addEventListener('input', (e) => {
      if (e.target.matches('input, textarea, select')) {
        this.formInteractions++;
      }
    });
  }

  // ✅ EVENTOS PERSONALIZADOS DE SOLIDARITY
  setupCustomEvents() {
    // Tracking de causas
    this.trackCauseEvents();
    
    // Tracking de donaciones
    this.trackDonationEvents();
    
    // Tracking de voluntariado
    this.trackVolunteerEvents();
    
    // Tracking de retos
    this.trackChallengeEvents();
    
    // Tracking de equipos
    this.trackTeamEvents();
  }

  // ✅ EVENTOS DE CAUSAS
  trackCauseEvents() {
    // Crear causa
    document.addEventListener('cause_created', (e) => {
      this.trackEvent('cause_created', {
        cause_category: e.detail.category || '',
        cause_type: e.detail.type || '',
        funding_goal: e.detail.goal || 0,
        beneficiaries_count: e.detail.beneficiaries || 0,
        user_type: this.userType
      });
    });

    // Ver detalle de causa
    document.addEventListener('cause_viewed', (e) => {
      this.trackEvent('cause_viewed', {
        cause_id: e.detail.causeId || '',
        cause_category: e.detail.category || '',
        funding_progress: e.detail.progress || 0,
        view_source: e.detail.source || 'direct'
      });
    });

    // Contribuir a causa
    document.addEventListener('cause_contributed', (e) => {
      this.trackEvent('cause_contribution', {
        cause_id: e.detail.causeId || '',
        contribution_amount: e.detail.amount || 0,
        contribution_type: e.detail.type || 'donation',
        payment_method: e.detail.paymentMethod || '',
        user_type: this.userType
      });
    });
  }

  // ✅ EVENTOS DE DONACIONES
  trackDonationEvents() {
    document.addEventListener('donation_started', (e) => {
      this.trackEvent('begin_checkout', {
        currency: 'EUR',
        value: e.detail.amount || 0,
        cause_id: e.detail.causeId || '',
        donation_type: e.detail.type || 'one_time'
      });
    });

    document.addEventListener('donation_completed', (e) => {
      this.trackEvent('purchase', {
        transaction_id: e.detail.transactionId || '',
        currency: 'EUR',
        value: e.detail.amount || 0,
        cause_id: e.detail.causeId || '',
        payment_method: e.detail.paymentMethod || ''
      });
    });
  }

  // ✅ EVENTOS DE VOLUNTARIADO
  trackVolunteerEvents() {
    document.addEventListener('volunteer_signup', (e) => {
      this.trackEvent('volunteer_signup', {
        activity_id: e.detail.activityId || '',
        activity_type: e.detail.type || '',
        time_commitment: e.detail.timeCommitment || '',
        skills_required: e.detail.skills || ''
      });
    });
  }

  // ✅ EVENTOS DE RETOS
  trackChallengeEvents() {
    document.addEventListener('challenge_joined', (e) => {
      this.trackEvent('challenge_joined', {
        challenge_id: e.detail.challengeId || '',
        challenge_type: e.detail.type || '',
        difficulty_level: e.detail.difficulty || '',
        expected_impact: e.detail.impact || ''
      });
    });

    document.addEventListener('challenge_completed', (e) => {
      this.trackEvent('challenge_completed', {
        challenge_id: e.detail.challengeId || '',
        completion_time: e.detail.completionTime || 0,
        points_earned: e.detail.points || 0,
        achievement_unlocked: e.detail.achievement || false
      });
    });
  }

  // ✅ EVENTOS DE EQUIPOS
  trackTeamEvents() {
    document.addEventListener('team_created', (e) => {
      this.trackEvent('team_created', {
        team_id: e.detail.teamId || '',
        team_size: e.detail.size || 0,
        team_focus: e.detail.focus || '',
        is_public: e.detail.isPublic || false
      });
    });

    document.addEventListener('team_joined', (e) => {
      this.trackEvent('team_joined', {
        team_id: e.detail.teamId || '',
        join_method: e.detail.method || 'invitation',
        team_member_count: e.detail.memberCount || 0
      });
    });
  }

  // ✅ SEGUIMIENTO DE RENDIMIENTO
  setupPerformanceTracking() {
    window.addEventListener('load', () => {
      setTimeout(() => {
        const perfData = performance.getEntriesByType('navigation')[0];
        if (perfData) {
          this.trackEvent('page_performance', {
            page_load_time: Math.round(perfData.loadEventEnd - perfData.fetchStart),
            dom_content_loaded: Math.round(perfData.domContentLoadedEventEnd - perfData.fetchStart),
            first_paint: this.getFirstPaint(),
            page_size: this.getPageSize()
          });
        }
      }, 1000);
    });
  }

  // ✅ SEGUIMIENTO DE ERRORES
  setupErrorTracking() {
    window.addEventListener('error', (e) => {
      this.trackEvent('javascript_error', {
        error_message: e.message || '',
        error_filename: e.filename || '',
        error_line: e.lineno || 0,
        error_column: e.colno || 0,
        user_agent: navigator.userAgent
      });
    });

    // Promise rejections
    window.addEventListener('unhandledrejection', (e) => {
      this.trackEvent('promise_rejection', {
        error_message: e.reason?.message || e.reason || '',
        error_stack: e.reason?.stack || ''
      });
    });
  }

  // ✅ INTERACCIONES SOCIALES
  setupSocialInteractions() {
    document.addEventListener('social_share', (e) => {
      this.trackEvent('share', {
        method: e.detail.platform || '',
        content_type: e.detail.contentType || '',
        item_id: e.detail.itemId || '',
        content_title: e.detail.title || ''
      });
    });

    document.addEventListener('social_follow', (e) => {
      this.trackEvent('social_follow', {
        platform: e.detail.platform || '',
        follow_type: e.detail.type || 'follow'
      });
    });
  }

  // ✅ MÉTODOS AUXILIARES
  trackEvent(eventName, parameters = {}) {
    if (typeof gtag !== 'undefined') {
      // Agregar datos comunes a todos los eventos
      const enrichedParams = {
        ...parameters,
        user_type: this.userType,
        session_id: this.getSessionId(),
        timestamp: new Date().toISOString(),
        page_section: this.getCurrentPageSection(),
        user_language: window.currentLang || 'es',
        device_type: this.getDeviceType(),
        connection_type: this.getConnectionType()
      };

      gtag('event', eventName, enrichedParams);
      console.log('📊 Analytics Event:', eventName, enrichedParams);
    }
  }

  getPageSection(element = null) {
    if (element) {
      const section = element.closest('section, main, nav, header, footer');
      return section?.id || section?.className.split(' ')[0] || 'unknown';
    }
    return this.getCurrentPageSection();
  }

  getCurrentPageSection() {
    const path = window.location.pathname;
    if (path.includes('/causes')) return 'causes';
    if (path.includes('/teams')) return 'teams';
    if (path.includes('/challenges')) return 'challenges';
    if (path.includes('/volunteer')) return 'volunteer';
    if (path.includes('/profile')) return 'profile';
    if (path === '/') return 'home';
    return 'other';
  }

  getSessionId() {
    let sessionId = sessionStorage.getItem('solidarity_session_id');
    if (!sessionId) {
      sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      sessionStorage.setItem('solidarity_session_id', sessionId);
    }
    return sessionId;
  }

  getDeviceType() {
    const width = window.innerWidth;
    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
  }

  getConnectionType() {
    return navigator.connection?.effectiveType || 'unknown';
  }

  getFirstPaint() {
    const paintTiming = performance.getEntriesByType('paint');
    const fp = paintTiming.find(entry => entry.name === 'first-paint');
    return fp ? Math.round(fp.startTime) : null;
  }

  getPageSize() {
    const resources = performance.getEntriesByType('resource');
    return resources.reduce((total, resource) => total + (resource.transferSize || 0), 0);
  }

  // ✅ MÉTODO PÚBLICO PARA TRACKEAR EVENTOS PERSONALIZADOS
  track(eventName, parameters = {}) {
    this.trackEvent(eventName, parameters);
  }
}

// ✅ INICIALIZAR ANALYTICS
window.solidarityAnalytics = new SolidarityAnalytics();

// ✅ FUNCIÓN GLOBAL PARA TRACKEAR DESDE CUALQUIER PARTE
window.trackEvent = function(eventName, parameters = {}) {
  window.solidarityAnalytics.track(eventName, parameters);
};

console.log('📊 Solidarity Analytics cargado y configurado');