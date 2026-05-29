import { kml as kmlToGeoJSON } from '@tmcw/togeojson';
import type { FeatureCollection } from 'geojson';

/**
 * Una GroundOverlay = imagen georreferenciada con una caja (north/south/east/west)
 * y opcionalmente una rotación en grados. Para renderizar en MapLibre necesitamos
 * los 4 cantos del rectángulo en orden TL, TR, BR, BL.
 */
export type GroundOverlay = {
  id: string;
  name: string;
  href: string;
  /** [TL, TR, BR, BL] en (lng, lat) */
  corners: [
    [number, number],
    [number, number],
    [number, number],
    [number, number],
  ];
};

export type KmlPayload = {
  /** Placemarks (Point/LineString/Polygon) convertidos a GeoJSON */
  features: FeatureCollection;
  /** Image overlays con esquinas calculadas con rotación aplicada */
  overlays: GroundOverlay[];
};

/** Carga un KML, normaliza visibility=0 y separa Placemarks de GroundOverlays. */
export async function loadKmlPayload(url: string): Promise<KmlPayload> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`KML fetch failed: ${res.status}`);
  let text = await res.text();
  // togeojson omite features con visibility=0
  text = text.replace(/<visibility>\s*0\s*<\/visibility>/gi, '<visibility>1</visibility>');

  const doc = new DOMParser().parseFromString(text, 'text/xml');
  // Extraigo los GroundOverlays primero, porque togeojson los convertiría
  // en polígonos de la LatLonBox (los cuadrantes naranjas indeseados).
  const overlays = extractGroundOverlays(doc);
  // Quito los <GroundOverlay> del DOM antes de togeojson: así "features"
  // contendrá solo Placemarks reales.
  Array.from(doc.getElementsByTagName('GroundOverlay')).forEach((n) =>
    n.parentNode?.removeChild(n),
  );
  const features = kmlToGeoJSON(doc) as unknown as FeatureCollection;
  return { features, overlays };
}

function extractGroundOverlays(doc: Document): GroundOverlay[] {
  const result: GroundOverlay[] = [];
  const nodes = Array.from(doc.getElementsByTagName('GroundOverlay'));
  nodes.forEach((node, i) => {
    const name = textOf(node, 'name') ?? `Overlay ${i + 1}`;
    const icon = node.getElementsByTagName('Icon')[0];
    const href = icon ? textOf(icon, 'href') : null;
    const box = node.getElementsByTagName('LatLonBox')[0];
    if (!href || !box) return;
    const north = numOf(box, 'north');
    const south = numOf(box, 'south');
    const east = numOf(box, 'east');
    const west = numOf(box, 'west');
    const rotation = numOf(box, 'rotation') ?? 0;
    if ([north, south, east, west].some((v) => v == null)) return;
    result.push({
      id: node.getAttribute('id') ?? `go-${i}`,
      name,
      href,
      corners: rotatedCorners(
        north as number,
        south as number,
        east as number,
        west as number,
        rotation,
      ),
    });
  });
  return result;
}

function textOf(parent: Element, tag: string): string | null {
  const el = parent.getElementsByTagName(tag)[0];
  return el ? (el.textContent ?? '').trim() : null;
}
function numOf(parent: Element, tag: string): number | null {
  const t = textOf(parent, tag);
  if (t == null || t === '') return null;
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : null;
}

/**
 * Devuelve los 4 cantos del rectángulo definido por north/south/east/west
 * tras rotarlo `rotation` grados (KML: positivo = anti-horario, eje Z hacia
 * arriba) alrededor del centro. Compensamos el "estiramiento" de las
 * longitudes en latitudes lejanas al ecuador con cos(centerLat).
 *
 * Orden devuelto: [top-left, top-right, bottom-right, bottom-left]
 * (lo que MapLibre espera para image sources).
 */
function rotatedCorners(
  n: number,
  s: number,
  e: number,
  w: number,
  rotation: number,
): GroundOverlay['corners'] {
  const cLat = (n + s) / 2;
  const cLng = (e + w) / 2;
  const halfH = (n - s) / 2;
  const halfW = (e - w) / 2;
  const cosLat = Math.cos((cLat * Math.PI) / 180) || 1;

  // KML: positivo = anti-horario alrededor del eje Z (hacia arriba)
  const theta = (rotation * Math.PI) / 180;
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);

  // Cantos sin rotar, como (dx, dy) desde el centro:
  // dx en grados de longitud (estirado por cosLat al pasar a "métrico")
  const unrotated: [number, number][] = [
    [-halfW, +halfH], // TL
    [+halfW, +halfH], // TR
    [+halfW, -halfH], // BR
    [-halfW, -halfH], // BL
  ];

  const rotated = unrotated.map(([dx, dy]) => {
    // Pasamos dx a "metros-equivalentes" multiplicando por cosLat
    const mx = dx * cosLat;
    const my = dy;
    const rmx = mx * cosT - my * sinT;
    const rmy = mx * sinT + my * cosT;
    // Volvemos a grados de longitud dividiendo por cosLat
    return [rmx / cosLat, rmy] as [number, number];
  });

  return [
    [cLng + rotated[0][0], cLat + rotated[0][1]],
    [cLng + rotated[1][0], cLat + rotated[1][1]],
    [cLng + rotated[2][0], cLat + rotated[2][1]],
    [cLng + rotated[3][0], cLat + rotated[3][1]],
  ];
}
