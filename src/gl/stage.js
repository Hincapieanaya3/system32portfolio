// Escenario 3D a partir de un pixel map de Resolume.
// Cada slice (x, y, w, h en px del lienzo de la composición) se vuelve una pantalla LED
// en el espacio y muestra exactamente su recorte del video. Tipos de rig:
//   square / cross  → las pantallas se ubican igual que en el lienzo
//   multi           → cada pantalla tiene su propio video (pos/size en metros, fuente "src")
//   curved          → el lienzo se dobla en un arco (pared panorámica en S)
//   festival        → pantalla central + laterales IMAG (pos/size/ry explícitos)
// Incluye modo STAGE BUILD 2D→3D en 4 fases (CAD Exploded, Pixelmap Slices, Rig & Beams, Live Show).
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { beat } from '../ui/beat.js';
import { asset } from '../data.js';

const WHITE = new THREE.Color(1, 1, 1);
const BG_CONCERT = new THREE.Color(0x050506);
const BG_CAD = new THREE.Color(0x040b15);

const ledVert = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const ledFrag = /* glsl */ `
uniform sampler2D map; uniform sampler2D tplMap;
uniform vec4 rect; uniform vec4 tplRect; uniform vec2 px; uniform float cab;
uniform float uTime; uniform float uGlitch; uniform float uStrobe; uniform float uHover;
uniform float uOn; uniform float uReady; uniform float uUseTpl; uniform float uAlpha;
varying vec2 vUv;
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main(){
  vec2 uv = rect.xy + vUv * rect.zw;
  vec2 tuv = tplRect.xy + vUv * tplRect.zw;
  float row = floor(vUv.y * 40.0);
  float gl = uGlitch * (hash(vec2(row, floor(uTime * 30.0))) - 0.5) * 0.25;
  vec3 c;
  c.r = texture2D(map, uv + vec2(gl + uGlitch * 0.012, 0.0)).r;
  c.g = texture2D(map, uv + vec2(gl, 0.0)).g;
  c.b = texture2D(map, uv + vec2(gl - uGlitch * 0.012, 0.0)).b;
  // carta de ajuste mientras carga el video
  vec2 ck = floor(vUv * px / 64.0);
  vec3 test = mix(vec3(0.07), vec3(0.16), mod(ck.x + ck.y, 2.0));
  c = mix(test, c, uReady);
  // proyección del pixelmap 2D real durante Stage Build (Fases 1-3)
  vec3 tplC = texture2D(tplMap, tuv).rgb;
  c = mix(c, tplC, uUseTpl);
  vec2 p = vUv * px;
  vec2 f = abs(fract(p) - 0.5);
  vec2 w = fwidth(p);
  float grid = 1.0 - (1.0 - smoothstep(0.5 - w.x, 0.5, f.x * 1.15)) * (1.0 - smoothstep(0.5 - w.y, 0.5, f.y * 1.15));
  float pxVis = 1.0 - smoothstep(0.25, 0.7, max(w.x, w.y));
  c *= 1.0 - 0.45 * pxVis * (1.0 - grid);
  vec2 cp = p / cab;
  vec2 cf = abs(fract(cp) - 0.5);
  vec2 cw = fwidth(cp) * 1.2;
  float seam = max(smoothstep(0.5 - cw.x, 0.5, cf.x), smoothstep(0.5 - cw.y, 0.5, cf.y));
  c *= 1.0 - 0.55 * seam;
  c = mix(c, abs(vec3(1.0) - c), uStrobe);
  c *= uOn;
  c += mix(vec3(1.0, 0.29, 0.11), vec3(0.0, 0.9, 1.0), uUseTpl) * uHover * 0.24;
  gl_FragColor = vec4(c * 0.94, uAlpha);
}`;

const beamVert = /* glsl */ `
varying float vT; varying vec3 vN; varying vec3 vV;
void main(){
  vT = uv.y;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix) * normal);
  vV = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const beamFrag = /* glsl */ `
uniform vec3 color; uniform float intensity;
varying float vT; varying vec3 vN; varying vec3 vV;
void main(){
  float edge = pow(abs(dot(vN, vV)), 1.6);
  float fall = pow(vT, 2.2);
  gl_FragColor = vec4(color * edge * fall * intensity, 1.0);
}`;

function spriteTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

function makeFallbackTemplateTex(pm) {
  const c = document.createElement('canvas');
  const [cw, ch] = pm.canvas;
  c.width = 512;
  c.height = Math.max(128, Math.round((512 * ch) / cw));
  const g = c.getContext('2d');
  const kx = c.width / cw;
  const ky = c.height / ch;
  g.fillStyle = '#070b14';
  g.fillRect(0, 0, c.width, c.height);
  const colors = ['#00e5ff', '#ff4a1c', '#b69cff', '#4df5c1', '#ffd23f'];
  pm.slices.forEach((s, idx) => {
    const x = s.x * kx, y = s.y * ky, w = s.w * kx, h = s.h * ky;
    g.fillStyle = idx % 2 ? '#0e1726' : '#121d2f';
    g.fillRect(x, y, w, h);
    g.strokeStyle = colors[idx % colors.length];
    g.lineWidth = 3;
    g.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
    g.beginPath();
    g.moveTo(x, y); g.lineTo(x + w, y + h);
    g.moveTo(x + w, y); g.lineTo(x, y + h);
    g.strokeStyle = 'rgba(0,229,255,0.28)';
    g.lineWidth = 1;
    g.stroke();
    g.fillStyle = '#ffffff';
    g.font = '700 18px monospace';
    g.textAlign = 'center';
    g.fillText(`${s.w}x${s.h}`, x + w / 2, y + h / 2 + 6);
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function trussGeometry(length, size = 0.3, r = 0.022) {
  const parts = [];
  const h = size / 2;
  for (const [x, z] of [[-h, -h], [h, -h], [h, h], [-h, h]]) {
    const g = new THREE.CylinderGeometry(r, r, length, 6);
    g.translate(x, length / 2, z); parts.push(g);
  }
  const n = Math.max(1, Math.round(length / (size * 1.6)));
  const step = length / n;
  const diag = Math.hypot(size, step);
  const ang = Math.atan2(size, step);
  for (let i = 0; i < n; i++) {
    const y = i * step + step / 2;
    const flip = i % 2 ? 1 : -1;
    for (let f = 0; f < 4; f++) {
      const g = new THREE.CylinderGeometry(r * 0.6, r * 0.6, diag, 4);
      g.rotateZ(ang * flip); g.translate(0, y, h); g.rotateY((f * Math.PI) / 2);
      parts.push(g);
    }
  }
  return mergeGeometries(parts);
}

const makeVideo = () => {
  const v = document.createElement('video');
  Object.assign(v, { muted: true, playsInline: true, crossOrigin: 'anonymous', preload: 'auto' });
  v.setAttribute('playsinline', '');
  const tex = new THREE.VideoTexture(v);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  return { v, tex };
};

// calidad adaptativa compartida entre escenarios: si un equipo va lento, el siguiente
// canal arranca ya en el nivel que funcionó
const QUALITY = [
  { pr: 1.25, mirror: true, bloom: true },
  { pr: 1, mirror: true, bloom: true },
  { pr: 0.85, mirror: false, bloom: true },
  { pr: 0.7, mirror: false, bloom: false },
];
let qLevel = 0;

export class Stage {
  constructor(container, pm, { onClip, onHoverSlice, onProjectLabels } = {}) {
    this.container = container;
    this.pm = pm;
    this.onClip = onClip;
    this.onHoverSlice = onHoverSlice;
    this.onProjectLabels = onProjectLabels;
    this.items = pm.scenes?.length ? pm.scenes : (pm.playlist || []);
    this.multi = !!pm.scenes?.length;
    this.clip = 0;
    this.autopilot = true;
    this.strobe = 0; this.strobeHeld = false;
    this.glitch = 0;
    this.slicesHover = -1;

    // Estado de Stage Build 2D→3D (4 fases)
    this.buildOpen = false;
    this.buildPhase = 4;
    this.explodeMix = 0;
    this.cadMix = 0;
    this.tplMix = 0;
    this.beamsMix = 1;

    const renderer = (this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false }));
    renderer.setPixelRatio(Math.min(devicePixelRatio, QUALITY[qLevel].pr));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.85;
    container.appendChild(renderer.domElement);

    const scene = (this.scene = new THREE.Scene());
    scene.background = BG_CONCERT.clone();
    scene.fog = new THREE.FogExp2(0x050506, 0.022);

    // Textura de carta de calibración / pixelmap 2D para Stage Build
    if (pm.image) {
      this.tplTex = new THREE.TextureLoader().load(asset(pm.image));
      this.tplTex.colorSpace = THREE.SRGBColorSpace;
      this.tplTex.minFilter = THREE.LinearFilter;
    } else {
      this.tplTex = makeFallbackTemplateTex(pm);
    }

    // ---- videos: uno compartido, o uno por fuente en rigs multi-pantalla
    this.sources = {};
    const keys = this.multi ? [...new Set(pm.slices.map((s) => s.src))] : ['main'];
    keys.forEach((k) => (this.sources[k] = makeVideo()));
    const area = (s) => (s.size ? s.size[0] * s.size[1] : s.w * s.h);
    const biggest = [...pm.slices].sort((a, b) => area(b) - area(a))[0];
    this.primaryKey = this.multi ? biggest.src : 'main';
    this.video = this.sources[this.primaryKey].v;
    this.video.addEventListener('ended', () => this.autopilot && this.next());
    Object.values(this.sources).forEach(({ v }) => v.addEventListener('loadeddata', () => (this.readyCount = (this.readyCount || 0) + 1)));

    // ---- pantallas + gabinetes + wireframes CAD + líneas guía explosionadas
    const [cw, ch] = pm.canvas;
    const s = (this.s = (pm.width || 6) / cw);
    const bottom = 1.6;
    this.screens = [];
    this.sliceParts = [];
    const cab = pm.cabinet || 128;
    const backMat = new THREE.MeshStandardMaterial({ color: 0x0c0e14, roughness: 0.55, metalness: 0.65 });
    const box = new THREE.Box3();
    const R = pm.rig === 'curved' ? (cw * s) / (pm.curve || 1.2) : 0;
    const sliceColors = [0x00e5ff, 0xff4a1c, 0xb69cff, 0x4df5c1, 0xffd23f];

    pm.slices.forEach((sl, i) => {
      const tex = this.sources[this.multi ? sl.src : 'main'].tex;
      const tplRect = new THREE.Vector4(sl.x / cw, 1 - (sl.y + sl.h) / ch, sl.w / cw, sl.h / ch);
      const rect = this.multi ? new THREE.Vector4(0, 0, 1, 1) : tplRect.clone();
      const uniforms = {
        map: { value: tex }, tplMap: { value: this.tplTex },
        rect: { value: rect }, tplRect: { value: tplRect },
        px: { value: new THREE.Vector2(sl.w, sl.h) }, cab: { value: cab },
        uTime: { value: 0 }, uGlitch: { value: 0 }, uStrobe: { value: 0 },
        uHover: { value: 0 }, uOn: { value: 0 }, uReady: { value: 0 },
        uUseTpl: { value: 0 }, uAlpha: { value: 1 },
      };
      const mat = new THREE.ShaderMaterial({
        vertexShader: ledVert, fragmentShader: ledFrag, uniforms,
        toneMapped: false, transparent: true, side: THREE.DoubleSide,
      });

      let mesh, back, wireGeo, centerLocal;
      if (pm.rig === 'curved') {
        const w = sl.w * s, h = sl.h * s;
        const segs = Math.max(4, Math.round((sl.w / cw) * 64));
        const geo = new THREE.PlaneGeometry(w, h, segs, 1);
        const pos = geo.attributes.position;
        const x0 = (sl.x + sl.w / 2 - cw / 2) * s;
        const yc = bottom + (ch / 2 - (sl.y + sl.h / 2)) * s + (ch * s) / 2;
        for (let k = 0; k < pos.count; k++) {
          const ax = pos.getX(k) + x0;
          const th = ax / R;
          pos.setXYZ(k, R * Math.sin(th), pos.getY(k) + yc, R * (1 - Math.cos(th)));
        }
        geo.computeVertexNormals();
        mesh = new THREE.Mesh(geo, mat);
        back = new THREE.Mesh(geo.clone(), backMat);
        back.position.z = -0.12;
        geo.computeBoundingBox();
        centerLocal = geo.boundingBox.getCenter(new THREE.Vector3());
        wireGeo = new THREE.EdgesGeometry(geo, 18);
      } else {
        const w = sl.size ? sl.size[0] : sl.w * s;
        const h = sl.size ? sl.size[1] : sl.h * s;
        const x = sl.pos ? sl.pos[0] : (sl.x + sl.w / 2 - cw / 2) * s;
        const y = sl.pos ? sl.pos[1] : bottom + (ch / 2 - (sl.y + sl.h / 2)) * s + (ch * s) / 2;
        const z = (sl.z || 0) + (pm.rig === 'cross' ? i * 0.012 : 0);
        mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
        mesh.position.set(x, y, z);
        if (sl.ry) mesh.rotation.y = sl.ry;
        back = new THREE.Mesh(new THREE.BoxGeometry(w + 0.08, h + 0.08, 0.16), backMat);
        back.position.set(x, y, z - 0.09);
        back.rotation.y = mesh.rotation.y;
        centerLocal = new THREE.Vector3(0, 0, 0);
        wireGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(w + 0.12, h + 0.12, 0.2));
      }

      const wireMat = new THREE.LineBasicMaterial({
        color: sliceColors[i % sliceColors.length],
        transparent: true,
        opacity: 0,
      });
      const wire = new THREE.LineSegments(wireGeo, wireMat);
      mesh.add(wire);

      mesh.userData.slice = i;
      scene.add(mesh); scene.add(back);
      box.expandByObject(mesh);
      this.screens.push(mesh);

      const basePos = mesh.position.clone();
      const backBasePos = back.position.clone();
      this.sliceParts.push({
        mesh, back, wire, wireMat, centerLocal, sliceIdx: i, slice: sl,
        basePos, backBasePos,
        expPos: basePos.clone(),
        backExpPos: backBasePos.clone(),
      });
    });

    const minX = box.min.x, maxX = box.max.x, topY = box.max.y;
    const W = maxX - minX;
    const cx = (minX + maxX) / 2;
    this.screenCenter = new THREE.Vector3(cx, (bottom + topY) / 2, 0);
    this.dims = { W, H: topY - bottom, bottom };

    // Calcular vectores de explosión CAD + líneas guía punteadas para cada slice
    this.sliceParts.forEach((p, i) => {
      const worldCenter = p.basePos.clone().add(p.centerLocal);
      const dx = (worldCenter.x - cx) * 0.24;
      const dy = (worldCenter.y - this.screenCenter.y) * 0.16 + 0.18;
      const dz = 1.65 + i * 0.42;
      p.expPos.set(p.basePos.x + dx, p.basePos.y + dy, p.basePos.z + dz);
      p.backExpPos.set(p.backBasePos.x + dx * 0.35, p.backBasePos.y + dy * 0.35, p.backBasePos.z - 1.35);

      const pts = new Float32Array([
        worldCenter.x, worldCenter.y, worldCenter.z - 1.35,
        worldCenter.x, worldCenter.y, worldCenter.z,
      ]);
      const lGeo = new THREE.BufferGeometry();
      lGeo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
      const lMat = new THREE.LineDashedMaterial({
        color: sliceColors[i % sliceColors.length],
        dashSize: 0.22,
        gapSize: 0.14,
        transparent: true,
        opacity: 0,
      });
      const leader = new THREE.Line(lGeo, lMat);
      leader.visible = false;
      scene.add(leader);
      p.leader = leader;
      p.leaderGeo = lGeo;
      p.leaderMat = lMat;
      p.worldAnchor = worldCenter.clone();
    });

    // ---- truss (agrupado para elevarse en Fase 1 CAD Exploded)
    this.trussGroup = new THREE.Group();
    const trussMat = new THREE.MeshStandardMaterial({ color: 0x9a9aa2, roughness: 0.35, metalness: 0.9 });
    const span = W + 3.2;
    const towerH = topY + 1.4;
    const tz = pm.rig === 'curved' ? -0.6 : -0.4;
    for (const z of [tz, 3.6]) {
      for (const sx of [-1, 1]) {
        const t = new THREE.Mesh(trussGeometry(towerH), trussMat);
        t.position.set(cx + (sx * span) / 2, 0, z);
        this.trussGroup.add(t);
      }
      const top = new THREE.Mesh(trussGeometry(span + 0.3), trussMat);
      top.rotation.z = Math.PI / 2;
      top.position.set(cx + span / 2 + 0.15, towerH, z);
      this.trussGroup.add(top);
    }
    scene.add(this.trussGroup);

    // ---- tarima y cabina (agrupadas para desplazarse en Fase 1)
    this.deckGroup = new THREE.Group();
    const deckMat = new THREE.MeshStandardMaterial({ color: 0x111114, roughness: 0.8, metalness: 0.2 });
    const deckD = pm.rig === 'curved' ? 7 : 5.2;
    const deck = new THREE.Mesh(new THREE.BoxGeometry(span + 1.5, 1.1, deckD), deckMat);
    deck.position.set(cx, 0.55, 1.3 + (deckD - 5.2) / 2);
    this.deckGroup.add(deck);
    const booth = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.05, 0.9), deckMat);
    booth.position.set(cx, 1.1 + 0.52, 2.2);
    this.deckGroup.add(booth);
    this.boothStrip = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 0.06), new THREE.MeshBasicMaterial({ color: 0xff4a1c, toneMapped: false }));
    this.boothStrip.position.set(cx, 1.1 + 0.85, 2.66);
    this.deckGroup.add(this.boothStrip);
    this.deckStrip = new THREE.Mesh(new THREE.PlaneGeometry(span + 1.5, 0.05), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
    this.deckStrip.position.set(cx, 1.08, 1.3 + deckD / 2 + 0.01 + (deckD - 5.2) / 2);
    this.deckGroup.add(this.deckStrip);
    scene.add(this.deckGroup);

    // ---- rejilla CAD blueprint (visible en Fases 1-2 de Stage Build)
    this.cadGrid = new THREE.GridHelper(70, 56, 0x00e5ff, 0x0c2b44);
    this.cadGrid.position.set(cx, 0.018, 0);
    this.cadGrid.material.transparent = true;
    this.cadGrid.material.opacity = 0;
    this.cadGrid.visible = false;
    scene.add(this.cadGrid);

    // ---- piso reflectivo atenuado
    const mirror = new Reflector(new THREE.PlaneGeometry(120, 120), {
      textureWidth: Math.round(innerWidth * 0.3), textureHeight: Math.round(innerHeight * 0.3), color: 0x777777,
    });
    mirror.rotation.x = -Math.PI / 2;
    scene.add(mirror);
    this.mirror = mirror;
    const mirrorRender = mirror.onBeforeRender;
    this.frame = 0;
    mirror.onBeforeRender = (...a) => { if (this.frame % 2 === 0) mirrorRender.apply(mirror, a); };
    mirror.visible = QUALITY[qLevel].mirror;
    const dim = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshStandardMaterial({ color: 0x050506, roughness: 0.9, transparent: true, opacity: 0.82 }));
    dim.rotation.x = -Math.PI / 2; dim.position.y = 0.005;
    scene.add(dim);

    // ---- público
    const crowdN = 190;
    const bodyG = new THREE.CapsuleGeometry(0.2, 0.95, 3, 8); bodyG.translate(0, 0.68, 0);
    const headG = new THREE.SphereGeometry(0.13, 10, 8); headG.translate(0, 1.42, 0);
    this.crowd = new THREE.InstancedMesh(mergeGeometries([bodyG, headG]), new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 1 }), crowdN);
    this.crowdData = [];
    const dummy = (this.dummy = new THREE.Object3D());
    const front = 1.3 + deckD / 2 + (deckD - 5.2) / 2 + 1.4;
    for (let i = 0; i < crowdN; i++) {
      const z = front + Math.random() * 12;
      const spread = Math.max(3, W * 0.35) + (z - front) * 0.9;
      this.crowdData.push({ x: cx + (Math.random() * 2 - 1) * spread, z, sc: 0.9 + Math.random() * 0.25, ph: Math.random(), amp: 0.06 + Math.random() * 0.14 });
    }
    scene.add(this.crowd);

    // ---- cabezas móviles
    const coneLen = 18;
    const coneG = new THREE.ConeGeometry(0.85, coneLen, 20, 1, true);
    coneG.translate(0, -coneLen / 2, 0);
    this.beams = [];
    const fixtureG = new THREE.BoxGeometry(0.3, 0.35, 0.3);
    const fixtureM = new THREE.MeshStandardMaterial({ color: 0x1a1a1d, roughness: 0.4, metalness: 0.7 });
    const beamMat = (k) => new THREE.ShaderMaterial({
      vertexShader: beamVert, fragmentShader: beamFrag, uniforms: { color: { value: new THREE.Color(1, 1, 1) }, intensity: { value: k } },
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
    });
    const nBeams = Math.max(6, Math.min(10, Math.round(span / 2.4)));
    for (let i = 0; i < nBeams; i++) {
      const pivot = new THREE.Group();
      pivot.position.set(cx - span / 2 + 0.6 + (i * (span - 1.2)) / (nBeams - 1), towerH - 0.35, 3.6);
      const mat = beamMat(0.15);
      pivot.add(new THREE.Mesh(coneG, mat)); pivot.add(new THREE.Mesh(fixtureG, fixtureM));
      this.trussGroup.add(pivot);
      this.beams.push({ pivot, mat, ph: i / nBeams, side: i < nBeams / 2 ? -1 : 1 });
    }
    for (const sx of [-1, 1]) for (let k = 0; k < 2; k++) {
      const pivot = new THREE.Group();
      pivot.position.set(cx + sx * (W / 2 + 0.6 + k * 0.9), 1.15, -0.8);
      const mat = beamMat(0.12);
      const cone = new THREE.Mesh(coneG, mat); cone.rotation.x = Math.PI;
      pivot.add(cone); scene.add(pivot);
      this.beams.push({ pivot, mat, ph: 0.5 + k * 0.25, side: sx, up: true });
    }

    // ---- humo
    const hazeN = 240;
    const hp = new Float32Array(hazeN * 3);
    for (let i = 0; i < hazeN; i++) { hp[i * 3] = cx + (Math.random() * 2 - 1) * (span * 0.8 + 4); hp[i * 3 + 1] = Math.random() * (towerH + 2); hp[i * 3 + 2] = -2 + Math.random() * 18; }
    const hazeG = new THREE.BufferGeometry(); hazeG.setAttribute('position', new THREE.BufferAttribute(hp, 3));
    this.haze = new THREE.Points(hazeG, new THREE.PointsMaterial({ size: 2.6, map: spriteTexture(), transparent: true, opacity: 0.03, depthWrite: false, blending: THREE.AdditiveBlending }));
    scene.add(this.haze);

    scene.add(new THREE.HemisphereLight(0x8890ff, 0x050505, 0.28));
    this.cadHemi = new THREE.HemisphereLight(0x8be9fd, 0x0a1c2e, 0);
    scene.add(this.cadHemi);
    this.screenLight = new THREE.PointLight(0xffffff, 18, 34, 1.6);
    this.screenLight.position.set(cx, this.screenCenter.y, 3);
    scene.add(this.screenLight);

    // ---- cámara, presets y controles
    const cam = (this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 300));
    const size = Math.max(W, this.dims.H * 1.6);
    const dist = size * 1.15 + 8;
    const tgt = this.screenCenter.clone().add(new THREE.Vector3(0, -0.5, 0));
    this.presets = {
      wide: { pos: new THREE.Vector3(cx + dist * 0.3, this.screenCenter.y * 0.65, dist), tgt },
      stage: { pos: new THREE.Vector3(cx - size * 0.12, this.screenCenter.y * 0.85, size * 0.62 + 4), tgt: this.screenCenter.clone() },
      booth: { pos: new THREE.Vector3(cx + 1.2, 3.3, front + 13), tgt: this.screenCenter.clone().add(new THREE.Vector3(0, -0.8, 0)) },
      // Presets coreografiados para Stage Build 2D→3D (isométrico CAD → ensamblaje → luces → live)
      build1: { pos: new THREE.Vector3(cx + dist * 0.56, this.screenCenter.y + dist * 0.34, dist * 1.12), tgt: this.screenCenter.clone().add(new THREE.Vector3(-dist * 0.08, 0.1, 0.3)) },
      build2: { pos: new THREE.Vector3(cx + dist * 0.28, this.screenCenter.y + dist * 0.14, dist * 1.06), tgt: this.screenCenter.clone().add(new THREE.Vector3(-dist * 0.06, 0, 0)) },
      build3: { pos: new THREE.Vector3(cx - dist * 0.3, this.screenCenter.y + dist * 0.1, dist * 1.06), tgt: this.screenCenter.clone().add(new THREE.Vector3(-dist * 0.05, 0, 0)) },
      build4: { pos: new THREE.Vector3(cx + dist * 0.24, this.screenCenter.y * 0.72, dist), tgt },
    };
    cam.position.copy(this.presets.wide.pos);
    const controls = (this.controls = new OrbitControls(cam, renderer.domElement));
    controls.target.copy(tgt);
    controls.enableDamping = true; controls.dampingFactor = 0.06;
    controls.enablePan = false; controls.enableZoom = false;
    controls.minDistance = 4; controls.maxDistance = dist * 1.9;
    controls.minPolarAngle = 0.28; controls.maxPolarAngle = 1.56;
    controls.minAzimuthAngle = -1.4; controls.maxAzimuthAngle = 1.4;
    controls.autoRotate = true; controls.autoRotateSpeed = 0.3;
    controls.addEventListener('start', () => { controls.autoRotate = false; this.camAnim = null; clearTimeout(this.idleT); });
    controls.addEventListener('end', () => { this.idleT = setTimeout(() => { if (!this.buildOpen) controls.autoRotate = true; }, 6000); });
    this.onWheel = (e) => {
      if (!(e.ctrlKey || e.metaKey || this.buildOpen)) return;
      e.preventDefault();
      const dir = cam.position.clone().sub(controls.target);
      const len = THREE.MathUtils.clamp(dir.length() * (1 + Math.sign(e.deltaY) * 0.08), controls.minDistance, controls.maxDistance);
      cam.position.copy(controls.target).add(dir.setLength(len));
    };
    renderer.domElement.addEventListener('wheel', this.onWheel, { passive: false });

    const composer = (this.composer = new EffectComposer(renderer));
    composer.addPass(new RenderPass(scene, cam));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.45, 0.78);
    composer.addPass(this.bloom);
    this.bloom.enabled = QUALITY[qLevel].bloom;
    composer.addPass(new OutputPass());

    this.sampler = document.createElement('canvas');
    this.sampler.width = this.sampler.height = 8;
    this.sctx = this.sampler.getContext('2d', { willReadFrequently: true });
    this.avg = new THREE.Color(1, 0.3, 0.1);
    this.avgTarget = new THREE.Color(1, 0.3, 0.1);
    this.avgLight = new THREE.Color();
    this.hitSlice = -1;
    this._projVec = new THREE.Vector3();

    this.ray = new THREE.Raycaster();
    this.pointer = new THREE.Vector2(9, 9);
    this.onMove = (e) => {
      const r = renderer.domElement.getBoundingClientRect();
      this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      this.pointerDirty = true;
    };
    this.onOut = () => { this.pointer.set(9, 9); this.pointerDirty = true; };
    renderer.domElement.addEventListener('pointermove', this.onMove);
    renderer.domElement.addEventListener('pointerleave', this.onOut);

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.io = new IntersectionObserver(([e]) => {
      this.visible = e.isIntersecting;
      Object.values(this.sources).forEach(({ v }) => (this.visible ? v.play().catch(() => {}) : v.pause()));
    });
    this.io.observe(container);
    this.visible = true;
    this.on = 0;

    this.clock = new THREE.Clock();
    this.resize();
    this.load(0);
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  videoFor(slice) { return this.sources[this.multi ? slice.src : 'main'].v; }

  load(i) {
    if (!this.items.length) return;
    this.clip = (i + this.items.length) % this.items.length;
    this.readyCount = 0;
    const it = this.items[this.clip];
    if (this.multi) {
      for (const [k, { v }] of Object.entries(this.sources)) {
        v.src = asset(it.sources[k]);
        v.loop = k !== this.primaryKey || !this.autopilot;
        v.play().catch(() => {});
      }
    } else {
      this.video.src = asset(it);
      this.video.loop = !this.autopilot;
      this.video.play().catch(() => {});
    }
    this.glitch = 1;
    this.onClip?.(this.clip);
  }
  next() { this.load(this.clip + 1); }
  prev() { this.load(this.clip - 1); }
  setAutopilot(on) { this.autopilot = on; this.video.loop = !on; }
  setStrobe(on) { this.strobeHeld = on; }
  highlight(i) { this.forcedHover = i; }

  setBuildMode(open, phase = 1) {
    this.buildOpen = open;
    this.buildPhase = open ? phase : 4;
    if (open) {
      this.setView(`build${phase}`);
    } else {
      this.setView('wide');
    }
  }

  setView(name) {
    const p = this.presets[name];
    if (!p) return;
    this.controls.autoRotate = false;
    clearTimeout(this.idleT);
    this.camAnim = { from: this.camera.position.clone(), fromT: this.controls.target.clone(), to: p.pos, toT: p.tgt, t: 0 };
    if (!this.buildOpen) {
      this.idleT = setTimeout(() => (this.controls.autoRotate = true), 9000);
    }
  }

  resize() {
    const r = this.container.getBoundingClientRect();
    if (!r.width) return;
    this.renderer.setSize(r.width, r.height, false);
    this.composer.setSize(r.width, r.height);
    this.bloom.setSize(r.width / 2, r.height / 2);
    this.camera.aspect = r.width / r.height;
    this.camera.fov = r.width / r.height < 1 ? 58 : 38;
    this.camera.updateProjectionMatrix();
  }

  sampleColor() {
    const v = this.video;
    if (v.readyState < 2) return;
    try {
      this.sctx.drawImage(v, 0, 0, 8, 8);
      const d = this.sctx.getImageData(0, 0, 8, 8).data;
      let r = 0, g = 0, b = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) {
        const wgt = 0.2 + (d[i] + d[i + 1] + d[i + 2]) / 765;
        r += d[i] * wgt; g += d[i + 1] * wgt; b += d[i + 2] * wgt; n += wgt;
      }
      const c = new THREE.Color(r / n / 255, g / n / 255, b / n / 255);
      const hsl = {}; c.getHSL(hsl);
      c.setHSL(hsl.h, Math.min(1, hsl.s * 1.6 + 0.15), Math.max(0.45, hsl.l));
      this.avgTarget.copy(c);
    } catch { /* sin cuadros todavía */ }
  }

  adapt(now) {
    const dt = now - (this.lastNow || now);
    this.lastNow = now;
    if (dt <= 0 || dt > 250) return;
    this.frame++;
    if (this.frame < 45) return;
    this.acc = (this.acc || 0) + dt; this.n = (this.n || 0) + 1;
    if (this.n < 50) return;
    const avg = this.acc / this.n;
    this.acc = 0; this.n = 0;
    if (avg > 23 && qLevel < QUALITY.length - 1) {
      qLevel++;
      const q = QUALITY[qLevel];
      this.renderer.setPixelRatio(Math.min(devicePixelRatio, q.pr));
      this.composer.setPixelRatio(this.renderer.getPixelRatio());
      this.mirror.visible = q.mirror;
      this.bloom.enabled = q.bloom;
      this.resize();
    }
  }

  loop(now = performance.now()) {
    this.raf = requestAnimationFrame(this.loop);
    if (!this.visible) return;
    this.adapt(now);
    const t = this.clock.getElapsedTime();
    const env = beat.env();
    const ph = beat.phase();
    if (((t * 8) | 0) !== this._ls) { this._ls = (t * 8) | 0; this.sampleColor(); }
    this.avg.lerp(this.avgTarget, 0.08);
    this.glitch *= 0.88;
    this.strobe = this.strobeHeld ? (ph < 0.5 ? 1 : 0) : 0;
    this.on += (1 - this.on) * 0.03;

    // ---- Interpolación suave de Stage Build (4 fases)
    const tgtExplode = this.buildOpen && this.buildPhase === 1 ? 1 : 0;
    const tgtCad = this.buildOpen && this.buildPhase <= 2 ? 1 : 0;
    const tgtTpl = this.buildOpen && this.buildPhase < 4 ? 1 : 0;
    const tgtBeams = !this.buildOpen || this.buildPhase >= 3 ? 1 : 0;

    this.explodeMix += (tgtExplode - this.explodeMix) * 0.085;
    this.cadMix += (tgtCad - this.cadMix) * 0.09;
    this.tplMix += (tgtTpl - this.tplMix) * 0.1;
    this.beamsMix += (tgtBeams - this.beamsMix) * 0.09;

    // Atmósfera CAD vs Concierto
    this.scene.background.lerpColors(BG_CONCERT, BG_CAD, this.cadMix);
    this.scene.fog.color.copy(this.scene.background);
    this.cadHemi.intensity = this.cadMix * 1.95;
    this.cadGrid.visible = this.cadMix > 0.02;
    this.cadGrid.material.opacity = this.cadMix * 0.55;
    this.crowd.visible = this.beamsMix > 0.15;
    this.haze.visible = this.beamsMix > 0.15;

    // Explosión estructural de Truss, Deck y Slices LED/Gabinetes
    this.trussGroup.position.set(0, this.explodeMix * 1.45, -this.explodeMix * 1.25);
    this.deckGroup.position.set(0, -this.explodeMix * 0.15, this.explodeMix * 1.15);

    if (this.camAnim) {
      const a = this.camAnim;
      a.t = Math.min(1, a.t + 0.024);
      const k = 1 - Math.pow(1 - a.t, 3);
      this.camera.position.lerpVectors(a.from, a.to, k);
      this.controls.target.lerpVectors(a.fromT, a.toT, k);
      if (a.t >= 1) this.camAnim = null;
    }

    if (this.pointerDirty || (this.pointer.x < 2 && this.frame % 6 === 0)) {
      this.pointerDirty = false;
      this.ray.setFromCamera(this.pointer, this.camera);
      const hit = this.ray.intersectObjects(this.screens)[0];
      this.hitSlice = hit ? hit.object.userData.slice : -1;
    }
    const hi = this.hitSlice >= 0 ? this.hitSlice : this.forcedHover ?? -1;
    if (hi !== this.slicesHover) { this.slicesHover = hi; this.onHoverSlice?.(hi); }

    const e = this.explodeMix;
    this.sliceParts.forEach((p, i) => {
      p.mesh.position.lerpVectors(p.basePos, p.expPos, e);
      p.back.position.lerpVectors(p.backBasePos, p.backExpPos, e);

      const u = p.mesh.material.uniforms;
      const v = this.videoFor(this.pm.slices[i]);
      u.uTime.value = t;
      u.uGlitch.value = this.glitch;
      u.uStrobe.value = this.strobe;
      u.uOn.value = this.on;
      u.uReady.value += ((v.readyState >= 2 ? 1 : 0) - u.uReady.value) * 0.1;
      u.uHover.value += ((i === hi ? 1 : 0) - u.uHover.value) * 0.15;
      u.uUseTpl.value = this.tplMix;
      u.uAlpha.value = 1 - e * 0.12;

      const isHov = i === hi;
      const wireOp = isHov ? 0.95 : this.cadMix * 0.65;
      p.wire.visible = wireOp > 0.02;
      p.wireMat.opacity = wireOp;

      const showLeader = e > 0.04;
      p.leader.visible = showLeader;
      if (showLeader) {
        const arr = p.leaderGeo.attributes.position.array;
        const backC = p.back.position.clone().add(p.centerLocal);
        const frontC = p.mesh.position.clone().add(p.centerLocal);
        arr[0] = backC.x; arr[1] = backC.y; arr[2] = backC.z;
        arr[3] = frontC.x; arr[4] = frontC.y; arr[5] = frontC.z;
        p.leaderGeo.attributes.position.needsUpdate = true;
        p.leader.computeLineDistances();
        p.leaderMat.opacity = Math.min(0.85, e * (isHov ? 1.0 : 0.72));
      }
    });

    this.avgLight.copy(this.avg).lerp(WHITE, 0.35);
    this.beams.forEach((b, i) => {
      const a = t * 0.55 + b.ph * Math.PI * 2;
      if (b.up) { b.pivot.rotation.z = b.side * (0.25 + Math.sin(a) * 0.22); b.pivot.rotation.x = 0.2 + Math.cos(a * 0.7) * 0.12; }
      else { b.pivot.rotation.z = Math.sin(a) * 0.55 + b.side * 0.1; b.pivot.rotation.x = -0.25 + Math.cos(a * 0.8) * 0.45; }
      b.mat.uniforms.color.value.copy(i % 2 ? this.avgLight : this.avg);
      b.mat.uniforms.intensity.value = ((b.up ? 0.12 : 0.15) * (0.7 + env * 0.6) + (this.strobe ? 0.15 : 0)) * this.beamsMix;
    });

    if (this.crowd.visible) {
      const ds = this.dummy;
      this.crowdData.forEach((p, i) => {
        ds.position.set(p.x, Math.max(0, Math.sin((ph + p.ph * 0.25) * Math.PI * 2)) * p.amp, p.z);
        ds.scale.setScalar(p.sc);
        ds.rotation.y = Math.sin(t * 0.3 + p.ph * 6) * 0.3;
        ds.updateMatrix();
        this.crowd.setMatrixAt(i, ds.matrix);
      });
      this.crowd.instanceMatrix.needsUpdate = true;
    }

    this.haze.rotation.y = Math.sin(t * 0.05) * 0.08;
    this.haze.material.color.copy(this.avg);
    this.screenLight.color.copy(this.avg);
    this.screenLight.intensity = (18 + env * 14) * this.on * (0.4 + 0.6 * this.beamsMix);
    this.boothStrip.material.color.copy(this.avg).multiplyScalar(1.5 + env);
    this.deckStrip.material.color.setScalar(0.3 + env * 1.2);
    this.bloom.strength = (0.42 + env * 0.18 + this.strobe * 0.3) * (0.35 + 0.65 * this.beamsMix);

    this.controls.update();
    this.composer.render();

    // Proyectar cotas 3D CAD sobre las pantallas durante Stage Build
    if (this.onProjectLabels) {
      if (this.buildOpen && this.buildPhase <= 3) {
        const w = this.container.clientWidth;
        const h = this.container.clientHeight;
        const projected = this.sliceParts.map((p) => {
          this._projVec.copy(p.mesh.position).add(p.centerLocal);
          this._projVec.project(this.camera);
          const visible = this._projVec.z < 1 && this._projVec.z > -1;
          return {
            i: p.sliceIdx,
            x: (this._projVec.x * 0.5 + 0.5) * w,
            y: (-this._projVec.y * 0.5 + 0.5) * h,
            visible,
          };
        });
        this.onProjectLabels(projected, hi);
      } else {
        this.onProjectLabels(null, hi);
      }
    }
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    clearTimeout(this.idleT);
    this.ro.disconnect(); this.io.disconnect();
    this.renderer.domElement.removeEventListener('wheel', this.onWheel);
    Object.values(this.sources).forEach(({ v, tex }) => { v.pause(); v.removeAttribute('src'); v.load(); tex.dispose(); });
    this.tplTex?.dispose();
    this.controls.dispose();
    this.scene.traverse((o) => { o.geometry?.dispose(); if (o.material) [].concat(o.material).forEach((m) => { m.map?.dispose?.(); m.dispose(); }); });
    this.mirror.getRenderTarget?.().dispose();
    this.composer.dispose?.();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}
