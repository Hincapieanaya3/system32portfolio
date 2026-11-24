import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import gsap from 'gsap';
import {
  Expand,
  Grid,
  Layers,
  Pause,
  Play,
  Radio,
  SkipBack,
  SkipForward,
  Video,
} from 'lucide-react';
import { PROJECTS, UI_TEXT, WORLDS } from '../../data/portfolioData';
import { getStageEngineeringSpec, STAGE_ENGINEERING } from '../../data/stageEngineering';
import { assetUrl } from '../../utils/assetUrl';
import SliceMonitor2D, { BuildScrubberDock } from '../SliceMonitor2D';

const BEAM_VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const BEAM_FRAG = `
uniform vec3 uColor;
uniform float uOpacity;
varying vec2 vUv;
void main() {
  float verticalFade = smoothstep(0.0, 0.85, vUv.y) * smoothstep(1.0, 0.82, vUv.y);
  float edgeSoft = sin(vUv.x * 3.14159265);
  float alpha = verticalFade * (0.35 + 0.65 * edgeSoft) * uOpacity;
  gl_FragColor = vec4(uColor, alpha);
}
`;

const SOPHII_WALL_FRAG = `
precision highp float;
uniform sampler2D uMap;
uniform vec3 uRimColor;
uniform float uAlpha;
varying vec2 vUv;

void main() {
  float u = vUv.x;
  float v = vUv.y;

  bool stepCut = (u < (5.5 / 29.0) || u > (23.5 / 29.0)) && (v > (3.5 / 5.0));
  bool doorL = (u > (8.0 / 29.0) && u < (9.5 / 29.0)) && (v < (2.5 / 5.0));
  bool doorR = (u > (19.5 / 29.0) && u < (21.0 / 29.0)) && (v < (2.5 / 5.0));

  if (stepCut || doorL || doorR) discard;

  vec3 col = texture2D(uMap, vUv).rgb;

  float topEdge = ((u < 5.5 / 29.0 || u > 23.5 / 29.0)
    ? smoothstep(0.685, 0.70, v)
    : smoothstep(0.982, 1.0, v));
  float doorEdgeL = (v < 0.508)
    ? (smoothstep(0.012, 0.0, abs(u - 8.0 / 29.0)) + smoothstep(0.012, 0.0, abs(u - 9.5 / 29.0)))
    : 0.0;
  float doorEdgeR = (v < 0.508)
    ? (smoothstep(0.012, 0.0, abs(u - 19.5 / 29.0)) + smoothstep(0.012, 0.0, abs(u - 21.0 / 29.0)))
    : 0.0;

  col += uRimColor * clamp(topEdge + (doorEdgeL + doorEdgeR) * 0.45, 0.0, 1.0) * 0.65;
  gl_FragColor = vec4(col, uAlpha);
}
`;

const AUTOPILOT_INTERVAL_MS = 6500;
const AUTOBUILD_INTERVAL_MS = 3800;

function createSlicedPlane(width3D, height3D, pxX, pxY, pxW, pxH, compW, compH) {
  const geo = new THREE.PlaneGeometry(width3D, height3D);
  const uv = geo.attributes.uv;
  const u0 = pxX / compW;
  const u1 = (pxX + pxW) / compW;
  const v1 = 1.0 - pxY / compH;
  const v0 = 1.0 - (pxY + pxH) / compH;

  uv.setXY(0, u0, v1);
  uv.setXY(1, u1, v1);
  uv.setXY(2, u0, v0);
  uv.setXY(3, u1, v0);
  uv.needsUpdate = true;
  return geo;
}

function makeWireBox(w, h, d, colorHex) {
  const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d));
  const mat = new THREE.LineBasicMaterial({
    color: new THREE.Color(colorHex),
    transparent: true,
    opacity: 0.0,
  });
  return { line: new THREE.LineSegments(edges, mat), mat };
}

function buildProjectPlaylist(proj, manifest) {
  if (proj.multiZoneScenes?.length) {
    return proj.multiZoneScenes.map((z) => ({
      type: 'multizone',
      src: z.central,
      cenefa: z.cenefa,
      lateral: z.lateral,
      label: z.label,
    }));
  }

  const list = [];
  const seen = new Set();
  const pushItem = (item) => {
    if (!item?.src || item.type === 'youtube' || seen.has(item.src)) return;
    if (item.src.includes('/media/pixelmaps/')) return;
    seen.add(item.src);
    list.push(item);
  };

  if (proj.stagePlaylist?.length) {
    proj.stagePlaylist.forEach(pushItem);
  }
  if (proj.gallery?.length) {
    const vids = proj.gallery.filter((g) => g.type === 'video');
    if (!proj.stagePlaylist?.length) {
      (vids.length ? vids : proj.gallery).forEach(pushItem);
    }
  }
  if (proj.behanceSlug && manifest?.behance?.[proj.behanceSlug]?.gallery?.length) {
    manifest.behance[proj.behanceSlug].gallery.forEach(pushItem);
  }
  if (!list.length && proj.preview) {
    pushItem({ type: 'video', src: proj.preview });
  }
  if (!list.length && proj.poster) {
    pushItem({ type: 'image', src: proj.poster });
  }
  return list;
}

export default function StageWorld({ lang, manifest, onInspectProject }) {
  const t = UI_TEXT[lang];
  const worldMeta = WORLDS.find((w) => w.id === 'stage');
  const stageProjects = useMemo(() => PROJECTS.filter((p) => p.world === 'stage'), []);

  const [activeIdx, setActiveIdx] = useState(0);
  const [clipIdx, setClipIdx] = useState(0);
  const [cenefaIdx, setCenefaIdx] = useState(0);
  const [autopilot, setAutopilot] = useState(true);
  const [camPreset, setCamPreset] = useState('wide');
  const [showPixelmap, setShowPixelmap] = useState(false);

  // Stage Construction / Engineering Mode (#1 Exploded 4-Phase Build + #2 2D<->3D Slice Monitor)
  const [buildOpen, setBuildOpen] = useState(false);
  const [buildPhase, setBuildPhase] = useState(4); // 1=CAD Exploded, 2=Pixelmap Slices, 3=Rig & Beams, 4=Live Show
  const [autoBuild, setAutoBuild] = useState(false);
  const [hoveredSlice, setHoveredSlice] = useState(null);

  const activeProject = stageProjects[activeIdx];
  const activeRigKey = activeProject.stageRig || 'festival-wide';
  const engSpec = useMemo(() => getStageEngineeringSpec(activeProject), [activeProject]);

  const playlist = useMemo(
    () => buildProjectPlaylist(activeProject, manifest),
    [activeProject, manifest]
  );
  const currentClip = playlist[clipIdx % Math.max(1, playlist.length)] || playlist[0];

  const cenefaList = activeProject.cenefaPlaylist?.length
    ? activeProject.cenefaPlaylist
    : activeProject.cenefaVideo
      ? [activeProject.cenefaVideo]
      : [];
  const currentCenefaSrc = cenefaList.length
    ? cenefaList[cenefaIdx % cenefaList.length]
    : null;

  const canvasHostRef = useRef(null);
  const labelElsRef = useRef({});
  const sceneApiRef = useRef(null);
  const hoveredSliceRef = useRef(null);
  const setHoveredSliceRef = useRef(setHoveredSlice);
  const buildStateRef = useRef({ open: false, phase: 4, rigKey: activeRigKey });

  useEffect(() => {
    hoveredSliceRef.current = hoveredSlice;
  }, [hoveredSlice]);

  useEffect(() => {
    setHoveredSliceRef.current = setHoveredSlice;
  }, []);

  useEffect(() => {
    buildStateRef.current = { open: buildOpen, phase: buildPhase, rigKey: activeRigKey };
  }, [buildOpen, buildPhase, activeRigKey]);

  // Reset clip index & hovered slice when switching projects; if new project has no pixelmap spec, exit build mode
  useEffect(() => {
    setClipIdx(0);
    setCenefaIdx(0);
    setHoveredSlice(null);
    if (!STAGE_ENGINEERING[activeProject.stageRig]) {
      setBuildOpen(false);
      setBuildPhase(4);
      setAutoBuild(false);
    }
  }, [activeIdx, activeProject.stageRig]);

  // Auto-Build stepper timer (01 -> 02 -> 03 -> 04 -> loop)
  useEffect(() => {
    if (!buildOpen || !autoBuild) return undefined;
    const id = window.setInterval(() => {
      setBuildPhase((p) => (p >= 4 ? 1 : p + 1));
    }, AUTOBUILD_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [buildOpen, autoBuild]);

  // Effective pixelmap state: either manual PIXELMAP button OR Build Phases 1, 2, 3
  const effectivePixelmap = showPixelmap || (buildOpen && buildPhase < 4);

  // Resolume-style Autopilot auto-cycling (only during Live Show phase)
  useEffect(() => {
    if (!autopilot || effectivePixelmap || playlist.length <= 1) return undefined;
    const timer = window.setInterval(() => {
      setClipIdx((prev) => (prev + 1) % playlist.length);
    }, AUTOPILOT_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [autopilot, effectivePixelmap, playlist.length, activeIdx]);

  useEffect(() => {
    if (!autopilot || effectivePixelmap || cenefaList.length <= 1) return undefined;
    const timer = window.setInterval(() => {
      setCenefaIdx((prev) => (prev + 1) % cenefaList.length);
    }, AUTOPILOT_INTERVAL_MS + 1500);
    return () => window.clearInterval(timer);
  }, [autopilot, effectivePixelmap, cenefaList.length, activeIdx]);

  useEffect(() => {
    const host = canvasHostRef.current;
    if (!host) return undefined;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const bgConcert = new THREE.Color(0x04050a);
    const bgCad = new THREE.Color(0x030b17);
    scene.background = bgConcert.clone();
    scene.fog = new THREE.FogExp2(0x05060d, 0.02);

    const camera = new THREE.PerspectiveCamera(46, host.clientWidth / host.clientHeight, 0.1, 180);
    camera.position.set(0, 4.8, 20.5);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.target.set(0, 4.3, -2.5);
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.minDistance = 8;
    controls.maxDistance = 42;
    controls.enablePan = false;

    // Stage Atmosphere Lights + CAD Inspection Light
    const ambientLight = new THREE.AmbientLight(0x2a2f4a, 0.95);
    scene.add(ambientLight);

    const cadHemiLight = new THREE.HemisphereLight(0x8be9fd, 0x0b192c, 0.0);
    scene.add(cadHemiLight);

    const keyLight = new THREE.PointLight(0x006eff, 38, 40);
    keyLight.position.set(-8, 9, 5);
    scene.add(keyLight);

    const fillLight = new THREE.PointLight(0x00f0ff, 38, 40);
    fillLight.position.set(8, 9, 5);
    scene.add(fillLight);

    const screenBounce = new THREE.PointLight(0x006eff, 32, 32);
    screenBounce.position.set(0, 5.2, 2.5);
    scene.add(screenBounce);

    // Reflective Festival Floor & Perspective Grids (Concert + CAD Blueprint)
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(100, 100),
      new THREE.MeshStandardMaterial({ color: 0x070910, roughness: 0.26, metalness: 0.74 })
    );
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    const grid = new THREE.GridHelper(64, 44, 0x222944, 0x101424);
    grid.position.y = 0.01;
    scene.add(grid);

    const cadGrid = new THREE.GridHelper(64, 64, 0x00f0ff, 0x0a3254);
    cadGrid.position.y = 0.025;
    cadGrid.visible = false;
    scene.add(cadGrid);

    // Common Stage Platform + DJ/VJ Console + Subwoofers
    const deckMat = new THREE.MeshStandardMaterial({ color: 0x10131e, roughness: 0.35, metalness: 0.8 });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(20, 1.15, 9), deckMat);
    deck.position.set(0, 0.575, -3);
    scene.add(deck);

    const edgeMat = new THREE.MeshBasicMaterial({ color: 0x006eff });
    const edgeStrip = new THREE.Mesh(new THREE.BoxGeometry(20.06, 0.1, 0.12), edgeMat);
    edgeStrip.position.set(0, 1.14, 1.52);
    scene.add(edgeStrip);

    const booth = new THREE.Mesh(
      new THREE.BoxGeometry(3.6, 1.2, 1.25),
      new THREE.MeshStandardMaterial({ color: 0x141824, roughness: 0.3, metalness: 0.85 })
    );
    booth.position.set(0, 1.75, 0.2);
    scene.add(booth);

    const boothLedMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const boothLed = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.82), boothLedMat);
    boothLed.position.set(0, 1.75, 0.84);
    scene.add(boothLed);

    const subMat = new THREE.MeshStandardMaterial({ color: 0x0c0e16, roughness: 0.5, metalness: 0.6 });
    [-8.6, 8.6].forEach((x) => {
      for (let i = 0; i < 3; i++) {
        const sub = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.96, 1.4), subMat);
        sub.position.set(x, 0.48 + i * 0.98, 1.6);
        scene.add(sub);
      }
    });

    // Shared Video Elements + Textures
    const mainVideo = document.createElement('video');
    mainVideo.loop = true;
    mainVideo.muted = true;
    mainVideo.playsInline = true;
    mainVideo.crossOrigin = 'anonymous';
    mainVideo.preload = 'auto';

    const mainVideoTex = new THREE.VideoTexture(mainVideo);
    mainVideoTex.minFilter = THREE.LinearFilter;
    mainVideoTex.magFilter = THREE.LinearFilter;
    mainVideoTex.colorSpace = THREE.SRGBColorSpace;

    const cenefaVideo = document.createElement('video');
    cenefaVideo.loop = true;
    cenefaVideo.muted = true;
    cenefaVideo.playsInline = true;
    cenefaVideo.crossOrigin = 'anonymous';
    cenefaVideo.preload = 'auto';

    const cenefaVideoTex = new THREE.VideoTexture(cenefaVideo);
    cenefaVideoTex.minFilter = THREE.LinearFilter;
    cenefaVideoTex.magFilter = THREE.LinearFilter;
    cenefaVideoTex.colorSpace = THREE.SRGBColorSpace;

    const lateralVideo = document.createElement('video');
    lateralVideo.loop = true;
    lateralVideo.muted = true;
    lateralVideo.playsInline = true;
    lateralVideo.crossOrigin = 'anonymous';
    lateralVideo.preload = 'auto';

    const lateralVideoTex = new THREE.VideoTexture(lateralVideo);
    lateralVideoTex.minFilter = THREE.LinearFilter;
    lateralVideoTex.magFilter = THREE.LinearFilter;
    lateralVideoTex.colorSpace = THREE.SRGBColorSpace;

    const texLoader = new THREE.TextureLoader();
    const imageTexCache = new Map();
    const getImageTexture = (url) => {
      if (imageTexCache.has(url)) return imageTexCache.get(url);
      const tex = texLoader.load(url);
      tex.colorSpace = THREE.SRGBColorSpace;
      imageTexCache.set(url, tex);
      return tex;
    };

    // Preload all project pixelmap textures
    [
      assetUrl('/media/pixelmaps/peterblue-pxmap.jpg'),
      assetUrl('/media/pixelmaps/albafranch-pxmap.png'),
      assetUrl('/media/pixelmaps/castrii-pxmap.png'),
      assetUrl('/media/pixelmaps/semana-pxmap.jpg'),
      assetUrl('/media/pixelmaps/sophii-pxmap.jpg'),
    ].forEach((url) => getImageTexture(url));

    const trussMat = new THREE.MeshStandardMaterial({
      color: 0x3b4764,
      roughness: 0.4,
      metalness: 0.9,
      wireframe: true,
    });
    const cabinetMat = new THREE.MeshStandardMaterial({
      color: 0x0a0d14,
      roughness: 0.3,
      metalness: 0.88,
    });

    const mainScreenMat = new THREE.MeshBasicMaterial({
      map: mainVideoTex,
      color: 0xffffff,
      transparent: true,
      opacity: 1,
    });
    const crossScreenMat = new THREE.MeshBasicMaterial({
      map: mainVideoTex,
      color: 0xffffff,
      transparent: true,
      opacity: 1,
    });
    const semanaMainMat = new THREE.MeshBasicMaterial({
      map: mainVideoTex,
      color: 0xffffff,
      transparent: true,
      opacity: 1,
    });
    const semanaLateralMat = new THREE.MeshBasicMaterial({
      map: lateralVideoTex,
      color: 0xffffff,
      transparent: true,
      opacity: 1,
    });
    const semanaCenefaMat = new THREE.MeshBasicMaterial({
      map: cenefaVideoTex,
      color: 0xffffff,
      transparent: true,
      opacity: 1,
    });
    const semanaPxMat = new THREE.MeshBasicMaterial({
      map: getImageTexture(assetUrl('/media/pixelmaps/semana-pxmap.jpg')),
      transparent: true,
      opacity: 1,
    });
    const rigRimMat = new THREE.MeshBasicMaterial({ color: 0x006eff });

    // Registries for Exploded View parts, CAD Leader Lines, Pickable 3D Slices & Highlight Boxes
    const explodeParts = [];
    const explodeLeaders = [];
    const pickableMeshes = [];
    const sliceHighlights = {};

    const registerExplode = (rig, obj, base, exp, leaderColor = null, localOffset = [0, 0, 0]) => {
      obj.position.set(base[0], base[1], base[2]);
      explodeParts.push({ rig, obj, base, exp });

      if (leaderColor) {
        const pts = new Float32Array(6);
        const lGeo = new THREE.BufferGeometry();
        lGeo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
        const lMat = new THREE.LineDashedMaterial({
          color: new THREE.Color(leaderColor),
          dashSize: 0.34,
          gapSize: 0.18,
          transparent: true,
          opacity: 0.62,
          depthWrite: false,
        });
        const lMesh = new THREE.Line(lGeo, lMat);
        lMesh.visible = false;
        scene.add(lMesh);
        explodeLeaders.push({ rig, obj, base, localOffset, lMesh, lGeo });
      }
    };

    const registerPickable = (rig, sliceId, mesh) => {
      mesh.userData.rig = rig;
      mesh.userData.sliceId = sliceId;
      pickableMeshes.push(mesh);
    };

    const attachSliceHighlight = (rig, sliceId, parent, w, h, d, colorHex, localAnchor = [0, 0, 0]) => {
      const { line, mat } = makeWireBox(w, h, d, colorHex);
      parent.add(line);

      const glowMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(colorHex),
        transparent: true,
        opacity: 0.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const glowMesh = new THREE.Mesh(new THREE.PlaneGeometry(Math.max(0.2, w - 0.12), Math.max(0.2, h - 0.12)), glowMat);
      glowMesh.position.z = d * 0.52;
      parent.add(glowMesh);

      const anchor = new THREE.Object3D();
      anchor.position.set(localAnchor[0], localAnchor[1], localAnchor[2]);
      parent.add(anchor);
      sliceHighlights[sliceId] = { line, mat, glowMat, rig, anchor };
    };

    // =========================================================================
    // RIG 1: SONAR PARK 1:1 SQUARE MONOLITH (1024 x 1024)
    // =========================================================================
    const rigSonar = new THREE.Group();
    const sqSize = 8.1;

    const sqCabinetGrp = new THREE.Group();
    sqCabinetGrp.add(new THREE.Mesh(new THREE.BoxGeometry(sqSize + 0.45, sqSize + 0.45, 0.45), cabinetMat));
    const sqRim = new THREE.Mesh(new THREE.BoxGeometry(sqSize + 0.56, sqSize + 0.56, 0.2), rigRimMat);
    sqRim.position.z = -0.12;
    sqCabinetGrp.add(sqRim);
    registerExplode('sonar-square', sqCabinetGrp, [0, 5.75, -4.9], [0, 5.75, -6.5]);
    rigSonar.add(sqCabinetGrp);

    const sqLedGrp = new THREE.Group();
    const sqLedMesh = new THREE.Mesh(new THREE.PlaneGeometry(sqSize, sqSize), mainScreenMat);
    sqLedGrp.add(sqLedMesh);
    registerPickable('sonar-square', 'sonar-main', sqLedMesh);
    registerExplode('sonar-square', sqLedGrp, [0, 5.75, -4.66], [0, 6.0, -1.6], '#00f0ff');
    attachSliceHighlight('sonar-square', 'sonar-main', sqLedGrp, sqSize + 0.25, sqSize + 0.25, 0.22, '#00f0ff', [0, 0, 0.25]);
    rigSonar.add(sqLedGrp);

    [-5.4, 5.4].forEach((tx) => {
      const tGrp = new THREE.Group();
      tGrp.add(new THREE.Mesh(new THREE.BoxGeometry(0.85, 10.6, 0.85, 1, 11, 1), trussMat));
      const strobeBar = new THREE.Mesh(new THREE.BoxGeometry(0.14, 7.6, 0.14), rigRimMat);
      strobeBar.position.set(tx > 0 ? -0.55 : 0.55, -0.1, 0.5);
      tGrp.add(strobeBar);
      registerExplode('sonar-square', tGrp, [tx, 5.9, -4.7], [tx * 1.36, 5.9, -5.6]);
      rigSonar.add(tGrp);
    });

    const sonarBridge = new THREE.Mesh(new THREE.BoxGeometry(12.4, 0.8, 0.85, 12, 1, 1), trussMat);
    registerExplode('sonar-square', sonarBridge, [0, 10.9, -4.7], [0, 12.6, -5.6]);
    rigSonar.add(sonarBridge);
    scene.add(rigSonar);

    // =========================================================================
    // RIG 2: CASTRII — TECHNO CROSS PIXELMAP (1008 x 784)
    // =========================================================================
    const rigCross = new THREE.Group();
    const crossW = 14.0;
    const crossH = 10.89;
    const armThick = 1.56;
    const crossCenterY = 6.2;

    const crossChassis = new THREE.Group();
    crossChassis.add(new THREE.Mesh(new THREE.BoxGeometry(armThick + 0.28, crossH + 0.28, 0.42), cabinetMat));
    crossChassis.add(new THREE.Mesh(new THREE.BoxGeometry(crossW + 0.28, armThick + 0.28, 0.42), cabinetMat));
    const crossRimV = new THREE.Mesh(new THREE.BoxGeometry(armThick + 0.4, crossH + 0.4, 0.14), rigRimMat);
    crossRimV.position.z = -0.16;
    crossChassis.add(crossRimV);
    const crossRimH = new THREE.Mesh(new THREE.BoxGeometry(crossW + 0.4, armThick + 0.4, 0.14), rigRimMat);
    crossRimH.position.z = -0.16;
    crossChassis.add(crossRimH);
    registerExplode('techno-cross', crossChassis, [0, crossCenterY, -4.9], [0, crossCenterY, -6.8]);
    rigCross.add(crossChassis);

    const crossVertGrp = new THREE.Group();
    const crossVertMesh = new THREE.Mesh(
      createSlicedPlane(armThick, crossH, 448, 0, 112, 784, 1008, 784),
      crossScreenMat
    );
    crossVertGrp.add(crossVertMesh);
    registerPickable('techno-cross', 'cross-v', crossVertMesh);
    registerExplode('techno-cross', crossVertGrp, [0, crossCenterY, -4.67], [0, crossCenterY + 0.45, -0.8], '#ff2e55');
    attachSliceHighlight('techno-cross', 'cross-v', crossVertGrp, armThick + 0.2, crossH + 0.2, 0.2, '#ff2e55', [0, 3.6, 0.25]);
    rigCross.add(crossVertGrp);

    const crossHorzGrp = new THREE.Group();
    const crossHorzMesh = new THREE.Mesh(
      createSlicedPlane(crossW, armThick, 0, 336, 1008, 112, 1008, 784),
      crossScreenMat
    );
    crossHorzGrp.add(crossHorzMesh);
    registerPickable('techno-cross', 'cross-h', crossHorzMesh);
    registerExplode('techno-cross', crossHorzGrp, [0, crossCenterY, -4.65], [0, crossCenterY - 0.3, -2.7], '#00f0ff');
    attachSliceHighlight('techno-cross', 'cross-h', crossHorzGrp, crossW + 0.2, armThick + 0.2, 0.2, '#00f0ff', [-4.4, 0, 0.25]);
    rigCross.add(crossHorzGrp);

    [-7.5, 7.5].forEach((tx) => {
      const tCol = new THREE.Mesh(new THREE.BoxGeometry(0.8, 11.4, 0.8, 1, 11, 1), trussMat);
      registerExplode('techno-cross', tCol, [tx, 6.2, -5.2], [tx * 1.26, 6.2, -6.2]);
      rigCross.add(tCol);
    });
    const crossTopTruss = new THREE.Mesh(new THREE.BoxGeometry(16.0, 0.8, 0.8, 15, 1, 1), trussMat);
    registerExplode('techno-cross', crossTopTruss, [0, 11.6, -5.2], [0, 13.1, -6.2]);
    rigCross.add(crossTopTruss);
    rigCross.visible = false;
    scene.add(rigCross);

    // =========================================================================
    // RIG 3: SEMANA DE LA JUVENTUD — 4-SCREEN RIG (1 unit = 1m)
    // =========================================================================
    const rigSemana = new THREE.Group();

    const semCenefaGrp = new THREE.Group();
    semCenefaGrp.add(new THREE.Mesh(new THREE.BoxGeometry(12.3, 1.24, 0.35), cabinetMat));
    const cenefaRim = new THREE.Mesh(new THREE.BoxGeometry(12.42, 1.34, 0.14), rigRimMat);
    cenefaRim.position.z = -0.15;
    semCenefaGrp.add(cenefaRim);
    const cenefaLiveLed = new THREE.Mesh(new THREE.PlaneGeometry(12.0, 1.0), semanaCenefaMat);
    cenefaLiveLed.position.z = 0.19;
    semCenefaGrp.add(cenefaLiveLed);
    const cenefaPxLed = new THREE.Mesh(
      createSlicedPlane(12.0, 1.0, 0, 0, 2496, 208, 2496, 2080),
      semanaPxMat
    );
    cenefaPxLed.position.z = 0.21;
    cenefaPxLed.visible = false;
    semCenefaGrp.add(cenefaPxLed);
    registerPickable('semana-mainstage', 'sem-cenefa', cenefaLiveLed);
    registerPickable('semana-mainstage', 'sem-cenefa', cenefaPxLed);
    registerExplode('semana-mainstage', semCenefaGrp, [0, 9.25, -4.0], [0, 11.0, -0.9], '#ff4d6d');
    attachSliceHighlight('semana-mainstage', 'sem-cenefa', semCenefaGrp, 12.2, 1.2, 0.44, '#ff4d6d', [0, 0.88, 0.28]);
    rigSemana.add(semCenefaGrp);

    const semCentralGrp = new THREE.Group();
    semCentralGrp.add(new THREE.Mesh(new THREE.BoxGeometry(8.35, 5.35, 0.38), cabinetMat));
    const semCentralLed = new THREE.Mesh(new THREE.PlaneGeometry(8.0, 5.0), semanaMainMat);
    semCentralLed.position.z = 0.21;
    semCentralGrp.add(semCentralLed);
    const semCentralPxLed = new THREE.Mesh(
      createSlicedPlane(8.0, 5.0, 0, 208, 1664, 1040, 2496, 2080),
      semanaPxMat
    );
    semCentralPxLed.position.z = 0.23;
    semCentralPxLed.visible = false;
    semCentralGrp.add(semCentralPxLed);
    registerPickable('semana-mainstage', 'sem-central', semCentralLed);
    registerPickable('semana-mainstage', 'sem-central', semCentralPxLed);
    registerExplode('semana-mainstage', semCentralGrp, [0, 5.15, -5.0], [0, 5.15, -2.3], '#38bdf8');
    attachSliceHighlight('semana-mainstage', 'sem-central', semCentralGrp, 8.2, 5.2, 0.48, '#38bdf8', [0, 0.45, 0.32]);
    rigSemana.add(semCentralGrp);

    const semLeftGroup = new THREE.Group();
    semLeftGroup.rotation.y = 0.16;
    semLeftGroup.add(new THREE.Mesh(new THREE.BoxGeometry(3.26, 4.26, 0.34), cabinetMat));
    const semLeftLed = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 4.0), semanaLateralMat);
    semLeftLed.position.z = 0.19;
    semLeftGroup.add(semLeftLed);
    const semLeftPxLed = new THREE.Mesh(
      createSlicedPlane(3.0, 4.0, 0, 1248, 624, 832, 2496, 2080),
      semanaPxMat
    );
    semLeftPxLed.position.z = 0.21;
    semLeftPxLed.visible = false;
    semLeftGroup.add(semLeftPxLed);
    registerPickable('semana-mainstage', 'sem-left', semLeftLed);
    registerPickable('semana-mainstage', 'sem-left', semLeftPxLed);
    registerExplode('semana-mainstage', semLeftGroup, [-6.45, 4.9, -4.15], [-8.85, 4.9, -1.0], '#ffd60a');
    attachSliceHighlight('semana-mainstage', 'sem-left', semLeftGroup, 3.2, 4.2, 0.44, '#ffd60a', [0, -1.15, 0.32]);
    rigSemana.add(semLeftGroup);

    const semRightGroup = new THREE.Group();
    semRightGroup.rotation.y = -0.16;
    semRightGroup.add(new THREE.Mesh(new THREE.BoxGeometry(3.26, 4.26, 0.34), cabinetMat));
    const semRightLed = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 4.0), semanaLateralMat);
    semRightLed.position.z = 0.19;
    semRightGroup.add(semRightLed);
    const semRightPxLed = new THREE.Mesh(
      createSlicedPlane(3.0, 4.0, 624, 1248, 624, 832, 2496, 2080),
      semanaPxMat
    );
    semRightPxLed.position.z = 0.21;
    semRightPxLed.visible = false;
    semRightGroup.add(semRightPxLed);
    registerPickable('semana-mainstage', 'sem-right', semRightLed);
    registerPickable('semana-mainstage', 'sem-right', semRightPxLed);
    registerExplode('semana-mainstage', semRightGroup, [6.45, 4.9, -4.15], [8.85, 4.9, -1.0], '#00ffa3');
    attachSliceHighlight('semana-mainstage', 'sem-right', semRightGroup, 3.2, 4.2, 0.44, '#00ffa3', [0, -1.15, 0.32]);
    rigSemana.add(semRightGroup);

    const semTrussGrp = new THREE.Group();
    [-8.4, 8.4].forEach((tx) => {
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.85, 10.6, 0.85, 1, 10, 1), trussMat);
      col.position.set(tx, 5.9, -4.4);
      semTrussGrp.add(col);
    });
    const semTopTruss = new THREE.Mesh(new THREE.BoxGeometry(17.8, 0.85, 0.85, 16, 1, 1), trussMat);
    semTopTruss.position.set(0, 10.85, -4.4);
    semTrussGrp.add(semTopTruss);
    registerExplode('semana-mainstage', semTrussGrp, [0, 0, 0], [0, 0.9, -2.0]);
    rigSemana.add(semTrussGrp);
    rigSemana.visible = false;
    scene.add(rigSemana);

    // =========================================================================
    // RIG 4: FESTIVAL WIDE 16:9 + DUAL IMAG WINGS
    // =========================================================================
    const rigFestival = new THREE.Group();
    const festFrame = new THREE.Mesh(new THREE.BoxGeometry(12.2, 6.95, 0.35), cabinetMat);
    festFrame.position.set(0, 5.5, -5.2);
    rigFestival.add(festFrame);

    const festMain = new THREE.Mesh(new THREE.PlaneGeometry(11.7, 6.55), mainScreenMat);
    festMain.position.set(0, 5.5, -5.0);
    rigFestival.add(festMain);

    const festWingL = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 5.2), mainScreenMat);
    festWingL.position.set(-8.2, 5.3, -3.5);
    festWingL.rotation.y = 0.34;
    rigFestival.add(festWingL);

    const festWingR = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 5.2), mainScreenMat);
    festWingR.position.set(8.2, 5.3, -3.5);
    festWingR.rotation.y = -0.34;
    rigFestival.add(festWingR);

    [-9.5, 9.5].forEach((tx) => {
      const tower = new THREE.Mesh(new THREE.BoxGeometry(0.9, 10.6, 0.9, 1, 10, 1), trussMat);
      tower.position.set(tx, 5.9, -4.4);
      rigFestival.add(tower);
    });
    const festTopTruss = new THREE.Mesh(new THREE.BoxGeometry(20.4, 0.85, 0.9, 18, 1, 1), trussMat);
    festTopTruss.position.set(0, 10.8, -4.4);
    rigFestival.add(festTopTruss);
    rigFestival.visible = false;
    scene.add(rigFestival);

    // =========================================================================
    // RIG 5: SOPHII SHOW — CURVED S-WAVE STEPPED LED WALL (7424 x 1280)
    // =========================================================================
    const rigSophii = new THREE.Group();
    const sophiiW = 20.3;
    const sophiiH = 3.5;
    const sophiiBaseY = 1.16;
    const sophiiCenterY = sophiiBaseY + sophiiH * 0.5;

    const sophiiCurveZ = (s) => -4.65 - 0.82 * Math.cos(s * Math.PI * 2.12) + 0.24 * s * s;

    const makeSophiiRibbonGeo = (zOffset = 0) => {
      const geo = new THREE.PlaneGeometry(sophiiW, sophiiH, 145, 25);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const s = x / (sophiiW * 0.5);
        pos.setZ(i, sophiiCurveZ(s) + zOffset);
      }
      geo.computeVertexNormals();
      return geo;
    };

    const sophiiWallMat = new THREE.ShaderMaterial({
      vertexShader: BEAM_VERT,
      fragmentShader: SOPHII_WALL_FRAG,
      uniforms: {
        uMap: { value: mainVideoTex },
        uRimColor: { value: new THREE.Color(0xd946ef) },
        uAlpha: { value: 1.0 },
      },
      transparent: true,
      side: THREE.DoubleSide,
    });

    const sophiiRibbonGrp = new THREE.Group();
    const sophiiLedMesh = new THREE.Mesh(makeSophiiRibbonGeo(0), sophiiWallMat);
    sophiiLedMesh.position.y = sophiiCenterY;
    sophiiRibbonGrp.add(sophiiLedMesh);
    registerPickable('sophii-curved', 'sophii-ribbon', sophiiLedMesh);

    // 3 Zone Slice Highlight Boxes along the S-Curve (Left Wing, Center Arch, Right Wing)
    const sLeftZone = new THREE.Group();
    sLeftZone.position.set(-7.1, sophiiBaseY + 1.22, sophiiCurveZ(-0.7) + 0.15);
    attachSliceHighlight('sophii-curved', 'sophii-left', sLeftZone, 5.6, 2.45, 0.8, '#f472b6', [0, -0.55, 0.35]);
    sophiiRibbonGrp.add(sLeftZone);

    const sCenterZone = new THREE.Group();
    sCenterZone.position.set(0, sophiiCenterY, sophiiCurveZ(0) + 0.35);
    attachSliceHighlight('sophii-curved', 'sophii-center', sCenterZone, 7.0, 3.5, 1.1, '#c084fc', [0, 1.25, 0.35]);
    sophiiRibbonGrp.add(sCenterZone);

    const sRightZone = new THREE.Group();
    sRightZone.position.set(7.1, sophiiBaseY + 1.22, sophiiCurveZ(0.7) + 0.15);
    attachSliceHighlight('sophii-curved', 'sophii-right', sRightZone, 5.6, 2.45, 0.8, '#38bdf8', [0, -0.55, 0.35]);
    sophiiRibbonGrp.add(sRightZone);

    registerExplode(
      'sophii-curved',
      sophiiRibbonGrp,
      [0, 0, 0],
      [0, 0.4, 2.4],
      '#c084fc',
      [0, sophiiCenterY, sophiiCurveZ(0)]
    );
    rigSophii.add(sophiiRibbonGrp);

    const sophiiBackGrp = new THREE.Group();
    const sophiiBackShell = new THREE.Mesh(makeSophiiRibbonGeo(-0.14), cabinetMat);
    sophiiBackShell.scale.y = 0.68;
    sophiiBackShell.position.y = sophiiBaseY + sophiiH * 0.34;
    sophiiBackGrp.add(sophiiBackShell);
    registerExplode('sophii-curved', sophiiBackGrp, [0, 0, 0], [0, 0, -1.8]);
    rigSophii.add(sophiiBackGrp);

    const sophiiCrownGrp = new THREE.Group();
    const blinderGeo = new THREE.SphereGeometry(0.11, 10, 10);
    const blinderMat = new THREE.MeshBasicMaterial({ color: 0xf5d0fe });
    for (let i = 0; i < 26; i++) {
      const u = (i + 0.5) / 26;
      const s = u * 2 - 1;
      const isOuterStep = u < 5.5 / 29.0 || u > 23.5 / 29.0;
      const topY = sophiiBaseY + sophiiH * (isOuterStep ? 3.5 / 5.0 : 1.0) + 0.14;
      const dot = new THREE.Mesh(blinderGeo, blinderMat);
      dot.position.set(s * (sophiiW * 0.49), topY, sophiiCurveZ(s) + 0.05);
      sophiiCrownGrp.add(dot);
    }
    registerExplode('sophii-curved', sophiiCrownGrp, [0, 0, 0], [0, 1.35, 1.1]);
    rigSophii.add(sophiiCrownGrp);

    const sophiiTrussGrp = new THREE.Group();
    const sophiiMidTruss = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.55, 0.55, 9, 1, 1), trussMat);
    sophiiMidTruss.position.set(0, 7.6, -4.3);
    sophiiTrussGrp.add(sophiiMidTruss);

    const sophiiLeftTruss = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.52, 0.52, 6, 1, 1), trussMat);
    sophiiLeftTruss.position.set(-6.3, 7.15, -3.5);
    sophiiLeftTruss.rotation.set(0, 0.36, 0.24);
    sophiiTrussGrp.add(sophiiLeftTruss);

    const sophiiRightTruss = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.52, 0.52, 6, 1, 1), trussMat);
    sophiiRightTruss.position.set(6.3, 7.15, -3.5);
    sophiiRightTruss.rotation.set(0, -0.36, -0.24);
    sophiiTrussGrp.add(sophiiRightTruss);
    registerExplode('sophii-curved', sophiiTrussGrp, [0, 0, 0], [0, 2.1, -0.8]);
    rigSophii.add(sophiiTrussGrp);

    const sophiiCatwalkGrp = new THREE.Group();
    const catwalk = new THREE.Mesh(
      new THREE.BoxGeometry(6.6, 1.14, 4.1),
      new THREE.MeshStandardMaterial({ color: 0x0b0914, roughness: 0.16, metalness: 0.88 })
    );
    catwalk.position.set(0, 0.57, 3.45);
    sophiiCatwalkGrp.add(catwalk);

    const catwalkGrid = new THREE.GridHelper(6.5, 8, 0x7e22ce, 0x2e1065);
    catwalkGrid.scale.z = 4.0 / 6.5;
    catwalkGrid.position.set(0, 1.15, 3.45);
    sophiiCatwalkGrp.add(catwalkGrid);

    const catwalkFrontLed = new THREE.Mesh(new THREE.BoxGeometry(6.64, 0.09, 0.1), rigRimMat);
    catwalkFrontLed.position.set(0, 1.12, 5.51);
    sophiiCatwalkGrp.add(catwalkFrontLed);

    [-5.1, 5.1].forEach((sx) => {
      for (let st = 0; st < 3; st++) {
        const stepMesh = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.28 * (3 - st), 0.55), deckMat);
        stepMesh.position.set(sx, 0.14 * (3 - st), 1.85 + st * 0.56);
        sophiiCatwalkGrp.add(stepMesh);
      }
    });
    registerExplode('sophii-curved', sophiiCatwalkGrp, [0, 0, 0], [0, -0.3, 2.1], '#38bdf8', [0, 1.1, 3.4]);
    rigSophii.add(sophiiCatwalkGrp);

    rigSophii.visible = false;
    scene.add(rigSophii);

    const rigMap = {
      'sonar-square': rigSonar,
      'techno-cross': rigCross,
      'semana-mainstage': rigSemana,
      'sophii-curved': rigSophii,
      'festival-wide': rigFestival,
    };

    // 6 Volumetric Sweeping Moving-Head Stage Beams
    const beamMaterials = [];
    const beamPivots = [];
    const beamXs = [-7.8, -4.8, -1.8, 1.8, 4.8, 7.8];
    beamXs.forEach((bx, i) => {
      const pivot = new THREE.Group();
      pivot.position.set(bx, 10.6, -4.2);

      const fixture = new THREE.Mesh(
        new THREE.BoxGeometry(0.45, 0.45, 0.45),
        new THREE.MeshStandardMaterial({ color: 0x191e2b, metalness: 0.8, roughness: 0.3 })
      );
      pivot.add(fixture);

      const bMat = new THREE.ShaderMaterial({
        vertexShader: BEAM_VERT,
        fragmentShader: BEAM_FRAG,
        uniforms: {
          uColor: { value: new THREE.Color(i % 2 === 0 ? 0x006eff : 0x00f0ff) },
          uOpacity: { value: 0.3 },
        },
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      beamMaterials.push(bMat);

      const coneGeo = new THREE.ConeGeometry(2.4, 17, 24, 1, true);
      coneGeo.translate(0, -8.5, 0);
      pivot.add(new THREE.Mesh(coneGeo, bMat));

      scene.add(pivot);
      beamPivots.push(pivot);
    });

    // Atmospheric Festival Haze Particles
    const pCount = 900;
    const pPos = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount; i++) {
      pPos[i * 3] = (Math.random() - 0.5) * 34;
      pPos[i * 3 + 1] = Math.random() * 12;
      pPos[i * 3 + 2] = (Math.random() - 0.5) * 26 + 3;
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    const haze = new THREE.Points(
      pGeo,
      new THREE.PointsMaterial({
        size: 0.08,
        color: 0xaad8ff,
        transparent: true,
        opacity: 0.42,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    scene.add(haze);

    let currentRigKey = null;
    let lastClipSrc = null;
    let lastCamChoreoKey = 'closed';
    let wasBuildOpen = false;

    const updateCameraViewOffset = (isBuildOpen) => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      camera.aspect = w / h;
      if (isBuildOpen && w > 1000) {
        camera.setViewOffset(w, h, -w * 0.1, 0, w, h);
      } else {
        camera.clearViewOffset();
      }
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    const tweenCameraTo = (pos, look, duration = 1.05) => {
      gsap.killTweensOf(camera.position);
      gsap.killTweensOf(controls.target);
      gsap.to(camera.position, {
        x: pos[0],
        y: pos[1],
        z: pos[2],
        duration,
        ease: 'power3.inOut',
      });
      gsap.to(controls.target, {
        x: look[0],
        y: look[1],
        z: look[2],
        duration,
        ease: 'power3.inOut',
      });
    };

    const getBuildPhaseCamera = (rigKey, phase) => {
      const isSophii = rigKey === 'sophii-curved';
      const isCross = rigKey === 'techno-cross';
      if (phase === 1) {
        if (isSophii) return { pos: [16.2, 9.5, 25.5], look: [0, 3.6, -1.5] };
        if (isCross) return { pos: [15.0, 9.4, 25.4], look: [0, 6.1, -4.0] };
        return { pos: [14.6, 9.1, 24.6], look: [0, 5.4, -3.5] };
      }
      if (phase === 2) {
        if (isSophii) return { pos: [9.6, 5.9, 22.8], look: [0, 3.3, -1.8] };
        return { pos: [8.4, 6.0, 21.6], look: [0, 5.0, -3.6] };
      }
      if (phase === 3) {
        if (isSophii) return { pos: [-8.6, 5.6, 22.8], look: [0, 3.4, -1.8] };
        return { pos: [-7.2, 5.4, 21.4], look: [0, 4.9, -3.5] };
      }
      return { pos: [0, 4.8, 20.5], look: [0, 4.3, -2.5] };
    };

    const applyStageState = (proj, clip, cenefaSrc, pixelmapMode, isBuildOpen, phase) => {
      const c1 = new THREE.Color(proj.stageColor || '#ff2e88');
      const c2 = new THREE.Color(proj.stageSecondary || '#00f0ff');

      keyLight.color.copy(c1);
      fillLight.color.copy(c2);
      screenBounce.color.copy(c1);
      edgeMat.color.copy(c1);
      rigRimMat.color.copy(c1);
      boothLedMat.color.copy(c2);

      const rigKey = proj.stageRig || 'festival-wide';
      if (rigKey !== currentRigKey) {
        Object.entries(rigMap).forEach(([k, grp]) => {
          grp.visible = k === rigKey;
        });
        const activeRig = rigMap[rigKey];
        if (activeRig) {
          gsap.killTweensOf(activeRig.scale);
          gsap.killTweensOf(activeRig.position);
          activeRig.scale.set(0.92, 0.88, 0.92);
          activeRig.position.y = -1.2;
          gsap.to(activeRig.scale, { x: 1, y: 1, z: 1, duration: 0.72, ease: 'back.out(1.3)' });
          gsap.to(activeRig.position, { y: 0, duration: 0.65, ease: 'power3.out' });
        }
        currentRigKey = rigKey;
      }

      // 4-Phase Build Choreography (CAD Exploded -> Pixelmap Assembly -> Rig & Beams -> Live Show)
      const isCadAtmosphere = isBuildOpen && phase <= 2;
      const isExploded = isBuildOpen && phase === 1;
      const beamsActive = !isBuildOpen || phase >= 3;
      const screenAlpha = isExploded ? 0.86 : 1.0;

      scene.background.copy(isCadAtmosphere ? bgCad : bgConcert);
      scene.fog.color.copy(isCadAtmosphere ? bgCad : bgConcert);
      cadGrid.visible = isCadAtmosphere;
      grid.visible = !isCadAtmosphere;
      haze.visible = beamsActive;

      [mainScreenMat, crossScreenMat, semanaMainMat, semanaLateralMat, semanaCenefaMat, semanaPxMat].forEach((m) => {
        gsap.to(m, { opacity: screenAlpha, duration: 0.45 });
      });
      gsap.to(sophiiWallMat.uniforms.uAlpha, { value: screenAlpha, duration: 0.45 });

      gsap.to(cadHemiLight, { intensity: isCadAtmosphere ? 2.2 : 0.0, duration: 0.45 });
      beamMaterials.forEach((bm, idx) => {
        bm.uniforms.uColor.value.copy(idx % 2 === 0 ? c1 : c2);
        gsap.to(bm.uniforms.uOpacity, {
          value: beamsActive ? 0.3 : 0.0,
          duration: 0.45,
        });
      });

      explodeParts.forEach((p) => {
        if (p.rig !== rigKey) return;
        const target = isExploded ? p.exp : p.base;
        gsap.to(p.obj.position, {
          x: target[0],
          y: target[1],
          z: target[2],
          duration: 0.82,
          ease: isExploded ? 'power3.out' : 'back.out(1.22)',
        });
      });

      updateCameraViewOffset(isBuildOpen);

      // Automatic Camera Choreography across Build Phases
      if (isBuildOpen) {
        const choreoKey = `${rigKey}-p${phase}`;
        if (choreoKey !== lastCamChoreoKey) {
          const camCfg = getBuildPhaseCamera(rigKey, phase);
          tweenCameraTo(camCfg.pos, camCfg.look, 1.05);
          lastCamChoreoKey = choreoKey;
        }
        wasBuildOpen = true;
      } else if (wasBuildOpen) {
        tweenCameraTo([0, 4.8, 20.5], [0, 4.3, -2.5], 0.95);
        lastCamChoreoKey = 'closed';
        wasBuildOpen = false;
      }

      // Resolve live media texture
      let liveTex = mainVideoTex;
      if (clip) {
        const changed = clip.src !== lastClipSrc;
        if (changed) {
          lastClipSrc = clip.src;
          gsap.killTweensOf(screenBounce);
          screenBounce.intensity = 65;
          gsap.to(screenBounce, { intensity: 32, duration: 0.45, ease: 'power2.out' });
        }

        if (clip.type === 'image') {
          liveTex = getImageTexture(clip.src);
          if (!mainVideo.paused) mainVideo.pause();
        } else {
          liveTex = mainVideoTex;
          if (mainVideo.getAttribute('data-src') !== clip.src) {
            mainVideo.setAttribute('data-src', clip.src);
            mainVideo.src = clip.src;
            mainVideo.currentTime = 0;
            mainVideo.play().catch(() => {});
          } else if (mainVideo.paused) {
            mainVideo.play().catch(() => {});
          }
        }
      }

      const isSophii = rigKey === 'sophii-curved';
      booth.visible = !isSophii && (!isBuildOpen || phase >= 3);
      boothLed.visible = !isSophii && (!isBuildOpen || phase >= 3);

      const usePx = Boolean(pixelmapMode && proj.pixelmapImage);
      const projPxTex = usePx ? getImageTexture(proj.pixelmapImage) : null;
      const effectiveCenefa = clip?.type === 'multizone' ? clip.cenefa : cenefaSrc;
      const effectiveLateral = clip?.type === 'multizone' ? clip.lateral : null;

      if (rigKey === 'sonar-square') {
        mainScreenMat.map = usePx ? projPxTex : liveTex;
        mainScreenMat.needsUpdate = true;
        if (sliceHighlights['sonar-main']) {
          const sCol = new THREE.Color(proj.id === 'alba-franch' ? '#ff2e88' : '#00f0ff');
          sliceHighlights['sonar-main'].mat.color.copy(sCol);
          sliceHighlights['sonar-main'].glowMat.color.copy(sCol);
        }
      } else if (rigKey === 'techno-cross') {
        crossScreenMat.map = usePx ? projPxTex : liveTex;
        crossScreenMat.needsUpdate = true;
      } else if (rigKey === 'semana-mainstage') {
        if (usePx && projPxTex) {
          semanaPxMat.map = projPxTex;
          semanaPxMat.needsUpdate = true;
        }
        cenefaPxLed.visible = usePx;
        semCentralPxLed.visible = usePx;
        semLeftPxLed.visible = usePx;
        semRightPxLed.visible = usePx;
        cenefaLiveLed.visible = !usePx;
        semCentralLed.visible = !usePx;
        semLeftLed.visible = !usePx;
        semRightLed.visible = !usePx;
        semanaMainMat.map = liveTex;
        semanaMainMat.needsUpdate = true;
        semanaLateralMat.map = effectiveLateral ? lateralVideoTex : liveTex;
        semanaLateralMat.needsUpdate = true;
        semanaCenefaMat.map = cenefaVideoTex;
        semanaCenefaMat.needsUpdate = true;
      } else if (rigKey === 'sophii-curved') {
        sophiiWallMat.uniforms.uMap.value = usePx ? projPxTex : liveTex;
        sophiiWallMat.uniforms.uRimColor.value.copy(c1);
      } else {
        mainScreenMat.map = liveTex;
        mainScreenMat.needsUpdate = true;
      }

      if (effectiveCenefa && cenefaVideo.getAttribute('data-src') !== effectiveCenefa) {
        cenefaVideo.setAttribute('data-src', effectiveCenefa);
        cenefaVideo.src = effectiveCenefa;
        cenefaVideo.currentTime = 0;
        cenefaVideo.play().catch(() => {});
      }

      if (effectiveLateral && lateralVideo.getAttribute('data-src') !== effectiveLateral) {
        lateralVideo.setAttribute('data-src', effectiveLateral);
        lateralVideo.src = effectiveLateral;
        lateralVideo.currentTime = 0;
        lateralVideo.play().catch(() => {});
      }
    };

    const moveCameraPreset = (preset) => {
      const targets = {
        wide: { pos: [0, 4.8, 20.5], look: [0, 4.3, -2.5] },
        close: { pos: [0, 5.6, 10.6], look: [0, 5.4, -4.8] },
        booth: { pos: [-6.4, 3.2, 8.2], look: [0.4, 4.8, -4.5] },
      };
      const cfg = targets[preset] || targets.wide;
      tweenCameraTo(cfg.pos, cfg.look, 1.1);
    };

    sceneApiRef.current = { applyStageState, moveCameraPreset };

    // Bi-Directional 3D Raycasting (Hovering or clicking 3D LED screens highlights 2D & 3D slices)
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    let isOrbitDragging = false;
    let last3DHover = null;

    const resolveHitSlice = (hit) => {
      if (!hit) return null;
      const rawId = hit.object.userData.sliceId;
      if (rawId === 'sophii-ribbon' && hit.uv) {
        const u = hit.uv.x;
        if (u < 2048 / 7424) return 'sophii-left';
        if (u > 5376 / 7424) return 'sophii-right';
        if (u >= 2350 / 7424 && u <= 5074 / 7424) return 'sophii-center';
        return null;
      }
      return rawId || null;
    };

    const onCanvasPointerDown = () => {
      isOrbitDragging = false;
    };

    const onCanvasPointerMove = (e) => {
      if (e.buttons > 0) {
        isOrbitDragging = true;
        return;
      }
      const bState = buildStateRef.current;
      if (!bState.open) {
        if (last3DHover !== null) {
          last3DHover = null;
          renderer.domElement.style.cursor = '';
        }
        return;
      }

      const rect = renderer.domElement.getBoundingClientRect();
      pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(pointerNdc, camera);
      const candidates = pickableMeshes.filter(
        (m) => m.userData.rig === bState.rigKey && m.visible
      );
      const hits = raycaster.intersectObjects(candidates, false);
      const hitSlice = hits.length ? resolveHitSlice(hits[0]) : null;

      renderer.domElement.style.cursor = hitSlice ? 'pointer' : 'grab';
      if (hitSlice !== last3DHover) {
        last3DHover = hitSlice;
        setHoveredSliceRef.current(hitSlice);
      }
    };

    const onCanvasClick = (e) => {
      if (isOrbitDragging || !buildStateRef.current.open) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, camera);
      const candidates = pickableMeshes.filter(
        (m) => m.userData.rig === buildStateRef.current.rigKey && m.visible
      );
      const hits = raycaster.intersectObjects(candidates, false);
      const hitSlice = hits.length ? resolveHitSlice(hits[0]) : null;
      if (hitSlice) {
        setHoveredSliceRef.current(hoveredSliceRef.current === hitSlice ? null : hitSlice);
      }
    };

    renderer.domElement.addEventListener('pointerdown', onCanvasPointerDown);
    renderer.domElement.addEventListener('pointermove', onCanvasPointerMove, { passive: true });
    renderer.domElement.addEventListener('click', onCanvasClick);

    let mouseX = 0;
    let mouseY = 0;
    const onPointerMove = (e) => {
      mouseX = (e.clientX / window.innerWidth) * 2 - 1;
      mouseY = (e.clientY / window.innerHeight) * 2 - 1;
    };

    const onResize = () => {
      if (!host) return;
      updateCameraViewOffset(buildStateRef.current.open);
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('resize', onResize);

    const clock = new THREE.Clock();
    const projVec = new THREE.Vector3();
    let rafId = 0;

    const animate = () => {
      rafId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      beamPivots.forEach((p, idx) => {
        const phase = idx * 0.95;
        p.rotation.z = Math.sin(elapsed * 1.15 + phase) * 0.42 + mouseX * 0.25;
        p.rotation.x = 0.26 + Math.cos(elapsed * 0.85 + phase) * 0.2 + mouseY * 0.14;
      });

      haze.rotation.y = elapsed * 0.025;
      controls.update();

      const hovId = hoveredSliceRef.current;
      const bState = buildStateRef.current;
      const pulse = 0.78 + Math.sin(elapsed * 7.0) * 0.22;

      // Update 3D CAD Dashed Leader Lines for Exploded Phase
      explodeLeaders.forEach((ldr) => {
        const showLeader = bState.open && bState.phase === 1 && ldr.rig === bState.rigKey;
        ldr.lMesh.visible = showLeader;
        if (showLeader) {
          const arr = ldr.lGeo.attributes.position.array;
          arr[0] = ldr.base[0] + ldr.localOffset[0];
          arr[1] = ldr.base[1] + ldr.localOffset[1];
          arr[2] = ldr.base[2] + ldr.localOffset[2];
          arr[3] = ldr.obj.position.x + ldr.localOffset[0];
          arr[4] = ldr.obj.position.y + ldr.localOffset[1];
          arr[5] = ldr.obj.position.z + ldr.localOffset[2];
          ldr.lGeo.attributes.position.needsUpdate = true;
          ldr.lMesh.computeLineDistances();
        }
      });

      // Update 3D Slice Wireframe Highlights, Holographic Fill & Projected 3D Dimension Tags
      Object.entries(sliceHighlights).forEach(([sId, info]) => {
        const isCurrentRig = info.rig === bState.rigKey;
        const isHovered = hovId === sId;
        const baseCadOpacity =
          bState.open && bState.phase <= 2 ? (hovId ? 0.2 : 0.65) : 0.0;
        info.mat.opacity = isCurrentRig ? (isHovered ? pulse : baseCadOpacity) : 0.0;
        info.glowMat.opacity = isCurrentRig && isHovered ? 0.22 * pulse : 0.0;

        const el = labelElsRef.current[sId];
        if (el) {
          const showTag =
            isCurrentRig && bState.open && (bState.phase <= 2 || isHovered);
          if (!showTag) {
            el.style.opacity = '0';
            el.style.pointerEvents = 'none';
          } else {
            info.anchor.getWorldPosition(projVec);
            projVec.project(camera);
            if (projVec.z > 1) {
              el.style.opacity = '0';
              el.style.pointerEvents = 'none';
            } else {
              const sx = (projVec.x * 0.5 + 0.5) * host.clientWidth;
              const sy = (-projVec.y * 0.5 + 0.5) * host.clientHeight;
              el.style.opacity = '1';
              el.style.pointerEvents = 'auto';
              el.style.transform = `translate3d(${sx}px, ${sy}px, 0) translate(-50%, -50%)`;
            }
          }
        }
      });

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(rafId);
      renderer.domElement.removeEventListener('pointerdown', onCanvasPointerDown);
      renderer.domElement.removeEventListener('pointermove', onCanvasPointerMove);
      renderer.domElement.removeEventListener('click', onCanvasClick);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('resize', onResize);
      controls.dispose();
      mainVideo.pause();
      mainVideo.src = '';
      mainVideoTex.dispose();
      cenefaVideo.pause();
      cenefaVideo.src = '';
      cenefaVideoTex.dispose();
      lateralVideo.pause();
      lateralVideo.src = '';
      lateralVideoTex.dispose();
      imageTexCache.forEach((tx) => tx.dispose());
      renderer.dispose();
      if (renderer.domElement.parentNode === host) {
        host.removeChild(renderer.domElement);
      }
    };
  }, [stageProjects]);

  useEffect(() => {
    sceneApiRef.current?.applyStageState(
      activeProject,
      currentClip,
      currentCenefaSrc,
      effectivePixelmap,
      buildOpen,
      buildPhase
    );
  }, [activeProject, currentClip, currentCenefaSrc, effectivePixelmap, buildOpen, buildPhase]);

  const handlePreset = (preset) => {
    setCamPreset(preset);
    sceneApiRef.current?.moveCameraPreset(preset);
  };

  const openBuildInspector = () => {
    setBuildOpen(true);
    setBuildPhase(1);
    setAutoBuild(false);
  };

  const closeBuildInspector = () => {
    setBuildOpen(false);
    setBuildPhase(4);
    setAutoBuild(false);
    setHoveredSlice(null);
    setCamPreset('wide');
  };

  const toggleBuildInspector = () => {
    if (!buildOpen) {
      openBuildInspector();
    } else {
      closeBuildInspector();
    }
  };

  const hasCustomPixelmap = Boolean(activeProject.pixelmapImage);
  const safeClipNum = (clipIdx % Math.max(1, playlist.length)) + 1;

  return (
    <div
      className="world-viewport"
      style={{ '--world-accent': activeProject.stageColor || worldMeta.accent }}
    >
      <div ref={canvasHostRef} className="world-canvas-host" />

      {/* Projected 3D CAD Dimension Callouts Layer (Interactive Hover/Click) */}
      {engSpec && (
        <div className="cad-labels-layer">
          {engSpec.slices.map((s) => {
            const isHov = hoveredSlice === s.id;
            const isDim = Boolean(hoveredSlice && !isHov);
            return (
              <div
                key={s.id}
                ref={(el) => {
                  if (el) labelElsRef.current[s.id] = el;
                }}
                className={`cad-dim-tag ${isHov ? 'is-hovered' : ''} ${isDim ? 'is-dimmed' : ''}`}
                style={{ '--tag-color': s.color, opacity: 0, pointerEvents: 'none' }}
                onMouseEnter={() => setHoveredSlice(s.id)}
                onMouseLeave={() => setHoveredSlice(null)}
                onClick={() => setHoveredSlice(hoveredSlice === s.id ? null : s.id)}
              >
                <strong>{s.name[lang]}</strong>
                {s.physical} · {s.pxLabel}
              </div>
            );
          })}
        </div>
      )}

      <div className="world-hud-layer">
        <div className="world-hud-top">
          <div>
            {buildOpen && engSpec ? (
              <SliceMonitor2D
                projectTitle={activeProject.title}
                spec={engSpec}
                lang={lang}
                hoveredSlice={hoveredSlice}
                onHoverSlice={setHoveredSlice}
                onClose={closeBuildInspector}
              />
            ) : (
              <div className="world-header-card">
                <div className="world-kicker">WORLD 01 // {t.stageLedLive}</div>
                <h1 className="world-heading">{worldMeta.name[lang]}</h1>
                <p className="world-desc">
                  {activeProject.pixelmapLabel || '16:9 MAINSTAGE + DUAL IMAG WINGS'}
                </p>
              </div>
            )}
          </div>

          <div className="world-controls-cluster">
            <div className="cam-presets">
              <button
                type="button"
                className={`cam-btn ${!buildOpen && camPreset === 'wide' ? 'active' : ''}`}
                onClick={() => handlePreset('wide')}
              >
                {t.stageCamWide}
              </button>
              <button
                type="button"
                className={`cam-btn ${!buildOpen && camPreset === 'close' ? 'active' : ''}`}
                onClick={() => handlePreset('close')}
              >
                {t.stageCamClose}
              </button>
              <button
                type="button"
                className={`cam-btn ${!buildOpen && camPreset === 'booth' ? 'active' : ''}`}
                onClick={() => handlePreset('booth')}
              >
                {t.stageCamBooth}
              </button>
              {hasCustomPixelmap && !buildOpen && (
                <button
                  type="button"
                  className={`cam-btn ${showPixelmap ? 'active' : ''}`}
                  onClick={() => setShowPixelmap((v) => !v)}
                  title="Toggle real Resolume Advanced Output Pixelmap"
                >
                  <Grid size={11} style={{ display: 'inline', marginRight: 4 }} />
                  {t.stagePixelmap}
                </button>
              )}
              {engSpec && (
                <button
                  type="button"
                  className={`cam-btn ${buildOpen ? 'active' : ''}`}
                  style={
                    buildOpen
                      ? { '--world-accent': '#00f0ff' }
                      : { border: '1px solid rgba(0, 240, 255, 0.5)', color: '#00f0ff' }
                  }
                  onClick={toggleBuildInspector}
                >
                  <Layers size={11} style={{ display: 'inline', marginRight: 4 }} />
                  {lang === 'es' ? 'CONSTRUCCIÓN 3D' : '3D STAGE BUILD'}
                </button>
              )}
            </div>

            {/* Resolume-Style Live Autopilot Deck Controls */}
            {(!buildOpen || buildPhase === 4) && (
              <div className="cam-presets" style={{ gap: 4 }}>
                <button
                  type="button"
                  className="cam-btn"
                  title="Previous visual"
                  onClick={() =>
                    setClipIdx((prev) => (prev - 1 + playlist.length) % Math.max(1, playlist.length))
                  }
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
                  AUTOPILOT {autopilot ? 'ON' : 'OFF'} · {String(safeClipNum).padStart(2, '0')}/
                  {String(playlist.length).padStart(2, '0')}
                </button>
                <button
                  type="button"
                  className="cam-btn"
                  title="Next visual"
                  onClick={() => setClipIdx((prev) => (prev + 1) % Math.max(1, playlist.length))}
                >
                  <SkipForward size={11} />
                </button>
              </div>
            )}

            <div className="telemetry-chip">
              <Radio
                size={11}
                style={{
                  display: 'inline',
                  marginRight: 6,
                  color: buildOpen ? '#00f0ff' : activeProject.stageColor || '#ff2e88',
                }}
              />
              {buildOpen
                ? lang === 'es'
                  ? 'ARRASTRA PARA ORBITAR 360° · RUEDA PARA ZOOM'
                  : 'DRAG TO ORBIT 360° · SCROLL TO ZOOM'
                : `RIG: ${activeProject.stageRig?.toUpperCase() || 'FESTIVAL-WIDE'} // ${t.controlsHint}`}
            </div>
          </div>
        </div>

        <div className="world-bottom-dock">
          {buildOpen && engSpec ? (
            <BuildScrubberDock
              lang={lang}
              buildPhase={buildPhase}
              onSelectPhase={(step) => {
                setAutoBuild(false);
                setBuildPhase(step);
              }}
              autoBuild={autoBuild}
              onToggleAutoBuild={() => setAutoBuild((v) => !v)}
              onClose={closeBuildInspector}
            />
          ) : (
            <div className="active-project-bar">
              <div className="active-project-info">
                <div className="active-project-meta">
                  <span>
                    {t.activeChannel} {String(activeIdx + 1).padStart(2, '0')} /{' '}
                    {String(stageProjects.length).padStart(2, '0')}
                  </span>
                  <span>•</span>
                  <span>{activeProject.year}</span>
                  <span>•</span>
                  <span>{activeProject.role[lang]}</span>
                </div>
                <div className="active-project-title">{activeProject.title}</div>
                <div className="active-project-summary">{activeProject.summary[lang]}</div>
              </div>

              <div className="active-project-actions">
                {activeProject.liveSetVideo && (
                  <button
                    type="button"
                    className="hud-btn live-set-btn"
                    onClick={() => onInspectProject(activeProject)}
                  >
                    <Play size={13} fill="currentColor" />
                    <span>{activeProject.liveSetVideo.label[lang]}</span>
                  </button>
                )}

                {engSpec && (
                  <button
                    type="button"
                    className="build-cta-btn"
                    onClick={openBuildInspector}
                  >
                    <span className="build-cta-dot" />
                    <Layers size={13} />
                    <span>
                      {lang === 'es'
                        ? 'VER CONSTRUCCIÓN 3D (2D → 3D)'
                        : 'EXPLORE STAGE BUILD (2D → 3D)'}
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  className="hud-btn primary"
                  style={{ '--accent': activeProject.stageColor || worldMeta.accent }}
                  onClick={() => onInspectProject(activeProject)}
                >
                  <Expand size={13} />
                  <span>{t.inspectProject}</span>
                </button>
              </div>
            </div>
          )}

          <div className="channel-strip">
            {stageProjects.map((proj, idx) => {
              const hasBuild = Boolean(STAGE_ENGINEERING[proj.stageRig]);
              return (
                <button
                  key={proj.id}
                  type="button"
                  className={`channel-card ${idx === activeIdx ? 'active' : ''}`}
                  onClick={() => setActiveIdx(idx)}
                >
                  <img className="channel-thumb" src={proj.poster} alt={proj.title} />
                  <div className="channel-text">
                    <div className="channel-ch">
                      <Video size={9} style={{ display: 'inline', marginRight: 4 }} />
                      CH {String(idx + 1).padStart(2, '0')}
                      {proj.stageRig === 'techno-cross'
                        ? ' · CROSS 3D'
                        : proj.stageRig === 'semana-mainstage'
                          ? ' · 4-SCREEN 3D'
                          : proj.stageRig === 'sophii-curved'
                            ? ' · CURVED 3D'
                            : proj.stageRig === 'sonar-square'
                              ? ' · 1:1 PXMAP 3D'
                              : ` · ${proj.totalClips} CLIPS`}
                    </div>
                    <div className="channel-name">
                      {hasBuild ? '✦ ' : ''}
                      {proj.title}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
