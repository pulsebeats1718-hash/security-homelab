/*
 * Offline support: registers sw.js. Only the production build adds this script
 * to the page (see vite.config.js), and it only registers when the game is
 * served over HTTPS and is not inside an iframe. For a local check of the
 * offline mode, `npm run build && npm run preview` and open
 * http://localhost:4173/?sw=1 (localhost counts as secure).
 */
(function () {
  try {
    if (!('serviceWorker' in navigator) || window.self !== window.top) return;
    var local = location.hostname === 'localhost' && /[?&]sw=1/.test(location.search);
    if (location.protocol !== 'https:' && !local) return;
    var register = function () {
      navigator.serviceWorker.register('./sw.js').catch(function (err) {
        console.warn('Phrasefall: offline mode is unavailable:', err);
      });
    };
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register);
  } catch (e) {
    /* offline support is optional */
  }
})();
