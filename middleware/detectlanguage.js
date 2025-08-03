// middleware/detectLanguage.js
module.exports = function(req, res, next) {
<<<<<<< HEAD
  const supportedLangs = ['es', 'en', 'fr', 'de', 'pt', 'it', 'nl', 'pl', 'ru', 'sv', 'no', 'en-US', 'ja', 'ko'];
  
  // 1. Verificar preferencia guardada (cookie)
  const savedLang = req.cookies?.userLang || '';
  if (supportedLangs.includes(savedLang)) {
=======
  const supportedLangs = [
    'es', 'en', 'fr', 'de', 'pt', 'it', 'nl', 'pl', 'ru', 'sv', 'no', 'ja', 'ko', 'zh-CN', 'ar', 'hi', 'tr'
  ];

  // 1. Preferencia guardada (cookie)
  const savedLang = req.cookies?.userLang;
  if (savedLang && supportedLangs.includes(savedLang)) {
>>>>>>> 59461df1b33d25c65c9221b39256b8f9c62636c9
    req.lang = savedLang;
    res.locals.lang = savedLang;
    res.locals.bodyClass = `lang-${savedLang}`;
    return next();
  }
<<<<<<< HEAD
  
  // 2. Detectar por geolocalización (Cloudflare)
  const userCountry = req.headers['cf-ipcountry'] || '';
  const countryLangMap = {
    'US': 'en-US', // ✅ CAMBIO: Usar en-US para Estados Unidos
    'GB': 'en', 'AU': 'en', 'CA': 'en', 'IE': 'en',
=======

  // 2. Geolocalización (Cloudflare)
  const userCountry = req.headers['cf-ipcountry'];
  const countryLangMap = {
    'US': 'en', 'GB': 'en', 'AU': 'en', 'CA': 'en', 'IE': 'en',
>>>>>>> 59461df1b33d25c65c9221b39256b8f9c62636c9
    'FR': 'fr', 'BE': 'fr', 'LU': 'fr', 'CH': 'fr',
    'DE': 'de', 'AT': 'de', 'LI': 'de',
    'BR': 'pt', 'PT': 'pt',
    'ES': 'es', 'MX': 'es', 'AR': 'es', 'CO': 'es', 'PE': 'es', 
    'CL': 'es', 'VE': 'es', 'EC': 'es', 'UY': 'es', 'PY': 'es',
    'BO': 'es', 'CR': 'es', 'PA': 'es', 'GT': 'es', 'HN': 'es',
    'SV': 'es', 'NI': 'es', 'DO': 'es', 'CU': 'es', 'PR': 'es',
    'IT': 'it', 'NL': 'nl', 'PL': 'pl', 'RU': 'ru',
<<<<<<< HEAD
    // ✅ AGREGAR NUEVOS PAÍSES:
    'SE': 'sv', // Suecia
    'NO': 'no', // Noruega
    'JP': 'ja', // Japón
    'KR': 'ko'  // Corea del Sur
  };
  
  if (countryLangMap[userCountry]) {
    req.lang = countryLangMap[userCountry];
    res.locals.lang = countryLangMap[userCountry];
    res.locals.bodyClass = `lang-${countryLangMap[userCountry]}`;
    return next();
  }
  
  // 3. Detectar por cabecera del navegador
=======
    'SE': 'sv', 'NO': 'no', 'JP': 'ja', 'KR': 'ko', 'CN': 'zh-CN'
  };
  if (userCountry && countryLangMap[userCountry]) {
    req.lang = countryLangMap[userCountry];
    res.locals.lang = countryLangMap[userCountry];
    res.locals.bodyClass = `lang-${countryLangMap[userCountry]}`;
    res.cookie('userLang', countryLangMap[userCountry], { maxAge: 31536000000, httpOnly: false });
    return next();
  }

  // 3. Cabecera del navegador
>>>>>>> 59461df1b33d25c65c9221b39256b8f9c62636c9
  const browserLang = req.acceptsLanguages(supportedLangs);
  if (browserLang && supportedLangs.includes(browserLang)) {
    req.lang = browserLang;
    res.locals.lang = browserLang;
    res.locals.bodyClass = `lang-${browserLang}`;
<<<<<<< HEAD
    return next();
  }
  
  // 4. ✅ FALLBACK A ESPAÑOL (IDIOMA ORIGINAL)
  req.lang = 'es';
  res.locals.lang = 'es';
  res.locals.bodyClass = 'lang-es';
  
=======
    res.cookie('userLang', browserLang, { maxAge: 31536000000, httpOnly: false });
    return next();
  }

  // 4. Fallback a español
  req.lang = 'es';
  res.locals.lang = 'es';
  res.locals.bodyClass = 'lang-es';
  res.cookie('userLang', 'es', { maxAge: 31536000000, httpOnly: false });

>>>>>>> 59461df1b33d25c65c9221b39256b8f9c62636c9
  next();
};