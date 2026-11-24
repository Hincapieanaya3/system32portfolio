import { useEffect, useRef } from 'react';
import * as THREE from 'three';

const VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

// Generative backdrop: domain-warped fluid field + iso-contour lines + cursor lens.
// A random seed is rolled on every load (and re-rolled with each click) so the art is never the same twice.
const FRAG = `
precision highp float;
varying vec2 vUv;

uniform float uTime;
uniform float uSeed;
uniform vec2 uMouse;
uniform vec2 uVelocity;
uniform vec2 uResolution;
uniform vec3 uHoverColor;
uniform float uHoverStrength;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = m * p;
    a *= 0.5;
  }
  return v;
}

vec3 blueGamut(float t, float seed) {
  float x = fract(t);
  // Subtle harmonic variation across clicks while staying 100% within rich blue shades
  float mode = fract(seed * 0.173);
  vec3 deepNavy = vec3(0.012, 0.036, 0.11);
  vec3 sapphire = mix(vec3(0.015, 0.14, 0.44), vec3(0.04, 0.10, 0.48), mode);
  vec3 cobalt   = mix(vec3(0.0, 0.38, 0.94), vec3(0.05, 0.46, 0.98), mode);
  vec3 cyan     = vec3(0.0, 0.84, 1.0);
  vec3 iceBlue  = vec3(0.62, 0.94, 1.0);

  vec3 c = mix(deepNavy, sapphire, smoothstep(0.0, 0.32, x));
  c = mix(c, cobalt, smoothstep(0.28, 0.60, x));
  c = mix(c, cyan, smoothstep(0.56, 0.84, x));
  c = mix(c, iceBlue, smoothstep(0.82, 1.0, x));
  return c;
}

void main() {
  vec2 uv = vUv;
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0) * 2.15;
  vec2 m = (uMouse - 0.5) * vec2(aspect, 1.0) * 2.15;

  // Cursor lens: fluid swirls and ripples around the pointer across the screen
  vec2 dv = p - m;
  float dist = length(dv);
  float lens = exp(-dist * 1.85);
  p -= normalize(dv + 1e-4) * lens * 0.36 - uVelocity * lens * 1.05;

  float t = uTime * 0.068;
  float s = uSeed;

  // Centered domain warping so liquid currents span evenly across ALL sides of the screen
  vec2 q = vec2(
    fbm(p + vec2(cos(s) * 2.0, sin(s) * 2.0) + t) - 0.48,
    fbm(p + vec2(5.2, 1.3) - t * 0.9) - 0.48
  );
  vec2 r = vec2(
    fbm(p + 3.2 * q + vec2(1.7, 9.2) + t * 1.35) - 0.48,
    fbm(p + 3.2 * q + vec2(8.3, 2.8) - t * 1.15) - 0.48
  );
  float f = fbm(p + 3.4 * r);

  // Full-screen liquid silk folds & iridescent blue currents
  float folds = 0.5 + 0.5 * sin((f * 5.2 + r.x * 2.6 - r.y * 2.2) * 3.14159 + t * 1.4);
  float body = clamp(smoothstep(0.14, 0.82, f) * 0.65 + folds * 0.48, 0.0, 1.0);

  vec3 hue = blueGamut(body * 0.88 + r.x * 0.16, s);
  vec3 hueAlt = blueGamut(folds * 0.78 + q.y * 0.22, s + 1.7);

  // Deep midnight-blue base + continuous cobalt/cyan liquid ribbons across 100% of viewport
  vec3 col = vec3(0.008, 0.022, 0.058);
  col += mix(hueAlt, hue, folds) * (0.22 + pow(body, 1.25) * 0.78);

  // Specular ice-cyan highlights along wave crests
  float crest = pow(folds, 4.2);
  col += vec3(0.25, 0.86, 1.0) * crest * 0.32;

  // Crisp cyan/cobalt fluid iso-contour lines across the entire field
  float c = abs(fract(f * 12.0 + r.x * 2.0 + s) - 0.5);
  float line = 1.0 - smoothstep(0.0, 0.036, c);
  col += mix(vec3(0.05, 0.52, 1.0), vec3(0.35, 0.92, 1.0), body) * line * (0.22 + body * 0.48);

  // Secondary fine azure liquid threads
  float c2 = abs(fract((q.x - q.y) * 8.5 + t * 0.8) - 0.5);
  float line2 = 1.0 - smoothstep(0.0, 0.024, c2);
  col += vec3(0.0, 0.72, 1.0) * line2 * (0.12 + 0.16 * body);

  // Cursor glow + accent tint when hovering a world portal
  vec3 glow = mix(vec3(0.0, 0.88, 1.0), uHoverColor, uHoverStrength);
  col += glow * lens * (0.24 + uHoverStrength * 0.22);
  col = mix(col, col * (0.78 + glow * 0.75), uHoverStrength * 0.35);

  // Very gentle edge balance + soft filmic shoulder
  float vig = smoothstep(1.65, 0.25, length((uv - 0.5) * vec2(aspect * 0.72, 1.0)));
  col *= 0.82 + 0.18 * vig;
  col = col / (1.0 + col * 0.75);
  col += (hash(uv * uResolution + uTime) - 0.5) * 0.018;

  gl_FragColor = vec4(max(col, 0.0), 1.0);
}
`;

export default function HeroWebGL({ hoveredAccent = '#00e5ff', isHoveringPortal = false }) {
  const hostRef = useRef(null);
  const accentRef = useRef({ color: new THREE.Color('#00e5ff'), strength: 0 });

  useEffect(() => {
    accentRef.current.color.set(hoveredAccent || '#00e5ff');
    accentRef.current.strength = isHoveringPortal ? 1.0 : 0.0;
  }, [hoveredAccent, isHoveringPortal]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
    renderer.setSize(host.clientWidth, host.clientHeight);
    host.appendChild(renderer.domElement);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';

    const bgScene = new THREE.Scene();
    const bgCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const uniforms = {
      uTime: { value: 0 },
      uSeed: { value: Math.random() * 100 },
      uMouse: { value: new THREE.Vector2(0.5, 0.5) },
      uVelocity: { value: new THREE.Vector2(0, 0) },
      uResolution: { value: new THREE.Vector2(host.clientWidth, host.clientHeight) },
      uHoverColor: { value: new THREE.Color('#00e5ff') },
      uHoverStrength: { value: 0 },
    };

    const quad = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms,
        depthWrite: false,
        depthTest: false,
      })
    );
    bgScene.add(quad);

    // Foreground drifting dust for depth
    const fgScene = new THREE.Scene();
    const fgCam = new THREE.PerspectiveCamera(50, host.clientWidth / host.clientHeight, 0.1, 100);
    fgCam.position.z = 8;

    const pCount = 520;
    const positions = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 20;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 12;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 8;
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const pMat = new THREE.PointsMaterial({
      size: 0.04,
      color: 0x9ef5ff,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const particles = new THREE.Points(pGeo, pMat);
    fgScene.add(particles);

    let targetX = 0.5;
    let targetY = 0.5;
    let smoothX = 0.5;
    let smoothY = 0.5;
    let velX = 0;
    let velY = 0;
    let seedTarget = uniforms.uSeed.value;

    const onMove = (e) => {
      const nx = e.clientX / window.innerWidth;
      const ny = 1.0 - e.clientY / window.innerHeight;
      velX = (nx - targetX) * 2.2;
      velY = (ny - targetY) * 2.2;
      targetX = nx;
      targetY = ny;
    };

    // Each click re-rolls the generative artwork
    const onDown = (e) => {
      if (e.target?.closest?.('button, a, input')) return;
      seedTarget += 4 + Math.random() * 9;
    };

    const onResize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      renderer.setSize(w, h);
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      uniforms.uResolution.value.set(w, h);
      fgCam.aspect = w / h;
      fgCam.updateProjectionMatrix();
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('resize', onResize);

    const clock = new THREE.Clock();
    let rafId = 0;
    renderer.autoClear = false;

    const animate = () => {
      rafId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      uniforms.uTime.value = t;

      smoothX += (targetX - smoothX) * 0.08;
      smoothY += (targetY - smoothY) * 0.08;
      velX *= 0.9;
      velY *= 0.9;
      uniforms.uSeed.value += (seedTarget - uniforms.uSeed.value) * 0.035;

      uniforms.uMouse.value.set(smoothX, smoothY);
      uniforms.uVelocity.value.set(velX, velY);
      uniforms.uHoverColor.value.lerp(accentRef.current.color, 0.08);
      uniforms.uHoverStrength.value +=
        (accentRef.current.strength - uniforms.uHoverStrength.value) * 0.08;

      particles.rotation.y = t * 0.04 + (smoothX - 0.5) * 0.35;
      particles.rotation.x = (smoothY - 0.5) * -0.22;
      pMat.color.lerp(accentRef.current.color, 0.05);

      renderer.clear();
      renderer.render(bgScene, bgCamera);
      renderer.clearDepth();
      renderer.render(fgScene, fgCam);
    };
    animate();

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('resize', onResize);
      pGeo.dispose();
      pMat.dispose();
      quad.geometry.dispose();
      quad.material.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === host) {
        host.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={hostRef} className="webgl-canvas-wrap" />;
}
