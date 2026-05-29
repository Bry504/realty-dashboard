export type RealtyProject = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  loc: string;
  tagline: string;
  url: string;
  img: string;
  kml_url?: string | null;
};

export type Competitor = {
  inmobiliaria: string;
  proyecto: string;
  provincia: string;
  distrito: string;
  lat: number;
  lng: number;
};

export type TerritorialLevel = 'departamento' | 'provincia' | 'distrito' | 'ninguno';
export type Basemap = 'claro' | 'osm' | 'satelite' | 'relieve';
