import { kml as kmlToGeoJSON } from '@tmcw/togeojson';
import type { FeatureCollection } from 'geojson';

/** Fetch a KML URL and convert it to GeoJSON. Safe to call from the browser. */
export async function loadKmlAsGeoJSON(url: string): Promise<FeatureCollection> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`KML fetch failed: ${res.status}`);
  const text = await res.text();
  const doc = new DOMParser().parseFromString(text, 'text/xml');
  return kmlToGeoJSON(doc) as unknown as FeatureCollection;
}
