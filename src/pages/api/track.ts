export const prerender = false; // Executa como Serverless Worker no Edge

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

/**
 * Função de Hashing SHA-256 nativa do Edge via Web Crypto API (Regra Seção 5.2)
 */
async function sha256(message: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(message.trim().toLowerCase());
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Envia evento para a Meta Conversions API (CAPI)
 */
async function sendToMetaCAPI(payload: any, env: any) {
  const pixelId = env.META_PIXEL_ID;
  const accessToken = env.META_CAPI_TOKEN;

  if (!pixelId || !accessToken) {
    console.warn('Meta CAPI: Tokens de ambiente não configurados.');
    return;
  }

  const clientIp = payload.ip;
  const userAgent = payload.userAgent;

  // Hashes obrigatórios para conformidade LGPD / Meta CAPI
  const hashedIp = clientIp ? await sha256(clientIp) : undefined;
  const hashedUserAgent = userAgent ? await sha256(userAgent) : undefined;

  const capiPayload = {
    data: [
      {
        event_name: payload.eventName || 'PageView',
        event_time: Math.floor(Date.now() / 1000),
        event_id: payload.eventId || crypto.randomUUID(),
        event_source_url: payload.url,
        action_source: 'website',
        user_data: {
          client_ip_address: hashedIp, // LGPD: IP hasheado SHA-256 no Edge
          client_user_agent: userAgent,
          fbc: payload.fbc,
          fbp: payload.fbp
        },
        custom_data: {
          sub_id: payload.subId,
          content_name: payload.contentName,
          value: payload.value,
          currency: 'BRL'
        }
      }
    ]
  };

  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${accessToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(capiPayload)
    });
    if (!res.ok) {
      console.error('Meta CAPI Error:', await res.text());
    }
  } catch (err) {
    console.error('Falha ao disparar Meta CAPI:', err);
  }
}

/**
 * Envia Ping para Google Ads / Analytics Server-Side
 */
async function sendToGoogleAds(payload: any, env: any) {
  const gadsId = env.GOOGLE_ADS_ID;
  if (!gadsId) return;

  // Respeita Consent Mode v2: Envia apenas pings anônimos se negado
  const isConsentGranted = payload.consent === 'granted';

  const body = new URLSearchParams({
    v: '2',
    tid: gadsId,
    cid: isConsentGranted ? payload.clientId || 'anonymous' : 'anonymous',
    en: payload.eventName || 'page_view',
    'ep.sub_id': payload.subId || ''
  });

  try {
    await fetch('https://www.google-analytics.com/g/collect', {
      method: 'POST',
      body: body.toString()
    });
  } catch (err) {
    console.error('Falha ao disparar Google Ads SS:', err);
  }
}

/**
 * POST Endpoint Handlers
 */
export const POST: APIRoute = async ({ request, locals }) => {
  const clientIp = request.headers.get('cf-connecting-ip') || '127.0.0.1';
  const userAgent = request.headers.get('user-agent') || '';

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const payload = {
    ...body,
    ip: clientIp,
    userAgent: userAgent,
    url: request.url
  };

  // Extrai o contexto do Worker (nova API Astro v6+ / @astrojs/cloudflare v14)
  const ctx = locals.cfContext;

  // DISPARO 100% ASSÍNCRONO VIA ctx.waitUntil (Regra Crítica Seção 5.2)
  // O Worker NÃO aguarda a resposta das APIs externas para responder ao cliente.
  const trackingPromises = Promise.all([
    sendToMetaCAPI(payload, env),
    sendToGoogleAds(payload, env)
  ]);

  if (ctx && typeof ctx.waitUntil === 'function') {
    ctx.waitUntil(trackingPromises);
  } else {
    // Fallback para ambiente local de desenvolvimento
    trackingPromises.catch(err => console.error('Tracking Error (Dev):', err));
  }

  // Retorna resposta instantânea em < 10ms (TTFB zerado)
  return new Response(JSON.stringify({ success: true, queued: true }), {
    status: 202,
    headers: { 'Content-Type': 'application/json' }
  });
};