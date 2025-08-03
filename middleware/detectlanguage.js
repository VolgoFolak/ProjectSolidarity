// middleware/detectLanguage.js
module.exports = function(req, res, next) {
  const supportedLangs = [
    'es', 'en', 'fr', 'de', 'pt', 'it', 'nl', 'pl', 'ru', 'sv', 'no', 'ja', 'ko', 'zh-CN', 'ar', 'hi', 'tr'
  ];

  // 1. Preferencia guardada (cookie)
  const savedLang = req.cookies?.userLang;
  if (savedLang && supportedLangs.includes(savedLang)) {
    req.lang = savedLang;
    res.locals.lang = savedLang;
    res.locals.bodyClass = `lang-${savedLang}`;
    return next();
  }

  // 2. Geolocalización (Cloudflare)
  const userCountry = req.headers['cf-ipcountry'];
  const countryLangMap = {
    'US': 'en', 'GB': 'en', 'AU': 'en', 'CA': 'en', 'IE': 'en',
    'FR': 'fr', 'BE': 'fr', 'LU': 'fr', 'CH': 'fr',
    'DE': 'de', 'AT': 'de', 'LI': 'de',
    'BR': 'pt', 'PT': 'pt',
    'ES': 'es', 'MX': 'es', 'AR': 'es', 'CO': 'es', 'PE': 'es', 
    'CL': 'es', 'VE': 'es', 'EC': 'es', 'UY': 'es', 'PY': 'es',
    'BO': 'es', 'CR': 'es', 'PA': 'es', 'GT': 'es', 'HN': 'es',
    'SV': 'es', 'NI': 'es', 'DO': 'es', 'CU': 'es', 'PR': 'es',
    'IT': 'it', 'NL': 'nl', 'PL': 'pl', 'RU': 'ru',
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
  const browserLang = req.acceptsLanguages(supportedLangs);
  if (browserLang && supportedLangs.includes(browserLang)) {
    req.lang = browserLang;
    res.locals.lang = browserLang;
    res.locals.bodyClass = `lang-${browserLang}`;
    res.cookie('userLang', browserLang, { maxAge: 31536000000, httpOnly: false });
    return next();
  }

  // 4. Fallback a español
  req.lang = 'es';
  res.locals.lang = 'es';
  res.locals.bodyClass = 'lang-es';
  res.cookie('userLang', 'es', { maxAge: 31536000000, httpOnly: false });

  next();
};