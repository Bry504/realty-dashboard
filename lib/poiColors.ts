import type { PoiCategory } from './types';

/** Color por defecto cuando la fila no fija uno propio. */
export const CATEGORY_COLOR: Record<PoiCategory, string> = {
  tren:      '#1976d2',  // azul ferroviario
  salud:     '#c0392b',
  finanzas:  '#16a085',
  educacion: '#8e44ad',
  otro:      '#5a4a40',
};

export const CATEGORY_LABEL: Record<PoiCategory, string> = {
  tren:      'Transporte',
  salud:     'Salud',
  finanzas:  'Finanzas',
  educacion: 'Educación',
  otro:      'Otros',
};
