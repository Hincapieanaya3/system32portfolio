import { ArrowLeft, ArrowRight, Layers, Pause, Play, Sparkles, X } from 'lucide-react';
import { BUILD_PHASES } from '../data/stageEngineering';

export default function SliceMonitor2D({
  projectTitle,
  spec,
  lang,
  hoveredSlice,
  onHoverSlice,
  onClose,
}) {
  if (!spec) return null;

  const aspect = spec.compWidth / spec.compHeight;

  return (
    <div className="slice-monitor-panel">
      <div className="slice-monitor-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <Layers size={15} style={{ color: '#00f0ff', flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <div className="slice-monitor-kicker">
              {lang === 'es' ? 'MAPEO 2D → ESCENARIO 3D' : '2D PIXELMAP → 3D STAGE'}
            </div>
            <div className="slice-monitor-proj">{projectTitle}</div>
          </div>
        </div>

        <button
          type="button"
          className="slice-close-pill"
          onClick={onClose}
          title={lang === 'es' ? 'Volver al show en vivo' : 'Exit build view'}
        >
          <X size={12} />
          <span>{lang === 'es' ? 'CERRAR' : 'EXIT'}</span>
        </button>
      </div>

      <div className="slice-canvas-section">
        <div className="slice-canvas-meta">
          <span>
            {lang === 'es' ? 'LIENZO' : 'INPUT'}: {spec.compWidth}×{spec.compHeight}px
          </span>
          <span className="slice-hint-pill">
            {lang === 'es' ? '✦ PASA EL CURSOR EN 2D O 3D' : '✦ HOVER 2D OR 3D SCREEN'}
          </span>
        </div>

        <div className="slice-canvas-frame">
          <div
            className="slice-canvas-box"
            style={{
              aspectRatio: `${spec.compWidth} / ${spec.compHeight}`,
              width: aspect >= 1.7 ? '100%' : 'auto',
              height: aspect >= 1.7 ? 'auto' : '124px',
              maxHeight: aspect > 3 ? '70px' : '128px',
              maxWidth: '100%',
            }}
          >
            <img src={spec.pixelmapUrl} alt="2D Pixelmap" className="slice-canvas-bg" />

            {spec.cutouts.map((c, idx) => (
              <div
                key={idx}
                className="slice-cutout-rect"
                style={{
                  left: `${(c.x / spec.compWidth) * 100}%`,
                  top: `${(c.y / spec.compHeight) * 100}%`,
                  width: `${(c.w / spec.compWidth) * 100}%`,
                  height: `${(c.h / spec.compHeight) * 100}%`,
                }}
              >
                {c.label && <span>{c.label}</span>}
              </div>
            ))}

            {spec.slices.map((s) => {
              const isHov = hoveredSlice === s.id;
              const isDimmed = Boolean(hoveredSlice && !isHov);
              return (
                <div
                  key={s.id}
                  className={`slice-rect ${isHov ? 'is-hovered' : ''} ${isDimmed ? 'is-dimmed' : ''}`}
                  style={{
                    '--slice-color': s.color,
                    left: `${(s.pxRect.x / spec.compWidth) * 100}%`,
                    top: `${(s.pxRect.y / spec.compHeight) * 100}%`,
                    width: `${(s.pxRect.w / spec.compWidth) * 100}%`,
                    height: `${(s.pxRect.h / spec.compHeight) * 100}%`,
                  }}
                  onMouseEnter={() => onHoverSlice(s.id)}
                  onMouseLeave={() => onHoverSlice(null)}
                  onClick={() => onHoverSlice(hoveredSlice === s.id ? null : s.id)}
                >
                  <span className="slice-rect-tag">{s.name[lang]}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="slice-legend-list">
          {spec.slices.map((s) => {
            const isHov = hoveredSlice === s.id;
            return (
              <button
                key={s.id}
                type="button"
                className={`slice-legend-item ${isHov ? 'active' : ''}`}
                style={{ '--slice-color': s.color }}
                onMouseEnter={() => onHoverSlice(s.id)}
                onMouseLeave={() => onHoverSlice(null)}
                onClick={() => onHoverSlice(hoveredSlice === s.id ? null : s.id)}
              >
                <span className="slice-legend-dot" />
                <span className="slice-legend-name">{s.name[lang]}</span>
                <span className="slice-legend-dim">
                  {s.physical} · {s.pxLabel}
                </span>
              </button>
            );
          })}
        </div>

        <div className="slice-hardware-foot">{spec.hardware}</div>
      </div>
    </div>
  );
}

export function BuildScrubberDock({
  lang,
  buildPhase,
  onSelectPhase,
  autoBuild,
  onToggleAutoBuild,
  onClose,
}) {
  const activePhaseObj = BUILD_PHASES.find((p) => p.step === buildPhase) || BUILD_PHASES[0];

  const nextStep = () => {
    onSelectPhase(buildPhase >= 4 ? 1 : buildPhase + 1);
  };
  const prevStep = () => {
    onSelectPhase(buildPhase <= 1 ? 4 : buildPhase - 1);
  };

  return (
    <div className="guided-build-dock">
      <div className="guided-build-top">
        <div className="guided-step-Readout">
          <span className="guided-step-badge">
            <Sparkles size={11} />
            {lang === 'es' ? `ETAPA ${buildPhase} DE 4` : `STEP ${buildPhase} OF 4`}
          </span>
          <span className="guided-step-desc">{activePhaseObj.desc[lang]}</span>
        </div>

        <div className="guided-nav-btns">
          <button
            type="button"
            className={`slice-mini-btn ${autoBuild ? 'active' : ''}`}
            onClick={onToggleAutoBuild}
          >
            {autoBuild ? <Pause size={11} /> : <Play size={11} />}
            <span>{lang === 'es' ? 'AUTO-TOUR' : 'AUTO-TOUR'}</span>
          </button>
          <button
            type="button"
            className="slice-mini-btn"
            onClick={prevStep}
            aria-label={lang === 'es' ? 'Etapa anterior' : 'Previous step'}
          >
            <ArrowLeft size={12} />
          </button>
          <button type="button" className="guided-next-btn" onClick={nextStep}>
            <span>
              {buildPhase < 4
                ? lang === 'es'
                  ? 'SIGUIENTE ETAPA'
                  : 'NEXT STEP'
                : lang === 'es'
                  ? 'REPETIR PROCESO'
                  : 'REPLAY BUILD'}
            </span>
            <ArrowRight size={12} />
          </button>
          <button
            type="button"
            className="slice-mini-btn"
            onClick={onClose}
            title={lang === 'es' ? 'Volver a vista del proyecto' : 'Back to project bar'}
          >
            <X size={12} />
            <span>{lang === 'es' ? 'VOLVER' : 'DONE'}</span>
          </button>
        </div>
      </div>

      <div className="guided-timeline-track">
        {BUILD_PHASES.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`guided-phase-pill ${buildPhase === p.step ? 'active' : ''} ${
              buildPhase > p.step ? 'done' : ''
            }`}
            onClick={() => onSelectPhase(p.step)}
          >
            <span className="guided-phase-num">0{p.step}</span>
            <span className="guided-phase-label">{p.short[lang].replace(/^0\d\s·\s/, '')}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
