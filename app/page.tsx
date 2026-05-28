import MapShell from '@/components/MapShell';
import { fetchCompetidores, fetchRealtyProyectos } from '@/lib/data';

export const revalidate = 0;
export const dynamic = 'force-dynamic';

export default async function Page() {
  const [realty, competitors] = await Promise.all([
    fetchRealtyProyectos(),
    fetchCompetidores(),
  ]);
  return <MapShell realty={realty} competitors={competitors} />;
}
