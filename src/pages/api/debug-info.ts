export const prerender = false; // SSR only

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

/**
 * Endpoint de Diagnóstico (somente para Go-Live Readiness)
 * Retorna status das variáveis de ambiente e conexões sem expor secrets.
 * DELETE ou desabilite em produção após a validação inicial.
 */
export const GET: APIRoute = async ({ request }) => {
  // Verifica se DEBUG_MODE está habilitado
  if (env.DEBUG_MODE !== 'true') {
    return new Response(JSON.stringify({ error: 'Debug mode desativado.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const checks = {
    site_url: env.SITE_URL || 'NOT SET',
    adsense_client_id: env.ADSENSE_CLIENT_ID ? 'SET' : 'NOT SET',
    adsense_slot_top: env.ADSENSE_SLOT_TOP ? 'SET' : 'NOT SET',
    adsense_slot_bottom: env.ADSENSE_SLOT_BOTTOM ? 'SET' : 'NOT SET',
    google_ads_id: env.GOOGLE_ADS_ID ? 'SET' : 'NOT SET',
    meta_pixel_id: env.META_PIXEL_ID ? 'SET' : 'NOT SET',
    meta_capi_token: env.META_CAPI_TOKEN ? 'SET' : 'NOT SET',
    amazon_access_key: env.AMAZON_ACCESS_KEY ? 'SET' : 'NOT SET',
    amazon_partner_tag: env.AMAZON_PARTNER_TAG || 'NOT SET',
    indexnow_key: env.INDEXNOW_KEY ? 'SET' : 'NOT SET',
    d1_connected: env.DB ? 'YES' : 'NO',
    secret_key: env.SECRET_KEY ? 'SET' : 'NOT SET (CRITICAL for SubID)',
    debug_mode: env.DEBUG_MODE || 'false',
  };

  return new Response(JSON.stringify(checks, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache'
    }
  });
};