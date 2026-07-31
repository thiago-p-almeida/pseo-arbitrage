/**
 * Módulo de Cache SWR (Stale-While-Revalidate) usando a Cloudflare Cache API
 * Garante a ADR-002 (Cache First, DB Second) para proteger a cota do D1.
 */

// TTL do Cache em Segundos (4 Horas)
const CACHE_TTL_SECONDS = 14400; 

export interface CacheOptions {
  ttl?: number;
  staleWhileRevalidate?: number;
}

/**
 * Executa uma busca com estratégia Stale-While-Revalidate na Cache API da Cloudflare
 *
 * @param request Objeto Request da página ou API
 * @param fetcherFn Função fallback que consulta o D1 caso não haja cache
 * @param executionContext Contexto do Worker (contendo ctx.waitUntil)
 * @param options Configurações customizadas de TTL
 */
export async function withEdgeCache(
  request: Request,
  fetcherFn: () => Promise<Response>,
  executionContext?: { waitUntil: (promise: Promise<any>) => void },
  options: CacheOptions = {}
): Promise<Response> {
  const ttl = options.ttl ?? CACHE_TTL_SECONDS;
  const swr = options.staleWhileRevalidate ?? 86400; // 24 Horas de SWR

  // 1. Tenta acessar a Cache API nativa do Cloudflare Edge
  // Em ambiente local de dev sem worker proxy, caches.default pode ser undefined
  let cache: Cache | null = null;
  try {
    if (typeof caches !== 'undefined' && caches.default) {
      cache = caches.default;
    }
  } catch (err) {
    console.warn('Cache API não disponível no ambiente atual, usando fallback.');
  }

  // Normaliza a URL para ignorar querystrings irrelevantes no cache key
  const cacheUrl = new URL(request.url);
  // Mantém apenas parâmetros essenciais se necessário (limpa fbclid/gclid do cache key)
  cacheUrl.searchParams.delete('fbclid');
  cacheUrl.searchParams.delete('gclid');
  cacheUrl.searchParams.delete('utm_source');
  cacheUrl.searchParams.delete('utm_medium');
  cacheUrl.searchParams.delete('utm_campaign');

  const cacheKey = new Request(cacheUrl.toString(), {
    method: 'GET',
    headers: request.headers
  });

  // 2. Se a Cache API estiver disponível, verifica HIT
  if (cache) {
    const cachedResponse = await cache.match(cacheKey);

    if (cachedResponse) {
      // Injeta cabeçalho indicando HIT para facilitar a depuração no DevTools
      const responseHeaders = new Headers(cachedResponse.headers);
      responseHeaders.set('X-Edge-Cache-Status', 'HIT');

      return new Response(cachedResponse.body, {
        status: cachedResponse.status,
        statusText: cachedResponse.statusText,
        headers: responseHeaders
      });
    }
  }

  // 3. CACHE MISS: Executa a busca no D1 / SSR
  const freshResponse = await fetcherFn();

  // Apenas respostas com status 200 devem ser salvas no cache
  if (freshResponse.status === 200) {
    const responseToCache = freshResponse.clone();
    const cacheHeaders = new Headers(responseToCache.headers);

    // Injeta cabeçalhos padrão do protocolo HTTP Stale-While-Revalidate
    cacheHeaders.set(
      'Cache-Control',
      `public, max-age=${ttl}, s-maxage=${ttl}, stale-while-revalidate=${swr}`
    );
    cacheHeaders.set('X-Edge-Cache-Status', 'MISS');

    const finalCachedResponse = new Response(responseToCache.body, {
      status: responseToCache.status,
      statusText: responseToCache.statusText,
      headers: cacheHeaders
    });

    // 4. Salva a resposta no Edge Cache de forma assíncrona (não bloqueia a resposta do usuário)
    if (cache) {
      const putPromise = cache.put(cacheKey, finalCachedResponse.clone());
      if (executionContext && typeof executionContext.waitUntil === 'function') {
        executionContext.waitUntil(putPromise);
      } else {
        await putPromise;
      }
    }

    return finalCachedResponse;
  }

  // Se a resposta for erro (404, 500, etc), retorna sem salvar em cache
  return freshResponse;
}