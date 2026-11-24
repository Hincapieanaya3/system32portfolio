import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, X } from 'lucide-react';
import { UI_TEXT, WORLDS } from '../data/portfolioData';

export default function ProjectModal({ project, manifest, lang, onClose }) {
  const t = UI_TEXT[lang];
  const [idx, setIdx] = useState(0);

  const items = (() => {
    if (!project) return [];
    if (project.gallery?.length) return project.gallery;
    const m = project.behanceSlug ? manifest?.behance?.[project.behanceSlug] : null;
    if (m?.gallery?.length) return m.gallery;
    if (project.preview) return [{ type: 'video', src: project.preview }];
    if (project.poster) return [{ type: 'image', src: project.poster }];
    return [];
  })();

  useEffect(() => {
    setIdx(0);
  }, [project?.id]);

  useEffect(() => {
    if (!project) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && items.length > 1) setIdx((i) => (i + 1) % items.length);
      if (e.key === 'ArrowLeft' && items.length > 1) setIdx((i) => (i - 1 + items.length) % items.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [project, items.length, onClose]);

  if (!project) return null;

  const world = WORLDS.find((w) => w.id === project.world);
  const current = items[idx] || items[0];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-panel"
        style={{ '--accent': world?.accent || '#00e5ff' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <div className="world-kicker" style={{ color: world?.accent || '#00e5ff' }}>
              WORLD {world?.index} // {world?.name[lang]} · {project.year}
            </div>
            <h2 className="world-heading" style={{ fontSize: 'clamp(18px, 2vw, 26px)' }}>
              {project.title}
            </h2>
          </div>

          <button type="button" className="hud-btn" onClick={onClose}>
            <X size={14} />
            <span>{t.close}</span>
          </button>
        </div>

        <div className="modal-body">
          {current && (
            <div className="media-stage-box">
              {current.type === 'youtube' ? (
                <iframe
                  key={current.youtubeId}
                  src={`https://www.youtube.com/embed/${current.youtubeId}?rel=0&modestbranding=1`}
                  title={current.caption?.[lang] || project.title}
                  className="media-youtube-frame"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              ) : current.type === 'video' ? (
                <video
                  key={current.src}
                  src={current.src}
                  poster={current.poster}
                  controls
                  autoPlay
                  loop
                  playsInline
                />
              ) : (
                <img src={current.src} alt={project.title} />
              )}

              {items.length > 1 && (
                <>
                  <button
                    type="button"
                    className="hud-btn"
                    style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
                    onClick={() => setIdx((i) => (i - 1 + items.length) % items.length)}
                    aria-label="Previous"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    type="button"
                    className="hud-btn"
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}
                    onClick={() => setIdx((i) => (i + 1) % items.length)}
                    aria-label="Next"
                  >
                    <ChevronRight size={16} />
                  </button>
                </>
              )}
            </div>
          )}

          {current?.caption && (
            <div className="telemetry-chip modal-caption-row">
              <span>
                {current.caption[lang]} ({idx + 1} / {items.length})
              </span>
              {current.type === 'youtube' && current.src && (
                <a
                  href={current.src}
                  target="_blank"
                  rel="noreferrer"
                  className="modal-yt-link"
                >
                  <ExternalLink size={11} />
                  <span>{lang === 'es' ? 'ABRIR EN YOUTUBE' : 'OPEN ON YOUTUBE'}</span>
                </a>
              )}
            </div>
          )}

          {items.length > 1 && (
            <div className="media-thumbs">
              {items.map((item, i) => (
                <button
                  key={item.src}
                  type="button"
                  className={`media-thumb-btn ${i === idx ? 'active' : ''}`}
                  onClick={() => setIdx(i)}
                >
                  {item.type === 'youtube' ? (
                    <img src={item.poster} alt={`${project.title} Live Set`} />
                  ) : item.type === 'video' ? (
                    item.poster ? (
                      <img src={item.poster} alt={`${project.title} ${i + 1}`} />
                    ) : (
                      <video src={item.src} muted playsInline preload="metadata" />
                    )
                  ) : (
                    <img src={item.src} alt={`${project.title} ${i + 1}`} />
                  )}
                  <span className="thumb-type-tag">
                    {item.type === 'youtube'
                      ? 'LIVE YT'
                      : item.type === 'video'
                        ? `VID ${i + 1}`
                        : `IMG ${i + 1}`}
                  </span>
                </button>
              ))}
            </div>
          )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 18,
              borderTop: '1px solid rgba(255,255,255,0.1)',
              paddingTop: 14,
            }}
          >
            <div>
              <div className="world-kicker" style={{ color: world?.accent || '#00e5ff' }}>
                {t.role}
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
                {project.role[lang]}
              </div>
              <p style={{ fontSize: 13.5, lineHeight: 1.55, color: 'rgba(243,245,249,0.74)' }}>
                {project.summary[lang]}
              </p>
            </div>

            <div>
              <div className="world-kicker" style={{ color: world?.accent || '#00e5ff' }}>
                {t.tools}
              </div>
              <div className="tag-list" style={{ marginTop: 8 }}>
                {project.tools.map((tool) => (
                  <span key={tool} className="tech-tag">
                    {tool}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
