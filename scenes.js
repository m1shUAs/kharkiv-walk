// Піксельні ілюстрації місць. Дев'ять сцен беруться зі спрайтів за фото (data/places.js),
// Буфет намальований кодом як кольорова сцена (вільного фото немає).
// Техніка NES: dithering Байєра 4x4, лише кольори палітри. Індекс сцени = індекс точки в spots.js.
// Виклик: NESPlaces.draw(canvas, index)
(() => {
  const P = {
    black: "#0c0e0c", navy: "#141519", plum: "#585360", wine: "#58363b", beige: "#efc094",
    amber: "#ca8028", cream: "#fff7e9", silver: "#dfe0df", coral: "#ff8765",
    mint: "#92d5b1", cyan: "#12c5c5"
  };
  const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  const dith = (x, y, t) => t * 16 > BAYER[y & 3][x & 3] + 0.5;
  const hash = (a, b) => {
    let h = (a * 374761393 + b * 668265263) | 0;
    h = (h ^ (h >>> 13)) * 1274126177;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };

  const W = 160, H = 90;
  let ctx;
  const px = (x, y, c) => { ctx.fillStyle = c; ctx.fillRect(x | 0, y | 0, 1, 1); };
  const R = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x | 0, y | 0, w | 0, h | 0); };
  const D = (x, y, w, h, a, b, t) => {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) px(i, j, dith(i, j, t) ? b : a);
  };
  const glow = (cx, cy, r, c, k = 0.55) => {
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
      const d = Math.hypot(i, j);
      if (d < r && dith(cx + i, cy + j, (1 - d / r) * k)) px(cx + i, cy + j, c);
    }
  };

  // ---------- Буфет: фасад із маркізою та освітленою вітриною ----------
  function sky(horizon, warm) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let c = P.black;
      const t1 = (y - 8) / Math.max(10, horizon * 0.7);
      if (t1 > 0) c = dith(x, y, Math.min(t1, 1)) ? P.navy : P.black;
      const t2 = (y - (horizon - 26)) / 26;
      if (t2 > 0) c = dith(x, y, Math.min(t2, 1) * warm) ? P.wine : P.navy;
      px(x, y, c);
    }
    for (let i = 0; i < 26; i++) {
      const x = (hash(i, 3) * W) | 0, y = (hash(i, 9) * horizon * 0.55) | 0;
      px(x, y, i % 4 === 0 ? P.silver : P.plum);
    }
  }
  function ground(y) {
    for (let j = y; j < H; j++) for (let i = 0; i < W; i++) px(i, j, dith(i, j, 0.25 + (j - y) / (H - y) * 0.6) ? P.black : P.navy);
    R(0, y, W, 1, P.plum);
  }
  function skyline(y, seed) {
    let x = 0;
    while (x < W) {
      const w = 6 + ((hash(x, seed) * 10) | 0), h = 6 + ((hash(seed, x) * 16) | 0);
      R(x, y - h, w, h, P.navy);
      if (hash(x, seed + 4) > 0.55) px(x + 2, y - h + 3, P.amber);
      x += w;
    }
  }
  function buffet() {
    sky(58, 0.5); skyline(58, 11);
    ground(66);
    D(26, 28, 108, 38, P.wine, P.navy, 0.35);
    R(24, 26, 112, 4, P.plum);
    for (let x = 30; x < 132; x += 8) R(x, 18, 4, 8, hash(x, 2) > 0.5 ? P.beige : P.amber);
    R(40, 31, 80, 6, P.black); D(44, 33, 72, 2, P.beige, P.amber, 0.5);
    for (let x = 28; x < 132; x += 6) R(x, 38, 6, 7, ((x - 28) / 6) % 2 ? P.cream : P.coral);
    R(32, 48, 52, 18, P.black); D(33, 49, 50, 16, P.amber, P.beige, 0.25);
    for (let x = 38; x < 80; x += 14) { R(x, 56, 6, 2, P.wine); R(x + 2, 58, 2, 6, P.wine); }
    R(94, 46, 16, 20, P.black); R(96, 48, 12, 18, P.wine); px(106, 58, P.beige);
    R(118, 52, 10, 14, P.navy); R(120, 54, 6, 3, P.cream);
    glow(70, 56, 30, P.amber, 0.3);
  }

  // ---------- Спрайти за фото (data/places.js): RLE-рядки, символ кольору і кількість повторів ----------
  const SPRITE_COLORS = {
    k: P.black, n: P.navy, p: P.plum, s: P.silver, c: P.cream,
    w: P.wine, a: P.amber, b: P.beige, m: P.mint, y: P.cyan, o: P.coral
  };
  const decoded = {};
  function decode(i) {
    if (decoded[i]) return decoded[i];
    const src = window.PLACE_SPRITES && window.PLACE_SPRITES[i];
    if (!src) return null;
    return (decoded[i] = src.map(r => {
      let out = "";
      r.replace(/(.)(\d*)/g, (_, ch, n) => { out += ch.repeat(n ? +n : 1); });
      return out;
    }));
  }

  function draw(canvas, i) {
    const sprite = decode(i);
    const w = sprite ? sprite[0].length : W, h = sprite ? sprite.length : H;
    canvas.width = w; canvas.height = h;
    ctx = canvas.getContext("2d");
    if (sprite) {
      sprite.forEach((row, y) => { for (let x = 0; x < w; x++) px(x, y, SPRITE_COLORS[row[x]] || P.black); });
    } else {
      buffet();
    }
    // затемнення зверху (під лого й заголовок) і вигасання в колір картки внизу
    for (let y = 0; y < 16; y++) for (let x = 0; x < w; x++) {
      if (dith(x, y, (1 - y / 16) * 0.8)) px(x, y, P.black);
    }
    for (let y = h - 14; y < h; y++) for (let x = 0; x < w; x++) {
      if (dith(x, y, (y - (h - 14)) / 14)) px(x, y, P.navy);
    }
  }

  window.NESPlaces = { draw, count: 10 };
})();
