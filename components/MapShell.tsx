'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import type { Basemap, Competitor, RealtyProject, TerritorialLevel } from '@/lib/types';
import { colorForInmobiliaria } from '@/lib/colors';

const TerritorialMap = dynamic(() => import('./TerritorialMap'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full grid place-items-center bg-bg">
      <div className="text-center">
        <div className="w-9 h-9 mx-auto mb-3 rounded-full border-[3px] border-line border-t-ink animate-spin" />
        <div className="text-xs text-ink-2 font-medium">Cargando mapa…</div>
      </div>
    </div>
  ),
});

export default function MapShell() {
  const [realty, setRealty] = useState<RealtyProject[]>([]);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [level, setLevel] = useState<TerritorialLevel>('ninguno');
  const [basemap, setBasemap] = useState<Basemap>('claro');
  const [hiddenInmob, setHiddenInmob] = useState<Set<string>>(new Set());
  const [hiddenRealty, setHiddenRealty] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [focusId, setFocusId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/data/realty_proyectos.json').then((r) => r.json()),
      fetch('/data/competidores_coords.json').then((r) => r.json()),
    ]).then(([r, c]: [RealtyProject[], Competitor[]]) => {
      setRealty(r);
      setCompetitors(c);
    });
  }, []);

  const inmobiliarias = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of competitors) map.set(c.inmobiliaria, (map.get(c.inmobiliaria) ?? 0) + 1);
    return Array.from(map.entries()).sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
    );
  }, [competitors]);

  const filteredInmob = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return inmobiliarias;
    return inmobiliarias.filter(([n]) => n.toLowerCase().includes(q));
  }, [inmobiliarias, search]);

  const toggleInmob = (name: string) =>
    setHiddenInmob((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });

  const toggleRealty = (id: string) =>
    setHiddenRealty((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const allHidden = inmobiliarias.length > 0 && hiddenInmob.size === inmobiliarias.length;
  const showAll = () => setHiddenInmob(new Set());
  const hideAll = () => setHiddenInmob(new Set(inmobiliarias.map(([n]) => n)));

  const visibleCompCount = competitors.filter((c) => !hiddenInmob.has(c.inmobiliaria)).length;
  const visibleRealtyCount = realty.filter((r) => !hiddenRealty.has(r.id)).length;

  return (
    <div className="h-screen flex flex-col">
      {/* Topbar */}
      <header className="h-14 flex items-center gap-6 px-5 bg-paper border-b border-line shrink-0 z-[600]">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg grid place-items-center text-white font-extrabold text-sm shadow-[0_2px_6px_rgba(184,88,26,0.35)]"
            style={{ background: 'linear-gradient(155deg, #e87722 0%, #b8581a 100%)' }}
          >
            R
          </div>
          <div className="leading-tight">
            <div className="font-extrabold text-[13px] tracking-tight">Realty GI</div>
            <div className="text-[10px] uppercase tracking-wider text-ink-3 font-bold">
              Mapa Territorial
            </div>
          </div>
        </div>

        <div className="flex gap-5 ml-4">
          <Stat v={`${visibleRealtyCount}/${realty.length}`} l="Realty" />
          <Stat v={`${visibleCompCount}/${competitors.length}`} l="Competencia" />
          <Stat v={inmobiliarias.length} l="Inmobiliarias" />
        </div>

        <div className="flex-1" />

        <div className="flex border border-line-2 rounded-md overflow-hidden">
          {(['claro', 'osm', 'satelite'] as Basemap[]).map((b) => (
            <button
              key={b}
              onClick={() => setBasemap(b)}
              className={`px-2.5 py-1.5 text-[11px] font-medium border-r border-line-2 last:border-r-0 ${
                basemap === b ? 'bg-ink text-white' : 'text-ink-2 hover:bg-paper-2'
              }`}
            >
              {b === 'claro' ? 'Claro' : b === 'osm' ? 'OSM' : 'Satélite'}
            </button>
          ))}
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 grid grid-cols-[320px_1fr] overflow-hidden">
        <aside className="bg-paper border-r border-line overflow-y-auto">
          {/* Realty brand block */}
          <section
            className="px-[18px] pt-[14px] pb-4 border-b-2"
            style={{
              background: 'linear-gradient(180deg, #fdf1e3 0%, #ffffff 80%)',
              borderBottomColor: '#e87722',
            }}
          >
            <div className="flex items-center gap-2 mb-2.5">
              <div
                className="w-7 h-7 rounded-lg grid place-items-center text-white shadow-[0_2px_6px_rgba(184,88,26,0.35)]"
                style={{ background: 'linear-gradient(155deg, #e87722 0%, #b8581a 100%)' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 10.5 12 3l9 7.5" />
                  <path d="M5 9.5V21h14V9.5" />
                </svg>
              </div>
              <div>
                <div className="font-extrabold text-[13px] tracking-tight text-realty-dark">
                  Realty Grupo Inmobiliario
                </div>
                <div className="text-[9px] uppercase tracking-[0.08em] font-bold text-ink-3">
                  Nuestros desarrollos
                </div>
              </div>
            </div>

            <div className="grid gap-1 -mx-1.5 max-h-[320px] overflow-y-auto">
              {realty.map((r) => {
                const off = hiddenRealty.has(r.id);
                return (
                  <div
                    key={r.id}
                    className={`grid grid-cols-[38px_1fr_22px] gap-2 items-center px-2 py-1.5 rounded-md cursor-pointer transition-colors hover:bg-realty-bg ${
                      off ? 'opacity-45' : ''
                    }`}
                    onClick={() => setFocusId(r.id)}
                  >
                    <div
                      className="w-[38px] h-[38px] rounded-md bg-paper-2 bg-cover bg-center shadow-[inset_0_0_0_1px_rgba(0,0,0,0.05)]"
                      style={{ backgroundImage: `url('${r.img}')` }}
                      aria-hidden
                    />
                    <div className="min-w-0 leading-tight">
                      <div className="text-[12px] font-bold text-ink truncate">{r.name}</div>
                      <div className="text-[10px] text-ink-3 truncate">{r.loc}</div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleRealty(r.id); }}
                      className="w-[22px] h-[22px] rounded grid place-items-center text-ink-3 hover:bg-[rgba(212,160,23,0.18)] hover:text-realty-dark"
                      aria-label={off ? 'Mostrar' : 'Ocultar'}
                      title={off ? 'Mostrar' : 'Ocultar'}
                    >
                      <EyeIcon off={off} />
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Territorial level */}
          <section className="px-4 py-4 border-b border-line">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-3 mb-2">
              Nivel territorial
            </h3>
            <div className="grid grid-cols-2 gap-1 p-0.5 bg-paper-2 rounded-md">
              {([
                ['ninguno', 'Ninguno'],
                ['departamento', 'Depto'],
                ['provincia', 'Provincia'],
                ['distrito', 'Distrito'],
              ] as [TerritorialLevel, string][]).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setLevel(key)}
                  className={`px-1.5 py-1.5 text-[11px] font-semibold rounded ${
                    level === key
                      ? 'bg-ink text-white shadow-sm'
                      : 'text-ink-2 hover:text-ink'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-ink-3 mt-2 leading-snug">
              Bordes de GeoPerú sobre el mapa, sin coloreo por datos.
            </p>
          </section>

          {/* Competition */}
          <section className="px-4 py-4 border-b border-line last:border-b-0">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-3">
                Competencia · {inmobiliarias.length}
              </h3>
              <button
                onClick={allHidden ? showAll : hideAll}
                className="text-[10px] font-semibold text-realty-dark hover:underline"
              >
                {allHidden ? 'Mostrar todas' : 'Ocultar todas'}
              </button>
            </div>

            <div className="relative mb-2">
              <svg
                className="absolute left-2 top-1/2 -translate-y-1/2 text-ink-3"
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar inmobiliaria…"
                className="w-full pl-7 pr-2 py-1.5 text-[12px] border border-line-2 rounded-md bg-paper text-ink placeholder:text-ink-3 outline-none focus:border-realty focus:ring-2 focus:ring-realty/20"
              />
            </div>

            <div className="space-y-0.5">
              {filteredInmob.map(([name, count]) => {
                const off = hiddenInmob.has(name);
                return (
                  <button
                    key={name}
                    onClick={() => toggleInmob(name)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-[11px] hover:bg-paper-2 ${
                      off ? 'opacity-40' : ''
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-black/10"
                      style={{ background: colorForInmobiliaria(name) }}
                    />
                    <span className="flex-1 truncate font-semibold text-ink-2">{name}</span>
                    <span className="font-mono text-[10px] text-ink-3">{count}</span>
                    <EyeIcon off={off} small />
                  </button>
                );
              })}
              {filteredInmob.length === 0 && (
                <div className="text-[11px] text-ink-3 text-center py-3">
                  Sin coincidencias.
                </div>
              )}
            </div>
          </section>
        </aside>

        <div className="relative">
          <TerritorialMap
            realty={realty}
            competitors={competitors}
            level={level}
            basemap={basemap}
            hiddenInmobiliarias={hiddenInmob}
            hiddenRealty={hiddenRealty}
            focusId={focusId}
          />
        </div>
      </div>
    </div>
  );
}

function Stat({ v, l }: { v: number | string; l: string }) {
  return (
    <div className="leading-tight">
      <div className="font-bold text-sm font-mono">{v}</div>
      <div className="text-[10px] uppercase tracking-wider text-ink-3">{l}</div>
    </div>
  );
}

function EyeIcon({ off, small = false }: { off: boolean; small?: boolean }) {
  const s = small ? 11 : 14;
  return off ? (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  ) : (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
