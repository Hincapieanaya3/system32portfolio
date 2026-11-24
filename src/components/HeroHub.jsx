import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ArrowUpRight, ExternalLink, Linkedin, Mail } from 'lucide-react';
import HeroWebGL from './HeroWebGL';
import { PROJECTS, UI_TEXT, WORLDS } from '../data/portfolioData';

export default function HeroHub({ lang, onEnterWorld }) {
  const t = UI_TEXT[lang];
  const [hoveredWorld, setHoveredWorld] = useState(null);
  const rootRef = useRef(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.hero-anim', {
        y: 28,
        opacity: 0,
        duration: 0.85,
        stagger: 0.09,
        ease: 'power3.out',
      });
      gsap.from('.portal-card', {
        y: 36,
        opacity: 0,
        duration: 0.8,
        stagger: 0.08,
        delay: 0.2,
        ease: 'power3.out',
      });
    }, rootRef);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={rootRef} className="hero-hub">
      <HeroWebGL
        hoveredAccent={hoveredWorld?.accent || '#00e5ff'}
        isHoveringPortal={Boolean(hoveredWorld)}
      />
      <div className="hero-vignette" />

      <div className="hero-content">
        <div className="hero-header">
          <div className="hero-kicker hero-anim">
            <span className="hero-kicker-line" />
            <span>{t.heroTag}</span>
          </div>

          <h1 className="hero-title hero-anim">
            SEBASTIAN
            <br />
            HINCAPIE
          </h1>

          <div className="hero-role-strip hero-anim">
            <span className="hero-role">{t.roleLine}</span>
          </div>

          <p className="hero-subtitle hero-anim">{t.heroSubtitle}</p>

          <div className="hero-contact-strip hero-anim">
            <a href="mailto:sebashinca13@gmail.com" className="hero-contact-pill">
              <Mail size={13} style={{ color: '#00e5ff' }} />
              <span>sebashinca13@gmail.com</span>
            </a>
            <a
              href="https://www.linkedin.com/in/sebastianhin"
              target="_blank"
              rel="noreferrer"
              className="hero-contact-pill"
            >
              <Linkedin size={13} style={{ color: '#38bdf8' }} />
              <span>linkedin.com/in/sebastianhin</span>
              <ExternalLink size={11} style={{ opacity: 0.65 }} />
            </a>
          </div>
        </div>

        <div className="world-portals-grid">
          {WORLDS.map((world) => {
            const count = PROJECTS.filter((p) => p.world === world.id).length;
            const isHovered = hoveredWorld?.id === world.id;

            return (
              <button
                key={world.id}
                type="button"
                className="portal-card"
                style={{ '--card-accent': world.accent }}
                onMouseEnter={() => setHoveredWorld(world)}
                onMouseLeave={() => setHoveredWorld(null)}
                onClick={() => onEnterWorld(world.id)}
              >
                <div className="portal-card-media">
                  {world.previewVideo && isHovered ? (
                    <video
                      src={world.previewVideo}
                      poster={world.poster}
                      autoPlay
                      loop
                      muted
                      playsInline
                    />
                  ) : (
                    <img src={world.poster} alt={world.name[lang]} />
                  )}
                  <div className="portal-card-scrim" />
                </div>

                <div className="portal-card-top">
                  <span className="portal-index-badge">WORLD {world.index}</span>
                  <span className="portal-coords">{world.coords}</span>
                </div>

                <div className="portal-card-bottom">
                  <h2 className="portal-title">{world.name[lang]}</h2>
                  <p className="portal-tagline">{world.tagline[lang]}</p>
                  <div className="portal-footer-row">
                    <span>
                      {count} {t.projectsCount}
                    </span>
                    <span className="portal-enter-cta">
                      {t.enterWorld}
                      <ArrowUpRight size={13} />
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
