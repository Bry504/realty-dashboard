-- Datos base del dashboard territorial (Realty GI)
--
-- Recuperados de public/data/*.json, que vivieron en el repo hasta el commit
-- a13ffb3 (28/05/2026) donde se migraron a Supabase y se borraron. Es la unica
-- copia que sobrevivio a la caida del proyecto Supabase original.
--
-- Correr DESPUES de schema.sql. Es idempotente: se puede repetir sin duplicar.
--
-- Lo que NO esta aqui porque nunca estuvo en el repo y solo vivio en la base:
--   * logo_url / kml_url de cada proyecto (los PNG y KML estaban en Storage)
--   * la tabla pois (capas KML de tren, salud, finanzas, educacion)
--   * los puntos marcados a mano en user_points
--   * earth_project_url y brand_logo_url en app_settings

-- ------------------------------------------------------------- proyectos
insert into public.realty_proyectos (id, name, lat, lng, loc, tagline, url, img, orden, visible) values
  ('asia-pacific', 'Asia Pacific', -12.768860472176959, -76.59414187065705, 'Asia · Cañete · Lima', 'Condominio playero frente al Boulevard de Asia', 'https://realtygi.pe/proyecto/asia-pacific/', 'https://realtygi.pe/wp-content/uploads/2026/05/Asia-PacificCard.webp', 1, true),
  ('bosques-calango', 'Bosques de Calango', -12.521052581582486, -76.54689722406069, 'Calango · Cañete · Lima', 'Casa de campo en valle interandino', 'https://realtygi.pe/project/bosques-de-calango/', 'https://realtygi.pe/wp-content/uploads/2026/05/Bosques-de-CalangoCard.webp', 2, true),
  ('paracas-beach', 'Paracas Realty Beach', -13.891908755971006, -76.13888029999998, 'Paracas · Pisco · Ica', 'Lotes desde 100 m² con playa artificial', 'https://realtygi.pe/project/paracas-realty-beach/', 'https://realtygi.pe/wp-content/uploads/2026/05/Paracas-Realty-BeachCard.webp', 3, true),
  ('pachacamac-luxury', 'Pachacamac Luxury', -12.208743286745753, -76.8250360037218, 'Pachacámac · Lima', 'Condominio premium en el valle de Lurín', 'https://realtygi.pe/proyecto/pachacamac-luxury/', 'https://realtygi.pe/wp-content/uploads/2026/05/Pachacamac-LuxuryCard.webp', 4, true),
  ('toscana-garden', 'Toscana Garden', -12.697194341717799, -76.62651921531803, 'Mala · Cañete · Lima', 'Inspiración mediterránea al sur de Lima', 'https://realtygi.pe/project/toscana-garden/', 'https://realtygi.pe/wp-content/uploads/2026/05/Toscana-GardenCard.webp', 5, true),
  ('buonavista', 'Buonavista Condominio', -11.615778189946568, -77.24328075756273, 'Huaral · Lima', 'Vivienda vacacional al norte de Lima', 'https://realtygi.pe/project/buonavista-condominio/', 'https://realtygi.pe/wp-content/uploads/2026/05/Buonavista-CondominioCard.webp', 6, true),
  ('altavista', 'Altavista Condominio', -12.634087263000621, -76.63080386487897, 'Mala · Cañete · Lima', 'Vista panorámica al valle de Mala', 'https://realtygi.pe/project/altavista-condominio/', 'https://realtygi.pe/wp-content/uploads/2026/05/Altavista-CondominioCard.webp', 7, true)
on conflict (id) do update set
  name    = excluded.name,
  lat     = excluded.lat,
  lng     = excluded.lng,
  loc     = excluded.loc,
  tagline = excluded.tagline,
  url     = excluded.url,
  img     = excluded.img,
  orden   = excluded.orden;

-- ----------------------------------------------------------- competencia
-- La tabla usa id autogenerado, asi que el anti-duplicado va por
-- (inmobiliaria, proyecto) con un indice unico.
create unique index if not exists competidores_inmob_proyecto_key
  on public.competidores (inmobiliaria, proyecto);

insert into public.competidores (inmobiliaria, proyecto, provincia, distrito, lat, lng, visible) values
  ('ADC Asia del Campo', 'Las Dunas de Asia', 'Cañete', 'Asia', -12.782, -76.598, true),
  ('ADC Asia del Campo', 'La Hacienda de Asia', 'Cañete', 'Asia', -12.79, -76.595, true),
  ('Calango Country Club/GrupoNorte', 'Calango Condominio', 'Cañete', 'Calango (Mala)', -12.5501, -76.6043, true),
  ('Calango Country Club/GrupoNorte', 'Cineguilla Country Club', 'Lima', 'Cieneguilla', -12.05, -76.83, true),
  ('Lares Grupo Inmobiliario', 'Praderas de Calango', 'Cañete', 'Calango', -12.62, -76.58, true),
  ('Lares Grupo Inmobiliario', 'Costa Morena', 'Lima', 'Punta Hermosa', -12.389, -76.815, true),
  ('Lares Grupo Inmobiliario', 'El Encanto de Paracas', 'Pisco', 'Paracas', -13.832, -76.256, true),
  ('Lares Grupo Inmobiliario', 'Villa El Encanto Paracas', 'Pisco', 'Paracas', -13.833, -76.257, true),
  ('Lares Grupo Inmobiliario', 'La Capilla – Cieneguilla', 'Lima', 'Cieneguilla', -12.03, -76.82, true),
  ('Menorca Inversiones', 'San Antonio de Mala 1-4', 'Cañete', 'Mala', -12.66, -76.635, true),
  ('Menorca Inversiones', 'Costalinda (Menorca Edition)', 'Cañete', 'Chilca', -12.528, -76.738, true),
  ('Menorca Inversiones', 'Las Rompientes (Edition)', 'Lima', 'Punta Rocas', -12.41, -76.83, true),
  ('Menorca Inversiones', 'Posada del Sol Ica', 'Ica', 'Ica', -14.069, -75.725, true),
  ('Menorca Inversiones', 'El Olivar de Pisco', 'Pisco', 'Pisco', -13.71, -76.202, true),
  ('Menorca Inversiones', 'Los Pecanos (Ica)', 'Ica', 'Ica', -14.07, -75.73, true),
  ('Los Portales S.A.', 'La Planicie de Cañete', 'Cañete', 'San Luis (Imperial)', -13.16, -76.44, true),
  ('Los Portales S.A.', 'Nuevo Polo San Antonio', 'Cañete', 'San Antonio', -12.552, -76.658, true),
  ('Los Portales S.A.', 'El Refugio de Ica', 'Ica', 'Ica', -14.091, -75.762, true),
  ('Los Portales S.A.', 'Sol de Ica San Carlos', 'Ica', 'Ica', -14.068, -75.725, true),
  ('Los Portales S.A.', 'Parque Chincha', 'Chincha', 'Chincha Alta', -13.403, -76.128, true),
  ('Convive Grupo Inmobiliario', 'Vive Paracas (I-III)', 'Pisco', 'Paracas', -13.796, -76.25, true),
  ('Convive Grupo Inmobiliario', 'Vive Chincha', 'Chincha', 'Chincha Baja', -13.512, -76.055, true),
  ('Convive Grupo Inmobiliario', 'Siente Chincha', 'Chincha', 'Chincha Baja', -13.52, -76.06, true),
  ('Costa Paraka', 'Costa Paraka', 'Pisco', 'Paracas', -13.836, -76.264, true),
  ('Go House Inmobiliaria', 'Fundo de Asia', 'Cañete', 'Asia', -12.782, -76.598, true),
  ('Go House Inmobiliaria', 'Oasis del Mar', 'Cañete', 'Cerro Azul', -13.021, -76.478, true),
  ('Go House Inmobiliaria', 'Caballerizas de San José I', 'Chincha', 'El Carmen', -13.505, -76.042, true),
  ('Go House Inmobiliaria', 'Caballerizas de San José II', 'Chincha', 'El Carmen', -13.506, -76.041, true),
  ('Go House Inmobiliaria', 'Finca Álamos', 'Cañete', 'Quilmaná', -13.025, -76.299, true),
  ('Go House Inmobiliaria', 'Cóndores de Calango', 'Cañete', 'Calango', -12.89, -76.42, true),
  ('Go House Inmobiliaria', 'Alameda de Paracas', 'Pisco', 'Paracas', -13.82, -76.255, true),
  ('Grupo Taurus', 'Condominio Santorini', 'Cañete', 'Asia', -12.843, -76.572, true),
  ('Centenario Urbanizaciones', 'El Haras – Ica (etapas 1-6B)', 'Ica', 'Ica', -14.07, -75.728, true),
  ('Centenario Urbanizaciones', 'Proyecto Pisco (casco urbano)', 'Pisco', 'Pisco', -13.71, -76.202, true),
  ('Inmobiliaria OXA del Sur', 'OXA del Sur – Grocio Prado', 'Chincha', 'Grocio Prado', -13.455, -76.071, true),
  ('Desarrolladora', 'Country San Antonio (casas)', 'Cañete', 'San Antonio', -12.552, -76.658, true),
  ('Desarrolladora', 'Kannes (Puerto Viejo)', 'Cañete', 'San Antonio', -12.553, -76.659, true),
  ('Promotora Privada/Varios', 'Condominio Playa del Carmen (Chincha)', 'Chincha', 'Chincha Baja', -13.572, -76.205, true),
  ('Promotora Privada/Varios', 'Condominio Brisas de Bujama', 'Cañete', 'Mala', -12.69, -76.645, true),
  ('Promotora Privada/Varios', 'Colinas de Puerto Viejo', 'Cañete', 'San Antonio', -12.553, -76.658, true)
on conflict (inmobiliaria, proyecto) do update set
  provincia = excluded.provincia,
  distrito  = excluded.distrito,
  lat       = excluded.lat,
  lng       = excluded.lng;
