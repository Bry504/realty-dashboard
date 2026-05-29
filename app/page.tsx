import MapShell from '@/components/MapShell';
import {
  fetchCompetidores,
  fetchPois,
  fetchRealtyProyectos,
  fetchSetting,
} from '@/lib/data';

export const revalidate = 0;
export const dynamic = 'force-dynamic';

export default async function Page() {
  const [realty, competitors, pois, earthProjectUrl] = await Promise.all([
    fetchRealtyProyectos(),
    fetchCompetidores(),
    fetchPois(),
    fetchSetting('earth_project_url'),
  ]);
  return (
    <MapShell
      realty={realty}
      competitors={competitors}
      pois={pois}
      earthProjectUrl={earthProjectUrl}
    />
  );
}
