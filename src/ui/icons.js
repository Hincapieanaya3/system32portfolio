// Sistema de iconografía geométrica SYSTEM32.
// Inspirado en blancos concéntricos cromáticos, retículas ASCII/pixel, barras halftone,
// bloques modulares y marcos con llaves { } / corchetes [ ].

const ICONS = {
  // Emblema de marca 3x3 pixel-cross + núcleo concéntrico (paleta SYSTEM32 monocroma + acento activo)
  brand: `<rect x="2" y="2" width="4" height="4" fill="var(--accent)"/>
    <rect x="14" y="2" width="4" height="4" fill="var(--accent)"/>
    <rect x="2" y="14" width="4" height="4" fill="var(--accent)"/>
    <rect x="14" y="14" width="4" height="4" fill="var(--accent)"/>
    <circle cx="10" cy="10" r="3.6" fill="none" stroke="currentColor" stroke-width="1.6"/>
    <circle cx="10" cy="10" r="1.4" fill="currentColor"/>`,

  // 00 HUB — Blanco concéntrico de 3 anillos (homenaje a grilla de puntos concéntricos)
  hub: `<circle cx="10" cy="10" r="7.5" fill="none" stroke="currentColor" stroke-width="1.35" stroke-dasharray="2.4 1.6"/>
    <circle cx="10" cy="10" r="4.5" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <circle cx="10" cy="10" r="1.8" fill="currentColor"/>`,

  // 01 STAGE & VJ — Monolito pixelmap modular en 4 bloques + haces
  stage: `<rect x="2" y="3" width="16" height="3.2" fill="currentColor"/>
    <rect x="2" y="8" width="4" height="9" fill="none" stroke="currentColor" stroke-width="1.4"/>
    <rect x="7.5" y="8" width="5" height="9" fill="currentColor"/>
    <rect x="14" y="8" width="4" height="9" fill="none" stroke="currentColor" stroke-width="1.4"/>`,

  // 02 MOTION — Barras verticales halftone / onda cinética (inspirado en círculos rayados)
  motion: `<line x1="3" y1="7" x2="3" y2="13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    <line x1="6.5" y1="4" x2="6.5" y2="16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    <line x1="10" y1="2" x2="10" y2="18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    <line x1="13.5" y1="5" x2="13.5" y2="15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    <line x1="17" y1="8" x2="17" y2="12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`,

  // 03 VR & REAL-TIME — Retícula binocular con corchetes [ ◉-◉ ]
  vr: `<path d="M5 4H2.5v12H5M15 4h2.5v12H15" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <circle cx="7.2" cy="10" r="2.2" fill="none" stroke="currentColor" stroke-width="1.4"/>
    <circle cx="12.8" cy="10" r="2.2" fill="none" stroke="currentColor" stroke-width="1.4"/>
    <circle cx="7.2" cy="10" r="0.8" fill="currentColor"/>
    <circle cx="12.8" cy="10" r="0.8" fill="currentColor"/>`,

  // 04 VIDEOJUEGOS — Clúster pixel cruz + puntos cardinales (inspirado en matriz pixel bordada)
  games: `<path d="M8 2h4v6h6v4h-6v6H8v-6H2V8h6z" fill="none" stroke="currentColor" stroke-width="1.45"/>
    <rect x="8.6" y="8.6" width="2.8" height="2.8" fill="currentColor"/>
    <rect x="2.5" y="2.5" width="2.2" height="2.2" fill="currentColor"/>
    <rect x="15.3" y="15.3" width="2.2" height="2.2" fill="currentColor"/>`,

  // Stage Build 2D→3D — Capas isométricas explosionadas + esquina CAD
  build: `<path d="M10 2.2 17.5 6 10 9.8 2.5 6z" fill="currentColor"/>
    <path d="M2.5 10 10 13.8 17.5 10" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <path d="M2.5 14 10 17.8 17.5 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2.5 1.4"/>`,

  // Retícula de cámara / FOH
  cam: `<path d="M3 7V3h4M13 3h4v4M17 13v4h-4M7 17H3v-4" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <circle cx="10" cy="10" r="2.4" fill="currentColor"/>`,

  // Autopilot — Anillo orbital + flecha de ciclo
  autopilot: `<path d="M16.5 10a6.5 6.5 0 1 1-1.9-4.6" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <path d="M14.5 2.6v3.2h3.2" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <circle cx="10" cy="10" r="2" fill="currentColor"/>`,

  // Strobe / HDR Flash — Estrella pixel de 8 puntas
  spark: `<path d="M10 1.5v17M1.5 10h17M4 4l12 12M16 4 4 16" stroke="currentColor" stroke-width="1.6" stroke-linecap="square"/>
    <circle cx="10" cy="10" r="2.3" fill="currentColor"/>`,

  // Pixel map — Grilla asimétrica estilo Mondrian / Resolume slices
  pixelmap: `<rect x="2.2" y="2.2" width="15.6" height="15.6" fill="none" stroke="currentColor" stroke-width="1.4"/>
    <line x1="2.2" y1="7" x2="17.8" y2="7" stroke="currentColor" stroke-width="1.3"/>
    <line x1="9.5" y1="7" x2="9.5" y2="17.8" stroke="currentColor" stroke-width="1.3"/>
    <rect x="11.5" y="9" width="4.3" height="6.8" fill="currentColor"/>`,

  // Entrar / Portal — Flecha diagonal enmarcada en llaves / corchetes
  enter: `<path d="M5 15 15 5M8.5 5H15v6.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="square"/>
    <rect x="2.5" y="13.5" width="3" height="3" fill="currentColor"/>`,

  // Flecha derecha modular
  arrow: `<path d="M3 10h13M11.5 5.5 16 10l-4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="square"/>`,

  // Flecha arriba / volver arriba
  up: `<path d="M10 16.5V4M5.5 8.5 10 4l4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="square"/>`,

  // Flecha atrás
  back: `<path d="M17 10H4M8.5 5.5 4 10l4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="square"/>`,

  // Play / Live Set
  play: `<polygon points="5.5,3.5 16.5,10 5.5,16.5" fill="currentColor"/>
    <rect x="2.2" y="3.5" width="1.6" height="13" fill="currentColor"/>`,

  // Galería — Mosaico modular 3 bloques
  gallery: `<rect x="2.2" y="2.5" width="9" height="15" fill="currentColor"/>
    <rect x="13" y="2.5" width="4.8" height="6.5" fill="none" stroke="currentColor" stroke-width="1.4"/>
    <rect x="13" y="11" width="4.8" height="6.5" fill="none" stroke="currentColor" stroke-width="1.4"/>`,

  // Contenidos — Matriz de puntos + barras
  contents: `<rect x="2.5" y="3.5" width="3" height="3" fill="currentColor"/>
    <line x1="7.5" y1="5" x2="17.5" y2="5" stroke="currentColor" stroke-width="1.6"/>
    <rect x="2.5" y="8.5" width="3" height="3" fill="currentColor"/>
    <line x1="7.5" y1="10" x2="17.5" y2="10" stroke="currentColor" stroke-width="1.6"/>
    <rect x="2.5" y="13.5" width="3" height="3" fill="currentColor"/>
    <line x1="7.5" y1="15" x2="17.5" y2="15" stroke="currentColor" stroke-width="1.6"/>`,

  // CV / Perfil — Tarjeta técnica con punto concéntrico
  cv: `<rect x="3" y="2.2" width="14" height="15.6" fill="none" stroke="currentColor" stroke-width="1.4"/>
    <circle cx="8" cy="7.5" r="2" fill="currentColor"/>
    <line x1="12" y1="7.5" x2="14.8" y2="7.5" stroke="currentColor" stroke-width="1.4"/>
    <line x1="6" y1="12.2" x2="14.5" y2="12.2" stroke="currentColor" stroke-width="1.4"/>
    <line x1="6" y1="15" x2="11.5" y2="15" stroke="currentColor" stroke-width="1.4"/>`,

  // Descargar PDF
  download: `<path d="M10 2.5v10M6 9l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="square"/>
    <path d="M3 14.5v3h14v-3" fill="none" stroke="currentColor" stroke-width="1.5"/>`,

  // Mail — Sobre geométrico pixelado
  mail: `<rect x="2.2" y="4" width="15.6" height="12" fill="none" stroke="currentColor" stroke-width="1.45"/>
    <path d="M2.5 5l7.5 5.8L17.5 5" fill="none" stroke="currentColor" stroke-width="1.45"/>`,

  // Enlace externo
  external: `<path d="M11 3h6v6M17 3 9 11" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square"/>
    <path d="M15 12v5H3V5h5" fill="none" stroke="currentColor" stroke-width="1.4"/>`,

  // BPM — Blanco concéntrico pulsante
  bpm: `<circle cx="10" cy="10" r="7.5" fill="none" stroke="currentColor" stroke-width="1.4" opacity="0.5"/>
    <circle cx="10" cy="10" r="4.3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <circle cx="10" cy="10" r="2" fill="currentColor"/>`,

  // Eject cartucho
  eject: `<polygon points="10,4 16.5,12 3.5,12" fill="currentColor"/>
    <rect x="3.5" y="14.2" width="13" height="2.4" fill="currentColor"/>`,

  // Cerrar ✕ geométrico
  close: `<path d="M4.5 4.5l11 11M15.5 4.5l-11 11" stroke="currentColor" stroke-width="1.7" stroke-linecap="square"/>`,

  // Modos cinéticos SYSTEM32 en Motion Graphics
  repel: `<circle cx="10" cy="10" r="2.2" fill="currentColor"/>
    <path d="M10 2v3.5M10 14.5V18M2 10h3.5M14.5 10H18M4.3 4.3l2.5 2.5M13.2 13.2l2.5 2.5M15.7 4.3l-2.5 2.5M6.8 13.2l-2.5 2.5" stroke="currentColor" stroke-width="1.45"/>`,

  wave: `<path d="M2 10c2-5 4-5 6 0s4 5 6 0 3-4 4-1" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
    <circle cx="5" cy="6.2" r="1.3" fill="currentColor"/>
    <circle cx="15" cy="13.8" r="1.3" fill="currentColor"/>`,

  vortex: `<circle cx="10" cy="10" r="7.2" fill="none" stroke="currentColor" stroke-width="1.35" stroke-dasharray="6 3"/>
    <circle cx="10" cy="10" r="4.2" fill="none" stroke="currentColor" stroke-width="1.45" stroke-dasharray="4 2.5"/>
    <circle cx="10" cy="10" r="1.8" fill="currentColor"/>`,

  glitch: `<rect x="2" y="3.5" width="11" height="2.4" fill="currentColor"/>
    <rect x="7" y="8.8" width="11" height="2.4" fill="currentColor"/>
    <rect x="3.5" y="14.1" width="10" height="2.4" fill="currentColor"/>`,

  random: `<rect x="3" y="3" width="4.2" height="4.2" fill="currentColor"/>
    <rect x="12.8" y="3" width="4.2" height="4.2" fill="none" stroke="currentColor" stroke-width="1.4"/>
    <rect x="3" y="12.8" width="4.2" height="4.2" fill="none" stroke="currentColor" stroke-width="1.4"/>
    <rect x="12.8" y="12.8" width="4.2" height="4.2" fill="currentColor"/>
    <circle cx="10" cy="10" r="1.5" fill="currentColor"/>`,

  // Vista lista y grilla en Contenidos
  list: `<rect x="2" y="3.5" width="3" height="2.6" fill="currentColor"/>
    <rect x="7" y="3.5" width="11" height="2.6" fill="currentColor"/>
    <rect x="2" y="8.7" width="3" height="2.6" fill="currentColor"/>
    <rect x="7" y="8.7" width="11" height="2.6" fill="currentColor"/>
    <rect x="2" y="13.9" width="3" height="2.6" fill="currentColor"/>
    <rect x="7" y="13.9" width="11" height="2.6" fill="currentColor"/>`,

  grid: `<rect x="2.2" y="2.2" width="6.4" height="6.4" fill="currentColor"/>
    <rect x="11.4" y="2.2" width="6.4" height="6.4" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <rect x="2.2" y="11.4" width="6.4" height="6.4" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <rect x="11.4" y="11.4" width="6.4" height="6.4" fill="currentColor"/>`,
};

export function ico(name, size = 14, cls = '') {
  const body = ICONS[name] || ICONS.hub;
  return `<svg class="s32-ico s32-ico--${name}${cls ? ' ' + cls : ''}" viewBox="0 0 20 20" width="${size}" height="${size}" aria-hidden="true">${body}</svg>`;
}
