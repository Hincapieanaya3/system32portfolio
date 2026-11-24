import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';
import { Expand, Film, Pause, Play, Shuffle, SkipBack, SkipForward } from 'lucide-react';
import { PROJECTS, UI_TEXT, WORLDS } from '../../data/portfolioData';

const MAX_W = 7.8;
const MAX_H = 5.65;
const AUTOPILOT_MS = 7500;

const KINETIC_MODES = [
  { id: 'scatter', label: { en: 'RANDOM SCATTER', es: 'CAOS KINETIC' } },
  { id: 'streams', label: { en: 'KINETIC STREAMS', es: 'FLUJO KINETIC' } },
  { id: 'diagonal', label: { en: 'DIAGONAL SLASH', es: 'DIAGONAL KINETIC' } },
  { id: 'vortex', label: { en: 'ORBIT VORTEX', es: 'VÓRTICE KINETIC' } },
];

const KINETIC_VERT = `
uniform float uTime;
uniform float uEnergy;
uniform float uShear;
uniform float uRow;
varying vec2 vUv;
varying float vAtlasV;

void main() {
  vUv = uv;
  // Map Plane UV (0..1) into one of the 4 horizontal strips of the 2048x1024 atlas
  vAtlasV = (uv.y + uRow) * 0.25;

  vec3 pos = position;
  // Cursor-driven elastic kinetic wave & italic velocity shear
  float wave = sin(uv.x * 9.42477 - uTime * 11.0) * uEnergy * 0.14;
  pos.y += wave;
  pos.x += (uv.y - 0.5) * (uShear * 0.55 + uEnergy * 0.22);

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

const KINETIC_FRAG = `
precision highp float;
uniform sampler2D uAtlas;
uniform vec3 uAccent;
uniform float uBaseOpacity;
uniform float uEnergy;
varying vec2 vUv;
varying float vAtlasV;

void main() {
  vec2 baseUv = vec2(vUv.x, vAtlasV);

  // Chromatic RGB split when cursor disturbs the typography
  float split = uEnergy * 0.018;
  float r = texture2D(uAtlas, vec2(clamp(baseUv.x + split, 0.002, 0.998), baseUv.y)).a;
  float g = texture2D(uAtlas, baseUv).a;
  float b = texture2D(uAtlas, vec2(clamp(baseUv.x - split, 0.002, 0.998), baseUv.y)).a;

  float alphaMask = max(max(r, g), b);
  if (alphaMask < 0.02) discard;

  vec3 restColor = mix(vec3(0.82, 0.86, 0.94), uAccent, 0.22);
  vec3 chromaColor = vec3(r, g, b);
  vec3 hotColor = mix(uAccent, vec3(1.0), g * 0.62) * (0.85 + 0.55 * chromaColor);

  vec3 finalCol = mix(restColor, hotColor, smoothstep(0.02, 0.65, uEnergy));
  float alpha = alphaMask * mix(uBaseOpacity, 0.96, smoothstep(0.0, 0.7, uEnergy));

  gl_FragColor = vec4(finalCol, alpha);
}
`;

function drawSystem32Atlas(canvas) {
  const W = 2048;
  const H = 1024;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const akira = "'Akira Expanded', 'Syne', sans-serif";
  const mono = "'JetBrains Mono', monospace";

  // Note: Canvas Y=0 is top, WebGL UV Y=1 is top -> Row 3 is top strip, Row 0 is bottom strip
  // Strip 3 (uRow = 3): Solid ExtraBold SYSTEM32 in Akira Expanded
  ctx.save();
  ctx.font = `800 134px ${akira}`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText('SYSTEM32', W / 2, H * 0.125);
  ctx.restore();

  // Strip 2 (uRow = 2): Crisp Outlined Stroke SYSTEM32 in Akira Expanded
  ctx.save();
  ctx.font = `800 134px ${akira}`;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 5.5;
  ctx.lineJoin = 'round';
  ctx.strokeText('SYSTEM32', W / 2, H * 0.375);
  ctx.restore();

  // Strip 1 (uRow = 1): Technical Brutalist Mono [ SYSTEM_32 // ]
  ctx.save();
  ctx.font = `700 124px ${mono}`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText('[ SYSTEM_32 // ]', W / 2, H * 0.625);
  ctx.restore();

  // Strip 0 (uRow = 0): Hybrid Kinetic /// SYSTEM32 (Solid + Outline) in Akira Expanded
  ctx.save();
  ctx.translate(W / 2, H * 0.875);
  ctx.transform(1, 0, -0.16, 1, 0, 0);
  ctx.font = `800 124px ${akira}`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText('/// SYSTEM', -240, 0);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 5.5;
  ctx.strokeText('32', 520, 0);
  ctx.restore();
}

function computeScreenDimensions(aspect) {
  const safeAspect = aspect > 0 ? aspect : 16 / 9;
  if (safeAspect >= MAX_W / MAX_H) {
    const w = MAX_W;
    return { w, h: w / safeAspect };
  }
  const h = MAX_H;
  return { w: h * safeAspect, h };
}

function buildMotionClips(proj, manifest) {
  const m = proj.behanceSlug ? manifest?.behance?.[proj.behanceSlug] : null;
  if (m?.gallery?.length) {
    const vids = m.gallery.filter((g) => g.type === 'video');
    if (vids.length) return vids.map((v) => v.src);
  }
  return proj.preview ? [proj.preview] : [];
}

export default function MotionWorld({ lang, manifest, onInspectProject }) {
  const t = UI_TEXT[lang];
  const worldMeta = WORLDS.find((w) => w.id === 'motion');
  const motionProjects = useMemo(() => PROJECTS.filter((p) => p.world === 'motion'), []);

  const [activeIdx, setActiveIdx] = useState(0);
  const [clipIdx, setClipIdx] = useState(0);
  const [autopilot, setAutopilot] = useState(true);
  const [aspectBadge, setAspectBadge] = useState('9:16 VERTICAL');
  const [kineticModeIdx, setKineticModeIdx] = useState(() =>
    Math.floor(Math.random() * KINETIC_MODES.length)
  );

  const activeProject = motionProjects[activeIdx];
  const clips = useMemo(
    () => buildMotionClips(activeProject, manifest),
    [activeProject, manifest]
  );
  const activeClipSrc = clips[clipIdx % Math.max(1, clips.length)] || activeProject.preview;

  const canvasHostRef = useRef(null);
  const apiRef = useRef(null);
  const activeIdxRef = useRef(0);

  useEffect(() => {
    activeIdxRef.current = activeIdx;
    setClipIdx(0);
  }, [activeIdx]);

  useEffect(() => {
    if (!autopilot || clips.length <= 1) return undefined;
    const id = window.setInterval(() => {
      setClipIdx((c) => (c + 1) % clips.length);
    }, AUTOPILOT_MS);
    return () => window.clearInterval(id);
  }, [autopilot, clips.length, activeIdx]);

  useEffect(() => {
    const host = canvasHostRef.current;
    if (!host) return undefined;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x030710);
    scene.fog = new THREE.FogExp2(0x030710, 0.018);

    const camera = new THREE.PerspectiveCamera(44, host.clientWidth / host.clientHeight, 0.1, 160);
    camera.position.set(0, 2.35, 13.0);

    // Studio Lighting (Blue Gamut)
    scene.add(new THREE.AmbientLight(0xd8ecff, 0.72));
    const accentLight = new THREE.PointLight(0x00e5ff, 40, 38);
    accentLight.position.set(0, 6, 8);
    scene.add(accentLight);

    const rimLight = new THREE.DirectionalLight(0x0077ff, 1.5);
    rimLight.position.set(-8, 12, -6);
    scene.add(rimLight);

    // Subtle Studio Floor Grid & Timeline Rail (Blue Gamut)
    const grid = new THREE.GridHelper(140, 90, 0x0e2a4c, 0x071326);
    grid.position.y = -2.85;
    scene.add(grid);

    const railMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
    const rail = new THREE.Mesh(new THREE.BoxGeometry(90, 0.035, 0.035), railMat);
    rail.position.set(22, -2.05, 1.2);
    scene.add(rail);

    // =========================================================================
    // RANDOM KINETIC TYPOGRAPHY BACKDROP ("SYSTEM32") — CURSOR-REACTIVE
    // =========================================================================
    const atlasCanvas = document.createElement('canvas');
    drawSystem32Atlas(atlasCanvas);
    const atlasTex = new THREE.CanvasTexture(atlasCanvas);
    atlasTex.colorSpace = THREE.SRGBColorSpace;
    atlasTex.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);
    atlasTex.needsUpdate = true;

    let disposed = false;
    if (document.fonts?.load) {
      Promise.all([
        document.fonts.load("800 120px 'Akira Expanded'"),
        document.fonts.ready,
      ]).then(() => {
        if (disposed) return;
        drawSystem32Atlas(atlasCanvas);
        atlasTex.needsUpdate = true;
      });
    }

    const kineticGroup = new THREE.Group();
    scene.add(kineticGroup);

    const WORD_COUNT = 92;
    const WRAP_W = 46.0;
    const sharedWordGeo = new THREE.PlaneGeometry(1, 0.145, 20, 2);
    const activeAccentColor = new THREE.Color(motionProjects[0]?.accentColor || '#00f5d4');
    const kineticItems = [];

    for (let i = 0; i < WORD_COUNT; i++) {
      const mat = new THREE.ShaderMaterial({
        vertexShader: KINETIC_VERT,
        fragmentShader: KINETIC_FRAG,
        uniforms: {
          uAtlas: { value: atlasTex },
          uTime: { value: 0 },
          uEnergy: { value: 0 },
          uShear: { value: 0 },
          uRow: { value: i % 4 },
          uAccent: { value: activeAccentColor.clone() },
          uBaseOpacity: { value: 0.24 },
        },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      });

      const mesh = new THREE.Mesh(sharedWordGeo, mat);
      kineticGroup.add(mesh);

      kineticItems.push({
        mesh,
        mat,
        // Parametric kinetic DNA (re-randomized by randomizeKineticField)
        mode: 'scatter',
        localX: 0,
        baseY: 2.2,
        baseZ: -6.0,
        baseScale: 3.4,
        baseRotZ: 0,
        speedX: 1.0,
        speedY: 0.0,
        ampY: 0.2,
        freq: 1.0,
        phase: 0,
        orbitR: 5.0,
        orbitSpd: 0.3,
        stepQuant: 0,
        // Spring-damper cursor displacement state
        dx: 0,
        dy: 0,
        dz: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        rotZ: 0,
        vRotZ: 0,
        energy: 0,
        shear: 0,
      });
    }

    const randomizeKineticField = (modeId) => {
      kineticItems.forEach((it, i) => {
        it.mode = modeId;
        const rowChoice = Math.floor(Math.random() * 4);
        it.mat.uniforms.uRow.value = rowChoice;
        it.phase = Math.random() * Math.PI * 2;
        it.freq = 0.6 + Math.random() * 1.8;
        // 30% of words use stepped After-Effects posterizeTime style pulses
        it.stepQuant = Math.random() < 0.3 ? 3.5 + Math.random() * 3.0 : 0;

        if (modeId === 'streams') {
          const laneCount = 9;
          const lane = i % laneCount;
          const colInLane = Math.floor(i / laneCount);
          const colsTotal = Math.ceil(WORD_COUNT / laneCount);
          const dir = lane % 2 === 0 ? 1 : -1;
          it.baseZ = -4.2 - (lane % 3) * 2.1 - Math.random() * 0.6;
          it.baseY = -3.4 + lane * 1.48;
          it.localX = (colInLane / colsTotal) * WRAP_W - WRAP_W * 0.5 + (Math.random() - 0.5) * 1.2;
          it.speedX = dir * (0.65 + (lane % 4) * 0.42 + Math.random() * 0.35);
          it.speedY = 0;
          it.ampY = 0.08 + Math.random() * 0.14;
          it.baseRotZ = 0;
          it.baseScale = 3.2 + (lane % 3) * 0.75;
          it.mat.uniforms.uBaseOpacity.value = rowChoice === 2 ? 0.3 : 0.2;
        } else if (modeId === 'diagonal') {
          const angle = 0.36; // ~21 deg brutalist kinetic slash
          const laneCount = 10;
          const lane = i % laneCount;
          const dir = lane % 2 === 0 ? 1 : -1;
          it.baseZ = -4.0 - Math.random() * 5.8;
          it.localX = (Math.random() - 0.5) * WRAP_W;
          it.baseY = -3.8 + lane * 1.42;
          const spd = dir * (0.9 + Math.random() * 1.4);
          it.speedX = Math.cos(angle) * spd;
          it.speedY = Math.sin(angle) * spd;
          it.ampY = 0.12;
          it.baseRotZ = angle;
          it.baseScale = 2.8 + Math.random() * 2.4;
          it.mat.uniforms.uBaseOpacity.value = 0.18 + Math.random() * 0.14;
        } else if (modeId === 'vortex') {
          it.baseZ = -4.3 - Math.random() * 6.0;
          it.orbitR = 2.6 + Math.random() * 10.5;
          it.orbitSpd = (i % 2 === 0 ? 1 : -1) * (0.18 + Math.random() * 0.45);
          it.localX = 0;
          it.baseY = 2.25;
          it.baseScale = 2.4 + Math.random() * 2.5;
          it.mat.uniforms.uBaseOpacity.value = 0.18 + Math.random() * 0.15;
        } else {
          // 'scatter' — Random Kinetic Cloud (varied scales, speeds, depths & orientations)
          it.baseZ = -3.9 - Math.random() * 6.8;
          it.localX = (Math.random() - 0.5) * WRAP_W;
          it.baseY = -3.6 + Math.random() * 12.2;
          const dir = Math.random() < 0.5 ? 1 : -1;
          it.speedX = dir * (0.25 + Math.random() * 1.55);
          it.speedY = (Math.random() - 0.5) * 0.28;
          it.ampY = 0.18 + Math.random() * 0.55;
          it.baseRotZ =
            Math.random() < 0.16
              ? (Math.random() < 0.5 ? 1 : -1) * (Math.PI * 0.5)
              : (Math.random() - 0.5) * 0.22;
          it.baseScale = 2.3 + Math.pow(Math.random(), 1.4) * 3.8;
          it.mat.uniforms.uBaseOpacity.value = 0.15 + Math.random() * 0.18;
        }

        // Gentle spring pop when switching modes
        it.vz += (Math.random() - 0.3) * 0.25;
        it.energy = Math.max(it.energy, 0.45);
      });
    };

    randomizeKineticField(KINETIC_MODES[kineticModeIdx].id);

    // Shared active VideoTexture
    const video = document.createElement('video');
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';
    video.preload = 'auto';

    const videoTex = new THREE.VideoTexture(video);
    videoTex.minFilter = THREE.LinearFilter;
    videoTex.magFilter = THREE.LinearFilter;
    videoTex.colorSpace = THREE.SRGBColorSpace;

    const texLoader = new THREE.TextureLoader();
    const spacing = 9.8;
    const screenGroups = [];
    const keyframeDiamonds = [];

    const layoutScreen = (sg, aspect, animateResize = false) => {
      const { w, h } = computeScreenDimensions(aspect);
      const dur = animateResize ? 0.45 : 0;

      if (animateResize) {
        gsap.to(sg.screen.scale, { x: w, y: h, z: 1, duration: dur, ease: 'power2.out' });
        gsap.to(sg.border.scale, { x: w + 0.36, y: h + 0.36, z: 1, duration: dur, ease: 'power2.out' });
        gsap.to(sg.bezel.scale, { x: w + 0.28, y: h + 0.3, z: 1, duration: dur, ease: 'power2.out' });
        sg.diamonds.forEach((d, k) => {
          gsap.to(d.position, {
            x: (k === 0 ? -1 : 1) * (w / 2 + 0.72),
            y: k === 0 ? h * 0.36 : -h * 0.34,
            duration: dur,
            ease: 'power2.out',
          });
        });
      } else {
        sg.screen.scale.set(w, h, 1);
        sg.border.scale.set(w + 0.36, h + 0.36, 1);
        sg.bezel.scale.set(w + 0.28, h + 0.3, 1);
        sg.diamonds.forEach((d, k) => {
          d.position.x = (k === 0 ? -1 : 1) * (w / 2 + 0.72);
          d.position.y = k === 0 ? h * 0.36 : -h * 0.34;
        });
      }
    };

    motionProjects.forEach((proj, i) => {
      const group = new THREE.Group();
      group.position.set(i * spacing, 2.35, 0);
      const groupDiamonds = [];

      const bezel = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 0.24),
        new THREE.MeshStandardMaterial({ color: 0x12141d, metalness: 0.85, roughness: 0.22 })
      );
      group.add(bezel);

      const borderMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(proj.accentColor || '#ff6b00'),
        transparent: true,
        opacity: 0.85,
      });
      const border = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.14), borderMat);
      border.position.z = -0.02;
      group.add(border);

      const screenMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const posterTex = texLoader.load(proj.poster, (loadedTex) => {
        const img = loadedTex.image;
        if (img?.width && img?.height) {
          const aspect = img.width / img.height;
          sg.posterAspect = aspect;
          if (activeIdxRef.current !== i || !video.videoWidth) {
            layoutScreen(sg, aspect, false);
          }
        }
      });
      posterTex.colorSpace = THREE.SRGBColorSpace;
      screenMat.map = posterTex;

      const screen = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), screenMat);
      screen.position.z = 0.13;
      group.add(screen);

      [-4.0, 4.0].forEach((kx, kIdx) => {
        const diamond = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.26, 0),
          new THREE.MeshStandardMaterial({
            color: new THREE.Color(proj.accentColor || '#ff6b00'),
            emissive: new THREE.Color(proj.accentColor || '#ff6b00'),
            emissiveIntensity: 0.8,
            roughness: 0.2,
            metalness: 0.6,
          })
        );
        diamond.position.set(kx, kIdx === 0 ? 1.8 : -1.6, 0.55);
        group.add(diamond);
        keyframeDiamonds.push(diamond);
        groupDiamonds.push(diamond);
      });

      const tick = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.22, 0),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(proj.accentColor || '#ff6b00') })
      );
      tick.position.set(0, -4.25, 1.2);
      group.add(tick);

      const sg = {
        group,
        screenMat,
        posterTex,
        posterAspect: 9 / 16,
        borderMat,
        proj,
        screen,
        border,
        bezel,
        diamonds: groupDiamonds,
      };
      layoutScreen(sg, 9 / 16, false);

      scene.add(group);
      screenGroups.push(sg);
    });

    const onLoadedMetadata = () => {
      if (!video.videoWidth || !video.videoHeight) return;
      const vAspect = video.videoWidth / video.videoHeight;
      const curSg = screenGroups[activeIdxRef.current];
      if (curSg) {
        layoutScreen(curSg, vAspect, true);
      }
      const label =
        vAspect < 0.85
          ? `9:16 VERTICAL (${video.videoWidth}×${video.videoHeight})`
          : vAspect > 1.2
            ? `16:9 WIDESCREEN (${video.videoWidth}×${video.videoHeight})`
            : `1:1 SQUARE (${video.videoWidth}×${video.videoHeight})`;
      setAspectBadge(label);
    };
    video.addEventListener('loadedmetadata', onLoadedMetadata);

    const cameraTarget = { x: 0, y: 2.1, z: 0 };

    const updateState = (idx, clipSrc) => {
      const targetX = idx * spacing;
      const proj = motionProjects[idx];
      const col = new THREE.Color(proj.accentColor || '#ff6b00');
      accentLight.color.copy(col);
      railMat.color.copy(col);
      kineticItems.forEach((it) => {
        it.mat.uniforms.uAccent.value.copy(col);
      });

      gsap.to(camera.position, {
        x: targetX,
        y: 2.4,
        z: 13.2,
        duration: 1.05,
        ease: 'power3.out',
      });
      gsap.to(cameraTarget, {
        x: targetX,
        y: 2.1,
        z: 0,
        duration: 1.05,
        ease: 'power3.out',
      });
      gsap.to(accentLight.position, {
        x: targetX,
        duration: 1.05,
        ease: 'power3.out',
      });

      screenGroups.forEach((sg, i) => {
        const isActive = i === idx;
        gsap.to(sg.group.scale, {
          x: isActive ? 1.04 : 0.84,
          y: isActive ? 1.04 : 0.84,
          z: isActive ? 1.04 : 0.84,
          duration: 0.7,
          ease: 'power2.out',
        });
        gsap.to(sg.group.rotation, {
          y: isActive ? 0 : i < idx ? 0.28 : -0.28,
          duration: 0.8,
          ease: 'power2.out',
        });
        sg.borderMat.opacity = isActive ? 1.0 : 0.25;
        sg.screenMat.map = isActive ? videoTex : sg.posterTex;
        sg.screenMat.needsUpdate = true;

        if (!isActive && sg.posterAspect) {
          layoutScreen(sg, sg.posterAspect, true);
        }
      });

      if (clipSrc && video.getAttribute('data-src') !== clipSrc) {
        video.setAttribute('data-src', clipSrc);
        video.src = clipSrc;
        video.currentTime = 0;
        video.play().catch(() => {});
      }
    };

    apiRef.current = { updateState, randomizeKineticField };

    // Cursor tracking + 3D ray unprojection for SYSTEM32 kinetic field
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2(99, 99);
    const prevPointerNdc = new THREE.Vector2(99, 99);
    let pointerActive = false;
    let pointerVelX = 0;
    let pointerVelY = 0;
    let burstWave = { active: false, ndcX: 0, ndcY: 0 };

    let mouseX = 0;
    let mouseY = 0;

    const onMove = (e) => {
      const rect = host.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      mouseX = nx;
      mouseY = -ny;

      if (pointerActive) {
        pointerVelX = nx - prevPointerNdc.x;
        pointerVelY = ny - prevPointerNdc.y;
      }
      prevPointerNdc.set(nx, ny);
      pointerNdc.set(nx, ny);
      pointerActive = true;
    };

    const onLeave = () => {
      pointerActive = false;
      pointerVelX = 0;
      pointerVelY = 0;
    };

    const onPointerUp = (e) => {
      if (e.pointerType && e.pointerType !== 'mouse') {
        onLeave();
      }
    };

    const onDown = (e) => {
      if (e.target?.closest?.('button, a')) return;
      const rect = host.getBoundingClientRect();
      burstWave = {
        active: true,
        ndcX: ((e.clientX - rect.left) / rect.width) * 2 - 1,
        ndcY: -((e.clientY - rect.top) / rect.height) * 2 + 1,
      };
    };

    const onResize = () => {
      if (!host) return;
      camera.aspect = host.clientWidth / host.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(host.clientWidth, host.clientHeight);
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('pointerup', onPointerUp, { passive: true });
    document.addEventListener('pointerleave', onLeave);
    window.addEventListener('blur', onLeave);
    window.addEventListener('resize', onResize);

    const clock = new THREE.Clock();
    let prevTime = 0;
    let rafId = 0;
    const burstRay = new THREE.Raycaster();

    const animate = () => {
      rafId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();
      const dt = Math.min(elapsed - prevTime, 0.05);
      prevTime = elapsed;
      const f = dt * 60.0;

      keyframeDiamonds.forEach((d, idx) => {
        d.rotation.y = elapsed * 1.4 + idx;
        d.rotation.x = elapsed * 0.8;
      });

      screenGroups.forEach((sg, i) => {
        sg.group.position.y = 2.35 + Math.sin(elapsed * 1.1 + i * 1.4) * 0.11;
      });

      camera.lookAt(
        cameraTarget.x + mouseX * 0.55,
        cameraTarget.y - mouseY * 0.32,
        cameraTarget.z
      );
      camera.updateMatrixWorld();

      if (pointerActive) {
        raycaster.setFromCamera(pointerNdc, camera);
      }
      const doBurst = burstWave.active;
      if (doBurst) {
        burstRay.setFromCamera(new THREE.Vector2(burstWave.ndcX, burstWave.ndcY), camera);
        burstWave.active = false;
      }

      const pointerSpeed = Math.min(Math.hypot(pointerVelX, pointerVelY) * 28.0, 2.2);
      pointerVelX *= 0.86;
      pointerVelY *= 0.86;

      const camX = camera.position.x;
      const halfWrap = WRAP_W * 0.5;
      const damp = Math.pow(0.88, f);
      const spring = 0.055 * f;

      for (let i = 0; i < kineticItems.length; i++) {
        const it = kineticItems[i];
        const tAnim = it.stepQuant > 0
          ? Math.floor(elapsed * it.stepQuant) / it.stepQuant
          : elapsed;

        let targetX = 0;
        let targetY = it.baseY;
        let targetRotZ = it.baseRotZ;

        if (it.mode === 'vortex') {
          const ang = elapsed * it.orbitSpd + it.phase;
          targetX = camX + Math.cos(ang) * it.orbitR * 1.45;
          targetY = 2.25 + Math.sin(ang) * it.orbitR * 0.62;
          targetRotZ = ang + Math.PI * 0.5;
        } else {
          // Seamless wraparound relative to camera.position.x with depth parallax
          const parallax = 0.38 * camX;
          const rawX = it.localX + elapsed * it.speedX - parallax;
          const wrapped = ((((rawX + halfWrap) % WRAP_W) + WRAP_W) % WRAP_W) - halfWrap;
          targetX = camX + wrapped;

          if (it.mode === 'diagonal') {
            const rawY = it.baseY + elapsed * it.speedY + 4.2;
            targetY = ((((rawY) % 14.5) + 14.5) % 14.5) - 4.2;
          } else {
            targetY = it.baseY + Math.sin(tAnim * it.freq + it.phase) * it.ampY;
          }
        }

        const wx = targetX + it.dx;
        const wy = targetY + it.dy;
        const wz = it.baseZ + it.dz;

        // Cursor Magnetic Repulsion + Vortex Swirl + Kinetic Stretch
        let hitEnergy = 0;
        if (pointerActive && Math.abs(raycaster.ray.direction.z) > 0.01) {
          const tRay = (wz - raycaster.ray.origin.z) / raycaster.ray.direction.z;
          const cx = raycaster.ray.origin.x + raycaster.ray.direction.x * tRay;
          const cy = raycaster.ray.origin.y + raycaster.ray.direction.y * tRay;

          const rx = wx - cx;
          const ry = wy - cy;
          const radius = 4.6 + pointerSpeed * 1.1;
          const distSq = rx * rx + ry * ry;

          if (distSq < radius * radius) {
            const dist = Math.sqrt(distSq) + 0.001;
            const falloff = 1.0 - dist / radius;
            const force = falloff * falloff * (0.22 + pointerSpeed * 0.14) * f;
            const nx = rx / dist;
            const ny = ry / dist;

            // Radial push + velocity drag + subtle vortex curl
            it.vx += (nx * force) + pointerVelX * 3.8 * falloff * f - ny * force * 0.35;
            it.vy += (ny * force) + pointerVelY * 3.8 * falloff * f + nx * force * 0.35;
            it.vz += falloff * 0.09 * f;
            it.vRotZ += (pointerVelX * 1.8 - nx * 0.06) * falloff * f;
            it.shear += (pointerVelX * 16.0 - it.shear) * 0.32;
            hitEnergy = falloff;
          }
        }

        if (doBurst && Math.abs(burstRay.ray.direction.z) > 0.01) {
          const tB = (wz - burstRay.ray.origin.z) / burstRay.ray.direction.z;
          const bx = burstRay.ray.origin.x + burstRay.ray.direction.x * tB;
          const by = burstRay.ray.origin.y + burstRay.ray.direction.y * tB;
          const ex = wx - bx;
          const ey = wy - by;
          const bRad = 9.0;
          const e2 = ex * ex + ey * ey;
          if (e2 < bRad * bRad) {
            const ed = Math.sqrt(e2) + 0.001;
            const bf = (1.0 - ed / bRad) * 0.85;
            it.vx += (ex / ed) * bf;
            it.vy += (ey / ed) * bf;
            it.vz += bf * 0.6;
            it.vRotZ += (Math.random() - 0.5) * bf * 0.6;
            hitEnergy = Math.max(hitEnergy, 1.0);
          }
        }

        // Spring back cleanly to kinetic path when cursor moves away
        it.vx += -it.dx * spring;
        it.vy += -it.dy * spring;
        it.vz += -it.dz * spring;
        it.vRotZ += -it.rotZ * spring * 1.1;

        it.vx *= damp;
        it.vy *= damp;
        it.vz *= damp;
        it.vRotZ *= damp;
        it.shear *= Math.pow(0.86, f);

        it.dx += it.vx * f;
        it.dy += it.vy * f;
        it.dz += it.vz * f;
        it.rotZ += it.vRotZ * f;

        const dispMag = Math.min(Math.hypot(it.dx, it.dy, it.dz) * 0.55, 1.0);
        const targetEnergy = Math.max(hitEnergy, dispMag);
        it.energy += (targetEnergy - it.energy) * 0.22;

        const pulseScale =
          it.stepQuant > 0
            ? 1.0 + Math.sin(tAnim * 3.0 + it.phase) * 0.08
            : 1.0;
        const stretchX = it.baseScale * pulseScale * (1.0 + it.energy * 0.28);
        const stretchY = it.baseScale * pulseScale * (1.0 + it.energy * 0.14);

        it.mesh.position.set(targetX + it.dx, targetY + it.dy, it.baseZ + it.dz);
        it.mesh.rotation.set(it.dy * 0.08, -it.dx * 0.08, targetRotZ + it.rotZ);
        it.mesh.scale.set(stretchX, stretchY, 1);

        it.mat.uniforms.uTime.value = elapsed;
        it.mat.uniforms.uEnergy.value = it.energy;
        it.mat.uniforms.uShear.value = it.shear;
      }

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onPointerUp);
      document.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('blur', onLeave);
      window.removeEventListener('resize', onResize);
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.pause();
      video.src = '';
      videoTex.dispose();
      sharedWordGeo.dispose();
      atlasTex.dispose();
      kineticItems.forEach((it) => it.mat.dispose());
      renderer.dispose();
      if (renderer.domElement.parentNode === host) {
        host.removeChild(renderer.domElement);
      }
    };
  }, [motionProjects]);

  useEffect(() => {
    apiRef.current?.updateState(activeIdx, activeClipSrc);
  }, [activeIdx, activeClipSrc]);

  const handleShuffleKinetic = () => {
    setKineticModeIdx((prev) => {
      const next = (prev + 1) % KINETIC_MODES.length;
      apiRef.current?.randomizeKineticField(KINETIC_MODES[next].id);
      return next;
    });
  };

  const safeClipNum = (clipIdx % Math.max(1, clips.length)) + 1;
  const activeKineticMode = KINETIC_MODES[kineticModeIdx];

  return (
    <div className="world-viewport" style={{ '--world-accent': worldMeta.accent }}>
      <div ref={canvasHostRef} className="world-canvas-host" />

      <div className="world-hud-layer">
        <div className="world-hud-top">
          <div className="world-header-card">
            <div className="world-kicker">WORLD 02 // {t.motionTimeline}</div>
            <h1 className="world-heading">{worldMeta.name[lang]}</h1>
            <p className="world-desc">{worldMeta.tagline[lang]}</p>
          </div>

          <div className="world-controls-cluster">
            <div className="cam-presets" style={{ gap: 6 }}>
              <button
                type="button"
                className="cam-btn"
                onClick={handleShuffleKinetic}
                title={
                  lang === 'es'
                    ? 'Cambiar patrón aleatorio de tipografía cinética SYSTEM32'
                    : 'Shuffle random SYSTEM32 kinetic typography mode'
                }
              >
                <Shuffle size={11} style={{ display: 'inline', marginRight: 5 }} />
                SYSTEM32: {activeKineticMode.label[lang]}
              </button>

              {clips.length > 1 && (
                <>
                  <button
                    type="button"
                    className="cam-btn"
                    onClick={() => setClipIdx((c) => (c - 1 + clips.length) % clips.length)}
                  >
                    <SkipBack size={11} />
                  </button>
                  <button
                    type="button"
                    className={`cam-btn ${autopilot ? 'active' : ''}`}
                    onClick={() => setAutopilot((a) => !a)}
                  >
                    {autopilot ? (
                      <Pause size={10} style={{ display: 'inline', marginRight: 5 }} />
                    ) : (
                      <Play size={10} style={{ display: 'inline', marginRight: 5 }} />
                    )}
                    CLIP {String(safeClipNum).padStart(2, '0')}/{String(clips.length).padStart(2, '0')}
                  </button>
                  <button
                    type="button"
                    className="cam-btn"
                    onClick={() => setClipIdx((c) => (c + 1) % clips.length)}
                  >
                    <SkipForward size={11} />
                  </button>
                </>
              )}
            </div>
            <div className="telemetry-chip">
              NATIVE RATIO // {aspectBadge}
            </div>
          </div>
        </div>

        <div className="world-bottom-dock">
          <div className="active-project-bar">
            <div className="active-project-info">
              <div className="active-project-meta">
                <span>
                  COMP {String(activeIdx + 1).padStart(2, '0')} /{' '}
                  {String(motionProjects.length).padStart(2, '0')}
                </span>
                <span>•</span>
                <span>{activeProject.year}</span>
                <span>•</span>
                <span>{activeProject.role[lang]}</span>
              </div>
              <div className="active-project-title">{activeProject.title}</div>
              <div className="active-project-summary">{activeProject.summary[lang]}</div>
            </div>

            <button
              type="button"
              className="hud-btn primary"
              style={{ '--accent': worldMeta.accent }}
              onClick={() => onInspectProject(activeProject)}
            >
              <Expand size={13} />
              <span>{t.inspectProject}</span>
            </button>
          </div>

          <div className="channel-strip">
            {motionProjects.map((proj, idx) => (
              <button
                key={proj.id}
                type="button"
                className={`channel-card ${idx === activeIdx ? 'active' : ''}`}
                onClick={() => setActiveIdx(idx)}
              >
                <img className="channel-thumb" src={proj.poster} alt={proj.title} />
                <div className="channel-text">
                  <div className="channel-ch">
                    <Film size={9} style={{ display: 'inline', marginRight: 4 }} />
                    COMP {String(idx + 1).padStart(2, '0')} · {proj.totalClips} CLIP
                    {proj.totalClips > 1 ? 'S' : ''}
                  </div>
                  <div className="channel-name">{proj.title}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
