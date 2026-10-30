(() => {
  const spots = window.SPOTS;
  const NS = "http://www.w3.org/2000/svg";
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const svg = document.getElementById("map");
  const gRiver = document.getElementById("river");
  const gLegs = document.getElementById("legs");
  const gDots = document.getElementById("dots");
  const els = {
    card: document.getElementById("card"),
    time: document.getElementById("time"),
    until: document.getElementById("until"),
    after: document.getElementById("after"),
    name: document.getElementById("name"),
    leg: document.getElementById("leg"),
    desc: document.getElementById("desc"),
    shelter: document.getElementById("shelter"),
    progress: document.getElementById("progress"),
    segs: document.getElementById("segs"),
    scene: document.getElementById("scene"),
    gmap: document.getElementById("gmap"),
    gmapOpen: document.getElementById("gmap-open"),
    gmapLabel: document.getElementById("gmap-label"),
    route: document.getElementById("route"),
    back: document.getElementById("back"),
    next: document.getElementById("next"),
  };

  // Схематичний вигин річки Харків (приблизно), щоб мапа мала орієнтир
  const RIVER = [
    [50.000, 36.262], [49.995, 36.252], [49.991, 36.246],
    [49.988, 36.240], [49.986, 36.233], [49.983, 36.228],
  ];

  let step = 0;
  let width = 0, height = 0, project;

  // Легке стиснення відстаней від центру маршруту: далекі точки (Буфет, бульвар)
  // лишаються в своїх напрямках, але не розтягують схему так, що центр злипається
  const cLat = spots.reduce((a, s) => a + s.lat, 0) / spots.length;
  const cLon = spots.reduce((a, s) => a + s.lon, 0) / spots.length;
  const kLat = Math.cos(cLat * Math.PI / 180);
  const R0 = 0.014;
  function warp(lat, lon) {
    const dx = (lon - cLon) * kLat, dy = lat - cLat;
    const r = Math.hypot(dx, dy) || 1e-9;
    const r2 = R0 * Math.pow(r / R0, 0.5);
    return [dx / r * r2, -dy / r * r2];
  }

  function buildProjection() {
    const r = svg.getBoundingClientRect();
    width = r.width; height = r.height;
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

    const pts = spots.map(s => warp(s.lat, s.lon));
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);

    const padX = 36, padY = 40;
    const spanX = maxX - minX, spanY = maxY - minY;
    const scale = Math.min((width - padX * 2) / spanX, (height - padY * 2) / spanY);
    const offX = (width - spanX * scale) / 2;
    const offY = (height - spanY * scale) / 2;

    project = (lat, lon) => {
      const [u, v] = warp(lat, lon);
      return [offX + (u - minX) * scale, offY + (v - minY) * scale];
    };
  }

  function el(name, attrs) {
    const n = document.createElementNS(NS, name);
    for (const a in attrs) n.setAttribute(a, attrs[a]);
    return n;
  }

  const f1 = n => n.toFixed(1);

  // Плавна крива через точки (Catmull-Rom у кубічні Безьє): для річки
  function smooth(pts) {
    let d = `M${f1(pts[0][0])},${f1(pts[0][1])}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C${f1(c1[0])},${f1(c1[1])} ${f1(c2[0])},${f1(c2[1])} ${f1(p2[0])},${f1(p2[1])}`;
    }
    return d;
  }

  // Відрізок як м'яка дуга: вигин убік від прямої, як стежка, а не лінійка
  function arc(a, b, i, taxi) {
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    const side = (i % 2 ? 1 : -1) * (0.7 + 0.5 * ((i * 37) % 10) / 10);
    const bend = len * (taxi ? 0.22 : 0.16) * side;
    const cx = mx - dy / len * bend, cy = my + dx / len * bend;
    return `M${f1(a[0])},${f1(a[1])} Q${f1(cx)},${f1(cy)} ${f1(b[0])},${f1(b[1])}`;
  }

  function drawStatic() {
    gRiver.replaceChildren(); gLegs.replaceChildren(); gDots.replaceChildren();

    gRiver.append(el("path", { d: smooth(RIVER.map(([la, lo]) => project(la, lo))), class: "river" }));

    spots.forEach((s, i) => {
      if (i > 0) {
        const a = project(spots[i - 1].lat, spots[i - 1].lon);
        const b = project(s.lat, s.lon);
        const line = el("path", { d: arc(a, b, i, s.leg === "taxi"), class: `leg-line ${s.leg}` });
        line.dataset.i = i;
        gLegs.append(line);
      }
    });

    spots.forEach((s, i) => {
      const [x, y] = project(s.lat, s.lon);
      const g = el("g", {});
      const halo = el("circle", { cx: x, cy: y, r: 14, class: "halo" });
      halo.style.display = "none";
      const dot = el("circle", { cx: x, cy: y, r: 6, class: "dot" });
      const num = el("text", { x, y: y - 12, class: "num" });
      num.textContent = i + 1;
      g.dataset.i = i;
      g.append(halo, dot, num);
      gDots.append(g);
    });
  }

  // Анімація "малювання" відрізка до поточної точки
  function drawLeg(line) {
    if (reduceMotion || !line.getTotalLength) return;
    const len = line.getTotalLength();
    const isTaxi = line.classList.contains("taxi");
    if (isTaxi) {
      line.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500, easing: "ease-out" });
      return;
    }
    line.style.strokeDasharray = len;
    line.animate(
      [{ strokeDashoffset: len }, { strokeDashoffset: 0 }],
      { duration: 600, easing: "cubic-bezier(.3,.6,.2,1)" }
    ).onfinish = () => { line.style.strokeDasharray = ""; };
  }

  // Google Maps (вбудована карта + повноекранне посилання) і Apple Maps (з поточного місця)
  function updateRoutes(s) {
    const prev = step > 0 ? spots[step - 1] : null;
    const to = `${s.lat},${s.lon}`;
    const taxi = s.leg === "taxi";
    let embed, full;
    if (prev) {
      const from = `${prev.lat},${prev.lon}`;
      embed = `https://maps.google.com/maps?saddr=${from}&daddr=${to}&dirflg=${taxi ? "d" : "w"}&hl=uk&output=embed`;
      full = `https://www.google.com/maps/dir/?api=1&origin=${from}&destination=${to}&travelmode=${taxi ? "driving" : "walking"}`;
    } else {
      embed = `https://maps.google.com/maps?q=${to}&z=16&hl=uk&output=embed`;
      full = `https://www.google.com/maps/search/?api=1&query=${to}`;
    }
    if (els.gmap.dataset.src !== embed) { els.gmap.dataset.src = embed; els.gmap.src = embed; }
    els.gmapOpen.href = full;
    els.gmapLabel.textContent = prev ? `- ${prev.name} / ${s.name} -` : "- Місце збору -";
    const mode = taxi ? "d" : "w";
    els.route.href = `https://maps.apple.com/?daddr=${to}&dirflg=${mode}&q=${encodeURIComponent(s.name)}`;
  }

  // Піксельне таксі з data/taxi.js (RLE-рядки: символ кольору і кількість повторів)
  const TAXI_COLORS = {
    k: "#0c0e0c", n: "#141519", p: "#585360", s: "#dfe0df", c: "#fff7e9",
    w: "#58363b", a: "#ca8028", b: "#efc094", o: "#ff8765", r: "#c35353", m: "#92d5b1", y: "#12c5c5",
  };
  (function drawTaxi() {
    const rows = (window.TAXI_SPRITE || []).map(r => {
      let out = "";
      r.replace(/(.)(\d*)/g, (_, ch, n) => { out += ch.repeat(n ? +n : 1); });
      return out;
    });
    if (!rows.length) return;
    const cv = document.getElementById("taxi-icon");
    cv.width = rows[0].length; cv.height = rows.length;
    const cx = cv.getContext("2d");
    rows.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch === "." || !TAXI_COLORS[ch]) return;
      cx.fillStyle = TAXI_COLORS[ch]; cx.fillRect(x, y, 1, 1);
    }));
  })();

  // Копіювання адреси по дотику
  const taxiHint = document.getElementById("taxi-hint");
  let hintTimer, taxiAddress = "";
  function legacyCopy(text) {
    return new Promise((resolve, reject) => {
      // iOS: textarea має бути редагованою, шрифт 16px (без зуму), виділення через діапазон
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;font-size:16px";
      document.body.append(ta);
      let ok = false;
      try {
        const sel = window.getSelection();
        const range = document.createRange();
        ta.focus({ preventScroll: true });
        range.selectNodeContents(ta);
        sel.removeAllRanges(); sel.addRange(range);
        ta.setSelectionRange(0, text.length);
        ok = document.execCommand("copy");
      } catch (e) {}
      ta.remove();
      ok ? resolve() : reject(new Error("copy failed"));
    });
  }
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).catch(() => legacyCopy(text));
    }
    return legacyCopy(text);
  }
  function setHint(text, ok) {
    taxiHint.textContent = text;
    taxiHint.classList.toggle("ok", !!ok);
  }
  document.getElementById("taxi-copy").addEventListener("click", () => {
    clearTimeout(hintTimer);
    copyText(taxiAddress).then(
      () => setHint("Адресу скопійовано", true),
      () => setHint("Не вдалося скопіювати, виділи адресу вручну", false)
    ).then(() => { hintTimer = setTimeout(() => setHint("Торкнись, щоб скопіювати адресу"), 2200); });
  });

  function updateTaxi(s) {
    const box = document.getElementById("taxi");
    let title, to, addr;
    if (s.leg === "taxi") {
      title = "- Таксі сюди -"; to = s.name; addr = s.address;
    }
    box.hidden = !title;
    if (!title) return;
    document.getElementById("taxi-title").textContent = title;
    document.getElementById("taxi-to").textContent = to;
    document.getElementById("taxi-addr").textContent = addr || "";
    taxiAddress = addr || "";
    clearTimeout(hintTimer);
    setHint("Торкнись, щоб скопіювати адресу");
  }

  // Додаткове піксельне фото точки (data/extra.js), наприклад страва
  function updateExtra() {
    const box = document.getElementById("extra");
    const src = window.PLACE_EXTRA && window.PLACE_EXTRA[step];
    box.hidden = !src;
    if (!src) return;
    const rows = src.map(r => {
      let out = "";
      r.replace(/(.)(\d*)/g, (_, ch, n) => { out += ch.repeat(n ? +n : 1); });
      return out;
    });
    const cv = document.getElementById("extra-img");
    cv.width = rows[0].length; cv.height = rows.length;
    cv.style.aspectRatio = `${cv.width} / ${cv.height}`;
    const cx = cv.getContext("2d");
    cx.clearRect(0, 0, cv.width, cv.height);
    rows.forEach((row, y) => [...row].forEach((ch, x) => {
      if (TAXI_COLORS[ch]) { cx.fillStyle = TAXI_COLORS[ch]; cx.fillRect(x, y, 1, 1); }
    }));
  }

  function render(animate) {
    const s = spots[step];

    gLegs.querySelectorAll(".leg-line").forEach(line => {
      const i = +line.dataset.i;
      line.classList.toggle("done", i < step);
      line.classList.toggle("active", i === step);
      if (animate && i === step) drawLeg(line);
    });

    gDots.querySelectorAll("g").forEach(g => {
      const i = +g.dataset.i;
      const dot = g.querySelector(".dot");
      const halo = g.querySelector(".halo");
      dot.classList.toggle("done", i < step);
      dot.classList.toggle("current", i === step);
      dot.setAttribute("r", i === step ? 8 : 6);
      const num = g.querySelector(".num");
      num.classList.toggle("done", i < step);
      num.classList.toggle("current", i === step);
      halo.style.display = i === step ? "" : "none";
      if (animate && i === step && !reduceMotion) {
        halo.animate([{ transform: "scale(.4)", opacity: .5 }, { transform: "scale(1)", opacity: .18 }],
          { duration: 700, easing: "ease-out", delay: 350, fill: "backwards" });
      }
    });

    if (window.NESPlaces) window.NESPlaces.draw(els.scene, step);
    els.scene.setAttribute("aria-label", `Ілюстрація: ${s.name}`);
    updateRoutes(s);
    updateTaxi(s);
    updateExtra();

    els.time.textContent = s.time;
    const nextSpot = spots[step + 1];
    els.until.textContent = nextSpot ? `до ${nextSpot.time}` : "фінал";
    els.after.replaceChildren(nextSpot ? "далі " : "кінець маршруту");
    if (nextSpot) { const b = document.createElement("b"); b.textContent = nextSpot.name; els.after.append(b); }
    els.name.textContent = s.name;
    els.leg.textContent = s.leg === "taxi" ? "Сюди на таксі" : s.leg === "walk" ? "Сюди пішки" : "";
    els.desc.textContent = s.description;
    els.shelter.textContent = s.shelter;
    const pad = n => String(n).padStart(2, "0");
    els.progress.textContent = `${pad(step + 1)}/${pad(spots.length)}`;
    els.segs.replaceChildren(...spots.map((_, i) => {
      const seg = document.createElement("span");
      seg.className = i <= step ? "seg on" : "seg";
      return seg;
    }));

    els.back.disabled = step === 0;
    els.next.textContent = step === spots.length - 1 ? "Почати знову" : "Далі";

    if (animate) {
      els.card.classList.remove("enter");
      void els.card.offsetWidth;
      els.card.classList.add("enter");
      els.card.scrollTop = 0;
    }
    try { localStorage.setItem("kharkiv-walk-step", step); } catch (e) {}
  }

  els.next.addEventListener("click", () => {
    step = step === spots.length - 1 ? 0 : step + 1;
    render(true);
  });
  els.back.addEventListener("click", () => {
    if (step > 0) { step--; render(true); }
  });

  // Свайп по мапі/картці
  let x0 = null, y0 = 0;
  document.addEventListener("touchstart", e => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  document.addEventListener("touchend", e => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    const dy = e.changedTouches[0].clientY - y0;
    x0 = null;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx < 0 && step < spots.length - 1) { step++; render(true); }
    if (dx > 0 && step > 0) { step--; render(true); }
  }, { passive: true });

  try {
    const saved = parseInt(localStorage.getItem("kharkiv-walk-step"), 10);
    if (saved >= 0 && saved < spots.length) step = saved;
  } catch (e) {}

  function setAppHeight() { document.documentElement.style.setProperty("--app-h", window.innerHeight + "px"); }
  setAppHeight();
  window.addEventListener("resize", setAppHeight);
  window.addEventListener("orientationchange", () => setTimeout(setAppHeight, 200));

  function layout() { buildProjection(); drawStatic(); render(false); }
  window.addEventListener("resize", layout);
  layout();
  requestAnimationFrame(() => render(true));
})();
