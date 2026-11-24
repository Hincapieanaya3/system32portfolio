import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Linkedin, Mail } from 'lucide-react';
import HeroWebGL from './HeroWebGL';
import LanguageSwitch from './LanguageSwitch';

const COPY = {
  es: {
    role: 'TECHNICAL ARTIST · REAL-TIME VISUALS · LIVE VJ',
    enter: 'ENTRAR A LOS MUNDOS',
    hint: 'PASA EL CURSOR POR EL NOMBRE PARA DESHACERLO · HAZ CLIC PARA EXPLOTARLO',
    boot: 'SYSTEM32 // SECUENCIA DE ARRANQUE OK',
    shortcuts: 'ACCESO DIRECTO',
  },
  en: {
    role: 'TECHNICAL ARTIST · REAL-TIME VISUALS · LIVE VJ',
    enter: 'ENTER THE WORLDS',
    hint: 'MOVE THE CURSOR OVER THE NAME TO DISSOLVE IT · CLICK TO BLAST IT',
    boot: 'SYSTEM32 // BOOT SEQUENCE OK',
    shortcuts: 'QUICK ACCESS',
  },
};

const VERT = `
attribute float aDisp;
attribute float aSeed;
uniform float uSize;
uniform float uDpr;
varying float vDisp;
varying float vSeed;
void main() {
  vDisp = aDisp;
  vSeed = aSeed;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * uDpr * (1.0 + aDisp * 1.6);
}
`;

const FRAG = `
precision highp float;
varying float vDisp;
varying float vSeed;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;
  float soft = smoothstep(0.5, 0.2, d);
  vec3 base = vec3(1.0, 1.0, 1.0);
  vec3 hot = mix(vec3(0.0, 0.90, 1.0), vec3(0.06, 0.44, 1.0), vSeed);
  vec3 col = mix(base, hot, smoothstep(0.05, 0.9, vDisp));
  float a = soft * (1.0 - vDisp * 0.3);
  gl_FragColor = vec4(col, a);
}
`;

// Soft dark halo drawn under every particle so the white name always separates from the bright liquid
const HALO_FRAG = `
precision highp float;
varying float vDisp;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;
  float soft = smoothstep(0.5, 0.0, d);
  gl_FragColor = vec4(0.004, 0.02, 0.07, soft * 0.5 * (1.0 - vDisp));
}
`;

const LINE_1 = 'SEBASTIAN HINCAPIE';
const LINE_2 = '(SYSTEM32)';

function sampleTextPoints(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const family = "'Akira Expanded', 'Syne', sans-serif";
  if (w < 640) {
    // Portrait mobile: stack SEBASTIAN / HINCAPIE / (SYSTEM32) so particle letters are bold & tactile
    ctx.font = `800 100px ${family}`;
    const measured = ctx.measureText('SEBASTIAN').width || 600;
    const targetW = w * 0.88;
    let size1 = Math.min((100 * targetW) / measured, h * 0.1);
    const size2 = size1 * 0.58;
    const cy = h * 0.36;
    ctx.font = `800 ${size1}px ${family}`;
    ctx.fillText('SEBASTIAN', w / 2, cy - size1 * 0.66);
    ctx.fillText('HINCAPIE', w / 2, cy + size1 * 0.48);
    ctx.font = `800 ${size2}px ${family}`;
    ctx.fillText(LINE_2, w / 2, cy + size1 * 1.48);
  } else {
    ctx.font = `800 100px ${family}`;
    const measured = ctx.measureText(LINE_1).width || 1000;
    const targetW = Math.min(w * 0.88, 1580);
    let size1 = (100 * targetW) / measured;
    size1 = Math.min(size1, h * 0.16);
    const size2 = size1 * 0.56;

    const cy = h * 0.42;
    ctx.font = `800 ${size1}px ${family}`;
    ctx.fillText(LINE_1, w / 2, cy);
    ctx.font = `800 ${size2}px ${family}`;
    ctx.fillText(LINE_2, w / 2, cy + size1 * 0.98);
  }

  const gap = 2;
  const data = ctx.getImageData(0, 0, w, h).data;
  const pts = [];
  for (let y = 0; y < h; y += gap) {
    for (let x = 0; x < w; x += gap) {
      if (data[(y * w + x) * 4 + 3] > 128) {
        pts.push(x - w / 2, h / 2 - y);
      }
    }
  }
  return pts;
}

export default function IntroScreen({ lang, onChangeLang, onEnter, onEnterWorld }) {
  const hostRef = useRef(null);
  const t = COPY[lang];

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    let cancelled = false;
    let raf = 0;
    let resizeTimer = 0;
    let state = null;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
    renderer.setPixelRatio(dpr);
    renderer.setClearColor(0x000000, 0);
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    let camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);

    const mouse = { x: -99999, y: -99999, px: -99999, py: -99999, speed: 0 };
    const burst = { active: false, x: 0, y: 0 };

    const disposeState = () => {
      if (!state) return;
      scene.remove(state.halo);
      scene.remove(state.points);
      state.geo.dispose();
      state.mat.dispose();
      state.haloMat.dispose();
      state = null;
    };

    const build = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (!w || !h) return;

      disposeState();
      renderer.setSize(w, h);
      camera = new THREE.OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, -10, 10);

      let raw = sampleTextPoints(w, h);
      let n = raw.length / 2;
      const MAX = 64000;
      if (n > MAX) {
        const keep = [];
        const stride = n / MAX;
        for (let i = 0; i < MAX; i++) {
          const idx = Math.floor(i * stride);
          keep.push(raw[idx * 2], raw[idx * 2 + 1]);
        }
        raw = keep;
        n = MAX;
      }

      const pos = new Float32Array(n * 3);
      const vel = new Float32Array(n * 2);
      const org = new Float32Array(n * 2);
      const disp = new Float32Array(n);
      const seed = new Float32Array(n);

      for (let i = 0; i < n; i++) {
        org[i * 2] = raw[i * 2];
        org[i * 2 + 1] = raw[i * 2 + 1];
        // Entrance: particles start scattered across the screen and assemble the name
        pos[i * 3] = (Math.random() - 0.5) * w * 1.3;
        pos[i * 3 + 1] = (Math.random() - 0.5) * h * 1.3;
        seed[i] = Math.random();
      }

      const geo = new THREE.BufferGeometry();
      const posAttr = new THREE.BufferAttribute(pos, 3);
      posAttr.setUsage(THREE.DynamicDrawUsage);
      const dispAttr = new THREE.BufferAttribute(disp, 1);
      dispAttr.setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute('position', posAttr);
      geo.setAttribute('aDisp', dispAttr);
      geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));

      const baseSize = w > 700 ? 3.0 : 2.4;
      const mat = new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: {
          uSize: { value: baseSize },
          uDpr: { value: dpr },
        },
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.NormalBlending,
      });

      const haloMat = new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: HALO_FRAG,
        uniforms: {
          uSize: { value: baseSize * 3.1 },
          uDpr: { value: dpr },
        },
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.NormalBlending,
      });

      const halo = new THREE.Points(geo, haloMat);
      halo.frustumCulled = false;
      halo.renderOrder = 0;
      scene.add(halo);

      const points = new THREE.Points(geo, mat);
      points.frustumCulled = false;
      points.renderOrder = 1;
      scene.add(points);

      state = {
        n,
        w,
        h,
        pos,
        vel,
        org,
        disp,
        seed,
        geo,
        mat,
        haloMat,
        halo,
        points,
        posAttr,
        dispAttr,
        baseR: Math.max(70, Math.min(w * 0.085, 140)),
      };
    };

    const startBuild = async () => {
      try {
        await document.fonts.load("800 100px 'Akira Expanded'");
      } catch (e) {
        /* fall back to default font */
      }
      if (!cancelled) build();
    };
    startBuild();

    const onMove = (e) => {
      const rect = host.getBoundingClientRect();
      mouse.x = e.clientX - rect.left - rect.width / 2;
      mouse.y = rect.height / 2 - (e.clientY - rect.top);
    };
    const onLeave = () => {
      mouse.x = -99999;
      mouse.y = -99999;
      mouse.px = -99999;
      mouse.py = -99999;
    };
    const onDown = (e) => {
      if (e.target?.closest?.('button, a')) return;
      const rect = host.getBoundingClientRect();
      burst.x = e.clientX - rect.left - rect.width / 2;
      burst.y = rect.height / 2 - (e.clientY - rect.top);
      burst.active = true;
    };
    const onUp = (e) => {
      if (e.pointerType && e.pointerType !== 'mouse') {
        onLeave();
      }
    };
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        if (!cancelled) build();
      }, 160);
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('pointerup', onUp, { passive: true });
    window.addEventListener('pointercancel', onLeave, { passive: true });
    document.addEventListener('pointerleave', onLeave);
    window.addEventListener('blur', onLeave);
    window.addEventListener('resize', onResize);

    let last = performance.now();
    const tick = (now) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (!state) return;

      const f = dt * 60;
      const { n, pos, vel, org, disp, seed, baseR } = state;

      const moved = Math.hypot(mouse.x - mouse.px, mouse.y - mouse.py);
      mouse.speed += ((mouse.px < -9000 ? 0 : moved) - mouse.speed) * 0.2;
      mouse.px = mouse.x;
      mouse.py = mouse.y;

      const R = baseR + Math.min(mouse.speed, 50) * 1.6;
      const R2 = R * R;
      const mx = mouse.x;
      const my = mouse.y;

      const damp = Math.pow(0.9, f);
      const k = 0.035 * f;
      const time = now * 0.001;

      const doBurst = burst.active;
      const bx = burst.x;
      const by = burst.y;
      const BR = 340;
      const BR2 = BR * BR;
      burst.active = false;

      for (let i = 0; i < n; i++) {
        const i2 = i * 2;
        const i3 = i * 3;
        const ox = org[i2] + Math.sin(time * 0.9 + seed[i] * 6.283) * 0.7;
        const oy = org[i2 + 1] + Math.cos(time * 0.8 + seed[i] * 6.283) * 0.7;
        let px = pos[i3];
        let py = pos[i3 + 1];
        let vx = vel[i2];
        let vy = vel[i2 + 1];

        // Cursor: dissolve the name into particles
        const dx = px - mx;
        const dy = py - my;
        const d2 = dx * dx + dy * dy;
        if (d2 < R2) {
          const d = Math.sqrt(d2) + 0.001;
          const tt = 1 - d / R;
          const force = tt * tt * 2.4 * f;
          const nx = dx / d;
          const ny = dy / d;
          vx += nx * force + -ny * force * 0.55 + (Math.random() - 0.5) * force * 0.9;
          vy += ny * force + nx * force * 0.55 + (Math.random() - 0.5) * force * 0.9;
        }

        if (doBurst) {
          const ex = px - bx;
          const ey = py - by;
          const e2 = ex * ex + ey * ey;
          if (e2 < BR2) {
            const e = Math.sqrt(e2) + 0.001;
            const bt = 1 - e / BR;
            const bf = bt * 16 + Math.random() * 4;
            vx += (ex / e) * bf;
            vy += (ey / e) * bf;
          }
        }

        // Spring back: the name re-forms when the cursor leaves
        vx += (ox - px) * k;
        vy += (oy - py) * k;
        vx *= damp;
        vy *= damp;
        px += vx * f;
        py += vy * f;

        pos[i3] = px;
        pos[i3 + 1] = py;
        vel[i2] = vx;
        vel[i2 + 1] = vy;

        const off = Math.hypot(px - ox, py - oy);
        const target = off / 80 > 1 ? 1 : off / 80;
        disp[i] += (target - disp[i]) * 0.25;
      }

      state.posAttr.needsUpdate = true;
      state.dispAttr.needsUpdate = true;
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(resizeTimer);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onLeave);
      document.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('blur', onLeave);
      window.removeEventListener('resize', onResize);
      disposeState();
      renderer.dispose();
      if (renderer.domElement.parentNode === host) {
        host.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <section className="intro-screen">
      <div className="intro-backdrop">
        <HeroWebGL />
      </div>
      <div className="intro-scrim" />
      <div ref={hostRef} className="intro-particles" />
      <h1 className="sr-only">SEBASTIAN HINCAPIE (SYSTEM32)</h1>

      <div className="intro-ui">
        <div className="intro-top">
          <span className="intro-boot">
            <span className="brand-pulse" />
            {t.boot}
          </span>
          <LanguageSwitch lang={lang} onChange={onChangeLang} variant="intro" />
        </div>

        <div className="intro-bottom">
          <div className="intro-role">{t.role}</div>

          <button type="button" className="intro-enter" onClick={onEnter}>
            <span>{t.enter}</span>
          </button>

          <div className="intro-contact-links">
            <a href="mailto:sebashinca13@gmail.com" className="intro-contact-link">
              <Mail size={12} />
              <span>sebashinca13@gmail.com</span>
            </a>
            <span className="intro-contact-sep">·</span>
            <a
              href="https://www.linkedin.com/in/sebastianhin"
              target="_blank"
              rel="noreferrer"
              className="intro-contact-link"
            >
              <Linkedin size={12} />
              <span>linkedin.com/in/sebastianhin</span>
            </a>
          </div>

          <div className="intro-hint">{t.hint}</div>
        </div>
      </div>
    </section>
  );
}
