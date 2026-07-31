/**
 * Helper do Cliente Cloudflare D1 com Queries Parametrizadas
 * Previne SQL Injection (stmt.bind()) e abstrai chamadas ao banco.
 */

export interface Product {
  id: string;
  slug: string;
  category: string;
  title: string;
  ean_upc?: string;
  oem_code?: string;
  specs_json?: string;
  lowest_price?: number;
  offers_json?: string;
  traffic_tier: 'A' | 'B' | 'C';
  updated_at: string;
}

export interface Compatibility {
  id: string;
  product_id: string;
  make: string;
  model: string;
  year_start?: number;
  year_end?: number;
  engine?: string;
}

/**
 * Busca produto no D1 pelo slug parametrizado
 */
export async function getProductBySlug(d1: D1Database, slug: string): Promise<Product | null> {
  if (!d1) return null;
  const stmt = d1.prepare('SELECT * FROM products WHERE slug = ? LIMIT 1');
  return await stmt.bind(slug).first<Product>();
}

/**
 * Busca compatibilidades automotivas de um produto
 */
export async function getProductCompatibilities(d1: D1Database, productId: string): Promise<Compatibility[]> {
  if (!d1) return [];
  const stmt = d1.prepare('SELECT * FROM automotive_compatibility WHERE product_id = ?');
  const result = await stmt.bind(productId).all<Compatibility>();
  return result.results || [];
}

/**
 * Busca produtos similares/universais para prevenção de Thin Content (Prevenção 404)
 */
export async function getFallbackProducts(d1: D1Database, category: string, limit = 4): Promise<Product[]> {
  if (!d1) return [];
  const stmt = d1.prepare('SELECT * FROM products WHERE category = ? ORDER BY lowest_price ASC LIMIT ?');
  const result = await stmt.bind(category, limit).all<Product>();
  return result.results || [];
}