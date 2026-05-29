import { supabase } from './supabase';
import type { Competitor, Poi, RealtyProject } from './types';

export async function fetchRealtyProyectos(): Promise<RealtyProject[]> {
  const { data, error } = await supabase
    .from('realty_proyectos')
    .select('id,name,lat,lng,loc,tagline,url,img,orden,visible,kml_url')
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
    kml_url: r.kml_url ?? null,
  }));
}

export async function fetchPois(): Promise<Poi[]> {
  const { data, error } = await supabase
    .from('pois')
    .select('id,name,category,kml_url,color,default_visible,orden')
    .order('orden', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    kml_url: p.kml_url,
    color: p.color,
    default_visible: p.default_visible,
  }));
}

export async function fetchSetting(key: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle();
  if (error) throw error;
  return data?.value ?? null;
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
