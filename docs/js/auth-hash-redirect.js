/**
 * If Supabase drops an auth recovery/invite link on the marketing Site URL
 * (or login page), forward to the dashboard reset-password route with tokens intact.
 *
 * Load after js/site-base.js when available.
 */
(function () {
  'use strict';

  var hash = window.location.hash || '';
  var search = window.location.search || '';
  var looksLikeAuth =
    /access_token=|refresh_token=|type=recovery|type=invite|type=signup|type=magiclink|type=email/i.test(
      hash
    ) || /[?&]code=/.test(search);

  if (!looksLikeAuth) return;

  // Already on the dashboard SPA — leave it alone
  if (/\/dashboard(\/|$)/i.test(window.location.pathname || '')) return;

  var target =
    window.SaccoFlowSite && typeof window.SaccoFlowSite.dashboard === 'function'
      ? window.SaccoFlowSite.dashboard('reset-password')
      : '/dashboard/reset-password';

  window.location.replace(target + search + hash);
})();
