-- Seed de dados para desenvolvimento local (D1 local)
-- NÃO afeta produção — apenas para testar a aplicação localmente
-- IDs sao TEXT (UUIDs) para compatibilidade com schema.sql id TEXT PRIMARY KEY

INSERT OR REPLACE INTO products (id, slug, category, title, description, ean_upc, oem_code, specs_json, lowest_price, offers_json, traffic_tier)
VALUES
(
  'prod-1',
  'pastilha-de-freio-honda-civic-2018',
  'pastilha-freio',
  'Pastilha de Freio Honda Civic 2018',
  'Pastilha de freio ceramica dianteira compativel com Honda Civic 2016-2021. Oferece desempenho superior em frenagem, com material ceramico que reduz ruido e vibracao. Codigo OEM: 45022-SNA-003.',
  '7891234567890',
  '45022-SNA-003',
  '{"Material": "Cerâmica", "Posição": "Dianteira", "Garantia": "3 meses"}',
  89.90,
  '[{"store":"Amazon","price":89.90,"url":"https://amazon.com.br/dp/B000000001?tag=meusite-20","image":"https://m.media-amazon.com/images/I/61N3E2-xJ7L._AC_SL1000_.jpg"},{"store":"Mercado Livre","price":94.40,"url":"https://produto.mercadolivre.com.br/MLB-000000001-pastilha","image":"https://http2.mlstatic.com/D_NQ_NP_123456-MLB12345678901_052022-O.webp"}]',
  'A'
),
(
  'prod-2',
  'pasteldo-de-freio-toyota-corolla-2020',
  'pastilha-freio',
  'Pastilha de Freio Toyota Corolla 2020',
  'Pastilha de freio semi-metalica dianteira compativel com Toyota Corolla 2019-2022. Projetada para durabilidade e eficiencia em diferentes condicoes de pista. Codigo OEM: 04465-0E010.',
  '7891234567891',
  '04465-0E010',
  '{"Material": "Semi-Metálica", "Posição": "Dianteira", "Garantia": "3 meses"}',
  79.50,
  '[{"store":"Amazon","price":79.50,"url":"https://amazon.com.br/dp/B000000002?tag=meusite-20","image":"https://m.media-amazon.com/images/I/71X3E2-yK8M._AC_SL1000_.jpg"},{"store":"Mercado Livre","price":83.48,"url":"https://produto.mercadolivre.com.br/MLB-000002-pastilha","image":"https://http2.mlstatic.com/D_NQ_NP_234567-MLB23456789012_052022-O.webp"}]',
  'B'
),
(
  'prod-3',
  'filtro-oleo-honda-civic-2018',
  'filtro-oleo',
  'Filtro de Oleo Honda Civic 2018',
  'Filtro de oleo para Honda Civic 2016-2021. Garante protecao superior ao motor, retendo particulas e contaminantes com alta eficiencia. Codigo OEM: 15400-RTA-003.',
  '7891234567892',
  '15400-RTA-003',
  '{"Tipo": "Elemento", "Posição": "Cárter", "Garantia": "6 meses"}',
  25.90,
  '[{"store":"Amazon","price":25.90,"url":"https://amazon.com.br/dp/B000000003?tag=meusite-20","image":"https://m.media-amazon.com/images/I/81Y4E2-zK9N._AC_SL1000_.jpg"},{"store":"Mercado Livre","price":27.20,"url":"https://produto.mercadolivre.com.br/MLB-000003-filtro","image":"https://http2.mlstatic.com/D_NQ_NP_345678-MLB34567890123_052022-O.webp"}]',
  'A'
);