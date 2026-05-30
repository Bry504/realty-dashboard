import MapShell from '@/components/MapShell';
import {
  fetchCompetidores,
  fetchPois,
  fetchRealtyProyectos,
  fetchSetting,
  fetchUserPoints,
} from '@/lib/data';

export const revalidate = 0;
export const dynamic = 'force-dynamic';

export default async function Page() {
  const [realty, competitors, pois, earthProjectUrl, brandLogoUrl, userPoints] =
    await Promise.all([
      fetchRealtyProyectos(),
      fetchCompetidores(),
      fetchPois(),
      fetchSetting('earth_project_url'),
      fetchSetting('brand_logo_url'),
      fetchUserPoints(),
    ]);
  return (
    <MapShell
      realty={realty}
      competitors={competitors}
      pois={pois}
      earthProjectUrl={earthProjectUrl}
      brandLogoUrl={brandLogoUrl}
      initialUserPoints={userPoints}
    />
  );
}
