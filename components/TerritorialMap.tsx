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
import { loadKmlAsGeoJSON } from '@/lib/kml';
import { formatDistance, totalLengthMeters } from '@/lib/distance';

// ---------- basemaps ----------

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
    maxzoom: 19,
  },
  relieve: {
    tiles: [
      'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',
      'https://b.tile.opentopomap.org/{z}/{x}/{y}.png',
      'https://c.tile.opentopomap.org/{z}/{x}/{y}.png',
    ],
    attribution: '© OpenTopoMap · © OpenStreetMap',
    maxzoom: 17,
  },
};

// AWS Terrarium DEM, free.
const TERRAIN_TILES = [
  'https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png',
];

function buildStyle(basemap: Basemap, terrainOn: boolean): StyleSpecification {
  const b = BASEMAPS[basemap];
  const style: StyleSpecification = {
    version: 8,
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources: {
      basemap: {
        type: 'raster',
        tiles: b.tiles,
        tileSize: 256,
        attribution: b.attribution,
        maxzoom: b.maxzoom ?? 19,
      },
    },
    layers: [{ id: 'basemap', type: 'raster', source: 'basemap' }],
  };
  if (terrainOn) {
    style.sources.terrain = {
      type: 'raster-dem',
      tiles: TERRAIN_TILES,
      tileSize: 256,
      encoding: 'terrarium',
      maxzoom: 14,
    };
    style.terrain = { source: 'terrain', exaggeration: 1.4 };
  }
  return style;
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
  threeD: boolean;
  measureMode: boolean;
};

type HoverInfo =
  | { kind: 'realty'; project: RealtyProject }
  | { kind: 'comp'; comp: Competitor }
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
  threeD,
  measureMode,
}: Props) {
  const mapRef = useRef<MapRef | null>(null);
  const [geo, setGeo] = useState<FeatureCollection | null>(null);
  const [kmlByProject, setKmlByProject] = useState<Record<string, FeatureCollection>>({});
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

  // KML overlays: convert each realty project's kml_url to GeoJSON once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next: Record<string, FeatureCollection> = {};
      await Promise.all(
        realty
          .filter((r) => !!r.kml_url)
          .map(async (r) => {
            try {
              next[r.id] = await loadKmlAsGeoJSON(r.kml_url as string);
            } catch {
              // ignore individual KML failures
            }
          }),
      );
      if (!cancelled) setKmlByProject(next);
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

  // flyTo focus
  useEffect(() => {
    if (!focusId || !mapRef.current) return;
    const r = realty.find((x) => x.id === focusId);
    if (!r) return;
    mapRef.current.flyTo({ center: [r.lng, r.lat], zoom: Math.max(mapRef.current.getZoom(), 13), duration: 900 });
  }, [focusId, realty]);

  // Style — recomputed when basemap or 3D changes
  const mapStyle = useMemo(
    () => buildStyle(basemap, threeD && basemap === 'satelite'),
    [basemap, threeD],
  );

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
      if (!measureMode) return;
      const { lng, lat } = e.lngLat;
      setMeasurePts((prev) => [...prev, [lng, lat]]);
    },
    [measureMode],
  );

  // Clear measure when toggled off
  useEffect(() => {
    if (!measureMode) setMeasurePts([]);
  }, [measureMode]);

  const measureTotal = useMemo(() => totalLengthMeters(measurePts), [measurePts]);

  // Cursor for measure mode
  const cursor = measureMode ? 'crosshair' : 'grab';

  // Set pitch when 3D toggled on
  useEffect(() => {
    if (!mapRef.current) return;
    const m = mapRef.current.getMap();
    if (threeD && basemap === 'satelite') {
      m.easeTo({ pitch: 60, duration: 500 });
    } else {
      m.easeTo({ pitch: 0, bearing: 0, duration: 400 });
    }
  }, [threeD, basemap]);

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
        cursor={cursor}
        style={{ width: '100%', height: '100%' }}
        maxPitch={75}
        dragRotate
      >
        <NavigationControl position="bottom-right" visualizePitch />
        <ScaleControl position="bottom-left" unit="metric" />
        <AttributionControl position="bottom-right" compact />

        {/* Territorial borders */}
        {geo && (
          <Source id="territorial" type="geojson" data={geo}>
            <Layer
              id="territorial-fill"
              type="fill"
              paint={{ 'fill-color': '#1d1410', 'fill-opacity': 0.04 }}
            />
            <Layer
              id="territorial-line"
              type="line"
              paint={{
                'line-color': '#5a4a40',
                'line-width':
                  level === 'distrito' ? 0.5 : level === 'provincia' ? 0.8 : 1.2,
                'line-opacity': 0.7,
              }}
            />
          </Source>
        )}

        {/* KML overlays */}
        {Object.entries(kmlByProject).map(([id, fc]) => (
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

        {/* Hover popup */}
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
