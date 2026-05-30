'use client';

import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';
import type {
  Basemap,
  Competitor,
  Poi,
  RealtyProject,
  TerritorialLevel,
  UserPoint,
} from '@/lib/types';
import { colorForInmobiliaria } from '@/lib/colors';
import { CATEGORY_COLOR } from '@/lib/poiColors';
import { createUserPoint, deleteUserPoint } from '@/lib/data';

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

type MapShellProps = {
  realty: RealtyProject[];
  competitors: Competitor[];
  pois: Poi[];
  earthProjectUrl?: string | null;
  brandLogoUrl?: string | null;
  initialUserPoints: UserPoint[];
};

const USER_POINT_COLORS = ['#7c3aed', '#e87722', '#16a085', '#c0392b', '#1976d2', '#d97706'];

export default function MapShell({
  realty,
  competitors,
  pois,
  earthProjectUrl,
  brandLogoUrl,
  initialUserPoints,
}: MapShellProps) {
  // Estado global ----------------------------------------------------------
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [level, setLevel] = useState<TerritorialLevel>('ninguno');
  const [basemap, setBasemap] = useState<Basemap>('claro');
  const [territorialOpacity, setTerritorialOpacity] = useState(0.06);
  const [hiddenInmob, setHiddenInmob] = useState<Set<string>>(new Set());
  const [hiddenRealty, setHiddenRealty] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [focusId, setFocusId] = useState<string | null>(null);
  const [measureMode, setMeasureMode] = useState(false);
  const [openEarthSignal, setOpenEarthSignal] = useState(0);

  const [activePoiIds, setActivePoiIds] = useState<Set<string>>(
    () => new Set(pois.filter((p) => p.default_visible).map((p) => p.id)),
  );

  // user_points
  const [userPoints, setUserPoints] = useState<UserPoint[]>(initialUserPoints);
  const [showUserPoints, setShowUserPoints] = useState(true);
  const [addPointMode, setAddPointMode] = useState(false);
  const [draftPoint, setDraftPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftDesc, setDraftDesc] = useState('');
  const [draftColor, setDraftColor] = useState(USER_POINT_COLORS[0]);
  const [savingPoint, setSavingPoint] = useState(false);

  // Derivados --------------------------------------------------------------
  const inmobiliarias = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of competitors) m.set(c.inmobiliaria, (m.get(c.inmobiliaria) ?? 0) + 1);
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [competitors]);

  const filteredInmob = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return inmobiliarias;
    return inmobiliarias.filter(([n]) => n.toLowerCase().includes(q));
  }, [inmobiliarias, search]);

  const allInmobHidden =
    inmobiliarias.length > 0 && hiddenInmob.size === inmobiliarias.length;
  const allRealtyHidden = realty.length > 0 && hiddenRealty.size === realty.length;

  const activePois = pois.filter((p) => activePoiIds.has(p.id));
  const visibleCompCount = competitors.filter((c) => !hiddenInmob.has(c.inmobiliaria)).length;
  const visibleRealtyCount = realty.filter((r) => !hiddenRealty.has(r.id)).length;

  // Handlers ---------------------------------------------------------------
  const toggleInmob = (name: string) =>
    setHiddenInmob((p) => {
      const n = new Set(p);
      n.has(name) ? n.delete(name) : n.add(name);
      return n;
    });
  const toggleRealty = (id: string) =>
    setHiddenRealty((p) => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const togglePoi = (id: string) =>
    setActivePoiIds((p) => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const toggleAllRealty = () =>
    setHiddenRealty(allRealtyHidden ? new Set() : new Set(realty.map((r) => r.id)));

  const startAddPoint = () => {
    setAddPointMode(true);
    setMeasureMode(false);
  };
  const cancelDraft = () => {
    setDraftPoint(null);
    setDraftName('');
    setDraftDesc('');
    setDraftColor(USER_POINT_COLORS[0]);
  };
  const saveDraft = async () => {
    if (!draftPoint || !draftName.trim()) return;
    setSavingPoint(true);
    try {
      const created = await createUserPoint({
        name: draftName.trim(),
        description: draftDesc.trim() || null,
        lat: draftPoint.lat,
        lng: draftPoint.lng,
        color: draftColor,
      });
      setUserPoints((prev) => [created, ...prev]);
      cancelDraft();
      setAddPointMode(false);
    } finally {
      setSavingPoint(false);
    }
  };
  const removeUserPoint = async (id: number) => {
    if (!confirm('¿Eliminar este punto guardado?')) return;
    await deleteUserPoint(id);
    setUserPoints((prev) => prev.filter((p) => p.id !== id));
  };

  // Render -----------------------------------------------------------------
  return (
    <div className="h-screen flex flex-col">
      {/* ============ Topbar ============ */}
      <header className="h-14 flex items-center gap-4 px-4 bg-paper border-b border-line shrink-0 z-[600]">
        <button
          onClick={() => setSidebarOpen((v) => !v)}
          className="w-8 h-8 rounded-md border border-line-2 text-ink-2 hover:bg-paper-2 grid place-items-center shrink-0"
          title={sidebarOpen ? 'Ocultar panel' : 'Mostrar panel'}
        >
          <HamburgerIcon />
        </button>

        <div className="flex items-center gap-2.5">
          {brandLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={brandLogoUrl}
              alt="Realty GI"
              className="h-9 w-auto object-contain"
            />
          ) : (
            <div
              className="w-8 h-8 rounded-lg grid place-items-center text-white font-extrabold text-sm shadow-[0_2px_6px_rgba(184,88,26,0.35)]"
              style={{ background: 'linear-gradient(155deg, #e87722 0%, #b8581a 100%)' }}
            >
              R
            </div>
          )}
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

        <button
          onClick={startAddPoint}
          className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-md border ${
            addPointMode ? 'bg-realty text-white border-realty' : 'border-line-2 text-ink-2 hover:bg-paper-2'
          }`}
          title="Añadir punto: click sobre el mapa"
        >
          <span className="inline-flex items-center gap-1.5">
            <PlusPinIcon /> {addPointMode ? 'Click en mapa…' : 'Añadir punto'}
          </span>
        </button>

        <button
          onClick={() => { setMeasureMode((v) => !v); setAddPointMode(false); }}
          className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-md border ${
            measureMode ? 'bg-ink text-white border-ink' : 'border-line-2 text-ink-2 hover:bg-paper-2'
          }`}
          title="Medir distancia"
        >
          <span className="inline-flex items-center gap-1.5">
            <RulerIcon /> Regla
          </span>
        </button>

        <button
          onClick={() => {
            if (earthProjectUrl) window.open(earthProjectUrl, '_blank', 'noopener,noreferrer');
            else setOpenEarthSignal((n) => n + 1);
          }}
          className="px-2.5 py-1.5 text-[11px] font-semibold rounded-md border border-line-2 text-ink-2 hover:bg-paper-2"
          title={earthProjectUrl ? 'Abrir nuestro Google Earth Project' : 'Abrir la vista actual en Google Earth'}
        >
          <span className="inline-flex items-center gap-1.5">
            <GlobeIcon /> 3D en Earth
          </span>
        </button>

        <div className="flex border border-line-2 rounded-md overflow-hidden">
          {(['claro', 'osm', 'satelite', 'relieve'] as Basemap[]).map((b) => (
            <button
              key={b}
              onClick={() => setBasemap(b)}
              className={`px-2.5 py-1.5 text-[11px] font-medium border-r border-line-2 last:border-r-0 ${
                basemap === b ? 'bg-ink text-white' : 'text-ink-2 hover:bg-paper-2'
              }`}
            >
              {b === 'claro' ? 'Claro' : b === 'osm' ? 'OSM' : b === 'satelite' ? 'Satélite' : 'Relieve'}
            </button>
          ))}
        </div>
      </header>

      {/* ============ Body ============ */}
      <div
        className={`flex-1 grid overflow-hidden transition-[grid-template-columns] duration-200 ${
          sidebarOpen ? 'grid-cols-[320px_1fr]' : 'grid-cols-[0_1fr]'
        }`}
      >
        <aside
          className={`bg-paper border-r border-line overflow-y-auto ${
            sidebarOpen ? '' : 'invisible'
          }`}
        >
          {/* Realty brand block */}
          <section
            className="px-[18px] pt-[14px] pb-3 border-b-2"
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
              <div className="flex-1 min-w-0">
                <div className="font-extrabold text-[13px] tracking-tight text-realty-dark">
                  Realty Grupo Inmobiliario
                </div>
                <div className="text-[9px] uppercase tracking-[0.08em] font-bold text-ink-3">
                  Nuestros desarrollos
                </div>
              </div>
              <button
                onClick={toggleAllRealty}
                className="w-[26px] h-[26px] rounded grid place-items-center text-ink-3 hover:bg-realty-bg hover:text-realty-dark"
                title={allRealtyHidden ? 'Mostrar todos' : 'Ocultar todos'}
              >
                <EyeIcon off={allRealtyHidden} />
              </button>
            </div>

            <div className="grid gap-1 -mx-1.5 max-h-[160px] overflow-y-auto">
              {realty.map((r) => {
                const off = hiddenRealty.has(r.id);
                const thumb = r.logo_url || r.img;
                return (
                  <div
                    key={r.id}
                    className={`grid grid-cols-[34px_1fr_22px] gap-2 items-center px-2 py-1 rounded-md cursor-pointer transition-colors hover:bg-realty-bg ${
                      off ? 'opacity-45' : ''
                    }`}
                    onClick={() => setFocusId(r.id)}
                  >
                    <div
                      className="w-[34px] h-[34px] rounded-md bg-white grid place-items-center shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]"
                      aria-hidden
                    >
                      {thumb && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={thumb} alt="" className="max-w-[28px] max-h-[28px] object-contain" />
                      )}
                    </div>
                    <div className="min-w-0 leading-tight">
                      <div className="text-[12px] font-bold text-ink truncate">{r.name}</div>
                      <div className="text-[10px] text-ink-3 truncate">{r.loc}</div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleRealty(r.id); }}
                      className="w-[22px] h-[22px] rounded grid place-items-center text-ink-3 hover:bg-[rgba(212,160,23,0.18)] hover:text-realty-dark"
                      title={off ? 'Mostrar' : 'Ocultar'}
                    >
                      <EyeIcon off={off} />
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Territorial level + opacidad */}
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
                    level === key ? 'bg-ink text-white shadow-sm' : 'text-ink-2 hover:text-ink'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {level !== 'ninguno' && (
              <div className="mt-3">
                <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-3 mb-1">
                  <span>Opacidad del relleno</span>
                  <span className="font-mono text-ink-2">
                    {Math.round(territorialOpacity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={60}
                  step={1}
                  value={Math.round(territorialOpacity * 100)}
                  onChange={(e) => setTerritorialOpacity(Number(e.target.value) / 100)}
                  className="w-full accent-realty"
                />
              </div>
            )}
          </section>

          {/* POIs */}
          <section className="px-4 py-4 border-b border-line">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-3 mb-2">
              Puntos de interés (POIS)
            </h3>
            {pois.length === 0 ? (
              <p className="text-[10px] text-ink-3 leading-snug">Aún no hay capas configuradas.</p>
            ) : (
              <div className="space-y-0.5">
                {pois.map((p) => {
                  const active = activePoiIds.has(p.id);
                  const dot = p.color ?? CATEGORY_COLOR[p.category] ?? '#5a4a40';
                  return (
                    <button
                      key={p.id}
                      onClick={() => togglePoi(p.id)}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-[11px] hover:bg-paper-2 ${
                        active ? '' : 'opacity-50'
                      }`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-black/10"
                        style={{ background: dot }}
                      />
                      <span className="flex-1 truncate font-semibold text-ink-2">{p.name}</span>
                      <EyeIcon off={!active} small />
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* Puntos guardados */}
          <section className="px-4 py-4 border-b border-line">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-3">
                Puntos guardados · {userPoints.length}
              </h3>
              <button
                onClick={() => setShowUserPoints((v) => !v)}
                className="w-[22px] h-[22px] rounded grid place-items-center text-ink-3 hover:bg-paper-2 hover:text-ink"
                title={showUserPoints ? 'Ocultar todos' : 'Mostrar todos'}
              >
                <EyeIcon off={!showUserPoints} small />
              </button>
            </div>
            {userPoints.length === 0 ? (
              <p className="text-[10px] text-ink-3 leading-snug">
                Click "Añadir punto" en la barra superior para colocar uno sobre el mapa.
              </p>
            ) : (
              <div className="space-y-0.5 max-h-[180px] overflow-y-auto">
                {userPoints.map((up) => (
                  <div
                    key={up.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded text-[11px] hover:bg-paper-2"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-black/10"
                      style={{ background: up.color }}
                    />
                    <button
                      onClick={() => setFocusId(`up-${up.id}`)}
                      className="flex-1 text-left min-w-0"
                    >
                      <div className="font-semibold text-ink-2 truncate">{up.name}</div>
                      {up.description && (
                        <div className="text-[10px] text-ink-3 truncate">{up.description}</div>
                      )}
                    </button>
                    <button
                      onClick={() => removeUserPoint(up.id)}
                      className="w-[22px] h-[22px] rounded grid place-items-center text-ink-3 hover:bg-paper-2 hover:text-bad"
                      title="Eliminar"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Competencia */}
          <section className="px-4 py-4 border-b border-line last:border-b-0">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-3">
                Competencia · {inmobiliarias.length}
              </h3>
              <button
                onClick={() =>
                  setHiddenInmob(allInmobHidden ? new Set() : new Set(inmobiliarias.map(([n]) => n)))
                }
                className="text-[10px] font-semibold text-realty-dark hover:underline"
              >
                {allInmobHidden ? 'Mostrar todas' : 'Ocultar todas'}
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
                <div className="text-[11px] text-ink-3 text-center py-3">Sin coincidencias.</div>
              )}
            </div>
          </section>
        </aside>

        <div className="relative">
          {/* FAB para reabrir sidebar cuando está cerrado */}
          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="absolute top-3 left-3 z-[500] bg-paper border border-line-2 shadow-card rounded-md px-2.5 py-1.5 text-[11px] font-semibold text-ink-2 hover:bg-paper-2 inline-flex items-center gap-1.5"
            >
              <HamburgerIcon /> Mostrar panel
            </button>
          )}

          {/* Banner del modo "añadir punto" */}
          {addPointMode && !draftPoint && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[500] bg-realty text-white text-[12px] font-semibold rounded-md shadow-card px-3 py-1.5 inline-flex items-center gap-2">
              Click sobre el mapa para colocar el punto
              <button
                onClick={() => setAddPointMode(false)}
                className="ml-1 underline underline-offset-2 hover:no-underline"
              >
                Cancelar
              </button>
            </div>
          )}

          <TerritorialMap
            realty={realty}
            competitors={competitors}
            level={level}
            basemap={basemap}
            hiddenInmobiliarias={hiddenInmob}
            hiddenRealty={hiddenRealty}
            focusId={focusId}
            measureMode={measureMode}
            openEarthSignal={openEarthSignal}
            pois={activePois}
            territorialFillOpacity={territorialOpacity}
            userPoints={showUserPoints ? userPoints : []}
            addPointMode={addPointMode}
            onMapClickToCreate={({ lng, lat }) => setDraftPoint({ lng, lat })}
          />

          {/* Modal de creación del punto */}
          {draftPoint && (
            <div className="absolute inset-0 z-[700] bg-black/30 grid place-items-center">
              <div className="bg-paper rounded-lg shadow-card w-[360px] max-w-[90vw] p-5">
                <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-ink-3 mb-1">
                  Nuevo punto
                </div>
                <div className="text-[13px] font-extrabold mb-3">
                  Lat {draftPoint.lat.toFixed(5)} · Lng {draftPoint.lng.toFixed(5)}
                </div>

                <label className="block text-[10px] font-bold uppercase tracking-[0.06em] text-ink-3 mb-1">
                  Nombre
                </label>
                <input
                  autoFocus
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  placeholder="Ej. Oficina de ventas competencia"
                  className="w-full mb-3 px-2.5 py-1.5 text-[12px] border border-line-2 rounded-md bg-paper text-ink outline-none focus:border-realty focus:ring-2 focus:ring-realty/20"
                />

                <label className="block text-[10px] font-bold uppercase tracking-[0.06em] text-ink-3 mb-1">
                  Descripción
                </label>
                <textarea
                  value={draftDesc}
                  onChange={(e) => setDraftDesc(e.target.value)}
                  rows={3}
                  placeholder="Notas, observaciones, links…"
                  className="w-full mb-3 px-2.5 py-1.5 text-[12px] border border-line-2 rounded-md bg-paper text-ink outline-none focus:border-realty focus:ring-2 focus:ring-realty/20 resize-none"
                />

                <label className="block text-[10px] font-bold uppercase tracking-[0.06em] text-ink-3 mb-1">
                  Color
                </label>
                <div className="flex gap-2 mb-4">
                  {USER_POINT_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setDraftColor(c)}
                      className={`w-6 h-6 rounded-full border-2 ${
                        draftColor === c ? 'border-ink' : 'border-line-2'
                      }`}
                      style={{ background: c }}
                      title={c}
                    />
                  ))}
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => {
                      cancelDraft();
                      setAddPointMode(false);
                    }}
                    className="px-3 py-1.5 text-[12px] font-semibold rounded-md border border-line-2 text-ink-2 hover:bg-paper-2"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={saveDraft}
                    disabled={!draftName.trim() || savingPoint}
                    className="px-3 py-1.5 text-[12px] font-semibold rounded-md bg-realty text-white hover:bg-realty-dark disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {savingPoint ? 'Guardando…' : 'Guardar'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- bits ----------

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

function HamburgerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}
function PlusPinIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s7-7 7-12a7 7 0 1 0-14 0c0 5 7 12 7 12Z" />
      <path d="M12 7v6M9 10h6" />
    </svg>
  );
}
function RulerIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 17 17 3l4 4L7 21 3 17Z" />
      <path d="m7 13 2 2M10 10l2 2M13 7l2 2" />
    </svg>
  );
}
function GlobeIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14.5 14.5 0 0 1 0 18M12 3a14.5 14.5 0 0 0 0 18" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6 18 21a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6" />
    </svg>
  );
}
