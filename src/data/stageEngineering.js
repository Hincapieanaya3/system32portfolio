import { assetUrl, prefixAssets } from '../utils/assetUrl';

export const BUILD_PHASES = [
  {
    step: 1,
    id: 'cad',
    short: { es: '01 · CAD EXPLODED', en: '01 · CAD EXPLODED' },
    desc: {
      es: 'Estructura de trusses y paneles LED separados en vista explosionada con cotas físicas a escala.',
      en: 'Truss structure and LED cabinets separated in exploded CAD view with scale physical dimensions.',
    },
  },
  {
    step: 2,
    id: 'pixelmap',
    short: { es: '02 · PIXELMAP SLICES', en: '02 · PIXELMAP SLICES' },
    desc: {
      es: 'Ensamblaje mecánico de pantallas proyectando la carta de ajuste y cortes de Resolume Advanced Output.',
      en: 'Mechanical cabinet assembly projecting the Resolume Advanced Output calibration grid and slices.',
    },
  },
  {
    step: 3,
    id: 'lighting',
    short: { es: '03 · RIG & BEAMS', en: '03 · RIG & BEAMS' },
    desc: {
      es: 'Encendido de iluminación escénica, blinders, tarima y calibración de color sobre el pixelmap.',
      en: 'Stage wash fixtures, blinders, deck, and volumetric beams powered on over the calibration map.',
    },
  },
  {
    step: 4,
    id: 'live',
    short: { es: '04 · LIVE SHOW', en: '04 · LIVE SHOW' },
    desc: {
      es: 'Operación final del show en vivo con visuales DXV3 corriendo en Autopilot sincronizado.',
      en: 'Full live festival operation streaming native DXV3 visuals in synchronized Autopilot.',
    },
  },
];

export const STAGE_ENGINEERING = prefixAssets({
  'sonar-square': {
    compWidth: 1024,
    compHeight: 1024,
    pixelmapUrl: '/media/pixelmaps/peterblue-pxmap.jpg',
    hardware: 'Resolume Arena 7 (DXV3) · 1024×1024 · 4 Layers',
    slices: [
      {
        id: 'sonar-main',
        name: { es: 'SLICE 1 · MONOLITO 1:1', en: 'SLICE 1 · 1:1 MONOLITH' },
        pxRect: { x: 0, y: 0, w: 1024, h: 1024 },
        pxLabel: '1024 × 1024 px',
        physical: '8.1m × 8.1m',
        color: '#00f0ff',
      },
    ],
    cutouts: [],
  },

  'techno-cross': {
    compWidth: 1008,
    compHeight: 784,
    pixelmapUrl: '/media/pixelmaps/castrii-pxmap.png',
    hardware: 'Resolume Advanced Output · 1008×784 · 2 Cross Slices',
    slices: [
      {
        id: 'cross-v',
        name: { es: 'PILAR VERTICAL', en: 'VERTICAL PILLAR' },
        pxRect: { x: 448, y: 0, w: 112, h: 784 },
        pxLabel: '112 × 784 px',
        physical: '1.56m × 10.9m',
        color: '#ff2e55',
      },
      {
        id: 'cross-h',
        name: { es: 'VIGA HORIZONTAL', en: 'HORIZONTAL BEAM' },
        pxRect: { x: 0, y: 336, w: 1008, h: 112 },
        pxLabel: '1008 × 112 px',
        physical: '14.0m × 1.56m',
        color: '#00f0ff',
      },
    ],
    cutouts: [
      { x: 0, y: 0, w: 448, h: 336, label: 'VOID' },
      { x: 560, y: 0, w: 448, h: 336, label: 'VOID' },
      { x: 0, y: 448, w: 448, h: 336, label: 'VOID' },
      { x: 560, y: 448, w: 448, h: 336, label: 'VOID' },
    ],
  },

  'semana-mainstage': {
    compWidth: 2496,
    compHeight: 2080,
    pixelmapUrl: '/media/pixelmaps/semana-pxmap.jpg',
    hardware: 'NovaPro UHD Jr · Fiber CVT 4K · Absen PL4.8 XL',
    slices: [
      {
        id: 'sem-cenefa',
        name: { es: 'CENEFA SUPERIOR', en: 'TOP CENEFA' },
        pxRect: { x: 0, y: 0, w: 2496, h: 208 },
        pxLabel: '2496 × 208 px',
        physical: '12.0m × 1.0m',
        color: '#ff4d6d',
      },
      {
        id: 'sem-central',
        name: { es: 'PANTALLA CENTRAL', en: 'CENTRAL WALL' },
        pxRect: { x: 0, y: 208, w: 1664, h: 1040 },
        pxLabel: '1664 × 1040 px',
        physical: '8.0m × 5.0m',
        color: '#38bdf8',
      },
      {
        id: 'sem-left',
        name: { es: 'LATERAL IZQUIERDA', en: 'LEFT WING' },
        pxRect: { x: 0, y: 1248, w: 624, h: 832 },
        pxLabel: '624 × 832 px',
        physical: '3.0m × 4.0m',
        color: '#ffd60a',
      },
      {
        id: 'sem-right',
        name: { es: 'LATERAL DERECHA', en: 'RIGHT WING' },
        pxRect: { x: 624, y: 1248, w: 624, h: 832 },
        pxLabel: '624 × 832 px',
        physical: '3.0m × 4.0m',
        color: '#00ffa3',
      },
    ],
    cutouts: [
      { x: 1664, y: 208, w: 832, h: 1872, label: 'UNMAPPED CANVAS' },
      { x: 1248, y: 1248, w: 416, h: 832, label: '' },
    ],
  },

  'sophii-curved': {
    compWidth: 7424,
    compHeight: 1280,
    pixelmapUrl: '/media/pixelmaps/sophii-pxmap.jpg',
    hardware: 'Curved S-Wave Ribbon · 29×5 LED Grid · 7424×1280',
    slices: [
      {
        id: 'sophii-left',
        name: { es: 'ALA CURVA IZQ', en: 'LEFT S-WING' },
        pxRect: { x: 0, y: 384, w: 2048, h: 896 },
        pxLabel: '2048 × 896 px',
        physical: '5.6m × 2.45m',
        color: '#f472b6',
      },
      {
        id: 'sophii-center',
        name: { es: 'ARCO CENTRAL S', en: 'CENTER S-ARCH' },
        pxRect: { x: 2432, y: 0, w: 2560, h: 1280 },
        pxLabel: '2560 × 1280 px',
        physical: '7.0m × 3.50m',
        color: '#c084fc',
      },
      {
        id: 'sophii-right',
        name: { es: 'ALA CURVA DER', en: 'RIGHT S-WING' },
        pxRect: { x: 5376, y: 384, w: 2048, h: 896 },
        pxLabel: '2048 × 896 px',
        physical: '5.6m × 2.45m',
        color: '#38bdf8',
      },
    ],
    cutouts: [
      { x: 0, y: 0, w: 1408, h: 384, label: 'STEP CUT' },
      { x: 6016, y: 0, w: 1408, h: 384, label: 'STEP CUT' },
      { x: 2048, y: 640, w: 384, h: 640, label: 'PORTAL L' },
      { x: 4992, y: 640, w: 384, h: 640, label: 'PORTAL R' },
    ],
  },
});

export function getStageEngineeringSpec(project) {
  if (!project) return null;
  const base = STAGE_ENGINEERING[project.stageRig];
  if (!base) return null;

  if (project.id === 'alba-franch') {
    return {
      ...base,
      pixelmapUrl: project.pixelmapImage || assetUrl('/media/pixelmaps/albafranch-pxmap.png'),
      hardware: 'Resolume Arena (DXV3 Alpha) · 1024×1024 · Alba Franch',
      slices: [
        {
          ...base.slices[0],
          name: { es: 'PANTALLA PPAL · 1:1', en: 'MAIN SCREEN · 1:1' },
          color: '#ff2e88',
        },
      ],
    };
  }

  return {
    ...base,
    pixelmapUrl: project.pixelmapImage || base.pixelmapUrl,
  };
}
