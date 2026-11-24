import { useState } from 'react';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  GraduationCap,
  Languages,
  Linkedin,
  Mail,
  MapPin,
  Phone,
  X,
} from 'lucide-react';
import { UI_TEXT } from '../data/portfolioData';
import { RESUME } from '../data/resumeData';
import { assetUrl } from '../utils/assetUrl';

const EMAIL = 'sebashinca13@gmail.com';
const PHONE_DISPLAY = '+57 311 715 6014';
const PHONE_LINK = '+573117156014';
const LINKEDIN_URL = 'https://www.linkedin.com/in/sebastianhin';
const BEHANCE_URL = 'https://www.behance.net/sebastihincapi12';
const RESUME_PDF = assetUrl('/Sebastian_Hincapie_Resume.pdf');

const TABS = [
  { id: 'profile', label: { en: 'PROFILE', es: 'PERFIL' } },
  { id: 'experience', label: { en: 'EXPERIENCE', es: 'EXPERIENCIA' } },
  { id: 'skills', label: { en: 'SKILLS & EDUCATION', es: 'HABILIDADES Y FORMACIÓN' } },
];

export default function AboutModal({ open, lang, onClose }) {
  const t = UI_TEXT[lang];
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState('profile');

  if (!open) return null;

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(EMAIL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      window.location.href = `mailto:${EMAIL}`;
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-panel resume-panel"
        style={{ width: 'min(960px, 96vw)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <div className="world-kicker">
              <MapPin size={11} style={{ display: 'inline', marginRight: 5 }} />
              MEDELLÍN, COLOMBIA // {lang === 'es' ? 'HOJA DE VIDA' : 'RESUME'}
            </div>
            <h2 className="world-heading" style={{ fontSize: 'clamp(16px, 2vw, 22px)' }}>
              {t.aboutTitle}
            </h2>
            <div className="resume-role-line">{RESUME.title[lang]}</div>
          </div>
          <button type="button" className="hud-btn" onClick={onClose}>
            <X size={14} />
            <span>{t.close}</span>
          </button>
        </div>

        <div className="resume-tabs" role="tablist">
          {TABS.map((tb) => (
            <button
              key={tb.id}
              type="button"
              role="tab"
              aria-selected={tab === tb.id}
              className={`resume-tab ${tab === tb.id ? 'active' : ''}`}
              onClick={() => setTab(tb.id)}
            >
              {tb.label[lang]}
            </button>
          ))}
        </div>

        <div className="modal-body resume-body">
          {tab === 'profile' && (
            <>
              <p className="resume-summary">{RESUME.summary[lang]}</p>

              <div className="resume-highlights">
                {RESUME.highlights.map((h) => (
                  <div key={h.value} className="resume-highlight">
                    <div className="resume-highlight-value">{h.value}</div>
                    <div className="resume-highlight-label">{h.label[lang]}</div>
                  </div>
                ))}
              </div>

              <div>
                <div className="world-kicker" style={{ marginBottom: 8 }}>
                  {lang === 'es' ? 'DISCIPLINAS' : 'DISCIPLINES'}
                </div>
                <div className="tag-list">
                  {[
                    lang === 'es' ? 'Technical Art' : 'Technical Art',
                    lang === 'es' ? 'VJ & Visuales en Vivo' : 'Live VJ & Visuals',
                    lang === 'es' ? 'Motion Graphics 3D' : '3D Motion Graphics',
                    lang === 'es' ? 'Videojuegos (Unity)' : 'Game Dev (Unity)',
                    lang === 'es' ? 'Realidad Virtual' : 'Virtual Reality',
                    lang === 'es' ? 'Instalaciones Interactivas' : 'Interactive Installations',
                  ].map((d) => (
                    <span key={d} className="tech-tag">
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}

          {tab === 'experience' && (
            <div className="resume-timeline">
              {RESUME.experience.map((job) => (
                <div
                  key={`${job.company}-${job.dates.en}`}
                  className={`resume-job ${job.current ? 'is-current' : ''}`}
                >
                  <span className="resume-job-dot" />
                  <div className="resume-job-head">
                    <div className="resume-job-role">{job.role[lang]}</div>
                    <div className="resume-job-dates">
                      {job.dates[lang]}
                      {job.current && (
                        <span className="resume-now-badge">
                          {lang === 'es' ? 'ACTIVO' : 'ACTIVE'}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="resume-job-company">
                    {job.company} <span>· {job.place}</span>
                  </div>
                  <ul className="resume-job-bullets">
                    {job.bullets[lang].map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {tab === 'skills' && (
            <>
              <div className="resume-skill-grid">
                {RESUME.skills.map((group) => (
                  <div key={group.title.en} className="resume-skill-card">
                    <div className="world-kicker" style={{ marginBottom: 8 }}>
                      {group.title[lang]}
                    </div>
                    <div className="tag-list">
                      {group.items.map((it) => (
                        <span key={it} className="tech-tag">
                          {it}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="resume-two-col">
                <div className="resume-skill-card">
                  <div className="world-kicker" style={{ marginBottom: 10 }}>
                    <GraduationCap size={12} style={{ display: 'inline', marginRight: 6 }} />
                    {lang === 'es' ? 'FORMACIÓN' : 'EDUCATION & TRAINING'}
                  </div>
                  {RESUME.education.map((ed) => (
                    <div key={ed.school} className="resume-edu-item">
                      <div className="resume-job-role">{ed.title[lang]}</div>
                      <div className="resume-job-company">
                        {ed.school} <span>· {ed.place}</span>
                      </div>
                      <div className="resume-job-dates">{ed.dates[lang]}</div>
                    </div>
                  ))}
                </div>

                <div className="resume-skill-card">
                  <div className="world-kicker" style={{ marginBottom: 10 }}>
                    <Languages size={12} style={{ display: 'inline', marginRight: 6 }} />
                    {lang === 'es' ? 'IDIOMAS' : 'LANGUAGES'}
                  </div>
                  {RESUME.languages.map((lg) => (
                    <div key={lg.name.en} className="resume-edu-item">
                      <div className="resume-job-role">{lg.name[lang]}</div>
                      <div className="resume-job-company">{lg.level[lang]}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="resume-contact-bar">
          <div className="resume-contact-links">
            <a href={`mailto:${EMAIL}`} className="resume-contact-item">
              <Mail size={13} />
              <span>{EMAIL}</span>
            </a>
            <button type="button" className="resume-copy-btn" onClick={handleCopyEmail}>
              {copied ? <Check size={12} style={{ color: '#00ffa3' }} /> : <Copy size={12} />}
              <span>{copied ? (lang === 'es' ? 'COPIADO' : 'COPIED') : lang === 'es' ? 'COPIAR' : 'COPY'}</span>
            </button>
            <a href={`tel:${PHONE_LINK}`} className="resume-contact-item">
              <Phone size={13} />
              <span>{PHONE_DISPLAY}</span>
            </a>
            <a href={LINKEDIN_URL} target="_blank" rel="noreferrer" className="resume-contact-item">
              <Linkedin size={13} />
              <span>LinkedIn</span>
              <ExternalLink size={11} />
            </a>
            <a href={BEHANCE_URL} target="_blank" rel="noreferrer" className="resume-contact-item">
              <span>Behance</span>
              <ExternalLink size={11} />
            </a>
          </div>

          <a
            href={RESUME_PDF}
            download="Sebastian_Hincapie_Resume.pdf"
            className="hud-btn primary"
            style={{ textDecoration: 'none' }}
          >
            <Download size={13} />
            <span>{lang === 'es' ? 'DESCARGAR HOJA DE VIDA (PDF)' : 'DOWNLOAD RESUME (PDF)'}</span>
          </a>
        </div>
      </div>
    </div>
  );
}
