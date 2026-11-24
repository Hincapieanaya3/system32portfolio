import { useState } from 'react';
import { ArrowUpRight, X } from 'lucide-react';
import { PROJECTS, UI_TEXT, WORLDS } from '../data/portfolioData';

export default function ArchiveModal({ open, lang, onClose, onSelectProject, onJumpWorld }) {
  const t = UI_TEXT[lang];
  const [filter, setFilter] = useState('all');

  if (!open) return null;

  const filtered = filter === 'all' ? PROJECTS : PROJECTS.filter((p) => p.world === filter);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="world-kicker">ARCHIVE // 2024—2026</div>
            <h2 className="world-heading" style={{ fontSize: 22 }}>
              {t.allProjectsTitle}
            </h2>
          </div>
          <button type="button" className="hud-btn" onClick={onClose}>
            <X size={14} />
            <span>{t.close}</span>
          </button>
        </div>

        <div className="modal-body">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className={`cam-btn ${filter === 'all' ? 'active' : ''}`}
              style={{ border: '1px solid rgba(255,255,255,0.14)', '--world-accent': '#00e5ff' }}
              onClick={() => setFilter('all')}
            >
              {t.filterAll} ({PROJECTS.length})
            </button>
            {WORLDS.map((w) => {
              const cnt = PROJECTS.filter((p) => p.world === w.id).length;
              return (
                <button
                  key={w.id}
                  type="button"
                  className={`cam-btn ${filter === w.id ? 'active' : ''}`}
                  style={{ border: '1px solid rgba(255,255,255,0.14)', '--world-accent': w.accent }}
                  onClick={() => setFilter(w.id)}
                >
                  {w.index} {w.shortName[lang]} ({cnt})
                </button>
              );
            })}
          </div>

          <div className="archive-grid">
            {filtered.map((proj) => {
              const world = WORLDS.find((w) => w.id === proj.world);
              return (
                <div
                  key={proj.id}
                  className="archive-card"
                  style={{ '--accent': world?.accent }}
                  onClick={() => {
                    onClose();
                    onSelectProject(proj);
                  }}
                >
                  <img src={proj.poster} alt={proj.title} loading="lazy" />
                  <div className="archive-card-body">
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 10,
                        color: world?.accent,
                      }}
                    >
                      <span>
                        W{world?.index} · {world?.shortName[lang]}
                      </span>
                      <span>{proj.year}</span>
                    </div>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14 }}>
                      {proj.title}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>{proj.role[lang]}</div>
                    <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <button
                        type="button"
                        className="hud-btn"
                        style={{ padding: '4px 8px', fontSize: 10 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onClose();
                          onJumpWorld(proj.world);
                        }}
                      >
                        <span>{t.enterWorld}</span>
                        <ArrowUpRight size={11} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
