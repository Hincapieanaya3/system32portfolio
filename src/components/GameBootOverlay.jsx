import { useEffect, useRef, useState } from 'react';
import { sfx } from '../utils/sfx';

const COPY = {
  en: {
    head: 'ANTILIFE ENGINE v2026.1 // BOOT SEQUENCE',
    lines: [
      '> CHECKING GPU ................. OK',
      '> LOADING TAW_BREAKER.UNITY ..... OK',
      '> MOUNTING OPOSSUM_ATELIER.FBX .. OK',
      '> COMPILING GLASSMARBLE SHADER .. OK',
      '> PLAYER 1 DETECTED ............. OK',
    ],
    title: 'VIDEO GAMES',
    sub: '& 3D TECHNICAL ART',
    press: 'PRESS START',
    hint: 'CLICK · TAP · ENTER',
    loading: 'LOADING',
  },
  es: {
    head: 'ANTILIFE ENGINE v2026.1 // SECUENCIA DE ARRANQUE',
    lines: [
      '> VERIFICANDO GPU ............... OK',
      '> CARGANDO TAW_BREAKER.UNITY .... OK',
      '> MONTANDO OPOSSUM_ATELIER.FBX .. OK',
      '> COMPILANDO SHADER GLASSMARBLE . OK',
      '> JUGADOR 1 DETECTADO ........... OK',
    ],
    title: 'VIDEOJUEGOS',
    sub: '& 3D TECHNICAL ART',
    press: 'PRESS START',
    hint: 'CLIC · TOQUE · ENTER',
    loading: 'CARGANDO',
  },
};

const LINE_MS = 430;

export default function GameBootOverlay({ lang, onStart }) {
  const t = COPY[lang] || COPY.en;
  const [phase, setPhase] = useState('boot'); // boot -> ready -> leaving
  const [shown, setShown] = useState(0);
  const [pct, setPct] = useState(0);
  const phaseRef = useRef('boot');

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    if (phase !== 'boot') return undefined;
    const total = t.lines.length;
    const timers = [];
    for (let i = 1; i <= total; i++) {
      timers.push(window.setTimeout(() => setShown(i), 350 + i * LINE_MS));
    }
    const tick = window.setInterval(() => {
      setPct((p) => Math.min(100, p + 2));
    }, ((total + 1) * LINE_MS) / 50);
    const done = window.setTimeout(() => setPhase('ready'), 350 + (total + 1) * LINE_MS + 250);
    return () => {
      timers.forEach(window.clearTimeout);
      window.clearInterval(tick);
      window.clearTimeout(done);
    };
  }, [phase, t.lines.length]);

  const begin = () => {
    if (phaseRef.current === 'boot') {
      setShown(t.lines.length);
      setPct(100);
      setPhase('ready');
      return;
    }
    if (phaseRef.current !== 'ready') return;
    phaseRef.current = 'leaving';
    setPhase('leaving');
    sfx.start();
    onStart();
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        begin();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div
      className={`game-boot ${phase === 'leaving' ? 'is-leaving' : ''}`}
      onClick={begin}
      role="button"
      tabIndex={0}
    >
      <div className="game-boot-crt" />
      <div className="game-boot-inner">
        {phase === 'boot' ? (
          <div className="game-boot-log">
            <div className="game-boot-head">{t.head}</div>
            {t.lines.slice(0, shown).map((l) => (
              <div key={l} className="game-boot-line">
                {l}
              </div>
            ))}
            <div className="game-boot-bar">
              <div className="game-boot-bar-fill" style={{ width: `${pct}%` }} />
            </div>
            <div className="game-boot-pct">
              {t.loading} {String(pct).padStart(3, '0')}%
            </div>
          </div>
        ) : (
          <div className="game-boot-title-screen">
            <div className="game-boot-kicker">WORLD 04 // PLAYER 1</div>
            <h2 className="game-boot-title">{t.title}</h2>
            <div className="game-boot-sub">{t.sub}</div>
            <div className="game-boot-press">{t.press}</div>
            <div className="game-boot-hint">{t.hint}</div>
          </div>
        )}
      </div>
    </div>
  );
}
