import { kml as kmlToGeoJSON } from '@tmcw/togeojson';
import type { FeatureCollection } from 'geojson';

/** Fetch a KML URL and convert it to GeoJSON. Safe to call from the browser. */
export async function loadKmlAsGeoJSON(url: string): Promise<FeatureCollection> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`KML fetch failed: ${res.status}`);
  let text = await res.text();
  // KMLs exportados desde Google Earth a veces traen <visibility>0</visibility>
  // en placemarks que sí queremos pintar. togeojson respeta esa bandera y los
  // omite — los normalizamos antes de parsear.
  text = text.replace(/<visibility>\s*0\s*<\/visibility>/gi, '<visibility>1</visibility>');
  const doc = new DOMParser().parseFromString(text, 'text/xml');
  return kmlToGeoJSON(doc) as unknown as FeatureCollection;
}
