import MapShell from '@/components/MapShell';
import type { Competitor, Poi, RealtyProject, UserPoint } from '@/lib/types';
import {
  fetchCompetidores,
  fetchPois,
  fetchRealtyProyectos,
  fetchSetting,
  fetchUserPoints,
} from '@/lib/data';

export const revalidate = 0;
export const dynamic = 'force-dynamic';

// Supabase es un servicio externo: si la base se cae o el proyecto queda
// pausado, el fetch revienta en el render del server y toda la página muere
// con un 500. Cada lectura cae a su propio valor por defecto para que el mapa
// siga en pie y el aviso explique por qué está vacío.
async function safe<T>(promise: Promise<T>, fallback: T): Promise<[T, boolean]> {
  try {
    return [await promise, true];
  } catch (err) {
    console.error('[dashboard] lectura de Supabase fallida:', err);
    return [fallback, false];
  }
}

export default async function Page() {
  const [
    [realty, okRealty],
    [competitors, okCompetitors],
    [pois, okPois],
    [earthProjectUrl, okEarth],
    [brandLogoUrl, okBrand],
    [userPoints, okPoints],
  ] = await Promise.all([
    safe(fetchRealtyProyectos(), [] as RealtyProject[]),
    safe(fetchCompetidores(), [] as Competitor[]),
    safe(fetchPois(), [] as Poi[]),
    safe(fetchSetting('earth_project_url'), null as string | null),
    safe(fetchSetting('brand_logo_url'), null as string | null),
    safe(fetchUserPoints(), [] as UserPoint[]),
  ]);

  const dbDown = !(okRealty && okCompetitors && okPois && okEarth && okBrand && okPoints);

  return (
    <>
      {dbDown && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[1000] max-w-[92vw] rounded-lg border border-amber-400 bg-amber-50 px-4 py-2 text-center shadow-lg">
          <div className="text-sm font-semibold text-amber-900">
            No se pudo leer la base de datos
          </div>
          <div className="text-xs text-amber-800">
            El mapa se muestra sin proyectos ni competencia. Revisa el estado del proyecto en
            Supabase.
          </div>
        </div>
      )}
      <MapShell
        realty={realty}
        competitors={competitors}
        pois={pois}
        earthProjectUrl={earthProjectUrl}
        brandLogoUrl={brandLogoUrl}
        initialUserPoints={userPoints}
      />
    </>
  );
}
