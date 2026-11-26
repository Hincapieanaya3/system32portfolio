// Escenario 3D con su interfaz: HUD del rig, cámaras, autopilot/strobe, pixel map 2D en
// vivo enlazado con las pantallas 3D, deck de canales y modo STAGE BUILD 2D→3D en 4 fases.
import { Stage } from '../gl/stage.js';
import { t, tr, asset, posterOf, pad } from '../data.js';

const BUILD_PHASES = [
  {
    step: 1,
    short: { es: '01 · CAD EXPLODED', en: '01 · CAD EXPLODED' },
    desc: {
      es: 'Trusses, gabinetes y pantallas LED separados en vista explosionada con cotas físicas y líneas guía.',
      en: 'Trusses, cabinets, and LED panels separated in exploded CAD view with physical dimensions and leader lines.',
    },
  },
  {
    step: 2,
    short: { es: '02 · PIXELMAP SLICES', en: '02 · PIXELMAP SLICES' },
    desc: {
      es: 'Ensamblaje mecánico proyectando el plano real de cortes de Resolume Advanced Output sobre cada pantalla.',
      en: 'Mechanical assembly projecting the real Resolume Advanced Output pixelmap calibration grid onto every slice.',
    },
  },
  {
    step: 3,
    short: { es: '03 · RIG & BEAMS', en: '03 · RIG & BEAMS' },
    desc: {
      es: 'Encendido de iluminación volumétrica, cabezas móviles, humo y público sobre el mapa de calibración.',
      en: 'Volumetric moving heads, stage haze, and crowd powered on over the active calibration pixelmap.',
    },
  },
  {
    step: 4,
    short: { es: '04 · LIVE SHOW', en: '04 · LIVE SHOW' },
    desc: {
      es: 'Show final en vivo corriendo los visuales DXV3 sincronizados al BPM en modo Autopilot.',
      en: 'Final live festival operation streaming synchronized DXV3 visuals in Autopilot mode.',
    },
  },
];

export function stageMarkup(pm, { label } = {}) {
  const [cw, ch] = pm.canvas;
  const multi = !!pm.scenes?.length;
  const items = multi ? pm.scenes : pm.playlist;
  const thumb = (it) => asset(posterOf(multi ? it.sources.central || Object.values(it.sources)[0] : it));
  return `
  <div class="stage-view">
    <div class="stage-gl" data-cursor="DRAG"></div>
    <div class="cad-tags" aria-hidden="true">
      ${pm.slices.map((s, i) => `<button type="button" class="cad-tag mono" data-i="${i}"><b>${tr(s.name)}</b> ${s.w}×${s.h}${s.physical ? ' · ' + s.physical : ''}</button>`).join('')}
    </div>
  </div>
  <div class="stage-hud">
    <p class="mono stage-tag"><i class="rec"></i>RIG: ${pm.label} // ${cw}×${ch}px // ${pm.slices.length} SLICE${pm.slices.length > 1 ? 'S' : ''}${label ? ' — ' + label : ''}</p>
    <div class="stage-ctrl mono">
      <button class="sc-build" type="button"><i class="b-dot"></i>${t('stageBuild')}</button>
      <span class="seg">
        <button data-cam="wide" class="on">${t('camWide')}</button><button data-cam="stage">${t('camStage')}</button><button data-cam="booth">${t('camBooth')}</button>
      </span>
      <button class="sc-auto on" type="button">${t('autopilot')}</button>
      <button class="sc-strobe" type="button" title="Space">${t('strobe')}</button>
      <button class="sc-map on" type="button">${t('pixelmap')}</button>
    </div>
  </div>
  <aside class="pxmap">
    <div class="pxmap-tabs mono"><button class="on" data-mode="live">${t('signal')}</button><button data-mode="tpl">${t('template')}</button></div>
    <div class="pxmap-box" style="aspect-ratio:${cw}/${ch}">
      <canvas class="pxmap-live" width="${Math.min(480, cw)}" height="${Math.round((Math.min(480, cw) * ch) / cw)}"></canvas>
      ${pm.image ? `<img class="pxmap-tpl" src="${asset(pm.image)}" alt="">` : `<canvas class="pxmap-tpl pxmap-gen" width="${cw}" height="${ch}"></canvas>`}
      <svg class="pxmap-svg" viewBox="0 0 ${cw} ${ch}" preserveAspectRatio="none">
        ${pm.slices.map((s, i) => `<g class="sl" data-i="${i}"><rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}"/></g>`).join('')}
      </svg>
      ${pm.slices.map((s, i) => `<span class="sl-label mono" data-i="${i}" style="left:${((s.x + s.w / 2) / cw) * 100}%;top:${((s.y + s.h / 2) / ch) * 100}%">${tr(s.name)}<br>${s.w}×${s.h}${s.physical ? ' · ' + s.physical : ''}</span>`).join('')}
    </div>
    <p class="mono dim pxmap-foot">${pm.hardware || 'Resolume Arena · Advanced Output'}${pm.bpm ? ' · ' + pm.bpm + ' BPM' : ''}</p>
  </aside>
  <div class="build-dock" hidden>
    <div class="build-dock-top">
      <div class="build-readout">
        <span class="build-badge mono">01 · CAD EXPLODED</span>
        <span class="build-desc"></span>
      </div>
      <div class="build-actions mono">
        <button type="button" class="bd-auto">${t('autoBuild')}</button>
        <button type="button" class="bd-next">${t('next')} →</button>
        <button type="button" class="bd-close">${t('exitBuild')} ✕</button>
      </div>
    </div>
    <div class="build-steps mono">
      ${BUILD_PHASES.map((p) => `<button type="button" class="bd-step" data-step="${p.step}">${tr(p.short)}</button>`).join('')}
    </div>
  </div>
  <div class="deck-wrap"><p class="deck-k mono">${multi ? t('scenes') : t('clips')} <b>${pad(items.length)}</b><span class="dim"> · [ ]</span></p><div class="deck" role="list" aria-label="${multi ? t('scenes') : t('clips')}" data-lenis-prevent>
    ${items.map((it, k) => `<button class="ch" role="listitem" data-k="${k}" data-cursor="CH ${pad(k + 1)}"><img src="${thumb(it)}" alt="" loading="lazy"><span class="mono">${multi ? it.label : 'CH ' + pad(k + 1)}</span></button>`).join('')}
  </div></div>`;
}

export function mountStage(root, pm, title = '') {
  const cleanups = [];
  const chs = [...root.querySelectorAll('.ch')];
  const svgG = [...root.querySelectorAll('.pxmap-svg .sl')];
  const labels = [...root.querySelectorAll('.sl-label')];
  const cadTags = [...root.querySelectorAll('.cad-tag')];
  const setHover = (i) => {
    svgG.forEach((g, k) => g.classList.toggle('hl', k === i));
    labels.forEach((l, k) => l.classList.toggle('hl', k === i));
    cadTags.forEach((c, k) => c.classList.toggle('hl', k === i));
  };

  const stage = new Stage(root.querySelector('.stage-gl'), pm, {
    onClip: (k) => chs.forEach((c, j) => { c.classList.toggle('on', j === k); if (j === k) c.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'smooth' }); }),
    onHoverSlice: setHover,
    onProjectLabels: (pts, hi) => {
      if (!pts) {
        cadTags.forEach((el) => (el.style.opacity = '0'));
        return;
      }
      pts.forEach((pt) => {
        const el = cadTags[pt.i];
        if (!el) return;
        if (!pt.visible) { el.style.opacity = '0'; return; }
        el.style.transform = `translate(${pt.x.toFixed(1)}px, ${pt.y.toFixed(1)}px) translate(-50%, -50%)`;
        el.style.opacity = hi >= 0 && hi !== pt.i ? '0.45' : '1';
      });
    },
  });
  chs.forEach((c) => c.addEventListener('click', () => stage.load(+c.dataset.k)));
  if (import.meta.env.DEV) window.__stage = stage;

  root.querySelectorAll('[data-cam]').forEach((b) => b.addEventListener('click', () => {
    root.querySelectorAll('[data-cam]').forEach((x) => x.classList.toggle('on', x === b));
    stage.setView(b.dataset.cam);
  }));
  const auto = root.querySelector('.sc-auto');
  auto.addEventListener('click', () => { auto.classList.toggle('on'); stage.setAutopilot(auto.classList.contains('on')); });
  const strobe = root.querySelector('.sc-strobe');
  const sOn = () => { strobe.classList.add('on'); stage.setStrobe(true); };
  const sOff = () => { strobe.classList.remove('on'); stage.setStrobe(false); };
  strobe.addEventListener('pointerdown', sOn);
  strobe.addEventListener('pointerup', sOff);
  strobe.addEventListener('pointerleave', sOff);

  const mapBtn = root.querySelector('.sc-map');
  const aside = root.querySelector('.pxmap');
  if (innerWidth < 760 || pm.rig === 'festival') { mapBtn.classList.remove('on'); aside.classList.add('off'); }
  mapBtn.addEventListener('click', () => { mapBtn.classList.toggle('on'); aside.classList.toggle('off'); });

  const box = root.querySelector('.pxmap-box');
  const pxTabs = [...root.querySelectorAll('.pxmap-tabs button')];
  const setPxMode = (mode) => {
    pxTabs.forEach((x) => x.classList.toggle('on', x.dataset.mode === mode));
    box.dataset.mode = mode;
  };
  pxTabs.forEach((b) => b.addEventListener('click', () => setPxMode(b.dataset.mode)));
  setPxMode('live');

  // ---- STAGE BUILD 2D→3D (4 fases interactivas + Auto-Build)
  const buildBtn = root.querySelector('.sc-build');
  const buildDock = root.querySelector('.build-dock');
  const deckWrap = root.querySelector('.deck-wrap');
  const badgeEl = root.querySelector('.build-badge');
  const descEl = root.querySelector('.build-desc');
  const stepBtns = [...root.querySelectorAll('.bd-step')];
  const bdAuto = root.querySelector('.bd-auto');
  const bdNext = root.querySelector('.bd-next');
  const bdClose = root.querySelector('.bd-close');

  let buildOpen = false;
  let buildPhase = 1;
  let autoTimer = 0;

  const stopAutoBuild = () => {
    clearInterval(autoTimer);
    autoTimer = 0;
    bdAuto.classList.remove('on');
  };

  const applyBuild = (open, phase = 1) => {
    buildOpen = open;
    buildPhase = phase;
    root.classList.toggle('is-building', open);
    buildBtn.classList.toggle('on', open);
    buildDock.hidden = !open;
    deckWrap.hidden = open;
    stage.setBuildMode(open, phase);

    if (open) {
      const meta = BUILD_PHASES[phase - 1] || BUILD_PHASES[0];
      badgeEl.textContent = tr(meta.short);
      descEl.textContent = tr(meta.desc);
      stepBtns.forEach((b) => {
        const s = +b.dataset.step;
        b.classList.toggle('on', s === phase);
        b.classList.toggle('done', s < phase);
      });
      if (innerWidth > 760) {
        aside.classList.remove('off');
        mapBtn.classList.add('on');
      } else {
        aside.classList.add('off');
        mapBtn.classList.remove('on');
      }
      setPxMode(phase < 4 ? 'tpl' : 'live');
    } else {
      stopAutoBuild();
      setPxMode('live');
    }
  };

  const openBuild = () => applyBuild(true, 1);
  const toggleBuild = () => applyBuild(!buildOpen, 1);

  buildBtn.addEventListener('click', toggleBuild);
  bdClose.addEventListener('click', () => applyBuild(false, 4));
  bdNext.addEventListener('click', () => {
    stopAutoBuild();
    applyBuild(true, buildPhase >= 4 ? 1 : buildPhase + 1);
  });
  stepBtns.forEach((b) => b.addEventListener('click', () => {
    stopAutoBuild();
    applyBuild(true, +b.dataset.step);
  }));
  bdAuto.addEventListener('click', () => {
    if (autoTimer) {
      stopAutoBuild();
    } else {
      bdAuto.classList.add('on');
      autoTimer = setInterval(() => applyBuild(true, buildPhase >= 4 ? 1 : buildPhase + 1), 3600);
    }
  });
  cleanups.push(stopAutoBuild);

  const inView = () => { const r = root.getBoundingClientRect(); return r.bottom > innerHeight * 0.3 && r.top < innerHeight * 0.5; };
  const kd = (e) => {
    if (e.target.closest('input, textarea')) return;
    if (e.code === 'Space' && inView()) { e.preventDefault(); sOn(); }
    if (e.key === ']') stage.next();
    if (e.key === '[') stage.prev();
    if (e.key === 'Escape' && buildOpen) applyBuild(false, 4);
  };
  const ku = (e) => { if (e.code === 'Space') sOff(); };
  addEventListener('keydown', kd); addEventListener('keyup', ku);
  cleanups.push(() => { removeEventListener('keydown', kd); removeEventListener('keyup', ku); });

  [...svgG, ...labels, ...cadTags].forEach((g) => {
    g.addEventListener('pointerenter', () => { stage.highlight(+g.dataset.i); setHover(+g.dataset.i); });
    g.addEventListener('pointerleave', () => { stage.highlight(undefined); setHover(-1); });
  });

  const gen = root.querySelector('.pxmap-gen');
  if (gen) drawTestCard(gen, pm, title);

  const live = root.querySelector('.pxmap-live');
  const lctx = live.getContext('2d');
  const k = live.width / pm.canvas[0];
  let rafL;
  let lastL = 0;
  const drawLive = (now = 0) => {
    rafL = requestAnimationFrame(drawLive);
    if (aside.classList.contains('off') || box.dataset.mode !== 'live' || now - lastL < 40) return;
    lastL = now;
    lctx.fillStyle = '#0b0b0d'; lctx.fillRect(0, 0, live.width, live.height);
    if (!stage.multi) {
      const v = stage.video;
      if (v.readyState < 2) return;
      lctx.globalAlpha = 0.14; lctx.drawImage(v, 0, 0, live.width, live.height); lctx.globalAlpha = 1;
      pm.slices.forEach((s) => { lctx.save(); lctx.beginPath(); lctx.rect(s.x * k, s.y * k, s.w * k, s.h * k); lctx.clip(); lctx.drawImage(v, 0, 0, live.width, live.height); lctx.restore(); });
    } else {
      pm.slices.forEach((s) => { const v = stage.videoFor(s); if (v.readyState >= 2) lctx.drawImage(v, s.x * k, s.y * k, s.w * k, s.h * k); });
    }
  };
  drawLive();
  cleanups.push(() => cancelAnimationFrame(rafL));

  const deck = root.querySelector('.deck');
  const onDeckWheel = (e) => {
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || deck.scrollWidth <= deck.clientWidth) return;
    e.preventDefault();
    deck.scrollLeft += e.deltaY;
  };
  deck.addEventListener('wheel', onDeckWheel, { passive: false });

  return {
    stage,
    openBuild,
    toggleBuild,
    destroy() { stage.destroy(); cleanups.forEach((f) => f()); },
  };
}

function drawTestCard(c, pm, title) {
  const g = c.getContext('2d');
  const [w, h] = pm.canvas;
  g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
  const sq = Math.round(Math.max(w, h) / 16);
  pm.slices.forEach((s) => {
    g.save(); g.beginPath(); g.rect(s.x, s.y, s.w, s.h); g.clip();
    for (let y = s.y; y < s.y + s.h; y += sq) for (let x = s.x; x < s.x + s.w; x += sq) {
      g.fillStyle = (Math.floor(x / sq) + Math.floor(y / sq)) % 2 ? '#1a1a1f' : '#ff4a1c';
      g.fillRect(x, y, sq, sq);
    }
    g.restore();
    g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = Math.max(2, w / 500);
    g.strokeRect(s.x, s.y, s.w, s.h);
  });
  g.fillStyle = '#fff'; g.font = `700 ${Math.round(h / 12)}px Archivo, sans-serif`; g.textAlign = 'right';
  g.fillText(`${w} x ${h}`, w - 24, h - 24);
}
