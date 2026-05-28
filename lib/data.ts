import { supabase } from './supabase';
import type { Competitor, RealtyProject } from './types';

export async function fetchRealtyProyectos(): Promise<RealtyProject[]> {
  const { data, error } = await supabase
    .from('realty_proyectos')
    .select('id,name,lat,lng,loc,tagline,url,img,orden,visible')
    .eq('visible', true)
    .order('orden', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    lat: r.lat,
    lng: r.lng,
    loc: r.loc,
    tagline: r.tagline ?? '',
    url: r.url ?? '',
    img: r.img ?? '',
  }));
}

export async function fetchCompetidores(): Promise<Competitor[]> {
  const { data, error } = await supabase
    .from('v_competidores')
    .select('inmobiliaria,proyecto,provincia,distrito,lat,lng,visible')
    .eq('visible', true)
    .order('inmobiliaria', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((c) => ({
    inmobiliaria: c.inmobiliaria,
    proyecto: c.proyecto,
    provincia: c.provincia ?? '',
    distrito: c.distrito ?? '',
    lat: c.lat,
    lng: c.lng,
  }));
}
