'use client';

import { useEffect, useMemo, useState } from 'react';
import L from 'leaflet';
import { GeoJSON, MapContainer, Marker, TileLayer, Tooltip, useMap } from 'react-leaflet';
import type { FeatureCollection } from 'geojson';
import type { Basemap, Competitor, RealtyProject, TerritorialLevel } from '@/lib/types';
import { colorForInmobiliaria } from '@/lib/colors';

const BASEMAPS: Record<Basemap, { url: string; attribution: string }> = {
  claro: {
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap &copy; CARTO',
  },
  osm: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
  },
  satelite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
  },
};

function realtyIcon(): L.DivIcon {
  return L.divIcon({
    className: 'realty-pin-wrap',
    iconSize: [28, 28],
    iconAnchor: [14, 26],
    tooltipAnchor: [0, -20],
    html: `
      <div style="position:relative;width:28px;height:28px;">
        <div class="realty-pulse"></div>
        <div class="realty-pin">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>
          </svg>
        </div>
      </div>
    `,
  });
}

function compIcon(color: string, letter: string): L.DivIcon {
  return L.divIcon({
    className: 'comp-pin-wrap',
    iconSize: [18, 18],
    iconAnchor: [9, 18],
    tooltipAnchor: [0, -14],
    html: `<div class="comp-pin" style="background:${color}"><span>${letter}</span></div>`,
  });
}

function FlyToFocus({
  realty,
  focusId,
}: {
  realty: RealtyProject[];
  focusId: string | null;
}) {
  const map = useMap();
  useEffect(() => {
    if (!focusId) return;
    const r = realty.find((x) => x.id === focusId);
    if (r) map.flyTo([r.lat, r.lng], Math.max(map.getZoom(), 13), { duration: 0.8 });
  }, [focusId, realty, map]);
  return null;
}

function FitBoundsOnce({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    const b = L.latLngBounds(points);
    map.fitBounds(b.pad(0.15));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

type Props = {
  realty: RealtyProject[];
  competitors: Competitor[];
  level: TerritorialLevel;
  basemap: Basemap;
  hiddenInmobiliarias: Set<string>;
  hiddenRealty: Set<string>;
  focusId?: string | null;
};

export default function TerritorialMap({
  realty,
  competitors,
  level,
  basemap,
  hiddenInmobiliarias,
  hiddenRealty,
  focusId,
}: Props) {
  const [geo, setGeo] = useState<FeatureCollection | null>(null);
  const [geoKey, setGeoKey] = useState(0);

  useEffect(() => {
    if (level === 'ninguno') {
      setGeo(null);
      return;
    }
    let cancelled = false;
    const file =
      level === 'departamento' ? 'departamentos' :
      level === 'provincia' ? 'provincias' : 'distritos';
    fetch(`/geo/${file}.geojson`)
      .then((r) => r.json())
      .then((data: FeatureCollection) => {
        if (!cancelled) {
          setGeo(data);
          setGeoKey((k) => k + 1);
        }
      })
      .catch(() => !cancelled && setGeo(null));
    return () => { cancelled = true; };
  }, [level]);

  const points: [number, number][] = useMemo(
    () => [
      ...realty.map((r) => [r.lat, r.lng] as [number, number]),
      ...competitors.map((c) => [c.lat, c.lng] as [number, number]),
    ],
    [realty, competitors],
  );

  const tile = BASEMAPS[basemap];
  const geoStyle = {
    color: '#5a4a40',
    weight: level === 'distrito' ? 0.5 : level === 'provincia' ? 0.8 : 1.2,
    opacity: 0.7,
    fillOpacity: 0.04,
    fillColor: '#1d1410',
  };

  return (
    <MapContainer
      center={[-12.5, -76.6]}
      zoom={8}
      scrollWheelZoom
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer key={basemap} url={tile.url} attribution={tile.attribution} />

      {geo && (
        <GeoJSON
          key={geoKey}
          data={geo}
          style={geoStyle}
          onEachFeature={(feature, layer) => {
            const p = (feature.properties ?? {}) as Record<string, unknown>;
            const label =
              (p.NOMBDEP as string) ||
              (p.NOMBPROV as string) ||
              (p.NOMBDIST as string) ||
              (p.name as string) ||
              '';
            if (label) layer.bindTooltip(label, { sticky: true, direction: 'top' });
            (layer as L.Path).on({
              mouseover: (e) => (e.target as L.Path).setStyle({ fillOpacity: 0.14, weight: 1.6 }),
              mouseout: (e) => (e.target as L.Path).setStyle(geoStyle),
            });
          }}
        />
      )}

      {competitors
        .filter((c) => !hiddenInmobiliarias.has(c.inmobiliaria))
        .map((c, i) => {
          const color = colorForInmobiliaria(c.inmobiliaria);
          const letter = (c.proyecto[0] || '?').toUpperCase();
          return (
            <Marker key={`c-${i}`} position={[c.lat, c.lng]} icon={compIcon(color, letter)}>
              <Tooltip direction="top" offset={[0, -8]} opacity={1}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 12, color: '#1d1410' }}>{c.proyecto}</div>
                  <div style={{ fontSize: 11, color: '#5a4a40', marginTop: 2 }}>
                    <span
                      style={{
                        display: 'inline-block',
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: color,
                        marginRight: 6,
                        verticalAlign: 'middle',
                      }}
                    />
                    {c.inmobiliaria}
                  </div>
                  <div style={{ fontSize: 10, color: '#9a8a80', marginTop: 2 }}>
                    {c.distrito} · {c.provincia}
                  </div>
                </div>
              </Tooltip>
            </Marker>
          );
        })}

      {realty.filter((r) => !hiddenRealty.has(r.id)).map((r) => (
        <Marker key={r.id} position={[r.lat, r.lng]} icon={realtyIcon()} zIndexOffset={1000}>
          <Tooltip direction="top" offset={[0, -22]} opacity={1}>
            <div>
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: '#b8581a',
                }}
              >
                Realty GI
              </div>
              <div style={{ fontWeight: 800, fontSize: 13, color: '#1d1410', marginTop: 2 }}>
                {r.name}
              </div>
              <div style={{ fontSize: 11, color: '#5a4a40', marginTop: 2 }}>{r.loc}</div>
              <div style={{ fontSize: 11, color: '#9a8a80', marginTop: 4, maxWidth: 220 }}>
                {r.tagline}
              </div>
            </div>
          </Tooltip>
        </Marker>
      ))}

      <FitBoundsOnce points={points} />
      <FlyToFocus realty={realty} focusId={focusId ?? null} />
    </MapContainer>
  );
}
