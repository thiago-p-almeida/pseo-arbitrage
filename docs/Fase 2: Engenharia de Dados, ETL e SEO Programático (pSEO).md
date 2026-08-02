# Fase 2: Engenharia de Dados, ETL e SEO Programático (pSEO)**

---

## SEÇÃO 3: Engenharia de Dados & Taxonomia (Eletrônicos + Peças Automotivas)

A modelagem de dados no Cloudflare D1 (SQLite) exige uma abordagem **desnormalizada**. Como o D1 opera no Edge, `JOINs` complexos entre múltiplas tabelas de milhões de linhas adicionam latência e consomem a cota de leitura rapidamente. A regra é: *O ETL faz o trabalho pesado de normalização; o D1 serve dados prontos para leitura.*

### 3.1. Modelagem de Dados (Conceptual DDL para Cloudflare D1)

```sql
-- Tabela 1: Catálogo Unificado (Eletrônicos e Peças)
-- Otimizada para leitura direta na rota SSR do Astro
CREATE TABLE products (
    id TEXT PRIMARY KEY, -- UUID ou Hash do EAN/OEM
    slug TEXT UNIQUE NOT NULL,
    category TEXT NOT NULL, -- 'smartphone', 'pastilha-freio'
    title TEXT NOT NULL,
    ean_upc TEXT, -- Para Eletrônicos
    oem_code TEXT, -- Para Peças Automotivas
    specs_json TEXT, -- JSON stringificado com especificações técnicas
    lowest_price REAL, -- Preço em cache para ordenação rápida
    offers_json TEXT, -- JSON stringificado com array de ofertas (Amazon, ML, etc)
    traffic_tier TEXT DEFAULT 'C', -- 'A', 'B', 'C' (Para o ETL Curva ABC)
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabela 2: Matriz de Compatibilidade Automotiva (N:N Desnormalizada)
-- Permite buscar todas as peças de um carro, ou todos os carros de uma peça
CREATE TABLE automotive_compatibility (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL, -- FK para products.id
    make TEXT NOT NULL, -- 'honda'
    model TEXT NOT NULL, -- 'civic'
    year_start INTEGER,
    year_end INTEGER,
    engine TEXT,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- ÍNDICES DE ALTA PERFORMANCE (CRÍTICOS)
CREATE INDEX idx_products_slug ON products(slug);
CREATE INDEX idx_auto_make_model ON automotive_compatibility(make, model);

-- ÍNDICE FTS5 (Full-Text Search) para busca em milissegundos
CREATE VIRTUAL TABLE products_fts USING fts5(
    title, 
    oem_code, 
    ean_upc, 
    content='products', 
    content_rowid='id'
);

-- TRIGGERS DE SINCRONIZAÇÃO FTS5 (OBRIGATÓRIO)
-- Garante que o índice de busca seja atualizado automaticamente pelo SQLite
-- sempre que o ETL inserir, atualizar ou deletar um produto.
CREATE TRIGGER products_ai AFTER INSERT ON products BEGIN
  INSERT INTO products_fts(rowid, title, oem_code, ean_upc) 
  VALUES (new.id, new.title, new.oem_code, new.ean_upc);
END;

CREATE TRIGGER products_ad AFTER DELETE ON products BEGIN
  INSERT INTO products_fts(products_fts, rowid, title, oem_code, ean_upc) 
  VALUES('delete', old.id, old.title, old.oem_code, old.ean_upc);
END;

CREATE TRIGGER products_au AFTER UPDATE ON products BEGIN
  INSERT INTO products_fts(products_fts, rowid, title, oem_code, ean_upc) 
  VALUES('delete', old.id, old.title, old.oem_code, old.ean_upc);
  INSERT INTO products_fts(rowid, title, oem_code, ean_upc) 
  VALUES (new.id, new.title, new.oem_code, new.ean_upc);
END;
```
*(Nota: A tabela `click_tracking` foi removida da arquitetura, pois o rastreamento de Sub-ID agora é 100% Stateless via Web Crypto API, conforme Seção 1.2).*

### 3.2. Pipeline ETL Assíncrono & Curva ABC (CRÍTICO)

Para não estourar os 2.000 minutos/mês do GitHub Actions, o script Python (`asyncio` + `aiohttp`) implementa uma lógica de atualização assimétrica baseada na **Curva ABC de Tráfego**.

**Lógica de Classificação (Atualizada via Worker):**
*   Se uma URL recebe > 10 visitas/semana ou gerou clique de afiliado = `traffic_tier = 'A'`.
*   Se recebe 1 a 9 visitas/semana = `traffic_tier = 'B'`.
*   Se não recebe visitas (Long-tail pSEO puro) = `traffic_tier = 'C'`.

**Resiliência e Rate Limits (Bypass de Bloqueios):**
APIs como a Amazon PAAPI possuem limites estritos (ex: 1 requisição por segundo). Como os IPs do GitHub Actions são públicos, disparar milhares de requisições simultâneas resultará em *HTTP 429 (Too Many Requests)* ou banimento de IP.
*   **Solução:** O script Python implementa obrigatoriamente **Exponential Backoff com Jitter**. Em caso de falha ou limite atingido, o script aguarda um tempo exponencialmente maior (2s, 4s, 8s) somado a um atraso aleatório (*jitter* de milissegundos) antes de tentar novamente, diluindo a carga e simulando comportamento orgânico.

**Cronograma do GitHub Actions:**
1.  **Workflow `etl-curve-a.yml` (Roda a cada 4 horas):**
    *   Faz `SELECT id FROM products WHERE traffic_tier = 'A'`.
    *   Dispara requisições assíncronas em lote (com Backoff/Jitter) para as APIs da Amazon/ML.
    *   Faz `UPDATE` no D1 com os novos preços. Consome ~5 min/dia.
2.  **Workflow `etl-curve-bc.yml` (Roda 1x por semana ou mensal):**
    *   Atualiza o restante do catálogo em *chunks* para manter o banco "fresco" para o Googlebot, sem estourar o limite de tempo.
3.  **Atualização Sob Demanda (Webhook):**
    *   Se um usuário acessa um produto 'C' e o cache está expirado há > 30 dias, o Worker envia uma mensagem para uma fila (Cloudflare Queue) que aciona o ETL apenas para aquele SKU específico.

---

## SEÇÃO 4: SEO Técnico Programático de Escala (pSEO & E-E-A-T)

O sucesso do pSEO depende de evitar a canibalização de palavras-chave, eliminar páginas órfãs e garantir que o Googlebot consiga rastrear centenas de milhares de URLs de forma eficiente (Crawl Budget).

### 4.1. Taxonomia de URLs & Permutações

As rotas no Astro (`src/pages/[...slug].astro`) devem ser estritamente semânticas e hierárquicas.

*   **Eletrônicos (Foco em EAN/Modelo Exato):**
    *   `/[categoria]/[marca]/[modelo]-[ean]`
    *   *Ex:* `/smartphones/samsung/galaxy-s24-ultra-7891234567890`
*   **Peças Automotivas (Foco em Compatibilidade e OEM):**
    *   `/[categoria-peca]/[montadora]/[modelo]/[ano]`
    *   *Ex:* `/pastilha-de-freio/honda/civic/2018`
    *   `/codigo-oem/[codigo-da-peca]`
    *   *Ex:* `/codigo-oem/04465-02220`

**Prevenção de Thin Content:**
Se uma permutação (ex: Pastilha de Freio para Ferrari 1980) não tiver ofertas ativas no JSON do banco, a página **não** deve retornar 404. Ela deve retornar 200, exibir as especificações técnicas da peça e sugerir "Peças Universais" ou "Modelos Similares", mantendo o valor da página para o SEO.

### 4.2. Estratégia de Schema JSON-LD Avançado

A injeção de dados estruturados no `<head>` é vital para capturar *Rich Snippets* (estrelas de avaliação e preços na SERP do Google). O Astro renderizará este JSON dinamicamente.

```json
// Exemplo de Schema para Página de Produto (Eletrônicos/Peças)
{
  "@context": "https://schema.org/",
  "@type": "Product",
  "name": "Pastilha de Freio Honda Civic 2018 (OEM: 04465-02220)",
  "image": "https://cdn.meusite.com/pecas/04465-02220.jpg",
  "mpn": "04465-02220",
  "brand": {
    "@type": "Brand",
    "name": "Honda"
  },
  "offers": {
    "@type": "AggregateOffer",
    "url": "https://meusite.com/codigo-oem/04465-02220",
    "priceCurrency": "BRL",
    "lowPrice": "120.50",
    "highPrice": "185.00",
    "offerCount": "3"
  },
  "isAccessoryOrSparePartFor": [
    {
      "@type": "Vehicle",
      "brand": "Honda",
      "model": "Civic",
      "vehicleModelDate": "2018"
    }
  ]
}
```

### 4.3. Arquitetura de Sitemaps Fragmentados & IndexNow

Para indexar 500.000+ URLs, um único `sitemap.xml` falhará.

1.  **Sitemap Index (`sitemap.xml`):** Aponta para os fragmentos.
2.  **Fragmentação Lógica:**
    *   `sitemap-eletronicos-smartphones-1.xml` (Máx 10k URLs)
    *   `sitemap-pecas-honda-1.xml` (Máx 10k URLs)
3.  **Protocolo IndexNow (Push vs Pull):**
    *   Em vez de esperar o Googlebot/Bingbot ler o sitemap, o ETL Python, ao inserir um novo lote de produtos no D1, dispara um `POST` para a API do **IndexNow** (suportado por Bing/Yandex) e para a **Google Search Console API**.
    *   *Payload:* `{"host": "meusite.com", "key": "xyz", "urlList": ["https://meusite.com/nova-peca"]}`
    *   *Resultado:* Indexação em minutos, não em semanas.

---

### CHECKPOINT DA FASE 2

A modelagem de dados, o pipeline de ingestão e a estrutura de SEO Programático estão definidos.