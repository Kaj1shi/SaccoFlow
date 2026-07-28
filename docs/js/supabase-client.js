// ── supabase-client.js ──────────────────────────────────────────────────────
// Direct Supabase REST API client — NO external CDN library required.
// Uses native fetch() so it works in every modern browser with zero dependencies.
// Load this file ONCE, before any service files. No <script> tag for supabase-js needed.

(function () {
  'use strict';

  const BASE_URL  = window.SUPABASE_CONFIG?.url || 'https://mapunkhahunxdvzqxgym.supabase.co';
  const ANON_KEY  = window.SUPABASE_CONFIG?.anonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1hcHVua2hhaHVueGR2enF4Z3ltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzMjk1OTQsImV4cCI6MjA4ODkwNTU5NH0.4pydfrrpR4ozG6FZuqdMogyTa79OUvlk0_d4kGUQg8s';

  // ── Base headers ───────────────────────────────────────────────────────────
  function baseHeaders(extra) {
    return Object.assign({
      'apikey':        ANON_KEY,
      'Authorization': 'Bearer ' + ANON_KEY,
      'Content-Type':  'application/json',
      'Prefer':        'return=representation',
    }, extra || {});
  }

  // ── INSERT ─────────────────────────────────────────────────────────────────
  async function insert(table, rows, opts) {
    opts = opts || {};
    try {
      const body = Array.isArray(rows) ? rows : [rows];
      const res  = await fetch(BASE_URL + '/rest/v1/' + table, {
        method:  'POST',
        headers: baseHeaders(),
        body:    JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return { data: null, error: pgError(json, res.status) };
      const data = opts.single ? (Array.isArray(json) ? json[0] : json) : json;
      return { data: data || null, error: null };
    } catch (err) {
      return { data: null, error: networkError(err) };
    }
  }

  // ── SELECT ─────────────────────────────────────────────────────────────────
  // opts: { select, filters: ['col=eq.val', ...], order, limit, single }
  async function select(table, opts) {
    opts = opts || {};
    try {
      const params = new URLSearchParams();
      if (opts.select) params.set('select', opts.select);
      if (opts.order)  params.set('order',  opts.order);
      if (opts.limit)  params.set('limit',  String(opts.limit));
      (opts.filters || []).forEach(function(f) {
        const eq  = f.indexOf('=');
        const col = f.slice(0, eq);
        const val = f.slice(eq + 1);
        params.set(col, val);
      });
      const res  = await fetch(BASE_URL + '/rest/v1/' + table + '?' + params, {
        method:  'GET',
        headers: baseHeaders(),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return { data: null, error: pgError(json, res.status) };
      const data = opts.single ? (Array.isArray(json) ? json[0] : json) : json;
      return { data: data || null, error: null };
    } catch (err) {
      return { data: null, error: networkError(err) };
    }
  }

  // ── UPDATE ─────────────────────────────────────────────────────────────────
  // filter: 'col=eq.value'
  async function update(table, updates, filter, opts) {
    opts = opts || {};
    try {
      const params = new URLSearchParams();
      const eq  = filter.indexOf('=');
      params.set(filter.slice(0, eq), filter.slice(eq + 1));
      const res  = await fetch(BASE_URL + '/rest/v1/' + table + '?' + params, {
        method:  'PATCH',
        headers: baseHeaders(),
        body:    JSON.stringify(updates),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return { data: null, error: pgError(json, res.status) };
      const data = opts.single ? (Array.isArray(json) ? json[0] : json) : json;
      return { data: data || null, error: null };
    } catch (err) {
      return { data: null, error: networkError(err) };
    }
  }

  // ── DELETE ─────────────────────────────────────────────────────────────────
  async function del(table, filter) {
    try {
      const params = new URLSearchParams();
      const eq  = filter.indexOf('=');
      params.set(filter.slice(0, eq), filter.slice(eq + 1));
      const res = await fetch(BASE_URL + '/rest/v1/' + table + '?' + params, {
        method:  'DELETE',
        headers: baseHeaders(),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        return { error: pgError(json, res.status) };
      }
      return { error: null };
    } catch (err) {
      return { error: networkError(err) };
    }
  }

  // ── AUTH ───────────────────────────────────────────────────────────────────
  async function authSignUp(email, password, metadata) {
    try {
      const res  = await fetch(BASE_URL + '/auth/v1/signup', {
        method:  'POST',
        headers: { 'apikey': ANON_KEY, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: email, password: password, data: metadata || {} }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.error) {
        return { data: null, error: { message: json.error_description || json.msg || json.error || 'Sign-up failed' } };
      }
      return { data: json, error: null };
    } catch (err) {
      return { data: null, error: networkError(err) };
    }
  }

  async function authSignIn(email, password) {
    try {
      const res  = await fetch(BASE_URL + '/auth/v1/token?grant_type=password', {
        method:  'POST',
        headers: { 'apikey': ANON_KEY, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: email, password: password }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.error) {
        return { data: null, error: { message: json.error_description || json.msg || json.error || 'Login failed' } };
      }
      return { data: json, error: null };
    } catch (err) {
      return { data: null, error: networkError(err) };
    }
  }

  // ── Error helpers ──────────────────────────────────────────────────────────
  var CODE_MSGS = {
    '23505': 'A record with this name or email already exists.',
    '23503': 'A required related record was not found.',
    '23514': 'A required field has an invalid value.',
    '42501': 'Permission denied — check your Supabase RLS policies.',
  };

  function pgError(json, status) {
    var code = json && json.code ? String(json.code) : String(status);
    var msg  = CODE_MSGS[code] || (json && json.message) || ('Database error (' + status + ')');
    return { code: code, message: msg, raw: json };
  }

  function networkError(err) {
    var msg = err && err.message ? err.message.toLowerCase() : '';
    if (msg.indexOf('failed to fetch') !== -1 || msg.indexOf('networkerror') !== -1) {
      return { code: 'network', message: 'Network error — please check your internet connection and try again.' };
    }
    return { code: 'unknown', message: (err && err.message) || 'An unexpected error occurred.' };
  }

  // ── Connectivity ping ──────────────────────────────────────────────────────
  // Pings the auth health endpoint — returns true if the Supabase project is
  // reachable. (The bare /rest/v1/ root now returns 401 even with a valid
  // apikey, so it can no longer be used as a health check.)
  async function ping() {
    try {
      var res = await fetch(BASE_URL + '/auth/v1/health', {
        headers: { 'apikey': ANON_KEY },
      });
      return res.ok;
    } catch (_) {
      return false;
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  window.SupabaseClient = {
    insert:  insert,
    select:  select,
    update:  update,
    delete:  del,
    auth:    { signUp: authSignUp, signIn: authSignIn },
    ping:    ping,
    isReady: function() { return true; }, // always synchronously ready
    config:  { url: BASE_URL, anonKey: ANON_KEY },

    handleSuccess: function(data, op) {
      console.log('[SupabaseClient] ' + op + ' ✓');
      return { success: true, data: data, message: op + ' completed successfully' };
    },
    handleError: function(err, op) {
      var msg = (err && (err.message || err.userMessage)) || String(err);
      console.error('[SupabaseClient] ' + op + ' ✗', err);
      return { success: false, error: msg, userMessage: msg, details: err };
    },
  };

  console.log('[SupabaseClient] Ready — direct REST API, no CDN required.');
})();
