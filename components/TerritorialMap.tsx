'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Map, {
  AttributionControl,
  Layer,
  Marker,
  NavigationControl,
  Popup,
  ScaleControl,
  Source,
  type MapMouseEvent,
  type MapRef,
  type StyleSpecification,
} from 'react-map-gl/maplibre';
import maplibregl from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';
import 'maplibre-gl/dist/maplibre-gl.css';

import type {
  Basemap,
  Competitor,
  RealtyProject,
  TerritorialLevel,
} from '@/lib/types';
import { colorForInmobiliaria } from '@/lib/colors';
import { loadKmlPayload, type GroundOverlay } from '@/lib/kml';
import { formatDistance, totalLengthMeters } from '@/lib/distance';
import { CATEGORY_COLOR } from '@/lib/poiColors';
import type { Poi, UserPoint } from '@/lib/types';

// ---------- basemaps ----------

// maxzoom = el zoom hasta el que el proveedor TIENE tiles reales en Perú.
// Más allá MapLibre hace overzoom (escala el último tile bueno) en vez de
// pedir tiles que el proveedor devuelve como "Map data not yet available".
const BASEMAPS: Record<
  Basemap,
  { tiles: string[]; attribution: string; maxzoom?: number; subdomains?: string[] }
> = {
  claro: {
    tiles: [
      'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
      'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
      'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
      'https://d.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
    ],
    attribution: '© OpenStreetMap · © CARTO',
    maxzoom: 19,
  },
  osm: {
    tiles: [
      'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
      'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
      'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
    ],
    attribution: '© OpenStreetMap contributors',
    maxzoom: 19,
  },
  satelite: {
    tiles: [
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    ],
    attribution: 'Tiles © Esri — World Imagery',
    // Esri en zonas rurales del Perú no tiene zoom > 17 confiable.
    maxzoom: 17,
  },
  relieve: {
    tiles: [
      'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',
      'https://b.tile.opentopomap.org/{z}/{x}/{y}.png',
      'https://c.tile.opentopomap.org/{z}/{x}/{y}.png',
    ],
    attribution: '© OpenTopoMap · © OpenStreetMap',
    maxzoom: 16,
  },
};

function buildStyle(basemap: Basemap): StyleSpecification {
  const b = BASEMAPS[basemap];
  return {
    version: 8,
    // El servidor demotiles.maplibre.org devuelve 404 intermitente.
    // OpenMapTiles aloja el mismo font stack ("Open Sans Regular") de forma estable.
    glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
    sources: {
      basemap: {
        type: 'raster',
        tiles: b.tiles,
        tileSize: 256,
        attribution: b.attribution,
        // El source maxzoom define hasta dónde el provider tiene tiles;
        // MapLibre hace "overzoom" más allá usando el último tile escalado,
        // así no aparecen los placeholders de "No data".
        maxzoom: b.maxzoom ?? 19,
      },
    },
    layers: [{ id: 'basemap', type: 'raster', source: 'basemap' }],
  };
}

/**
 * Registra (idempotentemente) un ícono SVG de tren en el sprite del mapa.
 * Hay que volver a llamarlo cada vez que se carga un nuevo estilo (al cambiar
 * el basemap) porque MapLibre vacía las imágenes registradas.
 */
function ensureTrainIcon(map: maplibregl.Map): void {
  const ID = 'icon-tren';
  if (map.hasImage(ID)) return;
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
  <circle cx="20" cy="20" r="17" fill="#1976d2" stroke="#ffffff" stroke-width="2.5"/>
  <rect x="12" y="11.5" width="16" height="13" rx="2.5" fill="#ffffff"/>
  <rect x="13.5" y="13.5" width="5" height="3" fill="#1976d2"/>
  <rect x="20.5" y="13.5" width="5" height="3" fill="#1976d2"/>
  <rect x="13.5" y="18" width="12" height="3" fill="#1976d2"/>
  <circle cx="15.5" cy="27" r="2" fill="#ffffff" stroke="#1976d2" stroke-width="1.4"/>
  <circle cx="24.5" cy="27" r="2" fill="#ffffff" stroke="#1976d2" stroke-width="1.4"/>
  <rect x="11" y="25.5" width="2" height="2" fill="#1976d2"/>
  <rect x="27" y="25.5" width="2" height="2" fill="#1976d2"/>
</svg>`;
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const img = new Image(40, 40);
  img.onload = () => {
    if (!map.hasImage(ID)) map.addImage(ID, img, { pixelRatio: 2 });
    URL.revokeObjectURL(url);
  };
  img.src = url;
}

/** Abre Google Earth Web centrado en la cámara actual del mapa. */
function openInGoogleEarth(lng: number, lat: number, zoom: number) {
  // Conversión aprox: distancia de cámara (range) en metros desde el zoom de Mercator
  const range = Math.max(50, 40_000_000 / Math.pow(2, zoom));
  const url = `https://earth.google.com/web/@${lat},${lng},0a,${range.toFixed(0)}d,35y,0h,60t,0r`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

// ---------- props ----------

type Props = {
  realty: RealtyProject[];
  competitors: Competitor[];
  level: TerritorialLevel;
  basemap: Basemap;
  hiddenInmobiliarias: Set<string>;
  hiddenRealty: Set<string>;
  focusId?: string | null;
  measureMode: boolean;
  /** Pulsos externos para abrir Google Earth en la posición actual del mapa */
  openEarthSignal?: number;
  pois?: Poi[];
  /** 0..1 — opacidad del relleno de cada polígono territorial */
  territorialFillOpacity?: number;
  userPoints?: UserPoint[];
  /** Activo cuando el usuario quiere crear un nuevo punto al hacer click */
  addPointMode?: boolean;
  onMapClickToCreate?: (lngLat: { lng: number; lat: number }) => void;
};

type HoverInfo =
  | { kind: 'realty'; project: RealtyProject }
  | { kind: 'comp'; comp: Competitor }
  | { kind: 'user'; point: UserPoint }
  | null;

// ---------- component ----------

export default function TerritorialMap({
  realty,
  competitors,
  level,
  basemap,
  hiddenInmobiliarias,
  hiddenRealty,
  focusId,
  measureMode,
  openEarthSignal,
  pois = [],
  territorialFillOpacity = 0.06,
  userPoints = [],
  addPointMode = false,
  onMapClickToCreate,
}: Props) {
  const mapRef = useRef<MapRef | null>(null);
  const [geo, setGeo] = useState<FeatureCollection | null>(null);
  const [kmlByProject, setKmlByProject] = useState<Record<string, FeatureCollection>>({});
  const [overlaysByProject, setOverlaysByProject] = useState<Record<string, GroundOverlay[]>>({});
  // Cache de cada POI KML cargado (id → FeatureCollection). Persiste entre toggles.
  const [poiCache, setPoiCache] = useState<Record<string, FeatureCollection>>({});
  const [hover, setHover] = useState<HoverInfo>(null);
  const [measurePts, setMeasurePts] = useState<[number, number][]>([]);

  // Territorial GeoJSON, only when level !== ninguno
  useEffect(() => {
    if (level === 'ninguno') {
      setGeo(null);
      return;
    }
    const file =
      level === 'departamento'
        ? 'departamentos'
        : level === 'provincia'
        ? 'provincias'
        : 'distritos';
    let cancelled = false;
    fetch(`/geo/${file}.geojson`)
      .then((r) => r.json())
      .then((data: FeatureCollection) => !cancelled && setGeo(data))
      .catch(() => !cancelled && setGeo(null));
    return () => {
      cancelled = true;
    };
  }, [level]);

  // KML overlays: cargo cada proyecto con kml_url y separo placemarks + ground overlays
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const nextFC: Record<string, FeatureCollection> = {};
      const nextOV: Record<string, GroundOverlay[]> = {};
      await Promise.all(
        realty
          .filter((r) => !!r.kml_url)
          .map(async (r) => {
            try {
              const payload = await loadKmlPayload(r.kml_url as string);
              if (payload.features.features.length > 0) nextFC[r.id] = payload.features;
              if (payload.overlays.length > 0) nextOV[r.id] = payload.overlays;
            } catch {
              // ignore individual KML failures
            }
          }),
      );
      if (!cancelled) {
        setKmlByProject(nextFC);
        setOverlaysByProject(nextOV);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [realty]);

  // Initial fit on first data load
  const didFit = useRef(false);
  useEffect(() => {
    if (didFit.current || !mapRef.current) return;
    const pts: [number, number][] = [
      ...realty.map((r) => [r.lng, r.lat] as [number, number]),
      ...competitors.map((c) => [c.lng, c.lat] as [number, number]),
    ];
    if (pts.length === 0) return;
    const lngs = pts.map((p) => p[0]);
    const lats = pts.map((p) => p[1]);
    mapRef.current.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: 60, duration: 0 },
    );
    didFit.current = true;
  }, [realty, competitors]);

  // Cargo POIs activos a demanda (con cache)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const missing = pois.filter((p) => !poiCache[p.id]);
      if (missing.length === 0) return;
      const loaded: Record<string, FeatureCollection> = {};
      await Promise.all(
        missing.map(async (p) => {
          try {
            const payload = await loadKmlPayload(p.kml_url);
            loaded[p.id] = payload.features;
          } catch {
            // silencio individual
          }
        }),
      );
      if (!cancelled && Object.keys(loaded).length > 0) {
        setPoiCache((prev) => ({ ...prev, ...loaded }));
      }
    })();
    return () => { cancelled = true; };
  }, [pois, poiCache]);

  // flyTo focus: si el proyecto tiene overlays los enmarca; sino vuela al pin
  useEffect(() => {
    if (!focusId || !mapRef.current) return;
    const r = realty.find((x) => x.id === focusId);
    if (!r) return;
    const ovs = overlaysByProject[focusId];
    if (ovs && ovs.length) {
      const lngs = ovs.flatMap((o) => o.corners.map((c) => c[0]));
      const lats = ovs.flatMap((o) => o.corners.map((c) => c[1]));
      mapRef.current.fitBounds(
        [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ],
        { padding: 80, duration: 900, maxZoom: 17 },
      );
    } else {
      mapRef.current.flyTo({
        center: [r.lng, r.lat],
        zoom: Math.max(mapRef.current.getZoom(), 13),
        duration: 900,
      });
    }
  }, [focusId, realty, overlaysByProject]);

  // El dataset GeoPerú trae algunas features con geometry: null.
  // MapLibre crashea internamente al renderizarlas, así que las filtramos.
  // De paso calculamos el área del bounding-box y la guardamos como _area:
  // así el symbol-sort-key del layer de etiquetas le da prioridad a los
  // distritos más chicos (los grandes son fáciles de identificar por contexto;
  // los chicos son los que pierden colisiones y dejan de etiquetarse).
  const safeGeo = useMemo<FeatureCollection | null>(() => {
    if (!geo) return null;
    return {
      type: 'FeatureCollection',
      features: geo.features
        .filter((f) => {
          const g = f.geometry as { coordinates?: unknown } | null;
          return !!g && g.coordinates != null;
        })
        .map((f) => {
          // bbox rápido para usarlo como sort-key
          let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
          const walk = (c: unknown): void => {
            if (Array.isArray(c) && typeof c[0] === 'number') {
              const [lng, lat] = c as number[];
              if (lng < minLng) minLng = lng;
              if (lng > maxLng) maxLng = lng;
              if (lat < minLat) minLat = lat;
              if (lat > maxLat) maxLat = lat;
            } else if (Array.isArray(c)) for (const x of c) walk(x);
          };
          walk((f.geometry as { coordinates: unknown }).coordinates);
          const area = (maxLng - minLng) * (maxLat - minLat) || 0;
          return {
            ...f,
            properties: { ...(f.properties ?? {}), _area: area },
          };
        }),
    };
  }, [geo]);

  // Style — recomputed when basemap changes
  const mapStyle = useMemo(() => buildStyle(basemap), [basemap]);

  // Re-registro el ícono del tren cada vez que MapLibre carga un nuevo estilo
  // (al cambiar basemap, el sprite de imágenes se vacía).
  useEffect(() => {
    const m = mapRef.current?.getMap();
    if (!m) return;
    ensureTrainIcon(m);
  }, [basemap]);

  // Cuando el shell pide "Abrir en Google Earth", capturamos la posición actual de la cámara
  useEffect(() => {
    if (!openEarthSignal || !mapRef.current) return;
    const m = mapRef.current.getMap();
    const c = m.getCenter();
    openInGoogleEarth(c.lng, c.lat, m.getZoom());
  }, [openEarthSignal]);

  // ---------- measurement ----------

  const measureGeoJSON: FeatureCollection = useMemo(
    () => ({
      type: 'FeatureCollection',
      features: [
        ...(measurePts.length >= 2
          ? [
              {
                type: 'Feature' as const,
                properties: {},
                geometry: {
                  type: 'LineString' as const,
                  coordinates: measurePts,
                },
              },
            ]
          : []),
        ...measurePts.map((p, i) => ({
          type: 'Feature' as const,
          properties: { i },
          geometry: { type: 'Point' as const, coordinates: p },
        })),
      ],
    }),
    [measurePts],
  );

  const onMapClick = useCallback(
    (e: MapMouseEvent) => {
      const { lng, lat } = e.lngLat;
      if (addPointMode && onMapClickToCreate) {
        onMapClickToCreate({ lng, lat });
        return;
      }
      if (!measureMode) return;
      setMeasurePts((prev) => [...prev, [lng, lat]]);
    },
    [measureMode, addPointMode, onMapClickToCreate],
  );

  // Clear measure when toggled off
  useEffect(() => {
    if (!measureMode) setMeasurePts([]);
  }, [measureMode]);

  const measureTotal = useMemo(() => totalLengthMeters(measurePts), [measurePts]);

  // Cursor for measure mode
  const cursor = addPointMode ? 'crosshair' : measureMode ? 'crosshair' : 'grab';

  const visibleRealty = realty.filter((r) => !hiddenRealty.has(r.id));
  const visibleCompetitors = competitors.filter(
    (c) => !hiddenInmobiliarias.has(c.inmobiliaria),
  );

  return (
    <>
      <Map
        ref={mapRef}
        initialViewState={{ longitude: -76.6, latitude: -12.5, zoom: 7.5 }}
        mapStyle={mapStyle}
        mapLib={maplibregl as never}
        attributionControl={false}
        onClick={onMapClick}
        onLoad={() => {
          const m = mapRef.current?.getMap();
          if (m) ensureTrainIcon(m);
        }}
        cursor={cursor}
        style={{ width: '100%', height: '100%' }}
        // Limito el zoom máximo a 19 — más allá los proveedores raster devuelven
        // tiles vacíos con texto "no data". Si el usuario quiere ver más detalle
        // tiene el botón "Abrir en Google Earth" en el topbar.
        maxZoom={20}
        minZoom={4}
        dragRotate={false}
      >
        <NavigationControl position="bottom-right" visualizePitch />
        <ScaleControl position="bottom-left" unit="metric" />
        <AttributionControl position="bottom-right" compact />

        {/* Polígonos territoriales + labels.
            Le pasamos los polígonos directamente al layer de símbolo: MapLibre
            calcula el "pole of inaccessibility" del polígono y coloca el label
            ahí — garantiza que esté dentro, mejor que cualquier centroide
            manual. Una sola fuente para fill / line / label. */}
        {safeGeo && (
          <Source id="territorial" type="geojson" data={safeGeo}>
            <Layer
              id="territorial-fill"
              type="fill"
              paint={{ 'fill-color': '#ffffff', 'fill-opacity': territorialFillOpacity }}
            />
            <Layer
              id="territorial-line"
              type="line"
              paint={{
                'line-color': '#000000',
                'line-width':
                  level === 'distrito' ? 1.8 : level === 'provincia' ? 2.6 : 3.4,
                'line-opacity': 0.95,
              }}
            />
            <Layer
              id="territorial-label"
              type="symbol"
              layout={{
                'text-field': [
                  'get',
                  level === 'departamento'
                    ? 'NOMBDEP'
                    : level === 'provincia'
                    ? 'NOMBPROV'
                    : 'NOMBDIST',
                ],
                'text-font': ['Open Sans Regular'],
                // Escala con el zoom para reducir colisiones a niveles bajos
                'text-size': [
                  'interpolate', ['linear'], ['zoom'],
                  6, 8,
                  10, 11,
                  14, 13,
                  18, 16,
                ],
                'text-letter-spacing': 0.04,
                'text-transform': 'uppercase',
                'text-padding': 0,
                'text-max-width': 8,
                'symbol-placement': 'point',
                // Forzamos que TODAS las etiquetas se rendericen — sin colisión-
                // culling. A zoom bajo puede haber superposición visual, pero
                // el usuario ve siempre el nombre de cada distrito.
                'text-allow-overlap': true,
                'text-ignore-placement': true,
              }}
              paint={{
                'text-color': '#000000',
                'text-halo-color': '#ffffff',
                'text-halo-width': 1.8,
                'text-halo-blur': 0.3,
              }}
            />
          </Source>
        )}

        {/* KML — GroundOverlay (imágenes georreferenciadas) */}
        {Object.entries(overlaysByProject)
          .filter(([projectId]) => !hiddenRealty.has(projectId))
          .flatMap(([projectId, overlays]) =>
          overlays.map((ov) => (
            <Source
              key={`img-${projectId}-${ov.id}`}
              id={`img-${projectId}-${ov.id}`}
              type="image"
              url={ov.href}
              coordinates={ov.corners}
            >
              <Layer
                id={`img-${projectId}-${ov.id}-layer`}
                type="raster"
                paint={{ 'raster-opacity': 0.92, 'raster-fade-duration': 200 }}
              />
            </Source>
          )),
        )}

        {/* KML — Placemarks (puntos/líneas/polígonos) */}
        {Object.entries(kmlByProject)
          .filter(([id]) => !hiddenRealty.has(id))
          .map(([id, fc]) => (
          <Source key={`kml-${id}`} id={`kml-${id}`} type="geojson" data={fc}>
            <Layer
              id={`kml-${id}-fill`}
              type="fill"
              filter={['==', '$type', 'Polygon']}
              paint={{ 'fill-color': '#e87722', 'fill-opacity': 0.18 }}
            />
            <Layer
              id={`kml-${id}-line`}
              type="line"
              filter={['!=', '$type', 'Point']}
              paint={{ 'line-color': '#b8581a', 'line-width': 2.2, 'line-opacity': 0.85 }}
            />
            <Layer
              id={`kml-${id}-point`}
              type="circle"
              filter={['==', '$type', 'Point']}
              paint={{
                'circle-radius': 6,
                'circle-color': '#e87722',
                'circle-stroke-color': '#fff',
                'circle-stroke-width': 2,
                'circle-opacity': 0.95,
              }}
            />
          </Source>
        ))}

        {/* POI overlays (KMLs cacheados, solo los activos) */}
        {pois.map((p) => {
          const fc = poiCache[p.id];
          if (!fc) return null;
          const color = p.color ?? CATEGORY_COLOR[p.category] ?? '#5a4a40';
          return (
            <Source key={`poi-${p.id}`} id={`poi-${p.id}`} type="geojson" data={fc}>
              <Layer
                id={`poi-${p.id}-line`}
                type="line"
                filter={['==', '$type', 'LineString']}
                paint={{ 'line-color': color, 'line-width': 3, 'line-opacity': 0.9 }}
              />
              <Layer
                id={`poi-${p.id}-fill`}
                type="fill"
                filter={['==', '$type', 'Polygon']}
                paint={{ 'fill-color': color, 'fill-opacity': 0.18 }}
              />
              {p.category === 'tren' ? (
                <Layer
                  id={`poi-${p.id}-symbol`}
                  type="symbol"
                  filter={['==', '$type', 'Point']}
                  layout={{
                    'icon-image': 'icon-tren',
                    'icon-size': 1.0,
                    'icon-allow-overlap': true,
                    'icon-ignore-placement': true,
                    'text-field': ['coalesce', ['get', 'name'], ''],
                    'text-font': ['Open Sans Regular'],
                    'text-size': 12,
                    'text-anchor': 'top',
                    'text-offset': [0, 1.3],
                    'text-optional': true,
                    'text-max-width': 8,
                  }}
                  paint={{
                    'text-color': '#1d1410',
                    'text-halo-color': '#ffffff',
                    'text-halo-width': 1.6,
                    'text-halo-blur': 0.2,
                  }}
                />
              ) : (
                <Layer
                  id={`poi-${p.id}-point`}
                  type="circle"
                  filter={['==', '$type', 'Point']}
                  paint={{
                    'circle-radius': 5,
                    'circle-color': color,
                    'circle-stroke-color': '#fff',
                    'circle-stroke-width': 2,
                    'circle-opacity': 0.95,
                  }}
                />
              )}
            </Source>
          );
        })}

        {/* Measure layer */}
        {measurePts.length > 0 && (
          <Source id="measure" type="geojson" data={measureGeoJSON}>
            <Layer
              id="measure-line"
              type="line"
              filter={['==', '$type', 'LineString']}
              paint={{
                'line-color': '#1d1410',
                'line-width': 2.5,
                'line-dasharray': [2, 1.5],
              }}
            />
            <Layer
              id="measure-points"
              type="circle"
              filter={['==', '$type', 'Point']}
              paint={{
                'circle-radius': 5,
                'circle-color': '#1d1410',
                'circle-stroke-color': '#fff',
                'circle-stroke-width': 2,
              }}
            />
          </Source>
        )}

        {/* Competitor markers */}
        {visibleCompetitors.map((c, i) => {
          const color = colorForInmobiliaria(c.inmobiliaria);
          const letter = (c.proyecto[0] || '?').toUpperCase();
          return (
            <Marker
              key={`c-${i}-${c.proyecto}`}
              longitude={c.lng}
              latitude={c.lat}
              anchor="bottom"
            >
              <div
                className="comp-pin-wrap"
                onMouseEnter={() => !measureMode && setHover({ kind: 'comp', comp: c })}
                onMouseLeave={() => setHover(null)}
                style={{ pointerEvents: measureMode ? 'none' : 'auto' }}
              >
                <div className="comp-pin" style={{ background: color }}>
                  <span>{letter}</span>
                </div>
              </div>
            </Marker>
          );
        })}

        {/* Realty markers */}
        {visibleRealty.map((r) => (
          <Marker
            key={r.id}
            longitude={r.lng}
            latitude={r.lat}
            anchor="bottom"
            style={{ zIndex: 10 }}
          >
            <div
              className="realty-pin-wrap"
              onMouseEnter={() => !measureMode && setHover({ kind: 'realty', project: r })}
              onMouseLeave={() => setHover(null)}
              style={{ pointerEvents: measureMode ? 'none' : 'auto' }}
            >
              <div style={{ position: 'relative', width: 28, height: 28 }}>
                <div className="realty-pulse" />
                <div className="realty-pin">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 10.5 12 3l9 7.5" />
                    <path d="M5 9.5V21h14V9.5" />
                  </svg>
                </div>
              </div>
            </div>
          </Marker>
        ))}

        {/* User-created points */}
        {userPoints.map((up) => (
          <Marker key={`up-${up.id}`} longitude={up.lng} latitude={up.lat} anchor="bottom">
            <div
              className="comp-pin-wrap"
              onMouseEnter={() => setHover({ kind: 'user', point: up })}
              onMouseLeave={() => setHover(null)}
            >
              <div
                className="comp-pin"
                style={{ background: up.color, width: 22, height: 22, fontSize: 11 }}
              >
                <span>★</span>
              </div>
            </div>
          </Marker>
        ))}

        {/* Hover popup */}
        {hover?.kind === 'user' && (
          <Popup
            longitude={hover.point.lng}
            latitude={hover.point.lat}
            anchor="bottom"
            offset={28}
            closeButton={false}
            closeOnClick={false}
            className="rg-popup"
          >
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: hover.point.color }}>
              Punto guardado
            </div>
            <div style={{ fontWeight: 800, fontSize: 13, color: '#1d1410', marginTop: 2 }}>
              {hover.point.name}
            </div>
            {hover.point.description && (
              <div style={{ fontSize: 11, color: '#5a4a40', marginTop: 4, maxWidth: 220 }}>
                {hover.point.description}
              </div>
            )}
          </Popup>
        )}

        {hover?.kind === 'realty' && (
          <Popup
            longitude={hover.project.lng}
            latitude={hover.project.lat}
            anchor="bottom"
            offset={32}
            closeButton={false}
            closeOnClick={false}
            className="rg-popup"
          >
            <div className="text-[9px] font-bold uppercase tracking-[0.08em] text-realty-dark">
              Realty GI
            </div>
            <div className="font-extrabold text-[13px] text-ink mt-0.5">{hover.project.name}</div>
            <div className="text-[11px] text-ink-2 mt-0.5">{hover.project.loc}</div>
            {hover.project.tagline && (
              <div className="text-[11px] text-ink-3 mt-1 max-w-[220px]">
                {hover.project.tagline}
              </div>
            )}
          </Popup>
        )}
        {hover?.kind === 'comp' && (
          <Popup
            longitude={hover.comp.lng}
            latitude={hover.comp.lat}
            anchor="bottom"
            offset={22}
            closeButton={false}
            closeOnClick={false}
            className="rg-popup"
          >
            <div className="font-bold text-[12px] text-ink">{hover.comp.proyecto}</div>
            <div className="text-[11px] text-ink-2 mt-1 flex items-center gap-1.5">
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ background: colorForInmobiliaria(hover.comp.inmobiliaria) }}
              />
              {hover.comp.inmobiliaria}
            </div>
            <div className="text-[10px] text-ink-3 mt-0.5">
              {hover.comp.distrito} · {hover.comp.provincia}
            </div>
          </Popup>
        )}
      </Map>

      {/* Measurement panel */}
      {measureMode && (
        <div className="absolute top-3 left-3 bg-paper border border-line-2 rounded-md shadow-card px-3 py-2 z-[450] min-w-[180px]">
          <div className="text-[10px] uppercase tracking-[0.08em] text-ink-3 font-bold">
            Regla · click para añadir puntos
          </div>
          <div className="font-mono font-bold text-[18px] text-ink mt-1">
            {measurePts.length >= 2 ? formatDistance(measureTotal) : '— —'}
          </div>
          <div className="flex gap-2 mt-1">
            <button
              onClick={() => setMeasurePts((p) => p.slice(0, -1))}
              disabled={measurePts.length === 0}
              className="text-[11px] font-semibold text-ink-2 hover:text-ink disabled:opacity-40"
            >
              Deshacer
            </button>
            <span className="text-ink-3">·</span>
            <button
              onClick={() => setMeasurePts([])}
              disabled={measurePts.length === 0}
              className="text-[11px] font-semibold text-ink-2 hover:text-ink disabled:opacity-40"
            >
              Limpiar
            </button>
          </div>
        </div>
      )}
    </>
  );
}
