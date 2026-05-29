import MapShell from '@/components/MapShell';
import { fetchCompetidores, fetchRealtyProyectos, fetchSetting } from '@/lib/data';

export const revalidate = 0;
export const dynamic = 'force-dynamic';

export default async function Page() {
  const [realty, competitors, earthProjectUrl] = await Promise.all([
    fetchRealtyProyectos(),
    fetchCompetidores(),
    fetchSetting('earth_project_url'),
  ]);
  return (
    <MapShell
      realty={realty}
      competitors={competitors}
      earthProjectUrl={earthProjectUrl}
    />
  );
}
