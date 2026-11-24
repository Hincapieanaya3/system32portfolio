import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import gsap from 'gsap';
import { Box, Expand, Film, Gamepad2, Layers, Play, SplitSquareHorizontal, Volume2, VolumeX, X, Zap } from 'lucide-react';
import GameBootOverlay from '../GameBootOverlay';
import { sfx } from '../../utils/sfx';
import { assetUrl } from '../../utils/assetUrl';
import {
  OPOSSUM_GAMEPLAY_CLIPS,
  OPOSSUM_PROPS,
  PROJECTS,
  TAW_BREAKER_DEVLOGS,
  UI_TEXT,
  WORLDS,
} from '../../data/portfolioData';

const MARBLE_VERT = `
varying vec3 vNormal;
varying vec3 vViewPos;
void main() {
  vNormal = normalize(normalMatrix * normal);
  vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
  vViewPos = -mvPos.xyz;
  gl_Position = projectionMatrix * mvPos;
}
`;

const MARBLE_FRAG = `
uniform vec3 uTint;
uniform vec3 uRimColor;
uniform vec3 uSkyTop;
uniform float uFlash;
varying vec3 vNormal;
varying vec3 vViewPos;

void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(vViewPos);
  float fresnel = pow(1.0 - max(dot(N, V), 0.0), 2.6);
  float sky = clamp(N.y * 0.5 + 0.5, 0.0, 1.0);

  vec3 baseCol = mix(uTint * 0.45, uSkyTop * 0.85, sky * 0.55);
  vec3 rim = uRimColor * fresnel * 1.9;
  vec3 col = baseCol + rim;

  // Dynamic HDR Damage Flash override (_Tint / _RimColor burst from Unity C# system)
  vec3 hdrFlash = vec3(1.8, 1.65, 1.35) + uRimColor * 1.2;
  col = mix(col, hdrFlash, clamp(uFlash, 0.0, 1.0));

  gl_FragColor = vec4(col, 1.0);
}
`;

export default function GamesWorld({ lang, onInspectProject }) {
  const t = UI_TEXT[lang];
  const worldMeta = WORLDS.find((w) => w.id === 'games');
  const gameProjects = useMemo(() => PROJECTS.filter((p) => p.world === 'games'), []);

  const [cartridge, setCartridge] = useState('taw-breaker'); // 'taw-breaker' | 'opossum-atelier'
  const [selectedPropIdx, setSelectedPropIdx] = useState(0);
  const [opossumTab, setOpossumTab] = useState('props'); // 'props' | 'videos'
  const [activeClipIdx, setActiveClipIdx] = useState(0);
  const [renderMode, setRenderMode] = useState('hybrid'); // 'shaded' | 'hybrid' | 'wireframe'
  const [loadingFbx, setLoadingFbx] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareSplit, setCompareSplit] = useState(50);

  // ---- Game feel: boot screen, score/XP HUD, level transitions ----
  const [started, setStarted] = useState(false);
  const [score, setScore] = useState(0);
  const [inspected, setInspected] = useState(() => new Set([0]));
  const [toast, setToast] = useState(null);
  const [levelTransition, setLevelTransition] = useState(null);
  const [sfxOn, setSfxOn] = useState(true);
  const [flashCombo, setFlashCombo] = useState(0);

  const activeProject = gameProjects.find((p) => p.id === cartridge) || gameProjects[0];
  const activeProp = OPOSSUM_PROPS[selectedPropIdx];
  const activeClip = OPOSSUM_GAMEPLAY_CLIPS[activeClipIdx] || OPOSSUM_GAMEPLAY_CLIPS[0];

  const canvasHostRef = useRef(null);
  const tawApiRef = useRef(null);
  const opossumApiRef = useRef(null);
  const startedRef = useRef(false);
  const flyInRef = useRef(null);
  const toastTimerRef = useRef(0);
  const comboTimerRef = useRef(0);

  useEffect(() => {
    sfx.enabled = sfxOn;
  }, [sfxOn]);

  const showToast = useCallback((title, body) => {
    window.clearTimeout(toastTimerRef.current);
    setToast({ title, body, key: Date.now() });
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  useEffect(
    () => () => {
      window.clearTimeout(toastTimerRef.current);
      window.clearTimeout(comboTimerRef.current);
    },
    []
  );

  const handleStart = useCallback(() => {
    startedRef.current = true;
    flyInRef.current?.();
    window.setTimeout(() => setStarted(true), 650);
  }, []);

  const switchCartridge = useCallback(
    (id) => {
      if (id === cartridge || levelTransition) return;
      sfx.confirm();
      setLevelTransition({ id });
      window.setTimeout(() => setCartridge(id), 380);
      window.setTimeout(() => setLevelTransition(null), 1050);
    },
    [cartridge, levelTransition]
  );

  const selectProp = useCallback(
    (idx) => {
      sfx.select();
      setSelectedPropIdx(idx);
      setInspected((prev) => {
        if (prev.has(idx)) return prev;
        const next = new Set(prev);
        next.add(idx);
        setScore((s) => s + 50);
        if (next.size === OPOSSUM_PROPS.length) {
          sfx.unlock();
          setScore((s) => s + 500);
          showToast('ACHIEVEMENT UNLOCKED', 'MASTER MODELER · 8/8 PROPS INSPECTED · +500');
        } else {
          showToast('PROP UNLOCKED', `${OPOSSUM_PROPS[idx].code} · +50 XP`);
        }
        return next;
      });
    },
    [showToast]
  );

  const fireFlash = useCallback(() => {
    sfx.hit();
    tawApiRef.current?.triggerImpactFlash();
    setScore((s) => s + 100);
    setFlashCombo((c) => c + 1);
    window.clearTimeout(comboTimerRef.current);
    comboTimerRef.current = window.setTimeout(() => setFlashCombo(0), 1800);
  }, []);

  useEffect(() => {
    if (!started) return undefined;
    const onKey = (e) => {
      if (e.target?.tagName === 'INPUT') return;
      if (e.key === '1') switchCartridge('taw-breaker');
      if (e.key === '2') switchCartridge('opossum-atelier');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [started, switchCartridge]);

  // ==================== 3D ENGINE VIEWPORT ====================
  useEffect(() => {
    const host = canvasHostRef.current;
    if (!host) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(44, host.clientWidth / host.clientHeight, 0.05, 150);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.enablePan = false;

    let rafId = 0;
    const clock = new THREE.Clock();

    // Shift camera slightly left so right-hand inspector panel never overlaps the 3D subject
    const applyCameraOffset = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      camera.aspect = w / h;
      if (w > 900) {
        camera.setViewOffset(w, h, w * 0.12, 0, w, h);
      } else {
        camera.clearViewOffset();
      }
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    applyCameraOffset();

    // -------- CARTRIDGE A: TAW BREAKER (UNITY TEMPLE & ELEMENTAL MARBLES) --------
    if (cartridge === 'taw-breaker') {
      scene.background = new THREE.Color(0x060812);
      scene.fog = new THREE.FogExp2(0x060812, 0.032);
      camera.position.set(0, 5.2, 10.2);
      controls.target.set(0, 1.0, 0);
      controls.minDistance = 5;
      controls.maxDistance = 18;

      // Trilight + Moonlight + Dynamic Torchlights
      scene.add(new THREE.HemisphereLight(0x3a4f8a, 0x16121f, 0.9));
      const moonlight = new THREE.DirectionalLight(0x88b4ff, 1.1);
      moonlight.position.set(6, 12, 8);
      scene.add(moonlight);

      // Octagonal Stone Temple Pedestal
      const stoneMat = new THREE.MeshStandardMaterial({
        color: 0x1a1e2e,
        roughness: 0.72,
        metalness: 0.2,
      });
      const arenaFloor = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.8, 0.9, 8), stoneMat);
      arenaFloor.position.y = -0.45;
      scene.add(arenaFloor);

      // Emissive Temple Ring
      const templeRing = new THREE.Mesh(
        new THREE.TorusGeometry(4.5, 0.05, 12, 64),
        new THREE.MeshBasicMaterial({ color: 0x00e5ff })
      );
      templeRing.rotation.x = Math.PI / 2;
      templeRing.position.y = 0.03;
      scene.add(templeRing);

      // 4 Corner Temple Torches with flickering fire lights
      const torchLights = [];
      const torchFlames = [];
      for (let i = 0; i < 4; i++) {
        const ang = (i * Math.PI) / 2 + Math.PI / 4;
        const tx = Math.cos(ang) * 4.4;
        const tz = Math.sin(ang) * 4.4;

        const pillar = new THREE.Mesh(
          new THREE.CylinderGeometry(0.18, 0.28, 2.3, 6),
          stoneMat
        );
        pillar.position.set(tx, 1.15, tz);
        scene.add(pillar);

        const flame = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.28, 1),
          new THREE.MeshBasicMaterial({ color: 0xff7700 })
        );
        flame.position.set(tx, 2.55, tz);
        scene.add(flame);
        torchFlames.push(flame);

        const tLight = new THREE.PointLight(0xff7722, 18, 12);
        tLight.position.set(tx, 2.8, tz);
        scene.add(tLight);
        torchLights.push(tLight);
      }

      // Central SwapStation Vortex Portal (Red -> Blue radial particles)
      const vortexCount = 520;
      const vPos = new Float32Array(vortexCount * 3);
      const vCol = new Float32Array(vortexCount * 3);
      const cRed = new THREE.Color(0xff2e55);
      const cBlue = new THREE.Color(0x00d9ff);
      for (let i = 0; i < vortexCount; i++) {
        const r = 0.25 + Math.random() * 1.65;
        const theta = Math.random() * Math.PI * 2;
        vPos[i * 3] = Math.cos(theta) * r;
        vPos[i * 3 + 1] = 0.15 + Math.random() * 0.9;
        vPos[i * 3 + 2] = Math.sin(theta) * r;
        const mixC = cRed.clone().lerp(cBlue, r / 1.9);
        vCol[i * 3] = mixC.r;
        vCol[i * 3 + 1] = mixC.g;
        vCol[i * 3 + 2] = mixC.b;
      }
      const vGeo = new THREE.BufferGeometry();
      vGeo.setAttribute('position', new THREE.BufferAttribute(vPos, 3));
      vGeo.setAttribute('color', new THREE.BufferAttribute(vCol, 3));
      const vortex = new THREE.Points(
        vGeo,
        new THREE.PointsMaterial({
          size: 0.09,
          vertexColors: true,
          transparent: true,
          opacity: 0.9,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      scene.add(vortex);

      // 3 Elemental GlassMarbles (Fire, Water, Plant) with Custom GLSL Shader
      const marbleDefs = [
        { name: 'Fire', tint: 0xff4500, rim: 0xffb703, sky: 0xff6b35, radius: 2.9, speed: 0.9, phase: 0 },
        { name: 'Water', tint: 0x0077ff, rim: 0x00f0ff, sky: 0x70e1ff, radius: 2.9, speed: 0.9, phase: (Math.PI * 2) / 3 },
        { name: 'Plant', tint: 0x16a34a, rim: 0x4ade80, sky: 0xa7f3d0, radius: 2.9, speed: 0.9, phase: (Math.PI * 4) / 3 },
      ];

      const marbles = marbleDefs.map((def) => {
        const mat = new THREE.ShaderMaterial({
          vertexShader: MARBLE_VERT,
          fragmentShader: MARBLE_FRAG,
          uniforms: {
            uTint: { value: new THREE.Color(def.tint) },
            uRimColor: { value: new THREE.Color(def.rim) },
            uSkyTop: { value: new THREE.Color(def.sky) },
            uFlash: { value: 0.0 },
          },
        });
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.62, 36, 36), mat);
        scene.add(mesh);

        const glow = new THREE.PointLight(def.rim, 8, 6);
        scene.add(glow);

        return { def, mesh, mat, glow };
      });

      // Collision Spark Burst System
      const sparkCount = 140;
      const sPos = new Float32Array(sparkCount * 3);
      const sVel = [];
      for (let i = 0; i < sparkCount; i++) {
        sPos[i * 3] = 0;
        sPos[i * 3 + 1] = -20;
        sPos[i * 3 + 2] = 0;
        sVel.push(new THREE.Vector3());
      }
      const sGeo = new THREE.BufferGeometry();
      sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
      const sMat = new THREE.PointsMaterial({
        size: 0.14,
        color: 0xffdd55,
        transparent: true,
        opacity: 0.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const sparks = new THREE.Points(sGeo, sMat);
      scene.add(sparks);

      let sparkLife = 0;

      const triggerImpactFlash = () => {
        // Trigger HDR shader flash across all marbles
        marbles.forEach(({ mat }) => {
          gsap.killTweensOf(mat.uniforms.uFlash);
          mat.uniforms.uFlash.value = 1.0;
          gsap.to(mat.uniforms.uFlash, {
            value: 0.0,
            duration: 0.65,
            ease: 'power2.out',
          });
        });

        // Burst sparks from center/marbles
        sparkLife = 1.0;
        const arr = sGeo.attributes.position.array;
        for (let i = 0; i < sparkCount; i++) {
          const m = marbles[i % 3].mesh.position;
          arr[i * 3] = m.x;
          arr[i * 3 + 1] = m.y;
          arr[i * 3 + 2] = m.z;
          sVel[i].set(
            (Math.random() - 0.5) * 0.22,
            0.06 + Math.random() * 0.18,
            (Math.random() - 0.5) * 0.22
          );
        }
        sGeo.attributes.position.needsUpdate = true;
      };

      tawApiRef.current = { triggerImpactFlash };

      const animate = () => {
        rafId = requestAnimationFrame(animate);
        const t = clock.getElapsedTime();

        vortex.rotation.y = t * 1.9;
        torchFlames.forEach((f, idx) => {
          f.rotation.y = t * 2.5 + idx;
          const sc = 0.85 + Math.sin(t * 9 + idx * 2) * 0.18;
          f.scale.set(sc, sc * 1.35, sc);
          torchLights[idx].intensity = 15 + Math.sin(t * 11 + idx) * 4;
        });

        marbles.forEach(({ def, mesh, glow }, idx) => {
          const a = t * def.speed + def.phase;
          const x = Math.cos(a) * def.radius;
          const z = Math.sin(a) * def.radius;
          const y = 0.72 + Math.sin(t * 2.4 + idx * 2.0) * 0.16;
          mesh.position.set(x, y, z);
          mesh.rotation.y = t * 1.6;
          glow.position.set(x, y + 0.2, z);
        });

        if (sparkLife > 0.01) {
          sparkLife *= 0.94;
          sMat.opacity = sparkLife;
          const arr = sGeo.attributes.position.array;
          for (let i = 0; i < sparkCount; i++) {
            arr[i * 3] += sVel[i].x;
            arr[i * 3 + 1] += sVel[i].y;
            arr[i * 3 + 2] += sVel[i].z;
            sVel[i].y -= 0.006;
          }
          sGeo.attributes.position.needsUpdate = true;
        }

        controls.update();
        renderer.render(scene, camera);
      };
      animate();
    }

    // -------- CARTRIDGE B: OPOSSUM ATELIER (LIVE 3D FBX PROP INSPECTOR) --------
    if (cartridge === 'opossum-atelier') {
      scene.background = new THREE.Color(0x0b1014);
      scene.fog = new THREE.FogExp2(0x0b1014, 0.04);
      camera.position.set(0.5, 2.1, 5.5);
      controls.target.set(0, 0.85, 0);
      controls.minDistance = 1.6;
      controls.maxDistance = 10;

      // Warm Cozy Studio Lighting (Botany Manor inspired)
      scene.add(new THREE.HemisphereLight(0xfff4e0, 0x26343d, 1.35));
      const key = new THREE.DirectionalLight(0xfff1d6, 2.2);
      key.position.set(5, 8, 6);
      scene.add(key);

      const rim = new THREE.DirectionalLight(0x60a5fa, 1.1);
      rim.position.set(-6, 4, -5);
      scene.add(rim);

      const fill = new THREE.PointLight(0xffb800, 10, 15);
      fill.position.set(3, 2, -4);
      scene.add(fill);

      // Studio Turntable Pedestal + Measurement Grid
      const grid = new THREE.GridHelper(18, 24, 0x60a5fa, 0x162428);
      scene.add(grid);

      const turntable = new THREE.Mesh(
        new THREE.CylinderGeometry(1.65, 1.8, 0.14, 48),
        new THREE.MeshStandardMaterial({ color: 0x141b22, roughness: 0.35, metalness: 0.7 })
      );
      turntable.position.y = -0.07;
      scene.add(turntable);

      const turntableRing = new THREE.Mesh(
        new THREE.TorusGeometry(1.68, 0.02, 12, 64),
        new THREE.MeshBasicMaterial({ color: 0x60a5fa })
      );
      turntableRing.rotation.x = Math.PI / 2;
      turntableRing.position.y = 0.01;
      scene.add(turntableRing);

      const propHolder = new THREE.Group();
      scene.add(propHolder);

      const fbxLoader = new FBXLoader();
      const texLoader = new THREE.TextureLoader();
      let currentWireOverlays = [];
      let currentShadedMeshes = [];
      let loadToken = 0;

      const applyRenderMode = (mode) => {
        currentShadedMeshes.forEach((m) => {
          m.visible = mode !== 'wireframe';
          if (m.material) {
            m.material.wireframe = false;
          }
        });
        currentWireOverlays.forEach((w) => {
          w.visible = mode === 'hybrid' || mode === 'wireframe';
          w.material.opacity = mode === 'wireframe' ? 0.95 : 0.28;
        });
      };

      const loadProp = (prop, mode) => {
        const myToken = ++loadToken;
        setLoadingFbx(true);

        // Clear previous prop
        while (propHolder.children.length > 0) {
          propHolder.remove(propHolder.children[0]);
        }
        currentWireOverlays = [];
        currentShadedMeshes = [];

        const baseTex = prop.baseColor ? texLoader.load(prop.baseColor) : null;
        if (baseTex) baseTex.colorSpace = THREE.SRGBColorSpace;
        const roughTex = prop.roughness ? texLoader.load(prop.roughness) : null;
        const metalTex = prop.metallic ? texLoader.load(prop.metallic) : null;

        fbxLoader.load(
          prop.fbx,
          (obj) => {
            if (myToken !== loadToken) return;

            const pbrMat = new THREE.MeshStandardMaterial({
              map: baseTex,
              roughnessMap: roughTex,
              metalnessMap: metalTex,
              roughness: roughTex ? 1.0 : 0.65,
              metalness: metalTex ? 0.8 : 0.05,
              side: THREE.DoubleSide,
            });

            const wireMat = new THREE.MeshBasicMaterial({
              color: 0x60a5fa,
              wireframe: true,
              transparent: true,
              opacity: 0.28,
            });

            const meshes = [];
            obj.traverse((child) => {
              if (child.isMesh) {
                child.material = pbrMat;
                meshes.push(child);
              }
            });

            meshes.forEach((m) => {
              currentShadedMeshes.push(m);
              const wireClone = new THREE.Mesh(m.geometry, wireMat);
              wireClone.scale.setScalar(1.002);
              m.parent.add(wireClone);
              wireClone.position.copy(m.position);
              wireClone.rotation.copy(m.rotation);
              currentWireOverlays.push(wireClone);
            });

            // Auto-normalize scale & center onto turntable
            const box = new THREE.Box3().setFromObject(obj);
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z, 0.001);
            const targetSize = 2.15;
            const scale = targetSize / maxDim;
            obj.scale.setScalar(scale);

            const scaledBox = new THREE.Box3().setFromObject(obj);
            const center = scaledBox.getCenter(new THREE.Vector3());
            obj.position.x -= center.x;
            obj.position.z -= center.z;
            obj.position.y -= scaledBox.min.y;

            propHolder.add(obj);
            applyRenderMode(mode);
            setLoadingFbx(false);
          },
          undefined,
          () => {
            if (myToken === loadToken) setLoadingFbx(false);
          }
        );
      };

      opossumApiRef.current = { loadProp, applyRenderMode };
      loadProp(OPOSSUM_PROPS[selectedPropIdx], renderMode);

      const animate = () => {
        rafId = requestAnimationFrame(animate);
        const dt = clock.getDelta();
        propHolder.rotation.y += dt * 0.42;
        controls.update();
        renderer.render(scene, camera);
      };
      animate();
    }

    window.addEventListener('resize', applyCameraOffset);

    // Cinematic "enter the game" fly-in: dolly + FOV punch toward the arena
    const homePos = camera.position.clone();
    const homeTarget = controls.target.clone();
    const homeFov = camera.fov;
    const flyIn = () => {
      gsap.killTweensOf(camera.position);
      gsap.killTweensOf(camera);
      camera.position.set(homePos.x * 3.4, homePos.y + 9, homePos.z * 3.4);
      camera.fov = 96;
      camera.updateProjectionMatrix();
      controls.target.copy(homeTarget);
      gsap.to(camera.position, {
        x: homePos.x,
        y: homePos.y,
        z: homePos.z,
        duration: 2.4,
        ease: 'power3.out',
      });
      gsap.to(camera, {
        fov: homeFov,
        duration: 2.4,
        ease: 'power2.out',
        onUpdate: () => camera.updateProjectionMatrix(),
      });
    };
    flyInRef.current = flyIn;
    if (startedRef.current) {
      flyIn();
    } else {
      // Waiting behind the boot screen: park the camera far away
      camera.position.set(homePos.x * 3.4, homePos.y + 9, homePos.z * 3.4);
      camera.fov = 96;
      camera.updateProjectionMatrix();
    }

    return () => {
      gsap.killTweensOf(camera.position);
      gsap.killTweensOf(camera);
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', applyCameraOffset);
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === host) {
        host.removeChild(renderer.domElement);
      }
    };
  }, [cartridge]);

  useEffect(() => {
    if (cartridge === 'opossum-atelier') {
      opossumApiRef.current?.loadProp(activeProp, renderMode);
    }
  }, [selectedPropIdx, cartridge]);

  useEffect(() => {
    if (cartridge === 'opossum-atelier') {
      opossumApiRef.current?.applyRenderMode(renderMode);
    }
  }, [renderMode, cartridge]);

  return (
    <div
      className={`world-viewport games-world ${started ? 'is-started' : ''}`}
      style={{ '--world-accent': cartridge === 'taw-breaker' ? '#00e5ff' : '#60a5fa' }}
    >
      <div ref={canvasHostRef} className="world-canvas-host" />
      <div className="game-crt-overlay" />

      {!started && <GameBootOverlay lang={lang} onStart={handleStart} />}

      {levelTransition && (
        <div className="game-level-transition">
          <div className="game-level-bars" />
          <div className="game-level-card">
            <div className="game-level-kicker">
              STAGE {levelTransition.id === 'taw-breaker' ? '01' : '02'} / 02
            </div>
            <div className="game-level-name">
              {levelTransition.id === 'taw-breaker' ? 'TAW BREAKER' : 'OPOSSUM ATELIER'}
            </div>
            <div className="game-level-load">
              {lang === 'es' ? 'CARGANDO NIVEL' : 'LOADING LEVEL'}
              <span className="game-level-dots" />
            </div>
          </div>
        </div>
      )}

      {started && (
        <div className="game-hud-strip">
          <div className="game-hud-cell">
            <span className="game-hud-label">STAGE</span>
            <span className="game-hud-value">{cartridge === 'taw-breaker' ? '01' : '02'}/02</span>
          </div>
          <div className="game-hud-cell">
            <span className="game-hud-label">SCORE</span>
            <span className="game-hud-value">{String(score).padStart(6, '0')}</span>
          </div>
          <div className="game-hud-cell game-hud-xp">
            <span className="game-hud-label">
              {cartridge === 'opossum-atelier'
                ? `PROPS ${inspected.size}/${OPOSSUM_PROPS.length}`
                : lang === 'es'
                  ? 'PULSA HDR FLASH'
                  : 'HIT HDR FLASH'}
            </span>
            <div className="game-xp-bar">
              <div
                className="game-xp-fill"
                style={{
                  width:
                    cartridge === 'opossum-atelier'
                      ? `${(inspected.size / OPOSSUM_PROPS.length) * 100}%`
                      : `${Math.min(100, flashCombo * 20)}%`,
                }}
              />
            </div>
          </div>
          {cartridge === 'taw-breaker' && flashCombo > 1 && (
            <div className="game-hud-combo">COMBO x{flashCombo}</div>
          )}
          <button
            type="button"
            className="game-hud-sfx"
            onClick={() => setSfxOn((v) => !v)}
            title="SFX"
          >
            {sfxOn ? <Volume2 size={12} /> : <VolumeX size={12} />}
            <span>SFX</span>
          </button>
        </div>
      )}

      {toast && (
        <div key={toast.key} className="game-toast">
          <div className="game-toast-title">{toast.title}</div>
          <div className="game-toast-body">{toast.body}</div>
        </div>
      )}

      <div className="world-hud-layer">
        <div className="world-hud-top">
          <div className="world-header-card game-select-card">
            <div className="world-kicker">
              PLAYER 1 // {t.gamesSelect}
            </div>
            <h1 className="world-heading">{activeProject.title}</h1>
            <p className="world-desc">{activeProject.role[lang]}</p>

            <div className="game-menu">
              <button
                type="button"
                className={`game-menu-btn ${cartridge === 'taw-breaker' ? 'active' : ''}`}
                style={{ '--menu-accent': '#00e5ff' }}
                onClick={() => switchCartridge('taw-breaker')}
              >
                <span className="game-menu-arrow">▶</span>
                <Gamepad2 size={12} />
                <span>[1] TAW BREAKER (UNITY)</span>
              </button>
              <button
                type="button"
                className={`game-menu-btn ${cartridge === 'opossum-atelier' ? 'active' : ''}`}
                style={{ '--menu-accent': '#60a5fa' }}
                onClick={() => switchCartridge('opossum-atelier')}
              >
                <span className="game-menu-arrow">▶</span>
                <Box size={12} />
                <span>[2] OPOSSUM ATELIER (3D FBX)</span>
              </button>
            </div>
            <div className="game-controls-hint">
              {lang === 'es'
                ? '[ARRASTRA] ORBITAR · [RUEDA] ZOOM · [1][2] CARTUCHO'
                : '[DRAG] ORBIT · [SCROLL] ZOOM · [1][2] CARTRIDGE'}
            </div>
          </div>
        </div>


        {/* Right-Hand Game Engine Inspector Panel */}
        <aside className="games-side-panel">
          {cartridge === 'taw-breaker' ? (
            <>
              <div className="games-panel-head">
                <span className="world-kicker" style={{ margin: 0 }}>
                  {t.tawDevlogsTitle}
                </span>
                <button
                  type="button"
                  className="hud-btn primary"
                  style={{ '--accent': '#00e5ff', padding: '5px 9px', fontSize: 10 }}
                  onClick={fireFlash}
                >
                  <Zap size={11} />
                  <span>HDR FLASH</span>
                </button>
              </div>
              <div className="games-panel-body">
                {/* Featured Official Alpha Trailer Card */}
                <button
                  type="button"
                  className="taw-trailer-card"
                  onClick={() => onInspectProject(activeProject)}
                >
                  <div className="taw-trailer-thumb">
                    <img src={assetUrl('/media/taw-breaker/trailer_poster.jpg')} alt="Taw Breaker Trailer" />
                    <span className="taw-trailer-play">
                      <Play size={16} fill="currentColor" />
                    </span>
                    <span className="taw-trailer-badge">
                      {lang === 'es' ? 'TRAILER ALFA · 1:18' : 'ALPHA TRAILER · 1:18'}
                    </span>
                  </div>
                  <div className="taw-trailer-copy">
                    <div className="devlog-num">VIDEO // OFFICIAL TRAILER</div>
                    <div className="taw-trailer-title">
                      {lang === 'es' ? 'Ver Tráiler Completo con Audio' : 'Watch Full Trailer with Audio'}
                    </div>
                  </div>
                </button>

                {TAW_BREAKER_DEVLOGS.map((dev) => (
                  <article key={dev.id} className="devlog-card">
                    <div className="devlog-num">DEVLOG {dev.num}</div>
                    <h3 className="devlog-title">{dev.title[lang]}</h3>
                    <img
                      src={dev.image}
                      alt={dev.title[lang]}
                      onClick={() => onInspectProject(activeProject)}
                    />
                    <p className="devlog-body">{dev.body[lang]}</p>
                    <ul className="devlog-bullets">
                      {dev.bullets[lang].map((b, i) => (
                        <li key={i}>{b}</li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="games-panel-head">
                <span className="world-kicker" style={{ margin: 0, color: '#60a5fa' }}>
                  {opossumTab === 'props'
                    ? `3D PROP INSPECTOR (${selectedPropIdx + 1}/8)`
                    : `UNITY GAMEPLAY (${activeClipIdx + 1}/${OPOSSUM_GAMEPLAY_CLIPS.length})`}
                </span>
                {opossumTab === 'props' ? (
                  <button
                    type="button"
                    className="hud-btn"
                    style={{ padding: '5px 8px', fontSize: 10 }}
                    onClick={() => setCompareOpen(true)}
                  >
                    <SplitSquareHorizontal size={11} />
                    <span>BEAUTY / QUADS</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="hud-btn"
                    style={{ padding: '5px 8px', fontSize: 10 }}
                    onClick={() => onInspectProject(activeProject)}
                  >
                    <Expand size={11} />
                    <span>FULLSCREEN</span>
                  </button>
                )}
              </div>

              {/* 2-Tab Switcher: 3D FBX Props vs Real Unity Gameplay Videos */}
              <div className="opossum-tab-bar">
                <button
                  type="button"
                  className={`opossum-tab-btn ${opossumTab === 'props' ? 'active' : ''}`}
                  onClick={() => {
                    sfx.select();
                    setOpossumTab('props');
                  }}
                >
                  <Box size={11} />
                  <span>{lang === 'es' ? 'PROPS 3D (8)' : '3D PROPS (8)'}</span>
                </button>
                <button
                  type="button"
                  className={`opossum-tab-btn ${opossumTab === 'videos' ? 'active' : ''}`}
                  onClick={() => {
                    sfx.select();
                    setOpossumTab('videos');
                  }}
                >
                  <Film size={11} />
                  <span>{lang === 'es' ? 'GAMEPLAY (3)' : 'GAMEPLAY (3)'}</span>
                </button>
              </div>

              <div className="games-panel-body">
                {opossumTab === 'props' ? (
                  <>
                    {loadingFbx && (
                      <div className="telemetry-chip" style={{ textAlign: 'center', color: '#60a5fa' }}>
                        {t.loadingModel}
                      </div>
                    )}

                    <div className="stats-grid">
                      <div className="stat-box">
                        <div className="stat-label">QUADS (100%)</div>
                        <div className="stat-val">{activeProp.quads}</div>
                      </div>
                      <div className="stat-box">
                        <div className="stat-label">TRIS / NGONS</div>
                        <div className="stat-val">0 / 0</div>
                      </div>
                      <div className="stat-box">
                        <div className="stat-label">GPU TRIS</div>
                        <div className="stat-val">{activeProp.gpuTris}</div>
                      </div>
                      <div className="stat-box">
                        <div className="stat-label">DRAW CALLS</div>
                        <div className="stat-val">1 PBR</div>
                      </div>
                    </div>

                    <div className="cam-presets" style={{ justifyContent: 'space-between' }}>
                      <button
                        type="button"
                        className={`cam-btn ${renderMode === 'shaded' ? 'active' : ''}`}
                        onClick={() => setRenderMode('shaded')}
                      >
                        {t.opossumShaded}
                      </button>
                      <button
                        type="button"
                        className={`cam-btn ${renderMode === 'hybrid' ? 'active' : ''}`}
                        onClick={() => setRenderMode('hybrid')}
                      >
                        {t.opossumHybrid}
                      </button>
                      <button
                        type="button"
                        className={`cam-btn ${renderMode === 'wireframe' ? 'active' : ''}`}
                        onClick={() => setRenderMode('wireframe')}
                      >
                        {t.opossumWireframe}
                      </button>
                    </div>

                    <div className="prop-grid-mini">
                      {OPOSSUM_PROPS.map((prop, idx) => (
                        <button
                          key={prop.slug}
                          type="button"
                          className={`prop-chip ${idx === selectedPropIdx ? 'active' : ''}`}
                          onClick={() => selectProp(idx)}
                        >
                          <img src={prop.beauty} alt={prop.name[lang]} />
                          <span className="prop-chip-name">{prop.name[lang]}</span>
                          <span className="prop-chip-meta">{prop.quads} QUADS</span>
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="opossum-videos-wrap">
                    <div className="opossum-video-stage">
                      <video
                        key={activeClip.src}
                        src={activeClip.src}
                        poster={activeClip.poster}
                        controls
                        autoPlay
                        loop
                        playsInline
                      />
                    </div>
                    <div className="opossum-video-meta">
                      <div className="devlog-num">CLIP {activeClip.num} // IN-ENGINE UNITY</div>
                      <div className="opossum-video-title">{activeClip.title[lang]}</div>
                      <div className="opossum-video-props">{activeClip.propsFeatured[lang]}</div>
                    </div>

                    <div className="opossum-clip-list">
                      {OPOSSUM_GAMEPLAY_CLIPS.map((clip, idx) => (
                        <button
                          key={clip.id}
                          type="button"
                          className={`opossum-clip-card ${idx === activeClipIdx ? 'active' : ''}`}
                          onClick={() => {
                            sfx.select();
                            setActiveClipIdx(idx);
                          }}
                        >
                          <img src={clip.poster} alt={clip.title[lang]} />
                          <div className="opossum-clip-info">
                            <div className="opossum-clip-num">
                              CLIP {clip.num} · {clip.duration}
                            </div>
                            <div className="opossum-clip-name">{clip.title[lang]}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </aside>

        {/* Bottom Game Engine Control Strip */}
        <div className="world-bottom-dock">
          <div className="active-project-bar">
            <div className="active-project-info">
              <div className="active-project-meta">
                <span>
                  {cartridge === 'taw-breaker'
                    ? 'UNITY ENGINE // GLASSMARBLE SHADER + VFX'
                    : `${activeProp.code} // ${t.opossumTopology}`}
                </span>
              </div>
              <div className="active-project-summary">{activeProject.summary[lang]}</div>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {cartridge === 'taw-breaker' && (
                <>
                  <button
                    type="button"
                    className="hud-btn"
                    onClick={() => onInspectProject(activeProject)}
                  >
                    <Play size={13} />
                    <span>{lang === 'es' ? 'VER TRÁILER' : 'WATCH TRAILER'}</span>
                  </button>
                  <button
                    type="button"
                    className="hud-btn primary"
                    style={{ '--accent': '#00e5ff' }}
                    onClick={fireFlash}
                  >
                    <Zap size={13} />
                    <span>{t.tawTriggerFlash}</span>
                  </button>
                </>
              )}
              {cartridge === 'opossum-atelier' && (
                <>
                  <button
                    type="button"
                    className="hud-btn"
                    onClick={() => {
                      sfx.select();
                      setOpossumTab((prev) => (prev === 'videos' ? 'props' : 'videos'));
                    }}
                  >
                    <Film size={13} />
                    <span>
                      {opossumTab === 'videos'
                        ? lang === 'es'
                          ? 'VER PROPS 3D'
                          : 'VIEW 3D PROPS'
                        : lang === 'es'
                          ? 'VER GAMEPLAY (3)'
                          : 'WATCH GAMEPLAY (3)'}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="hud-btn"
                    onClick={() => setCompareOpen(true)}
                  >
                    <Layers size={13} />
                    <span>{t.opossumCompare}</span>
                  </button>
                </>
              )}
              <button
                type="button"
                className="hud-btn primary"
                style={{ '--accent': cartridge === 'taw-breaker' ? '#00e5ff' : '#60a5fa' }}
                onClick={() => onInspectProject(activeProject)}
              >
                <Expand size={13} />
                <span>{t.inspectProject}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Beauty vs 100% Quads Wireframe Split Modal */}
      {compareOpen && (
        <div className="modal-backdrop" onClick={() => setCompareOpen(false)}>
          <div className="modal-panel" style={{ maxWidth: 960 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div className="world-kicker" style={{ color: '#60a5fa' }}>
                  OPOSSUM ATELIER // {activeProp.code} ({activeProp.quads} QUADS)
                </div>
                <h2 className="world-heading" style={{ fontSize: 20 }}>
                  {activeProp.name[lang]}
                </h2>
              </div>
              <button type="button" className="hud-btn" onClick={() => setCompareOpen(false)}>
                <X size={14} />
                <span>{t.close}</span>
              </button>
            </div>

            <div className="modal-body">
              <div className="compare-slider-wrap">
                <img src={activeProp.wireframe} alt="Wireframe 100% Quads" />
                <div
                  className="compare-overlay-clip"
                  style={{ clipPath: `inset(0 ${100 - compareSplit}% 0 0)` }}
                >
                  <img src={activeProp.beauty} alt="Beauty Render" />
                </div>
                <div className="compare-divider" style={{ left: `${compareSplit}%` }} />
                <span className="compare-badge left">BEAUTY PBR</span>
                <span className="compare-badge right">100% QUADS WIREFRAME</span>
              </div>

              <div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={compareSplit}
                  onChange={(e) => setCompareSplit(Number(e.target.value))}
                  className="compare-range"
                />
                <div className="telemetry-chip" style={{ textAlign: 'center', marginTop: 4 }}>
                  {t.dragSlider}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
