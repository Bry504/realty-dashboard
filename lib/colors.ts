// Deterministic color per inmobiliaria.
const PALETTE = [
  '#c0392b', '#2980b9', '#16a085', '#8e44ad', '#d35400',
  '#27ae60', '#2c3e50', '#c2185b', '#0097a7', '#5d4037',
  '#7b1fa2', '#00838f', '#ad1457', '#1565c0', '#558b2f',
  '#6d4c41', '#ef6c00', '#4527a0', '#00695c', '#283593',
];

export function colorForInmobiliaria(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
