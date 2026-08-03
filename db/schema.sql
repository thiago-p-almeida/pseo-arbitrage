-- Tabela 1: Catálogo Unificado (Eletrônicos e Peças)
-- Otimizada para leitura direta na rota SSR do Astro
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    ean_upc TEXT,
    oem_code TEXT,
    specs_json TEXT,
    lowest_price REAL,
    offers_json TEXT,
    traffic_tier TEXT DEFAULT 'C',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabela 2: Matriz de Compatibilidade Automotiva (N:N Desnormalizada)
CREATE TABLE IF NOT EXISTS automotive_compatibility (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    make TEXT NOT NULL,
    model TEXT NOT NULL,
    year_start INTEGER,
    year_end INTEGER,
    engine TEXT,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- ÍNDICES DE ALTA PERFORMANCE (CRÍTICOS)
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_auto_make_model ON automotive_compatibility(make, model);

-- FTS5: Desabilitado temporariamente pois content=products exige id INTEGER, mas usamos TEXT (UUIDs)
-- Para ativar no futuro, substitua content_rowid por triggers que usam o rowid implícito do SQLite
-- Exemplo: INSERT INTO products_fts(rowid, title, ...) VALUES ((SELECT rowid FROM products WHERE id = new.id), ...)
