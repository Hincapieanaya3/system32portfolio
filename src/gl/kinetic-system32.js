// Tipografía cinética interactiva "SYSTEM32" de fondo para Mundo 02 (Motion Graphics).
// 4 modos interactivos: REPEL (física de resorte), WAVE (flujo líquido), VORTEX (remolino gravitacional),
// GLITCH (desgarro RGB y scramble). Clic en el fondo dispara ondas de choque elásticas.
import { beat } from '../ui/beat.js';

export const KINETIC_MODES = ['repel', 'wave', 'vortex', 'glitch'];
const WORD = 'SYSTEM32';
const GLITCH_VARIANTS = ['SYSTEM32', 'SYS73M32', '5Y5T3M32', 'SY$TEM32', 'SYSTEM_32', 'S¥STEM32'];

export function mountSystem32Kinetic(canvas, hostEl, { initialMode = null, onModeChange } = {}) {
  const ctx = canvas.getContext('2d');
  let width = 1, height = 1, dpr = 1;
  let mode = initialMode || KINETIC_MODES[Math.floor(Math.random() * KINETIC_MODES.length)];
  let glyphs = [];
  let rows = 5;
  let fontSize = 96;

  const ptr = { x: -9999, y: -9999, tx: -9999, ty: -9999, vx: 0, vy: 0, down: false, active: false };
  const ripples = [];

  const rebuildGrid = () => {
    const r = hostEl.getBoundingClientRect();
    width = Math.max(320, r.width);
    height = Math.max(320, r.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);

    rows = width < 760 ? 5 : 6;
    fontSize = Math.max(42, Math.min(126, Math.round(height / (rows * 1.18))));

    ctx.save();
    ctx.font = `800 ${fontSize}px "Akira Expanded", "Archivo", sans-serif`;
    const charW = Math.max(fontSize * 0.72, ctx.measureText('M').width * 0.96);
    ctx.restore();

    const wordSpan = charW * (WORD.length + 1.15);
    const colsPerRow = Math.ceil((width + wordSpan * 2) / wordSpan);
    const rowStep = height / rows;

    glyphs = [];
    for (let row = 0; row < rows; row++) {
      const baseY = rowStep * (row + 0.56);
      const dir = row % 2 === 0 ? 1 : -1;
      const outlined = row % 2 === 1;
      const startX = -wordSpan * 0.6 + (row % 2 ? wordSpan * 0.35 : 0);
      for (let wIdx = 0; wIdx < colsPerRow; wIdx++) {
        const wordX = startX + wIdx * wordSpan;
        for (let cIdx = 0; cIdx < WORD.length; cIdx++) {
          const ch = WORD[cIdx];
          const hx = wordX + cIdx * charW;
          glyphs.push({
            ch,
            row,
            cIdx,
            wIdx,
            dir,
            outlined,
            hx,
            hy: baseY,
            ox: 0,
            oy: 0,
            vx: 0,
            vy: 0,
            rot: 0,
            vrot: 0,
            scale: 1,
            glow: 0,
            spanW: colsPerRow * wordSpan,
            seed: Math.sin(row * 17.3 + wIdx * 5.1 + cIdx * 2.7),
          });
        }
      }
    }
  };

  const fireRipple = (x, y, strength = 1) => {
    ripples.push({ x, y, r: 10, maxR: Math.max(width, height) * 0.65, life: 1, strength });
  };

  const setMode = (next) => {
    mode = next === 'random'
      ? KINETIC_MODES.filter((m) => m !== mode)[Math.floor(Math.random() * (KINETIC_MODES.length - 1))]
      : next;
    fireRipple(ptr.active ? ptr.x : width * 0.5, ptr.active ? ptr.y : height * 0.45, 1.15);
    onModeChange?.(mode);
  };

  const onMove = (e) => {
    const r = hostEl.getBoundingClientRect();
    const nx = e.clientX - r.left;
    const ny = e.clientY - r.top;
    if (!ptr.active) { ptr.x = nx; ptr.y = ny; }
    ptr.tx = nx;
    ptr.ty = ny;
    ptr.active = true;
  };
  const onLeave = () => { ptr.active = false; ptr.down = false; };
  const onDown = (e) => {
    if (e.target.closest('button, a, video, input, .m-timeline, .m-comps, .w-info, .m-kin-bar')) return;
    const r = hostEl.getBoundingClientRect();
    ptr.down = true;
    fireRipple(e.clientX - r.left, e.clientY - r.top, 1.35);
  };
  const onUp = () => {
    if (ptr.down && mode === 'vortex') {
      fireRipple(ptr.x, ptr.y, 1.45);
    }
    ptr.down = false;
  };

  hostEl.addEventListener('pointermove', onMove, { passive: true });
  hostEl.addEventListener('pointerleave', onLeave);
  hostEl.addEventListener('pointerdown', onDown);
  window.addEventListener('pointerup', onUp);

  const ro = new ResizeObserver(rebuildGrid);
  ro.observe(hostEl);
  rebuildGrid();
  document.fonts?.ready?.then(rebuildGrid);
  onModeChange?.(mode);

  let raf = 0;
  let t0 = performance.now();

  const draw = (now) => {
    raf = requestAnimationFrame(draw);
    const dt = Math.min(0.033, (now - t0) / 1000);
    t0 = now;
    const t = now * 0.001;
    const env = beat.env();

    // Suavizado del cursor + cálculo de velocidad
    if (ptr.active) {
      const lx = ptr.x, ly = ptr.y;
      ptr.x += (ptr.tx - ptr.x) * 0.24;
      ptr.y += (ptr.ty - ptr.y) * 0.24;
      ptr.vx = (ptr.x - lx) / Math.max(dt, 0.008);
      ptr.vy = (ptr.y - ly) / Math.max(dt, 0.008);
    } else {
      ptr.vx *= 0.88;
      ptr.vy *= 0.88;
    }
    const ptrSpeed = Math.min(1, Math.hypot(ptr.vx, ptr.vy) / 1400);

    // Actualizar ondas de choque
    for (let i = ripples.length - 1; i >= 0; i--) {
      const rp = ripples[i];
      rp.r += dt * 780;
      rp.life = Math.max(0, 1 - rp.r / rp.maxR);
      if (rp.life <= 0.01) ripples.splice(i, 1);
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    // Halo atmosférico siguiendo el cursor
    if (ptr.active) {
      const grd = ctx.createRadialGradient(ptr.x, ptr.y, 10, ptr.x, ptr.y, 300);
      grd.addColorStop(0, mode === 'glitch' ? 'rgba(0, 229, 255, 0.14)' : 'rgba(182, 156, 255, 0.16)');
      grd.addColorStop(0.55, 'rgba(0, 150, 255, 0.05)');
      grd.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, width, height);
    }

    // Dibujar anillos sutiles de onda de choque
    ripples.forEach((rp) => {
      ctx.beginPath();
      ctx.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(0, 229, 255, ${(rp.life * 0.35).toFixed(3)})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `800 ${fontSize}px "Akira Expanded", "Archivo", sans-serif`;

    const radius = Math.min(width, height) * (mode === 'vortex' ? 0.34 : 0.27);

    for (let i = 0; i < glyphs.length; i++) {
      const g = glyphs[i];

      // Desplazamiento horizontal continuo según el modo
      const scrollSpeed = mode === 'wave' ? 48 : mode === 'glitch' ? 28 : 16;
      const rawX = ((g.hx + t * scrollSpeed * g.dir) % g.spanW + g.spanW) % g.spanW - fontSize * 1.4;
      let baseY = g.hy;
      if (mode === 'wave') {
        baseY += Math.sin(t * 2.2 + rawX * 0.006 + g.row * 0.9) * (16 + env * 12);
      }

      let gx = rawX + g.ox;
      let gy = baseY + g.oy;
      let targetScale = 1 + env * 0.03;
      let targetGlow = 0;

      // Interacción con cursor según el modo activo
      if (ptr.active) {
        const dx = gx - ptr.x;
        const dy = gy - ptr.y;
        const dist = Math.hypot(dx, dy) || 1;
        if (dist < radius) {
          const inf = 1 - dist / radius;
          const easeInf = inf * inf;
          targetGlow = Math.max(targetGlow, easeInf);

          if (mode === 'repel') {
            const push = easeInf * (ptr.down ? 36 : 20);
            g.vx += (dx / dist) * push + ptr.vx * 0.008 * easeInf;
            g.vy += (dy / dist) * push + ptr.vy * 0.008 * easeInf;
            g.vrot += (dx > 0 ? 1 : -1) * easeInf * 0.08;
            targetScale = 1 + easeInf * 0.32;
          } else if (mode === 'wave') {
            g.vy += Math.sin(dist * 0.045 - t * 9) * easeInf * 16 + ptr.vy * 0.012 * easeInf;
            g.vx += ptr.vx * 0.015 * easeInf;
            g.vrot += (ptr.vx * 0.00018) * easeInf;
            targetScale = 1 + easeInf * 0.28;
          } else if (mode === 'vortex') {
            // Fuerza tangencial de giro + atracción/órbita
            const tx = -dy / dist;
            const ty = dx / dist;
            const swirl = easeInf * (ptr.down ? 26 : 15);
            const pull = ptr.down ? -easeInf * 18 : (dist < radius * 0.35 ? easeInf * 12 : -easeInf * 5);
            g.vx += tx * swirl + (dx / dist) * pull;
            g.vy += ty * swirl + (dy / dist) * pull;
            g.vrot += easeInf * 0.12;
            targetScale = 1 + easeInf * 0.38;
          } else if (mode === 'glitch') {
            const jitter = (Math.sin(t * 48 + g.row * 9 + g.cIdx) > 0 ? 1 : -1) * easeInf * (22 + ptrSpeed * 38);
            g.vx += jitter;
            g.vy += (Math.cos(t * 32 + i) * 6) * easeInf;
            targetScale = 1 + easeInf * 0.22;
          }
        }
      }

      // Interacción con ondas de choque (clics o cambio de composición)
      for (let rIdx = 0; rIdx < ripples.length; rIdx++) {
        const rp = ripples[rIdx];
        const rdx = gx - rp.x;
        const rdy = gy - rp.y;
        const rdist = Math.hypot(rdx, rdy) || 1;
        const band = Math.abs(rdist - rp.r);
        if (band < 75) {
          const force = (1 - band / 75) * rp.life * 26 * rp.strength;
          g.vx += (rdx / rdist) * force;
          g.vy += (rdy / rdist) * force;
          targetGlow = Math.max(targetGlow, (1 - band / 75) * rp.life);
        }
      }

      // Física de resorte de retorno
      const spring = mode === 'vortex' ? 0.065 : 0.1;
      const damp = mode === 'vortex' ? 0.84 : 0.8;
      g.vx = (g.vx - g.ox * spring) * damp;
      g.vy = (g.vy - g.oy * spring) * damp;
      g.ox += g.vx;
      g.oy += g.vy;

      g.vrot = (g.vrot - g.rot * 0.12) * 0.78;
      g.rot += g.vrot;
      g.scale += (targetScale - g.scale) * 0.18;
      g.glow += (targetGlow - g.glow) * 0.18;

      gx = rawX + g.ox;
      gy = baseY + g.oy;
      if (gx < -fontSize * 1.5 || gx > width + fontSize * 1.5) continue;

      let ch = g.ch;
      if (mode === 'glitch' && g.glow > 0.25 && Math.sin(t * 28 + i * 3.1) > 0.55) {
        const alt = GLITCH_VARIANTS[(Math.floor(t * 14) + g.row) % GLITCH_VARIANTS.length];
        ch = alt[g.cIdx % alt.length];
      }

      ctx.save();
      ctx.translate(gx, gy);
      if (Math.abs(g.rot) > 0.002) ctx.rotate(g.rot);
      const sx = mode === 'wave' ? g.scale * (1 + g.glow * 0.28) : g.scale;
      const sy = mode === 'glitch' && g.glow > 0.35 ? g.scale * 0.84 : g.scale;
      if (sx !== 1 || sy !== 1) ctx.scale(sx, sy);

      // Separación cromática RGB cuando el cursor interactúa
      const chroma = g.glow * (mode === 'glitch' ? 9 : 5.5) + ptrSpeed * g.glow * 4;
      if (chroma > 0.45) {
        ctx.fillStyle = `rgba(0, 229, 255, ${(0.22 + g.glow * 0.45).toFixed(3)})`;
        ctx.fillText(ch, -chroma, 0);
        ctx.fillStyle = `rgba(255, 74, 28, ${(0.18 + g.glow * 0.38).toFixed(3)})`;
        ctx.fillText(ch, chroma, 0);
      }

      if (g.outlined) {
        ctx.lineWidth = 1.2 + g.glow * 1.2;
        ctx.strokeStyle = g.glow > 0.08
          ? `rgba(237, 235, 230, ${(0.2 + g.glow * 0.65).toFixed(3)})`
          : `rgba(182, 156, 255, ${(0.16 + env * 0.06).toFixed(3)})`;
        ctx.strokeText(ch, 0, 0);
      } else {
        ctx.fillStyle = g.glow > 0.08
          ? `rgba(225, 215, 255, ${(0.14 + g.glow * 0.58).toFixed(3)})`
          : `rgba(182, 156, 255, ${(0.085 + env * 0.045).toFixed(3)})`;
        ctx.fillText(ch, 0, 0);
      }

      ctx.restore();
    }
  };

  raf = requestAnimationFrame(draw);

  return {
    setMode,
    getMode: () => mode,
    pulse: () => fireRipple(width * 0.5, height * 0.45, 1.0),
    destroy() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      hostEl.removeEventListener('pointermove', onMove);
      hostEl.removeEventListener('pointerleave', onLeave);
      hostEl.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
    },
  };
}
