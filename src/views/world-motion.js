// Mundo 02 — Motion Graphics & Design.
// Estudio tipo software de animación: composiciones, visor con timecode, línea de tiempo
// con keyframes, editor de curvas y fondo interactivo de tipografía cinética "SYSTEM32".
import { projectsOf, worldOf, t, tr, pad, asset, posterOf } from '../data.js';
import { KINETIC_MODES, mountSystem32Kinetic } from '../gl/kinetic-system32.js';

const FPS = 30;
const tc = (s) => { const f = Math.floor((s % 1) * FPS); const x = Math.floor(s); return `${pad(Math.floor(x / 3600))}:${pad(Math.floor(x / 60) % 60)}:${pad(x % 60)}:${pad(f)}`; };
const hash = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0) / 4294967295; };

const MODE_LABELS = {
  repel: { es: 'Repel', en: 'Repel' },
  wave: { es: 'Onda', en: 'Wave' },
  vortex: { es: 'Vórtice', en: 'Vortex' },
  glitch: { es: 'Glitch', en: 'Glitch' },
};

export function renderMotionWorld(app) {
  const w = worldOf('motion');
  const list = projectsOf('motion');
  let cur = 0, layer = 0;

  const el = document.createElement('div');
  el.className = 'world world--motion';
  el.innerHTML = `
  <canvas class="kinetic-canvas" aria-hidden="true"></canvas>
  <header class="w-head">
    <p class="mono w-kicker"><span class="w-dot"></span>${tr({ es: 'MUNDO', en: 'WORLD' })} ${w.index} // ${w.coords}</p>
    <h1 class="w-title">${tr(w.name)}</h1>
  </header>
  <div class="m-kin-bar mono">
    <span class="m-kin-label">SYSTEM32 TYPE</span>
    <span class="seg">
      ${KINETIC_MODES.map((m) => `<button type="button" data-kmode="${m}">${tr(MODE_LABELS[m])}</button>`).join('')}
    </span>
    <button type="button" class="m-kin-rand" data-kmode="random" title="Key K">${tr({ es: 'Aleatorio', en: 'Random' })}</button>
  </div>
  <aside class="m-comps">
    <p class="mono dim m-panel-k">${t('composition')}s · ${pad(list.length)}</p>
    ${list.map((p, i) => `<button class="m-comp" data-i="${i}">
      <img src="${asset(p.poster)}" alt="" loading="lazy">
      <span class="m-comp-t">${p.title}</span>
      <span class="mono dim">COMP ${pad(i + 1)} · ${p.w && p.h ? `${p.w}×${p.h}` : '—'} · ${FPS}fps</span></button>`).join('')}
  </aside>
  <section class="m-viewer">
    <div class="m-frame">
      <video muted playsinline loop autoplay></video>
      <div class="m-safe" aria-hidden="true"><i></i><i></i></div>
      <span class="m-tc mono">00:00:00:00</span>
      <span class="m-res mono"></span>
    </div>
  </section>
  <article class="w-info m-info">
    <p class="mono w-info-k"></p>
    <h2 class="w-info-t"></h2>
    <p class="w-info-s"></p>
    <div class="w-info-cta"></div>
  </article>
  <section class="m-timeline" data-cursor="SCRUB">
    <div class="m-ruler mono"></div>
    <div class="m-layers"></div>
    <canvas class="m-graph" width="300" height="120" aria-hidden="true"></canvas>
    <div class="m-head"><i></i></div>
  </section>`;
  app.appendChild(el);

  const v = el.querySelector('.m-frame video');
  const frame = el.querySelector('.m-frame');
  const tcEl = el.querySelector('.m-tc');
  const layersEl = el.querySelector('.m-layers');
  const ruler = el.querySelector('.m-ruler');
  const tl = el.querySelector('.m-timeline');
  const head = el.querySelector('.m-head');
  const graph = el.querySelector('.m-graph');
  const gctx = graph.getContext('2d');
  const modeBtns = [...el.querySelectorAll('[data-kmode]')];

  // Fondo interactivo de tipografía cinética SYSTEM32
  const kinetic = mountSystem32Kinetic(el.querySelector('.kinetic-canvas'), el, {
    onModeChange: (active) => {
      modeBtns.forEach((b) => b.classList.toggle('on', b.dataset.kmode === active));
    },
  });
  modeBtns.forEach((b) => b.addEventListener('click', () => kinetic.setMode(b.dataset.kmode)));

  const mediaOf = (p) => {
    const vids = (p.gallery || []).filter((g) => g.type === 'video');
    return vids.length ? vids : [{ type: 'video', src: p.preview, w: p.w, h: p.h, caption: { es: 'Preview', en: 'Preview' } }];
  };

  function show(i, l = 0) {
    cur = i; layer = l;
    const p = list[i];
    const items = mediaOf(p);
    const m = items[l] || items[0];
    el.querySelectorAll('.m-comp').forEach((b, k) => b.classList.toggle('on', k === i));
    v.src = asset(m.src); v.poster = asset(m.poster || posterOf(m.src));
    v.play().catch(() => {});
    const ar = m.w && m.h ? m.w / m.h : 16 / 9;
    frame.style.aspectRatio = `${m.w || 16} / ${m.h || 9}`;
    frame.classList.toggle('is-tall', ar < 1);
    el.querySelector('.m-res').textContent = `${m.w || '?'}×${m.h || '?'} · ${FPS}fps`;
    layersEl.innerHTML = items.map((it, k) => {
      const a = 0.04 + hash(it.src) * 0.2, b = 0.7 + hash(it.src + 'b') * 0.28;
      const kf = [0, 1, 2, 3].map((j) => (a + (b - a) * (0.08 + j * 0.28 + hash(it.src + j) * 0.12)));
      return `<button class="m-layer ${k === l ? 'on' : ''}" data-k="${k}">
        <span class="m-layer-n mono">${pad(k + 1)}</span>
        <span class="m-layer-name">${tr(it.caption) || `${p.title} ${pad(k + 1)}`}</span>
        <span class="m-bar" style="left:${a * 100}%;width:${(b - a) * 100}%"></span>
        ${kf.map((x) => `<i class="m-kf" style="left:${x * 100}%" data-x="${x}"></i>`).join('')}
      </button>`;
    }).join('');
    layersEl.querySelectorAll('.m-layer').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); show(cur, +b.dataset.k); }));
    el.querySelector('.w-info-k').textContent = `COMP ${pad(i + 1)} / ${pad(list.length)} · ${p.year} · ${tr(p.role)}`;
    el.querySelector('.w-info-t').textContent = p.title;
    el.querySelector('.w-info-s').textContent = tr(p.summary);
    el.querySelector('.w-info-cta').innerHTML = `<a class="pill pill--fill" href="#/p/${p.id}">${t('openGallery')} →</a>`;
    kinetic.pulse();
  }
  el.querySelectorAll('.m-comp').forEach((b) => b.addEventListener('click', () => show(+b.dataset.i)));

  ruler.innerHTML = Array.from({ length: 11 }, (_, k) => `<span style="left:${k * 10}%">${k * 10}%</span>`).join('');

  let dragging = false;
  const scrubTo = (e) => {
    const r = layersEl.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    if (v.duration) v.currentTime = x * v.duration;
  };
  tl.addEventListener('pointerdown', (e) => { if (e.target.closest('.m-layer-n, .m-layer-name')) return; dragging = true; v.pause(); scrubTo(e); tl.setPointerCapture(e.pointerId); });
  tl.addEventListener('pointermove', (e) => dragging && scrubTo(e));
  tl.addEventListener('pointerup', () => { dragging = false; v.play().catch(() => {}); });

  let raf;
  const loop = () => {
    raf = requestAnimationFrame(loop);
    const p = v.duration ? v.currentTime / v.duration : 0;
    tcEl.textContent = tc(v.currentTime || 0);
    const r = layersEl.getBoundingClientRect(), tr0 = tl.getBoundingClientRect();
    head.style.transform = `translateX(${r.left - tr0.left + p * r.width}px)`;
    layersEl.querySelectorAll('.m-kf').forEach((k) => k.classList.toggle('hit', Math.abs(+k.dataset.x - p) < 0.02));

    const W = graph.width, H = graph.height;
    gctx.clearRect(0, 0, W, H);
    gctx.strokeStyle = 'rgba(237,235,230,.12)'; gctx.lineWidth = 1;
    for (let x = 0; x <= W; x += W / 6) { gctx.beginPath(); gctx.moveTo(x, 0); gctx.lineTo(x, H); gctx.stroke(); }
    const P0 = [10, H - 12], P1 = [W * 0.55, H - 12], P2 = [W * 0.45, 12], P3 = [W - 10, 12];
    gctx.strokeStyle = '#B69CFF'; gctx.lineWidth = 2;
    gctx.beginPath(); gctx.moveTo(...P0); gctx.bezierCurveTo(...P1, ...P2, ...P3); gctx.stroke();
    gctx.strokeStyle = 'rgba(182,156,255,.45)'; gctx.lineWidth = 1;
    gctx.beginPath(); gctx.moveTo(...P0); gctx.lineTo(...P1); gctx.moveTo(...P3); gctx.lineTo(...P2); gctx.stroke();
    [P1, P2].forEach(([x, y]) => { gctx.fillStyle = '#B69CFF'; gctx.fillRect(x - 3, y - 3, 6, 6); });
    const u = p, iu = 1 - u;
    const bx = iu ** 3 * P0[0] + 3 * iu * iu * u * P1[0] + 3 * iu * u * u * P2[0] + u ** 3 * P3[0];
    const by = iu ** 3 * P0[1] + 3 * iu * iu * u * P1[1] + 3 * iu * u * u * P2[1] + u ** 3 * P3[1];
    gctx.fillStyle = '#fff'; gctx.beginPath(); gctx.arc(bx, by, 4, 0, 7); gctx.fill();
  };
  loop();

  const onKey = (e) => {
    if (e.target.closest('input, textarea')) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); show((cur + 1) % list.length); }
    if (e.key === 'ArrowUp') { e.preventDefault(); show((cur - 1 + list.length) % list.length); }
    if (e.key === 'k' || e.key === 'K') { kinetic.setMode('random'); }
    if (e.code === 'Space') { e.preventDefault(); v.paused ? v.play() : v.pause(); }
  };
  addEventListener('keydown', onKey);
  show(0);

  return {
    name: 'world',
    destroy() {
      cancelAnimationFrame(raf);
      kinetic.destroy();
      removeEventListener('keydown', onKey);
      v.pause(); v.removeAttribute('src'); v.load();
    },
  };
}
