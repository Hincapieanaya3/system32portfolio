import { Grid3X3, User } from 'lucide-react';
import { UI_TEXT, WORLDS } from '../data/portfolioData';
import LanguageSwitch from './LanguageSwitch';

export default function TopNav({
  activeWorld,
  onSelectWorld,
  lang,
  onChangeLang,
  onOpenArchive,
  onOpenAbout,
}) {
  const t = UI_TEXT[lang];

  return (
    <header className="top-nav">
      <button
        type="button"
        className="brand-btn"
        onClick={() => onSelectWorld('intro')}
        aria-label="Go to SYSTEM32 intro"
      >
        <span className="brand-pulse" />
        <span>
          <span className="brand-name">SEBASTIAN HINCAPIE</span>
          <span className="brand-sub">TECH ART // REAL-TIME LAB</span>
        </span>
      </button>

      <nav className="world-nav-pills" aria-label="Worlds Navigation">
        <button
          type="button"
          className={`world-pill ${activeWorld === 'hub' ? 'active' : ''}`}
          style={{ '--pill-accent': '#00e5ff' }}
          onClick={() => onSelectWorld('hub')}
        >
          <span className="world-pill-dot" />
          {t.worldNavHub}
        </button>
        {WORLDS.map((w) => (
          <button
            key={w.id}
            type="button"
            className={`world-pill ${activeWorld === w.id ? 'active' : ''}`}
            style={{ '--pill-accent': w.accent }}
            onClick={() => onSelectWorld(w.id)}
          >
            <span className="world-pill-dot" />
            {w.index} {w.shortName[lang]}
          </button>
        ))}
      </nav>

      <div className="nav-actions">
        <button type="button" className="hud-btn" onClick={onOpenArchive}>
          <Grid3X3 size={13} />
          <span>{t.allProjects}</span>
        </button>
        <button type="button" className="hud-btn" onClick={onOpenAbout}>
          <User size={13} />
          <span>{t.about}</span>
        </button>
        <LanguageSwitch lang={lang} onChange={onChangeLang} variant="nav" />
      </div>
    </header>
  );
}
