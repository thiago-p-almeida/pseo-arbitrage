export const prerender = false; // SSR: precisa do domínio dinâmico

import type { APIRoute } from 'astro';

/**
 * Gera o robots.txt dinamicamente no Edge
 * Aponta para o sitemap index (Seção 4.3 dos docs)
 */
export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const siteUrl = url.origin;

  const robots = `User-agent: *
Allow: /
Sitemap: ${siteUrl}/sitemap.xml
`;

  return new Response(robots, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600'
    }
  });
};