import { useEffect, useRef, useState } from 'react';
import { sfx } from '../utils/sfx';

const COPY = {
  en: {
    head: 'OPENXR SPATIAL RUNTIME v3.2 // HEADSET CALIBRATION',
    lines: [
      '> DETECTING HMD OPTICS (90Hz) .... OK',
      '> IPD CALIBRATION 64.0mm ......... LOCKED',
      '> 6DOF GUARDIAN BOUNDARY MESH .... ACTIVE',
      '> MOUNTING COLOMBIAN_TAVERN.VR ... OK',
      '> TOUCHDESIGNER GPU NODES ........ SYNCED',
    ],
    kicker: 'WORLD 03 // 6DOF SPATIAL XR CHAMBER',
    title: 'VIRTUAL REALITY',
    sub: '& TOUCHDESIGNER REAL-TIME LAB',
    cta: 'PUT ON HEADSET - ENTER VR',
    hint: 'CLICK · TAP · ENTER · SKIP CALIBRATION',
    telemetry: 'IPD 64mm  ·  90Hz OLED  ·  6DOF TRACKING',
  },
  es: {
    head: 'OPENXR SPATIAL RUNTIME v3.2 // CALIBRACION DE VISOR',
    lines: [
      '> DETECTANDO OPTICA HMD (90Hz) ... OK',
      '> CALIBRACION IPD 64.0mm ......... FIJADO',
      '> MALLA GUARDIAN 6DOF ............ ACTIVA',
      '> MONTANDO COLOMBIAN_TAVERN.VR ... OK',
      '> NODOS GPU TOUCHDESIGNER ........ SYNC',
    ],
    kicker: 'WORLD 03 // CAMARA ESPACIAL XR 6DOF',
    title: 'VIRTUAL REALITY',
    sub: '& LABORATORIO TOUCHDESIGNER',
    cta: 'PONERSE VISOR - ENTRAR A VR',
    hint: 'CLIC · TOQUE · ENTER',
    telemetry: 'IPD 64mm  ·  90Hz OLED  ·  RASTREO 6DOF',
  },
};

const LINE_MS = 280;

export default function VRBootOverlay({ lang, onEnter }) {
  const t = COPY[lang] || COPY.en;
  const [phase, setPhase] = useState('calibrating'); // calibrating -> ready -> entering
  const [shown, setShown] = useState(0);
  const [pct, setPct] = useState(0);
  const phaseRef = useRef('calibrating');

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    if (phase !== 'calibrating') return undefined;
    const total = t.lines.length;
    const timers = [];
    for (let i = 1; i <= total; i++) {
      timers.push(window.setTimeout(() => setShown(i), 180 + i * LINE_MS));
    }
    const tick = window.setInterval(() => {
      setPct((p) => Math.min(100, p + 4));
    }, ((total + 1) * LINE_MS) / 25);
    const done = window.setTimeout(() => setPhase('ready'), 200 + (total + 1) * LINE_MS);
    return () => {
      timers.forEach(window.clearTimeout);
      window.clearInterval(tick);
      window.clearTimeout(done);
    };
  }, [phase, t.lines.length]);

  const enterVR = () => {
    if (phaseRef.current === 'calibrating') {
      setShown(t.lines.length);
      setPct(100);
      setPhase('ready');
      return;
    }
    if (phaseRef.current !== 'ready') return;
    phaseRef.current = 'entering';
    setPhase('entering');
    sfx.start();
    onEnter();
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        enterVR();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div
      className={`vr-boot ${phase === 'entering' ? 'is-entering' : ''}`}
      onClick={enterVR}
      role="button"
      tabIndex={0}
    >
      {/* Curved Binocular VR Lens Optics Backdrop */}
      <div className="vr-boot-optics" aria-hidden="true">
        <div className="vr-lens vr-lens-left">
          <div className="vr-lens-ring" />
          <div className="vr-lens-crosshair" />
        </div>
        <div className="vr-lens vr-lens-right">
          <div className="vr-lens-ring" />
          <div className="vr-lens-crosshair" />
        </div>
        <div className="vr-optics-scanline" />
      </div>

      <div className="vr-boot-inner">
        {phase === 'calibrating' ? (
          <div className="vr-boot-log">
            <div className="vr-boot-head">{t.head}</div>
            {t.lines.slice(0, shown).map((line) => (
              <div key={line} className="vr-boot-line">
                {line}
              </div>
            ))}
            <div className="vr-boot-meter">
              <div className="vr-boot-meter-fill" style={{ width: `${pct}%` }} />
            </div>
            <div className="vr-boot-meta">{t.telemetry} · {String(pct).padStart(3, '0')}%</div>
          </div>
        ) : (
          <div className="vr-boot-ready">
            <div className="vr-boot-kicker">{t.kicker}</div>
            <h2 className="vr-boot-title">{t.title}</h2>
            <div className="vr-boot-sub">{t.sub}</div>
            <div className="vr-boot-pill">{t.cta}</div>
            <div className="vr-boot-telemetry">{t.telemetry}</div>
            <div className="vr-boot-hint">{t.hint}</div>
          </div>
        )}
      </div>
    </div>
  );
}
