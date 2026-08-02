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
 * Mocks de Emergência para SSG (Prevenção de quebra de Build no CI e SEO Vazio)
 */
const MOCK_PRODUCTS: Product[] = [
  {
    id: 'mock-1',
    slug: 'pastilha-de-freio-honda-civic-2018',
    category: 'pastilha-freio',
    title: 'Pastilha de Freio Cerâmica - Honda Civic (2016-2021)',
    oem_code: '45022-TET-H01',
    lowest_price: 289.90,
    traffic_tier: 'A',
    updated_at: new Date().toISOString()
  },
  {
    id: 'mock-2',
    slug: 'pastilha-de-freio-toyota-corolla-2020',
    category: 'pastilha-freio',
    title: 'Pastilha de Freio Dianteira - Toyota Corolla (2015+)',
    oem_code: '04465-02390',
    lowest_price: 245.00,
    traffic_tier: 'A',
    updated_at: new Date().toISOString()
  },
  {
    id: 'mock-3',
    slug: 'filtro-de-oleo-toyota-corolla-2020',
    category: 'filtro-oleo',
    title: 'Filtro de Óleo Original - Toyota Corolla (2019+)',
    oem_code: '04152-YZZA6',
    lowest_price: 45.50,
    traffic_tier: 'A',
    updated_at: new Date().toISOString()
  }
];

/**
 * Busca produto no D1 pelo slug parametrizado
 */
export async function getProductBySlug(d1: any, slug: string): Promise<Product | null> {
  try {
    if (!d1) return null;
    const stmt = d1.prepare('SELECT * FROM products WHERE slug = ? LIMIT 1');
    return await stmt.bind(slug).first<Product>();
  } catch (err) {
    console.warn(`[D1] Erro ao buscar produto ${slug}:`, err);
    return null;
  }
}

/**
 * Busca compatibilidades automotivas de um produto
 */
export async function getProductCompatibilities(d1: any, productId: string): Promise<Compatibility[]> {
  try {
    if (!d1) return [];
    const stmt = d1.prepare('SELECT * FROM automotive_compatibility WHERE product_id = ?');
    const result = await stmt.bind(productId).all<Compatibility>();
    return result.results || [];
  } catch (err) {
    console.warn(`[D1] Erro ao buscar compatibilidade para ${productId}:`, err);
    return [];
  }
}

/**
 * Busca produtos similares/universais para prevenção de Thin Content (Prevenção 404)
 */
export async function getFallbackProducts(d1: any, category: string, limit = 4): Promise<Product[]> {
  try {
    if (!d1) return MOCK_PRODUCTS.filter(p => p.category === category).slice(0, limit);
    const stmt = d1.prepare('SELECT * FROM products WHERE category = ? ORDER BY lowest_price ASC LIMIT ?');
    const result = await stmt.bind(category, limit).all<Product>();
    
    // Se retornar vazio do D1 (durante build), usa os Mocks
    if (!result.results || result.results.length === 0) {
      return MOCK_PRODUCTS.filter(p => p.category === category).slice(0, limit);
    }
    
    return result.results || [];
  } catch (err) {
    console.warn(`[D1] Erro de Fallback (tabela ausente?):`, err);
    // Retorna mocks compatíveis com a categoria solicitada para não quebrar o SSG
    const categoryMocks = MOCK_PRODUCTS.filter(p => p.category === category);
    return categoryMocks.length > 0 ? categoryMocks.slice(0, limit) : MOCK_PRODUCTS.slice(0, limit);
  }
}
