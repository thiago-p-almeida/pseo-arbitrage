-- Seed de dados para desenvolvimento local (D1 local)
-- NÃO afeta produção — apenas para testar a aplicação localmente
-- Nota: IDs sao INTEGER porque o FTS5 content_rowid='id' exige inteiro

INSERT INTO products (id, slug, category, title, description, ean_upc, oem_code, specs_json, lowest_price, offers_json, traffic_tier)
VALUES
(
  1,
  'pastilha-de-freio-honda-civic-2018',
  'pastilha-freio',
  'Pastilha de Freio Honda Civic 2018',
  'Pastilha de freio ceramica dianteira compativel com Honda Civic 2016-2021. Oferece desempenho superior em frenagem, com material ceramico que reduz ruido e vibracao. Codigo OEM: 45022-SNA-003.',
  '7891234567890',
  '45022-SNA-003',
  '{"material":"Ceramica","posicao":"Dianteira","compatibilidade":"Honda Civic 2016-2021"}',
  89.90,
  '[{"store":"Amazon","price":89.90,"url":"https://amazon.com.br/dp/B000000001?tag=meusite-20"},{"store":"Mercado Livre","price":94.40,"url":"https://produto.mercadolivre.com.br/MLB-000000001-pastilha"}]',
  'A'
),
(
  2,
  'pastilha-de-freio-toyota-corolla-2020',
  'pastilha-freio',
  'Pastilha de Freio Toyota Corolla 2020',
  'Pastilha de freio semi-metalica dianteira compativel com Toyota Corolla 2019-2022. Projetada para durabilidade e eficiencia em diferentes condicoes de pista. Codigo OEM: 04465-0E010.',
  '7891234567891',
  '04465-0E010',
  '{"material":"Semi-metallica","posicao":"Dianteira","compatibilidade":"Toyota Corolla 2019-2022"}',
  79.50,
  '[{"store":"Amazon","price":79.50,"url":"https://amazon.com.br/dp/B000000002?tag=meusite-20"},{"store":"Mercado Livre","price":83.48,"url":"https://produto.mercadolivre.com.br/MLB-000000002-pastilha"}]',
  'B'
),
(
  3,
  'filtro-oleo-honda-civic-2018',
  'filtro-oleo',
  'Filtro de Oleo Honda Civic 2018',
  'Filtro de oleo para Honda Civic 2016-2021. Garante protecao superior ao motor, retendo particulas e contaminantes com alta eficiencia. Codigo OEM: 15400-RTA-003.',
  '7891234567892',
  '15400-RTA-003',
  '{"tipo":"Elemento","compatibilidade":"Honda Civic 2016-2021"}',
  25.90,
  '[{"store":"Amazon","price":25.90,"url":"https://amazon.com.br/dp/B000000003?tag=meusite-20"},{"store":"Mercado Livre","price":27.20,"url":"https://produto.mercadolivre.com.br/MLB-000000003-filtro"}]',
  'A'
);