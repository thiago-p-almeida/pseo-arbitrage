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

-- ÍNDICE FTS5 (Full-Text Search) para busca em milissegundos
CREATE VIRTUAL TABLE IF NOT EXISTS products_fts USING fts5(
    title, 
    oem_code, 
    ean_upc, 
    content='products', 
    content_rowid='id'
);

-- TRIGGERS DE SINCRONIZAÇÃO FTS5 (OBRIGATÓRIO)
CREATE TRIGGER IF NOT EXISTS products_ai AFTER INSERT ON products BEGIN
  INSERT INTO products_fts(rowid, title, oem_code, ean_upc) 
  VALUES (new.id, new.title, new.oem_code, new.ean_upc);
END;

CREATE TRIGGER IF NOT EXISTS products_ad AFTER DELETE ON products BEGIN
  INSERT INTO products_fts(products_fts, rowid, title, oem_code, ean_upc) 
  VALUES('delete', old.id, old.title, old.oem_code, old.ean_upc);
END;

CREATE TRIGGER IF NOT EXISTS products_au AFTER UPDATE ON products BEGIN
  INSERT INTO products_fts(products_fts, rowid, title, oem_code, ean_upc) 
  VALUES('delete', old.id, old.title, old.oem_code, old.ean_upc);
  INSERT INTO products_fts(rowid, title, oem_code, ean_upc) 
  VALUES (new.id, new.title, new.oem_code, new.ean_upc);
END;