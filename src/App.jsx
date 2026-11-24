import { useCallback, useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import CustomCursor from './components/CustomCursor';
import TopNav from './components/TopNav';
import HeroHub from './components/HeroHub';
import IntroScreen from './components/IntroScreen';
import StageWorld from './components/worlds/StageWorld';
import MotionWorld from './components/worlds/MotionWorld';
import VRWorld from './components/worlds/VRWorld';
import GamesWorld from './components/worlds/GamesWorld';
import ProjectModal from './components/ProjectModal';
import ArchiveModal from './components/ArchiveModal';
import AboutModal from './components/AboutModal';
import { WORLDS } from './data/portfolioData';
import { assetUrl, prefixAssets } from './utils/assetUrl';

export default function App() {
  const [activeWorld, setActiveWorld] = useState('intro');
  const [lang, setLang] = useState('en');
  const [manifest, setManifest] = useState(null);
  const [inspectedProject, setInspectedProject] = useState(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [warpInfo, setWarpInfo] = useState({ label: '', title: '', accent: '#00e5ff' });

  const curtainRef = useRef(null);
  const transitioningRef = useRef(false);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    fetch(assetUrl('/media/manifest.json'))
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setManifest(prefixAssets(data));
      })
      .catch(() => {});
  }, []);

  const navigateWorld = useCallback(
    (targetWorld) => {
      if (targetWorld === activeWorld || transitioningRef.current) return;
      transitioningRef.current = true;

      const meta = WORLDS.find((w) => w.id === targetWorld);
      setWarpInfo({
        label: meta
          ? `ENTERING WORLD ${meta.index} // ${meta.coords}`
          : targetWorld === 'intro'
            ? 'REBOOTING // SYSTEM32'
            : 'ENTERING CENTRAL HUB',
        title: meta ? meta.name[lang] : targetWorld === 'intro' ? 'SYSTEM32' : 'SEBASTIAN HINCAPIE',
        accent: meta ? meta.accent : '#00e5ff',
      });

      const el = curtainRef.current;
      if (!el) {
        setActiveWorld(targetWorld);
        transitioningRef.current = false;
        return;
      }

      const tl = gsap.timeline({
        onComplete: () => {
          transitioningRef.current = false;
        },
      });

      tl.set(el, { visibility: 'visible' })
        .to(el, { opacity: 1, duration: 0.34, ease: 'power2.inOut' })
        .add(() => {
          setActiveWorld(targetWorld);
          document.documentElement.style.setProperty('--accent', meta ? meta.accent : '#00e5ff');
        })
        .to(el, { opacity: 0, duration: 0.48, delay: 0.16, ease: 'power2.out' })
        .set(el, { visibility: 'hidden' });
    },
    [activeWorld, lang]
  );

  return (
    <div className="app-shell">
      <CustomCursor />
      <div className="film-grain" />

      {activeWorld !== 'intro' && (
        <TopNav
          activeWorld={activeWorld}
          onSelectWorld={navigateWorld}
          lang={lang}
          onChangeLang={setLang}
          onOpenArchive={() => setArchiveOpen(true)}
          onOpenAbout={() => setAboutOpen(true)}
        />
      )}

      <main style={{ width: '100%', height: '100%' }}>
        {activeWorld === 'intro' && (
          <IntroScreen
            lang={lang}
            onChangeLang={setLang}
            onEnter={() => navigateWorld('hub')}
            onEnterWorld={navigateWorld}
          />
        )}
        {activeWorld === 'hub' && <HeroHub lang={lang} onEnterWorld={navigateWorld} />}
        {activeWorld === 'stage' && (
          <StageWorld
            lang={lang}
            manifest={manifest}
            onInspectProject={setInspectedProject}
          />
        )}
        {activeWorld === 'motion' && (
          <MotionWorld
            lang={lang}
            manifest={manifest}
            onInspectProject={setInspectedProject}
          />
        )}
        {activeWorld === 'vr' && (
          <VRWorld lang={lang} onInspectProject={setInspectedProject} />
        )}
        {activeWorld === 'games' && (
          <GamesWorld lang={lang} onInspectProject={setInspectedProject} />
        )}
      </main>

      {/* Cinematic World Warp Curtain */}
      <div
        ref={curtainRef}
        className="warp-curtain"
        style={{ '--accent': warpInfo.accent }}
      >
        <div className="warp-curtain-label">{warpInfo.label}</div>
        <div className="warp-curtain-title">{warpInfo.title}</div>
      </div>

      {/* Modals */}
      <ProjectModal
        project={inspectedProject}
        manifest={manifest}
        lang={lang}
        onClose={() => setInspectedProject(null)}
      />

      <ArchiveModal
        open={archiveOpen}
        lang={lang}
        onClose={() => setArchiveOpen(false)}
        onSelectProject={setInspectedProject}
        onJumpWorld={navigateWorld}
      />

      <AboutModal open={aboutOpen} lang={lang} onClose={() => setAboutOpen(false)} />
    </div>
  );
}
