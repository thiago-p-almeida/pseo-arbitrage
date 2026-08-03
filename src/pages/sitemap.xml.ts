export const prerender = false; // SSR: consulta D1 com Cache SWR

import type { APIRoute } from 'astro';
import { withEdgeCache } from '../lib/cache';
import { env } from 'cloudflare:workers';

const PAGE_SIZE = 10000; // Máx de URLs por fragmento (Seção 4.3 dos docs)

/**
 * Gera o sitemap.xml dinâmico no Edge
 * Sitemap Index apontando para fragmentos por categoria (máx 10k URLs cada)
 * Proteção do D1: Cache SWR obrigatório (Regra Inquebrável)
 */
export const GET: APIRoute = async ({ request, locals }) => {
  const db = env.DB;
  const ctx = locals.cfContext;
  const url = new URL(request.url);
  const siteUrl = url.origin;

  const category = url.searchParams.get('category');

  // Se for um fragmento (com ?category=), gera as URLs dos produtos
  if (category) {
    // Requisição Fantasma para o Cache SWR (não colide com cache de HTML)
    const cacheUrl = new URL(`/_d1_cache/sitemap/${category}`, request.url);
    const dataRequest = new Request(cacheUrl.toString(), { headers: request.headers });

    const fetchProductsFromD1 = async () => {
      if (!db) {
        return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      // Query 100% parametrizada com LIMIT para o fragmento
      const stmt = db.prepare(
        'SELECT slug, updated_at FROM products WHERE category = ? ORDER BY updated_at DESC LIMIT ?'
      ).bind(category, PAGE_SIZE);
      const result = await stmt.all();

      return new Response(JSON.stringify(result.results || []), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    };

    const cachedRes = await withEdgeCache(dataRequest, fetchProductsFromD1, ctx);

    let products: any[] = [];
    if (cachedRes.status === 200) {
      products = await cachedRes.json();
    }

    // Gera os XML <url> entries
    const urls = products.map((p: any) => {
      const lastmod = p.updated_at ? new Date(p.updated_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
      return `  <url>\n    <loc>${siteUrl}/${p.slug}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`;
    }).join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

    return new Response(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=14400'
      }
    });
  }

  // Caso contrário, gera o Sitemap Index dinâmico com todas as categorias do D1
  // Proteção: Cache SWR para evitar consulta direta ao D1 em cada request
  const cacheUrl2 = new URL('/_d1_cache/sitemap_categories', request.url);
  const catRequest = new Request(cacheUrl2.toString(), { headers: request.headers });

  const fetchCategoriesFromD1 = async () => {
    if (!db) {
      // Fallback mínimo para dev local
      return new Response(JSON.stringify(['pastilha-freio', 'filtro-oleo', 'eletronicos']), {
        status: 200, headers: { 'Content-Type': 'application/json' }
      });
    }
    const stmt = db.prepare('SELECT DISTINCT category FROM products LIMIT 100');
    const result = await stmt.all();
    const categories = (result.results || []).map((r: any) => r.category);
    return new Response(JSON.stringify(categories), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });
  };

  const catCached = await withEdgeCache(catRequest, fetchCategoriesFromD1, ctx);
  const categories: string[] = catCached.status === 200 ? await catCached.json() : [];

  const sitemaps = categories.map(cat =>
    `  <sitemap>\n    <loc>${siteUrl}/sitemap.xml?category=${encodeURIComponent(cat)}</loc>\n  </sitemap>`
  ).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${siteUrl}/sitemap.xml?category=all</loc>
  </sitemap>
${sitemaps}
</sitemapindex>`;

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=14400'
    }
  });
};