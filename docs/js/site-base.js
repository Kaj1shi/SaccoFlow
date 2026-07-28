/**
 * Site root path helper for both local serve (http://localhost:8080/)
 * and GitHub Pages project sites (https://user.github.io/SaccoFlow/).
 *
 * Load this before login/register scripts that need absolute site paths.
 */
(function () {
  'use strict';

  function siteBase() {
    var host = window.location.hostname || '';
    var path = window.location.pathname || '/';

    // GitHub Pages project site: /<repo>/...
    if (/\.github\.io$/i.test(host)) {
      var parts = path.split('/').filter(Boolean);
      if (parts.length > 0) return '/' + parts[0] + '/';
    }

    // Local serve.mjs / any custom domain at domain root
    return '/';
  }

  var base = siteBase();

  window.SaccoFlowSite = {
    base: base,
    /** Absolute path on this origin, e.g. url('login.html') → '/SaccoFlow/login.html' */
    url: function (path) {
      path = String(path || '').replace(/^\//, '');
      return base + path;
    },
    dashboard: function (path) {
      path = String(path || '').replace(/^\//, '');
      return base + 'dashboard/' + path;
    },
  };
})();
