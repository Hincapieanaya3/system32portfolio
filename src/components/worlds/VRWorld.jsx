import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import gsap from 'gsap';
import { Cpu, Expand, Eye, EyeOff, Scan } from 'lucide-react';
import VRBootOverlay from '../VRBootOverlay';
import { sfx } from '../../utils/sfx';
import { PROJECTS, UI_TEXT, WORLDS } from '../../data/portfolioData';

/**
 * Builds a gently concave curved XR screen facing +Z with exact 0..1 UVs (no mirroring).
 */
function createCurvedScreenGeometry(width = 8.4, height = 4.72, radius = 12.5, segX = 48, segY = 8) {
  const geo = new THREE.BufferGeometry();
  const arcAngle = width / radius;
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let iy = 0; iy <= segY; iy++) {
    const v = iy / segY;
    const y = (v - 0.5) * height;
    for (let ix = 0; ix <= segX; ix++) {
      const u = ix / segX;
      const theta = (u - 0.5) * arcAngle;
      const x = Math.sin(theta) * radius;
      // Curve gently forward at the edges (concave toward viewer at +Z)
      const z = radius - Math.cos(theta) * radius;
      positions.push(x, y, z);
      uvs.push(u, v);
    }
  }

  const row = segX + 1;
  for (let iy = 0; iy < segY; iy++) {
    for (let ix = 0; ix < segX; ix++) {
      const a = iy * row + ix;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      indices.push(a, b, d, a, d, c);
    }
  }

  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds curved top/bottom glowing frame rails matching the XR cinema screen.
 */
function createCurvedArcPoints(width = 8.65, radius = 12.5, yOffset = 0, segs = 48) {
  const arcAngle = width / radius;
  const pts = [];
  for (let i = 0; i <= segs; i++) {
    const u = i / segs;
    const theta = (u - 0.5) * arcAngle;
    pts.push(new THREE.Vector3(Math.sin(theta) * radius, yOffset, radius - Math.cos(theta) * radius + 0.03));
  }
  return pts;
}

export default function VRWorld({ lang, onInspectProject }) {
  const t = UI_TEXT[lang];
  const worldMeta = WORLDS.find((w) => w.id === 'vr');
  const vrProjects = useMemo(() => PROJECTS.filter((p) => p.world === 'vr'), []);

  const [activeIdx, setActiveIdx] = useState(0);
  const [entered, setEntered] = useState(false);
  const [visorHud, setVisorHud] = useState(true);
  const activeProject = vrProjects[activeIdx];

  const canvasHostRef = useRef(null);
  const apiRef = useRef(null);
  const enteredRef = useRef(false);
  const diveInRef = useRef(null);

  const handleEnterVR = useCallback(() => {
    enteredRef.current = true;
    diveInRef.current?.();
    window.setTimeout(() => setEntered(true), 680);
  }, []);

  const selectProject = useCallback((idx) => {
    setActiveIdx(idx);
    sfx.select();
    apiRef.current?.pulseFrame();
  }, []);

  useEffect(() => {
    const host = canvasHostRef.current;
    if (!host) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020712);
    scene.fog = new THREE.FogExp2(0x020712, 0.022);

    const camera = new THREE.PerspectiveCamera(54, host.clientWidth / host.clientHeight, 0.1, 180);
    const homePos = new THREE.Vector3(0, 2.2, 12.2);
    const homeTarget = new THREE.Vector3(0, 1.85, 0);
    camera.position.copy(homePos);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.target.copy(homeTarget);
    controls.minDistance = 6.5;
    controls.maxDistance = 24;
    controls.maxPolarAngle = Math.PI * 0.58;
    controls.enablePan = false;

    scene.add(new THREE.AmbientLight(0x284b78, 1.25));
    const coreLight = new THREE.PointLight(0x00e5ff, 38, 36);
    coreLight.position.set(0, 3.2, 4.5);
    scene.add(coreLight);

    const blueLight = new THREE.PointLight(0x0066ff, 30, 32);
    blueLight.position.set(-7, 5, -3);
    scene.add(blueLight);

    // 360° Enclosing VR Geodesic Holodeck Dome
    const domeMesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(36, 2),
      new THREE.MeshBasicMaterial({
        color: 0x0077ff,
        wireframe: true,
        transparent: true,
        opacity: 0.13,
      })
    );
    domeMesh.position.y = 2.0;
    scene.add(domeMesh);

    // Infinite VR Cybernetic Grid + Glowing Guardian Floor Boundary Rings
    const vrGrid = new THREE.GridHelper(90, 60, 0x0096ff, 0x081e3a);
    vrGrid.position.y = -2.6;
    scene.add(vrGrid);

    const guardianInner = new THREE.Mesh(
      new THREE.TorusGeometry(6.6, 0.045, 12, 96),
      new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.55 })
    );
    guardianInner.rotation.x = Math.PI / 2;
    guardianInner.position.y = -2.56;
    scene.add(guardianInner);

    const guardianOuter = new THREE.Mesh(
      new THREE.TorusGeometry(7.25, 0.022, 12, 96),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.28 })
    );
    guardianOuter.rotation.x = Math.PI / 2;
    guardianOuter.position.y = -2.56;
    scene.add(guardianOuter);

    // Subtle Guardian boundary vertical energy curtain
    const guardianCurtain = new THREE.Mesh(
      new THREE.CylinderGeometry(6.6, 6.6, 0.85, 64, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0x00e5ff,
        transparent: true,
        opacity: 0.06,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    guardianCurtain.position.y = -2.14;
    scene.add(guardianCurtain);

    // Central Curved Spatial XR Cinema Screen + Gyroscopic Rings
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

    const holoGroup = new THREE.Group();
    holoGroup.position.set(0, 2.0, 0);

    const screenW = 8.4;
    const screenH = 4.72;
    const screenR = 12.5;
    const screenGeo = createCurvedScreenGeometry(screenW, screenH, screenR, 48, 8);
    const screenMesh = new THREE.Mesh(
      screenGeo,
      new THREE.MeshBasicMaterial({ map: videoTex, side: THREE.DoubleSide })
    );
    holoGroup.add(screenMesh);

    // Curved luminous XR bezel rails (top & bottom arcs + subtle halo wireframe behind)
    const bezelMat = new THREE.LineBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.82,
    });
    const topRail = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(createCurvedArcPoints(screenW + 0.3, screenR, screenH / 2 + 0.14)),
      bezelMat
    );
    const botRail = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(createCurvedArcPoints(screenW + 0.3, screenR, -screenH / 2 - 0.14)),
      bezelMat
    );
    holoGroup.add(topRail, botRail);

    const backWire = new THREE.Mesh(
      createCurvedScreenGeometry(screenW + 0.34, screenH + 0.34, screenR + 0.25, 18, 6),
      new THREE.MeshBasicMaterial({
        color: 0x00e5ff,
        wireframe: true,
        transparent: true,
        opacity: 0.2,
      })
    );
    backWire.position.z = -0.14;
    holoGroup.add(backWire);

    // Rotating Gyroscopic Spatial Rings around XR Screen
    const ring1 = new THREE.Mesh(
      new THREE.TorusGeometry(5.35, 0.032, 16, 100),
      new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.48 })
    );
    holoGroup.add(ring1);

    const ring2 = new THREE.Mesh(
      new THREE.TorusGeometry(6.05, 0.022, 16, 100),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.32 })
    );
    ring2.rotation.x = Math.PI * 0.36;
    holoGroup.add(ring2);

    scene.add(holoGroup);

    // Dual 3D VR Controller Anchors + Interactive Laser Pointer Rays
    const leftOrigin = new THREE.Vector3(-3.8, -1.55, 7.6);
    const rightOrigin = new THREE.Vector3(3.8, -1.55, 7.6);

    const buildControllerGhost = (origin) => {
      const grp = new THREE.Group();
      grp.position.copy(origin);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.32, 0.028, 12, 32),
        new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.72 })
      );
      ring.rotation.x = Math.PI * 0.4;
      const grip = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.06, 0.45, 12),
        new THREE.MeshStandardMaterial({
          color: 0x081a34,
          emissive: 0x0077ff,
          emissiveIntensity: 0.45,
          roughness: 0.3,
          metalness: 0.8,
        })
      );
      grip.position.y = -0.22;
      grp.add(ring, grip);
      scene.add(grp);
      return grp;
    };

    const leftCtrl = buildControllerGhost(leftOrigin);
    const rightCtrl = buildControllerGhost(rightOrigin);

    const makeLaser = (origin, color) => {
      const pts = new Float32Array([origin.x, origin.y, origin.z, 0, 2.0, 0.2]);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
      const line = new THREE.Line(
        geo,
        new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.42 })
      );
      scene.add(line);
      return { line, geo };
    };

    const leftLaser = makeLaser(leftOrigin, 0x38bdf8);
    const rightLaser = makeLaser(rightOrigin, 0x00e5ff);

    // Laser Reticle Dot on the Curved XR Screen
    const reticleDot = new THREE.Mesh(
      new THREE.RingGeometry(0.055, 0.105, 24),
      new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
    );
    reticleDot.position.set(0, 2.0, 0.25);
    scene.add(reticleDot);

    // TouchDesigner-Style 3D Operator Node Network + Data Pulses
    const nodePositions = [
      new THREE.Vector3(-8.2, 4.4, -2.8),
      new THREE.Vector3(-6.8, -0.3, 2.0),
      new THREE.Vector3(8.1, 4.5, -2.4),
      new THREE.Vector3(7.1, -0.4, 2.2),
      new THREE.Vector3(-4.8, 6.0, -5.4),
      new THREE.Vector3(4.9, 5.8, -5.6),
    ];

    const nodes = [];
    const pulses = [];

    nodePositions.forEach((pos, idx) => {
      const nodeColor = idx % 2 === 0 ? 0x00e5ff : 0x0077ff;
      const nodeMesh = new THREE.Mesh(
        new THREE.BoxGeometry(1.15, 0.72, 0.25),
        new THREE.MeshStandardMaterial({
          color: 0x061326,
          emissive: nodeColor,
          emissiveIntensity: 0.55,
          roughness: 0.25,
          metalness: 0.8,
        })
      );
      nodeMesh.position.copy(pos);
      nodeMesh.lookAt(0, 2, 0);
      scene.add(nodeMesh);
      nodes.push(nodeMesh);

      const mid = pos.clone().lerp(new THREE.Vector3(0, 2.0, 0), 0.5);
      mid.y += idx % 2 === 0 ? 1.2 : -1.0;
      const curve = new THREE.QuadraticBezierCurve3(pos, mid, new THREE.Vector3(0, 2.0, -0.2));

      const lineGeo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(36));
      const lineMat = new THREE.LineBasicMaterial({
        color: nodeColor,
        transparent: true,
        opacity: 0.42,
      });
      scene.add(new THREE.Line(lineGeo, lineMat));

      const pulse = new THREE.Mesh(
        new THREE.SphereGeometry(0.11, 10, 10),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      scene.add(pulse);
      pulses.push({ mesh: pulse, curve, offset: idx / nodePositions.length });
    });

    // Reactive GPU-Style Harmonic Particle Field (2,200 particles)
    const pCount = 2200;
    const basePos = new Float32Array(pCount * 3);
    const curPos = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount; i++) {
      const radius = 6.2 + Math.random() * 16;
      const theta = Math.random() * Math.PI * 2;
      const y = (Math.random() - 0.5) * 12 + 2.0;
      const x = Math.cos(theta) * radius;
      const z = Math.sin(theta) * radius;
      basePos[i * 3] = x;
      basePos[i * 3 + 1] = y;
      basePos[i * 3 + 2] = z;
      curPos[i * 3] = x;
      curPos[i * 3 + 1] = y;
      curPos[i * 3 + 2] = z;
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(curPos, 3));
    const pMat = new THREE.PointsMaterial({
      size: 0.075,
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const particleField = new THREE.Points(pGeo, pMat);
    scene.add(particleField);

    const setProject = (proj) => {
      if (proj.preview && video.getAttribute('data-src') !== proj.preview) {
        video.setAttribute('data-src', proj.preview);
        video.src = proj.preview;
        video.currentTime = 0;
        video.play().catch(() => {});
      }
    };

    const pulseFrame = () => {
      gsap.killTweensOf(backWire.material);
      backWire.material.opacity = 0.72;
      gsap.to(backWire.material, { opacity: 0.2, duration: 0.85, ease: 'power2.out' });
      gsap.killTweensOf(guardianInner.scale);
      guardianInner.scale.setScalar(1.06);
      gsap.to(guardianInner.scale, { x: 1, y: 1, z: 1, duration: 0.75, ease: 'power2.out' });
    };

    apiRef.current = { setProject, pulseFrame };
    setProject(vrProjects[0]);

    // Spatial headset camera dive when entering VR
    const diveIn = () => {
      gsap.killTweensOf(camera.position);
      gsap.killTweensOf(camera);
      camera.position.set(0, 5.4, 24.5);
      camera.fov = 104;
      camera.updateProjectionMatrix();
      controls.target.copy(homeTarget);
      gsap.to(camera.position, {
        x: homePos.x,
        y: homePos.y,
        z: homePos.z,
        duration: 1.9,
        ease: 'power3.out',
      });
      gsap.to(camera, {
        fov: 54,
        duration: 1.9,
        ease: 'power2.out',
        onUpdate: () => camera.updateProjectionMatrix(),
      });
    };
    diveInRef.current = diveIn;

    if (!enteredRef.current) {
      camera.position.set(0, 5.4, 24.5);
      camera.fov = 104;
      camera.updateProjectionMatrix();
    }

    let mouseX = 0;
    let mouseY = 0;
    let smoothX = 0;
    let smoothY = 0;
    const onMove = (e) => {
      mouseX = (e.clientX / window.innerWidth) * 2 - 1;
      mouseY = -((e.clientY / window.innerHeight) * 2 - 1);
    };

    const onResize = () => {
      if (!host) return;
      camera.aspect = host.clientWidth / host.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(host.clientWidth, host.clientHeight);
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('resize', onResize);

    const clock = new THREE.Clock();
    let rafId = 0;

    const animate = () => {
      rafId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      smoothX += (mouseX - smoothX) * 0.09;
      smoothY += (mouseY - smoothY) * 0.09;

      domeMesh.rotation.y = t * 0.018;
      guardianInner.material.opacity = 0.45 + Math.sin(t * 2.2) * 0.14;
      guardianCurtain.material.opacity = 0.045 + Math.sin(t * 2.2) * 0.02;

      ring1.rotation.z = t * 0.22;
      ring1.rotation.y = Math.sin(t * 0.35) * 0.28 + smoothX * 0.2;
      ring2.rotation.y = -t * 0.3;
      ring2.rotation.x = Math.PI * 0.36 - smoothY * 0.18;

      const holoY = 2.0 + Math.sin(t * 1.3) * 0.12;
      holoGroup.position.y = holoY;

      // Track target point on the curved XR cinema screen for VR controller laser pointers
      const targetX = THREE.MathUtils.clamp(smoothX * 3.8, -3.9, 3.9);
      const targetY = THREE.MathUtils.clamp(holoY + smoothY * 2.0, holoY - 2.1, holoY + 2.1);
      const theta = targetX / screenR;
      const targetZ = screenR - Math.cos(theta) * screenR + 0.12;

      reticleDot.position.set(targetX, targetY, targetZ);
      reticleDot.rotation.y = -theta;

      leftCtrl.lookAt(targetX, targetY, targetZ);
      rightCtrl.lookAt(targetX, targetY, targetZ);

      const lArr = leftLaser.geo.attributes.position.array;
      lArr[3] = targetX - 0.08;
      lArr[4] = targetY;
      lArr[5] = targetZ;
      leftLaser.geo.attributes.position.needsUpdate = true;

      const rArr = rightLaser.geo.attributes.position.array;
      rArr[3] = targetX + 0.08;
      rArr[4] = targetY;
      rArr[5] = targetZ;
      rightLaser.geo.attributes.position.needsUpdate = true;

      nodes.forEach((n, idx) => {
        n.position.y = nodePositions[idx].y + Math.sin(t * 1.5 + idx) * 0.22;
      });

      pulses.forEach((p) => {
        const u = (t * 0.45 + p.offset) % 1;
        p.mesh.position.copy(p.curve.getPointAt(u));
      });

      const attr = pGeo.attributes.position;
      for (let i = 0; i < pCount; i += 2) {
        const bx = basePos[i * 3];
        const by = basePos[i * 3 + 1];
        attr.array[i * 3 + 1] = by + Math.sin(t * 1.4 + bx * 0.35 + smoothX * 2.0) * 0.45;
      }
      attr.needsUpdate = true;
      particleField.rotation.y = t * 0.04 + smoothX * 0.12;

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      gsap.killTweensOf(camera.position);
      gsap.killTweensOf(camera);
      cancelAnimationFrame(rafId);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('resize', onResize);
      controls.dispose();
      video.pause();
      video.src = '';
      videoTex.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === host) {
        host.removeChild(renderer.domElement);
      }
    };
  }, [vrProjects]);

  useEffect(() => {
    apiRef.current?.setProject(activeProject);
  }, [activeProject]);

  return (
    <div
      className={`world-viewport vr-world ${entered ? 'is-entered' : ''}`}
      style={{ '--world-accent': worldMeta.accent }}
    >
      <div ref={canvasHostRef} className="world-canvas-host" />

      {/* Binocular VR Headset Entry Overlay */}
      {!entered && <VRBootOverlay lang={lang} onEnter={handleEnterVR} />}

      {/* Subtle Optical VR Visor Edge & Corner Brackets (Non-Obstructive) */}
      {entered && visorHud && (
        <div className="vr-visor-overlay" aria-hidden="true">
          <div className="vr-visor-vignette" />
          <div className="vr-visor-corner tl" />
          <div className="vr-visor-corner tr" />
          <div className="vr-visor-corner bl" />
          <div className="vr-visor-corner br" />
        </div>
      )}

      <div className="world-hud-layer">
        <div className="world-hud-top">
          <div className="world-header-card">
            <div className="world-kicker">
              WORLD 03 // {lang === 'es' ? 'CAMARA ESPACIAL VR & NODOS' : '6DOF VR CHAMBER & NODES'}
            </div>
            <h1 className="world-heading">{worldMeta.name[lang]}</h1>
            <p className="world-desc">{worldMeta.tagline[lang]}</p>
          </div>

          <div className="world-controls-cluster">
            <div className="telemetry-chip vr-telemetry-chip">
              <Scan size={11} />
              <span>6DOF · 90Hz · IPD 64mm · {activeProject.nodeType}</span>
            </div>
            <button
              type="button"
              className={`hud-btn ${visorHud ? 'primary' : ''}`}
              style={{ '--accent': worldMeta.accent, padding: '6px 10px', fontSize: 10 }}
              onClick={() => setVisorHud((v) => !v)}
            >
              {visorHud ? <Eye size={12} /> : <EyeOff size={12} />}
              <span>{visorHud ? 'VISOR HUD' : 'VISOR OFF'}</span>
            </button>
          </div>
        </div>

        <div className="world-bottom-dock">
          <div className="active-project-bar">
            <div className="active-project-info">
              <div className="active-project-meta">
                <span>
                  VR NODE 0{activeIdx + 1} / 0{vrProjects.length}
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
            {vrProjects.map((proj, idx) => (
              <button
                key={proj.id}
                type="button"
                className={`channel-card ${idx === activeIdx ? 'active' : ''}`}
                onClick={() => selectProject(idx)}
              >
                <img className="channel-thumb" src={proj.poster} alt={proj.title} />
                <div className="channel-text">
                  <div className="channel-ch">
                    <Cpu size={9} style={{ display: 'inline', marginRight: 4 }} />
                    {proj.nodeType}
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
