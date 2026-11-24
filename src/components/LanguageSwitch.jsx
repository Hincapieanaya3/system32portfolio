import { useState } from 'react';
import { Globe } from 'lucide-react';

// Bilingual switch: the label is always shown in both languages so anyone understands what it does.
export default function LanguageSwitch({ lang, onChange, variant = 'nav' }) {
  const [seen, setSeen] = useState(false);
  const isIntro = variant === 'intro';

  const pick = (code) => {
    setSeen(true);
    onChange(code);
  };

  return (
    <div
      className={`lang-switch ${variant} ${seen ? 'seen' : ''}`}
      onMouseEnter={() => setSeen(true)}
    >
      <span className="lang-switch-label" aria-hidden="true">
        <Globe size={isIntro ? 14 : 13} />
        {isIntro && <span>LANGUAGE · IDIOMA</span>}
      </span>
      <div className="lang-toggle" role="group" aria-label="Language / Idioma">
        <button
          type="button"
          className={`lang-opt ${lang === 'en' ? 'active' : ''}`}
          title="English"
          aria-pressed={lang === 'en'}
          onClick={() => pick('en')}
        >
          {isIntro ? 'ENGLISH' : 'EN'}
        </button>
        <button
          type="button"
          className={`lang-opt ${lang === 'es' ? 'active' : ''}`}
          title="Español"
          aria-pressed={lang === 'es'}
          onClick={() => pick('es')}
        >
          {isIntro ? 'ESPAÑOL' : 'ES'}
        </button>
      </div>
    </div>
  );
}
