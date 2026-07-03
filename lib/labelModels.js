export const LABEL_MODELS = [
  {
    id: 'gondola_small',
    name: 'Modelo gondola pequeno',
    widthMm: 48,
    heightMm: 70,
    marginMm: 8,
    gapMm: 4,
    columns: 3,
    rows: 3,
    orientation: 'portrait',
    hasCutouts: true,
    kind: 'gondola'
  },
  {
    id: 'gondola_medium',
    name: 'Modelo gondola medio',
    widthMm: 63,
    heightMm: 88,
    marginMm: 8,
    gapMm: 4,
    columns: 3,
    rows: 2,
    orientation: 'portrait',
    hasCutouts: true,
    kind: 'gondola'
  },
  {
    id: 'gondola_large',
    name: 'Modelo gondola grande',
    widthMm: 90,
    heightMm: 120,
    marginMm: 8,
    gapMm: 5,
    columns: 2,
    rows: 2,
    orientation: 'portrait',
    hasCutouts: true,
    kind: 'gondola'
  },
  {
    id: 'simple_sticker',
    name: 'Modelo adesivo simples',
    widthMm: 60,
    heightMm: 35,
    marginMm: 8,
    gapMm: 3,
    columns: 3,
    rows: 7,
    orientation: 'portrait',
    hasCutouts: false,
    kind: 'sticker'
  },
  {
    id: 'promo',
    name: 'Modelo promocional',
    widthMm: 90,
    heightMm: 70,
    marginMm: 8,
    gapMm: 4,
    columns: 2,
    rows: 3,
    orientation: 'portrait',
    hasCutouts: true,
    kind: 'promo'
  }
];

export const DEFAULT_LABEL_OPTIONS = {
  showLogo: true,
  showSku: true,
  showQrCode: false,
  showBarcode: true,
  showCategory: true,
  showCutouts: true
};

export function getLabelModel(id) {
  return LABEL_MODELS.find((model) => model.id === id) || LABEL_MODELS[0];
}

export function getModelCapacity(model) {
  return Number(model?.columns || 1) * Number(model?.rows || 1);
}
