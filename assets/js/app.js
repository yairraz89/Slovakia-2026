/* ==========================================================================
   סלובקיה 2026 — לוגיקת האפליקציה
   המפה מבוססת Google Maps JavaScript API. המפתח נמצא ב-assets/js/config.js
   ========================================================================== */
(function () {
  'use strict';

  const T = window.TRIP;
  const CFG = window.CONFIG || {};
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const poiById = Object.fromEntries(T.pois.map((p) => [p.id, p]));

  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* גוגל מפות: חיפוש לפי השם המקומי, עם הקואורדינטות כגיבוי */
  const navUrl = (p) =>
    'https://www.google.com/maps/search/?api=1&query=' +
    encodeURIComponent((p.local || p.name) + ', ' + p.lat + ',' + p.lng);

  /* וייז: ניווט ישיר לקואורדינטות. הקישור פותח את האפליקציה אם היא מותקנת,
     ואחרת את waze.com בדפדפן. וייז לא תומך בשם מקום בקישור ניווט ישיר. */
  const wazeUrl = (p) => 'https://www.waze.com/ul?ll=' + p.lat + '%2C' + p.lng + '&navigate=yes&zoom=16';

  const WAZE_ICON =
    '<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true">' +
    '<path d="M21.4 2.6a1 1 0 0 0-1.1-.2l-18 8a1 1 0 0 0 .1 1.9l7.6 2.2 2.2 7.6a1 1 0 0 0 1.9.1l8-18a1 1 0 0 0-.7-1.6z"/></svg>';

  /** שני כפתורי הניווט — משמשים גם בחלון המידע וגם במסך הגיבוי */
  const navButtons = (p) =>
    `<div class="navbtns">
      <a class="navbtn navbtn--gmaps" href="${esc(navUrl(p))}" target="_blank" rel="noopener">🧭 גוגל מפות</a>
      <a class="navbtn navbtn--waze" href="${esc(wazeUrl(p))}" target="_blank" rel="noopener">${WAZE_ICON} Waze</a>
    </div>`;

  const fmtDate = (iso) => {
    const [, m, d] = iso.split('-');
    return `${+d}/${+m}`;
  };

  const WEATHER = {
    scenic: { label: 'תלוי נוף', cls: 'scenic' },
    rainproof: { label: 'חסין גשם', cls: 'rainproof' },
    flex: { label: 'גמיש', cls: 'flex' },
  };

  const darkMQ = window.matchMedia('(prefers-color-scheme: dark)');

  /* ══════════════════ מסלול נסיעה יומי בגוגל מפות ══════════════════ */

  /**
   * בונה קישור Directions לכל תחנות היום, לפי הסדר.
   * היום מתחיל ומסתיים בלינה, אלא אם הוא כבר מתחיל/מסתיים בשדה התעופה.
   *
   * המסלול כולל רק את התחנות הקבועות ורק נקודות שאפשר להגיע אליהן ברכב:
   * פריטים מסומנים `optional` יוצאים החוצה, נקודות `walk` (יעד רגלי) מדולגות,
   * ונקודה עם `driveTo` מוחלפת בחניון / תחנת הרכבל שלה.
   */
  function dayRouteUrl(day) {
    if (day.noRoute) return null;

    const seq = [];
    const push = (id) => {
      let p = poiById[id];
      if (!p || p.walk) return;
      if (p.driveTo) p = poiById[p.driveTo] || p;
      if (p && seq[seq.length - 1] !== p) seq.push(p);
    };

    day.items.forEach((it) => it.poi && !it.optional && push(it.poi));
    if (!seq.length) return null;

    const ends = ['lodging', 'airport'];
    if (!ends.includes(seq[0].id)) seq.unshift(poiById.lodging);
    if (!ends.includes(seq[seq.length - 1].id)) seq.push(poiById.lodging);
    if (seq.length < 2) return null;

    const at = (p) => p.lat + ',' + p.lng;
    const params = new URLSearchParams({
      api: '1',
      origin: at(seq[0]),
      destination: at(seq[seq.length - 1]),
      travelmode: 'driving',
    });
    const mid = seq.slice(1, -1);
    if (mid.length) params.set('waypoints', mid.map(at).join('|'));

    return 'https://www.google.com/maps/dir/?' + params;
  }

  /* ══════════════════ ניווט בין מסכים ══════════════════ */

  function showView(name) {
    $$('.view').forEach((v) => v.classList.toggle('is-active', v.id === 'view-' + name));
    $$('.tab').forEach((t) => t.classList.toggle('is-active', t.dataset.view === name));
    $('.foot').style.display = name === 'map' ? 'none' : '';
    if (name === 'map') initMap();
    else window.scrollTo(0, 0);
    history.replaceState(null, '', '#' + name);
  }

  $('#tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('.tab');
    if (btn) showView(btn.dataset.view);
  });

  /* ══════════════════ כותרת וספירה לאחור ══════════════════ */

  function renderHeader() {
    $('#brandTitle').textContent = T.meta.title;
    $('#brandSub').textContent = T.meta.subtitle;
    $('#heroSub').textContent = `${fmtDate(T.meta.start)}–${fmtDate(T.meta.end)} באוגוסט 2026 · ${T.meta.people}`;

    $('#factstrip').innerHTML = [
      ['🏡', 'לינה', T.meta.base],
      ['✈️', 'נחיתה והמראה', T.meta.airport + ' · 10:00'],
      ['🕯️', 'שבת', '22/8 · בלינה, בלי נסיעה'],
      ['🍽️', 'כשרות', 'להביא מהבית / קראקוב'],
    ]
      .map(([i, k, v]) => `<li><span aria-hidden="true">${i}</span> ${esc(k)}: <b>${esc(v)}</b></li>`)
      .join('');

    const el = $('#countdown');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(T.meta.start + 'T00:00:00');
    const end = new Date(T.meta.end + 'T00:00:00');
    const days = Math.round((start - today) / 86400000);

    if (days > 0) {
      el.textContent = days === 1 ? 'מחר טסים! ✈️' : `עוד ${days} ימים`;
    } else if (today <= end) {
      const n = Math.round((today - start) / 86400000) + 1;
      el.textContent = `יום ${n} בטיול 🏔️`;
      el.classList.add('countdown--live');
    } else {
      el.textContent = 'הטיול הסתיים 💚';
    }
  }

  /* ══════════════════ מסלול ══════════════════ */

  function poiLine(id) {
    const p = poiById[id];
    if (!p) return '';
    return `<button class="linkbtn" data-goto="${esc(p.id)}">📍 ${esc(p.name)} — הצג במפה</button>`;
  }

  function renderDays() {
    const todayISO = new Date().toISOString().slice(0, 10);

    $('#days').innerHTML = T.days
      .map((d) => {
        const w = WEATHER[d.weather];
        const items = d.items
          .map((it) => {
            const tags = it.optional ? '<span class="pill pill--opt">אופציונלי</span>' : '';
            return `
            <div class="tlitem${it.flag ? ' tlitem--flag' : ''}">
              <div class="tlitem__time">
                ${it.time ? `<b>${esc(it.time)}</b>` : '<b>·</b>'}
                <div class="tlitem__dot"></div>
              </div>
              <div class="tlitem__body">
                <div class="tlitem__title">${esc(it.title)}${tags}</div>
                ${it.desc ? `<div class="tlitem__desc">${esc(it.desc)}</div>` : ''}
                ${it.poi ? poiLine(it.poi) : ''}
              </div>
            </div>`;
          })
          .join('');

        const alt = d.alt
          ? `<div class="altbox">
               <h4>🔀 ${esc(d.alt.title)}</h4>
               <p>${esc(d.alt.desc)}</p>
               ${poiLine(d.alt.poi)}
             </div>`
          : '';

        const route = dayRouteUrl(d);
        const routeBtn = route
          ? `<div class="dayroute">
               <a class="btn btn--route" href="${esc(route)}" target="_blank" rel="noopener">
                 🚗 מסלול הנסיעה של היום בגוגל מפות
               </a>
             </div>`
          : '';

        return `
        <article class="day${d.dow === 'שבת' ? ' is-shabbat' : ''}${d.date === todayISO ? ' is-today' : ''}" data-day="${d.n}">
          <button class="day__head" aria-expanded="false">
            <div class="day__num"><b>${d.n}</b><small>${esc(d.dow.replace('יום ', ''))}</small></div>
            <div class="day__main">
              <div class="day__when">
                <span class="day__date">${esc(d.dow)} · ${fmtDate(d.date)}</span>
                <span class="wbadge wbadge--${w.cls}">${w.label}</span>
              </div>
              <div class="day__title">${esc(d.title)}</div>
              <div class="day__summary">${esc(d.summary)}</div>
              <div class="day__meta">
                <span>🚗 ${esc(d.drive)}</span>
                <span>📍 ${d.items.length} תחנות</span>
              </div>
            </div>
            <div class="day__chev" aria-hidden="true">⌄</div>
          </button>
          <div class="day__body"><div class="tl">${items}${alt}</div>${routeBtn}</div>
        </article>`;
      })
      .join('');

    $('#days').addEventListener('click', (e) => {
      const head = e.target.closest('.day__head');
      if (head) {
        const card = head.closest('.day');
        const open = card.classList.toggle('is-open');
        head.setAttribute('aria-expanded', String(open));
      }
    });

    const target = $('.day.is-today') || $('.day');
    if (target) {
      target.classList.add('is-open');
      $('.day__head', target).setAttribute('aria-expanded', 'true');
    }
  }

  /* קישורי "הצג במפה" מכל המסכים */
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-goto]');
    if (!btn) return;
    showView('map');
    focusPoi(btn.dataset.goto);
  });

  /* ══════════════════ תוכנית גשם ══════════════════ */

  function renderRain() {
    $('#rainPrinciple').textContent = T.rain.principle;

    $('#rainOptions').innerHTML = T.rain.options
      .map(
        (o) => `
      <section class="ropt">
        <div class="ropt__head">
          <span class="ropt__key">אופציה ${esc(o.key)}</span>
          <h3>${esc(o.title)}</h3>
          <p>${esc(o.lead)}</p>
        </div>
        <div class="ropt__blocks">
          ${o.blocks
            .map((b) => {
              const p = poiById[b.poi];
              const cat = p ? T.categories[p.cat] : null;
              return `<div class="rblock">
                ${b.when ? `<div class="rblock__when">${esc(b.when)}</div>` : ''}
                <div class="rblock__title"><span aria-hidden="true">${cat ? cat.icon : '•'}</span>${esc(p ? p.name : '')}</div>
                <div class="rblock__text">${esc(b.text)}</div>
                ${poiLine(b.poi)}
              </div>`;
            })
            .join('')}
        </div>
      </section>`
      )
      .join('');
  }

  /* ══════════════════ מידע ══════════════════ */

  function renderInfo() {
    $('#infoBlocks').innerHTML = T.info
      .map(
        (b) => `
      <section class="iblock${b.urgent ? ' iblock--urgent' : ''}">
        <h2><span aria-hidden="true">${b.icon}</span>${esc(b.title)}</h2>
        <ul>${b.body.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      </section>`
      )
      .join('');

    $('#verifyList').innerHTML = T.verify.map((v) => `<li>${esc(v)}</li>`).join('');
  }

  /* ══════════════════ צ׳קליסט ══════════════════ */

  const LS_KEY = 'slovakia2026.checklist.v1';

  function loadChecks() {
    try {
      return JSON.parse(localStorage.getItem(LS_KEY)) || {};
    } catch (_) {
      return {};
    }
  }
  function saveChecks(state) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(state));
    } catch (_) {
      /* מצב פרטי / אחסון חסום — פשוט לא נשמר */
    }
  }

  function renderChecklist() {
    const state = loadChecks();
    const groups = [];
    T.checklist.forEach((c) => {
      let g = groups.find((x) => x.name === c.g);
      if (!g) groups.push((g = { name: c.g, items: [] }));
      g.items.push(c);
    });

    $('#checklist').innerHTML = groups
      .map(
        (g) => `
      <section class="cgroup">
        <h3>${esc(g.name)}</h3>
        ${g.items
          .map((it) => {
            const key = g.name + '|' + it.t;
            return `<label class="citem">
              <input type="checkbox" data-key="${esc(key)}" ${state[key] ? 'checked' : ''}>
              <span>${esc(it.t)}</span>
            </label>`;
          })
          .join('')}
      </section>`
      )
      .join('');

    updateProgress();
  }

  function updateProgress() {
    const boxes = $$('#checklist input[type=checkbox]');
    const done = boxes.filter((b) => b.checked).length;
    const pct = boxes.length ? Math.round((done / boxes.length) * 100) : 0;
    $('#progressFill').style.width = pct + '%';
    $('#progressLabel').textContent = `${done}/${boxes.length}`;
  }

  $('#checklist').addEventListener('change', (e) => {
    const box = e.target.closest('input[type=checkbox]');
    if (!box) return;
    const state = loadChecks();
    if (box.checked) state[box.dataset.key] = 1;
    else delete state[box.dataset.key];
    saveChecks(state);
    updateProgress();
  });

  $('#resetList').addEventListener('click', () => {
    if (!confirm('לאפס את כל הסימונים?')) return;
    saveChecks({});
    $$('#checklist input[type=checkbox]').forEach((b) => (b.checked = false));
    updateProgress();
  });

  /* ══════════════════ מפה — Google Maps ══════════════════ */

  let map = null;
  let infoWin = null;
  let markers = {};
  let selected = null;
  let mapReady = false;
  let mapLoading = null;
  let pendingFocus = null;
  const filters = { day: 'all', cat: 'all' };

  /* צורת סמן קלאסי (24×24, הקצה התחתון ב-y=24) */
  const PIN_PATH = 'M12 0C6.9 0 2.8 4.1 2.8 9.2 2.8 16.1 12 24 12 24s9.2-7.9 9.2-14.8C21.2 4.1 17.1 0 12 0z';

  /* סגנון כהה — חל על סוג המפה "מפת דרכים" (terrain/לוויין מציגים את הצבעים שלהם) */
  const DARK_STYLE = [
    { elementType: 'geometry', stylers: [{ color: '#20282b' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#20282b' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#8a9b96' }] },
    { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#c9a227' }] },
    { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#7f8f8a' }] },
    { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#1e3330' }] },
    { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#4f8a72' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#333d40' }] },
    { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#1c2426' }] },
    { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9aa8a3' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#5c5340' }] },
    { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#1c2426' }] },
    { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#e6c98a' }] },
    { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2a3336' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#12262f' }] },
    { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#4a6570' }] },
  ];

  /** טוען את ה-SDK של Google Maps. נדחה אם אין מפתח או אם הטעינה נכשלה. */
  function loadGoogleMaps() {
    if (mapLoading) return mapLoading;

    const key = String(CFG.GOOGLE_MAPS_API_KEY || '').trim();
    if (!key) return Promise.reject(new Error('no-key'));

    mapLoading = new Promise((resolve, reject) => {
      window.__gmapsReady = () => resolve(window.google);

      const params = new URLSearchParams({
        key: key,
        v: 'weekly',
        libraries: 'marker',
        language: CFG.MAP_LANGUAGE || 'iw',
        region: 'SK',
        loading: 'async',
        callback: '__gmapsReady',
      });

      const s = document.createElement('script');
      s.src = 'https://maps.googleapis.com/maps/api/js?' + params.toString();
      s.async = true;
      s.onerror = () => reject(new Error('load-failed'));
      document.head.appendChild(s);

      /* אם המפתח פסול, Google לא קורא ל-callback — נכשלים בנימוס */
      setTimeout(() => reject(new Error('timeout')), 15000);
    });

    return mapLoading;
  }

  async function initMap() {
    if (mapReady) return;
    try {
      await loadGoogleMaps();
    } catch (err) {
      showMapSetup(err.message);
      return;
    }
    buildMap();
  }

  function buildMap() {
    if (mapReady) return;
    mapReady = true;
    $('#mapSetup').hidden = true;

    const opts = {
      center: { lat: 49.3, lng: 19.7 },
      zoom: 8,
      mapTypeId: CFG.MAP_TYPE || 'terrain',
      gestureHandling: 'greedy',
      streetViewControl: false,
      fullscreenControl: false,
      mapTypeControl: true,
      mapTypeControlOptions: {
        position: google.maps.ControlPosition.TOP_RIGHT,
        mapTypeIds: ['terrain', 'roadmap', 'hybrid'],
      },
      zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_BOTTOM },
    };

    const useAdvanced = !!String(CFG.MAP_ID || '').trim();
    if (useAdvanced) opts.mapId = String(CFG.MAP_ID).trim();
    else opts.styles = darkMQ.matches ? DARK_STYLE : [];

    map = new google.maps.Map($('#map'), opts);
    infoWin = new google.maps.InfoWindow({ maxWidth: 300 });
    infoWin.addListener('closeclick', () => setSelected(null));

    /* מעבר בהיר/כהה בזמן אמת (רק כשאין Map ID — אחרת הסגנון מנוהל בענן) */
    if (!useAdvanced) {
      const onScheme = (e) => map.setOptions({ styles: e.matches ? DARK_STYLE : [] });
      darkMQ.addEventListener ? darkMQ.addEventListener('change', onScheme) : darkMQ.addListener(onScheme);
    }

    T.pois.forEach((p) => (markers[p.id] = makeMarker(p, useAdvanced)));

    renderFilters();
    applyFilters(true);

    if (pendingFocus) {
      const id = pendingFocus;
      pendingFocus = null;
      focusPoi(id);
    }
  }

  /**
   * עוטף את שני סוגי הסמנים (Advanced / קלאסי) בממשק אחיד:
   * show/hide, סימון נבחר, ועוגן ל-InfoWindow.
   */
  function makeMarker(p, useAdvanced) {
    const cat = T.categories[p.cat];
    const position = { lat: p.lat, lng: p.lng };

    if (useAdvanced) {
      const el = document.createElement('div');
      el.className = 'mk';
      el.style.background = cat.color;
      el.innerHTML = `<span>${cat.icon}</span>`;

      const m = new google.maps.marker.AdvancedMarkerElement({ position, content: el, title: p.name });
      m.addListener('click', () => select(p.id, true, false));

      return {
        anchor: m,
        show: (on) => (m.map = on ? map : null),
        setSelected: (on) => el.classList.toggle('is-sel', on),
      };
    }

    const baseIcon = (sel) => ({
      path: PIN_PATH,
      fillColor: cat.color,
      fillOpacity: 1,
      strokeColor: sel ? '#f59e0b' : '#ffffff',
      strokeWeight: sel ? 3.5 : 2,
      scale: sel ? 1.7 : 1.4,
      anchor: new google.maps.Point(12, 24),
      labelOrigin: new google.maps.Point(12, 9.5),
    });

    const m = new google.maps.Marker({
      position,
      title: p.name,
      icon: baseIcon(false),
      label: { text: cat.icon, fontSize: '12px' },
    });
    m.addListener('click', () => select(p.id, true, false));

    return {
      anchor: m,
      show: (on) => m.setMap(on ? map : null),
      setSelected: (on) => m.setIcon(baseIcon(on)),
    };
  }

  function popupHtml(p) {
    const daysTxt = (p.days || []).length ? 'יום ' + p.days.join(', ') : p.bonus ? 'רעיון נוסף' : '';
    return `<div class="pop">
      <div class="pop__name">${esc(p.name)}</div>
      ${p.local ? `<div class="pop__local">${esc(p.local)}</div>` : ''}
      ${daysTxt ? `<div class="pop__days">${esc(daysTxt)}</div>` : ''}
      <div class="pop__desc">${esc(p.desc || '')}</div>
      ${p.tips && p.tips.length ? `<ul class="pop__tips">${p.tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
      ${navButtons(p)}
    </div>`;
  }

  /* ---------- מסך הסבר כשאין מפתח ---------- */

  function showMapSetup(reason) {
    const box = $('#mapSetup');
    box.hidden = false;

    const msg =
      reason === 'no-key'
        ? 'כדי להציג את המפה צריך מפתח Google Maps API. זה חינם לשימוש בהיקף כזה, ולוקח כמה דקות.'
        : 'המפה לא נטענה. בדקו שהמפתח ב-assets/js/config.js תקין, שהופעל Maps JavaScript API, ושהדומיין מורשה במגבלות המפתח.';

    box.innerHTML = `
      <div class="mapsetup__card">
        <h2><span aria-hidden="true">🗺️</span> המפה עדיין לא מחוברת</h2>
        <p>${esc(msg)}</p>
        <ol class="mapsetup__steps">
          <li>היכנסו ל-<a href="https://console.cloud.google.com/google/maps-apis/credentials" target="_blank" rel="noopener">Google Cloud Console</a> וצרו פרויקט.</li>
          <li>הפעילו את <b>Maps JavaScript API</b>.</li>
          <li>צרו מפתח (Create credentials ⇦ API key) והגבילו אותו ל-HTTP referrer של האתר.</li>
          <li>הדביקו אותו ב-<code>assets/js/config.js</code> בשדה <code>GOOGLE_MAPS_API_KEY</code>.</li>
        </ol>
        <p class="muted">בינתיים אפשר לנווט לכל נקודה ישירות מהרשימה.</p>
        <div class="mapsetup__grid">
          ${T.pois
            .map((p) => {
              const c = T.categories[p.cat];
              return `<div class="mapsetup__poi">
                <span class="mapsetup__poi-icon" aria-hidden="true">${c.icon}</span>
                <span class="mapsetup__poi-txt">
                  <b>${esc(p.name)}</b>
                  ${p.local ? `<i dir="ltr">${esc(p.local)}</i>` : ''}
                </span>
                ${navButtons(p)}
              </div>`;
            })
            .join('')}
        </div>
      </div>`;
  }

  /* ---------- פילטרים ורשימה ---------- */

  function visiblePois() {
    return T.pois.filter((p) => {
      if (filters.cat !== 'all' && p.cat !== filters.cat) return false;
      if (filters.day === 'all') return true;
      if (filters.day === 'bonus') return !!p.bonus;
      return (p.days || []).includes(+filters.day);
    });
  }

  function renderFilters() {
    const dayBtns = [{ v: 'all', t: 'כל הימים' }]
      .concat(T.days.map((d) => ({ v: String(d.n), t: 'יום ' + d.n })))
      .concat([{ v: 'bonus', t: '✨ רעיונות נוספים' }]);

    $('#dayFilters').innerHTML = dayBtns
      .map((b) => `<button class="chip${b.v === 'all' ? ' is-on' : ''}" data-day="${b.v}">${esc(b.t)}</button>`)
      .join('');

    $('#catFilters').innerHTML =
      '<button class="chip is-on" data-cat="all">הכל</button>' +
      Object.entries(T.categories)
        .map(
          ([k, c]) =>
            `<button class="chip" data-cat="${esc(k)}"><span aria-hidden="true">${c.icon}</span>${esc(c.label)}</button>`
        )
        .join('');

    $('#dayFilters').addEventListener('click', (e) => {
      const b = e.target.closest('.chip');
      if (!b) return;
      filters.day = b.dataset.day;
      $$('#dayFilters .chip').forEach((x) => x.classList.toggle('is-on', x === b));
      applyFilters(true);
    });

    $('#catFilters').addEventListener('click', (e) => {
      const b = e.target.closest('.chip');
      if (!b) return;
      filters.cat = b.dataset.cat;
      $$('#catFilters .chip').forEach((x) => x.classList.toggle('is-on', x === b));
      applyFilters(true);
    });

    $('#poiList').addEventListener('click', (e) => {
      const b = e.target.closest('.poicard');
      if (b) select(b.dataset.id, true, true);
    });
  }

  function applyFilters(fit) {
    const vis = visiblePois();
    const visIds = new Set(vis.map((p) => p.id));

    T.pois.forEach((p) => markers[p.id] && markers[p.id].show(visIds.has(p.id)));

    if (selected && !visIds.has(selected)) {
      infoWin.close();
      setSelected(null);
    }

    $('#poiCount').textContent = `${vis.length} מתוך ${T.pois.length} נקודות`;

    $('#poiList').innerHTML = vis
      .map((p) => {
        const c = T.categories[p.cat];
        const d = (p.days || []).length ? 'יום ' + p.days.join(', ') : p.bonus ? 'רעיון נוסף' : '';
        return `<li><button class="poicard${p.id === selected ? ' is-sel' : ''}" data-id="${esc(p.id)}">
          <span class="poicard__icon" aria-hidden="true">${c.icon}</span>
          <span class="poicard__txt">
            <span class="poicard__name">${esc(p.name)}</span>
            ${p.local ? `<span class="poicard__local" dir="ltr">${esc(p.local)}</span>` : ''}
            ${d ? `<span class="poicard__days">${esc(d)}</span>` : ''}
          </span>
        </button></li>`;
      })
      .join('');

    if (fit && vis.length) fitTo(vis);
  }

  function fitTo(pois) {
    const b = new google.maps.LatLngBounds();
    pois.forEach((p) => b.extend({ lat: p.lat, lng: p.lng }));
    map.fitBounds(b, 60);
    /* fitBounds על נקודה בודדת מזניק את הזום לקצה — מגבילים פעם אחת */
    google.maps.event.addListenerOnce(map, 'idle', () => {
      if (map.getZoom() > 13) map.setZoom(13);
    });
  }

  function setSelected(id) {
    if (selected && markers[selected]) markers[selected].setSelected(false);
    selected = id;
    if (id && markers[id]) markers[id].setSelected(true);
    $$('#poiList .poicard').forEach((b) => b.classList.toggle('is-sel', b.dataset.id === id));
  }

  function select(id, openInfo, recenter) {
    const p = poiById[id];
    if (!p) return;

    setSelected(id);

    if (recenter) {
      map.panTo({ lat: p.lat, lng: p.lng });
      if (map.getZoom() < 12) map.setZoom(12);
    }

    if (openInfo) {
      infoWin.setContent(popupHtml(p));
      infoWin.open({ anchor: markers[id].anchor, map: map });
    }

    $('.mapshell').classList.remove('side-open');

    const card = $(`#poiList .poicard[data-id="${CSS.escape(id)}"]`);
    if (card) card.scrollIntoView({ block: 'nearest' });
  }

  /** קפיצה לנקודה מכל מקום באתר — גם אם היא מסוננת החוצה כרגע */
  function focusPoi(id) {
    if (!mapReady) {
      pendingFocus = id;
      initMap();
      return;
    }

    if (!visiblePois().some((p) => p.id === id)) {
      filters.day = 'all';
      filters.cat = 'all';
      $$('#dayFilters .chip').forEach((x) => x.classList.toggle('is-on', x.dataset.day === 'all'));
      $$('#catFilters .chip').forEach((x) => x.classList.toggle('is-on', x.dataset.cat === 'all'));
      applyFilters(false);
    }

    select(id, true, true);
  }

  $('#mapsideToggle').addEventListener('click', () => {
    $('.mapshell').classList.add('side-open');
    $('#mapsideToggle').setAttribute('aria-expanded', 'true');
  });
  $('#mapsideClose').addEventListener('click', () => {
    $('.mapshell').classList.remove('side-open');
    $('#mapsideToggle').setAttribute('aria-expanded', 'false');
  });

  /* ══════════════════ init ══════════════════ */

  renderHeader();
  renderDays();
  renderRain();
  renderInfo();
  renderChecklist();

  const initial = (location.hash || '#plan').slice(1);
  showView(['plan', 'map', 'rain', 'info', 'list'].includes(initial) ? initial : 'plan');
})();
