// middleware/detectLanguage.js
module.exports = function(req, res, next) {
  const supportedLangs = ['es', 'en', 'fr', 'de', 'pt', 'it', 'nl', 'pl', 'ru', 'sv', 'no', 'en-US', 'ja', 'ko'];
  
  // 1. Verificar preferencia guardada (cookie)
  const savedLang = req.cookies?.userLang || '';
  if (supportedLangs.includes(savedLang)) {
    req.lang = savedLang;
    res.locals.lang = savedLang;
    res.locals.bodyClass = `lang-${savedLang}`;
    return next();
  }
  
  // 2. Detectar por geolocalización (Cloudflare)
  const userCountry = req.headers['cf-ipcountry'] || '';
  const countryLangMap = {
    'US': 'en-US', // ✅ CAMBIO: Usar en-US para Estados Unidos
    'GB': 'en', 'AU': 'en', 'CA': 'en', 'IE': 'en',
    'FR': 'fr', 'BE': 'fr', 'LU': 'fr', 'CH': 'fr',
    'DE': 'de', 'AT': 'de', 'LI': 'de',
    'BR': 'pt', 'PT': 'pt',
    'ES': 'es', 'MX': 'es', 'AR': 'es', 'CO': 'es', 'PE': 'es', 
    'CL': 'es', 'VE': 'es', 'EC': 'es', 'UY': 'es', 'PY': 'es',
    'BO': 'es', 'CR': 'es', 'PA': 'es', 'GT': 'es', 'HN': 'es',
    'SV': 'es', 'NI': 'es', 'DO': 'es', 'CU': 'es', 'PR': 'es',
    'IT': 'it', 'NL': 'nl', 'PL': 'pl', 'RU': 'ru',
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
  const browserLang = req.acceptsLanguages(supportedLangs);
  if (browserLang && supportedLangs.includes(browserLang)) {
    req.lang = browserLang;
    res.locals.lang = browserLang;
    res.locals.bodyClass = `lang-${browserLang}`;
    return next();
  }
  
  // 4. ✅ FALLBACK A ESPAÑOL (IDIOMA ORIGINAL)
  req.lang = 'es';
  res.locals.lang = 'es';
  res.locals.bodyClass = 'lang-es';
  
  next();
};