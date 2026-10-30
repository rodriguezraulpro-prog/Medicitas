// Cloudflare Pages Worker (_worker.js)
// Enables automatic cross-device synchronization of Cloud database credentials (PCs, phones, tablets)
// on Cloudflare Pages (both Direct ZIP Upload and Git deployments).

let memoryConfig = null;

function getCacheKey(requestUrl) {
  const url = new URL(requestUrl);
  return new Request(`${url.origin}/__medicitas_edge_cloud_config_v4__`, {
    method: 'GET',
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1. API Endpoint: /api/config/supabase
    if (url.pathname === '/api/config/supabase' || url.pathname.endsWith('/api/config/supabase')) {
      const corsHeaders = {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      };

      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
      }

      const cache = typeof caches !== 'undefined' && caches.default ? caches.default : null;
      const cacheKey = getCacheKey(request.url);

      if (request.method === 'POST') {
        try {
          const body = await request.json();
          const supaUrl = typeof body?.url === 'string' ? body.url.trim() : '';
          const anonKey = typeof body?.anonKey === 'string' ? body.anonKey.trim() : '';

          if (!supaUrl || !anonKey) {
            return new Response(
              JSON.stringify({ success: false, message: 'URL y Anon Key son requeridos.' }),
              { status: 400, headers: corsHeaders }
            );
          }

          const payload = {
            url: supaUrl,
            anonKey,
            configured: true,
            updatedAt: new Date().toISOString(),
          };

          memoryConfig = payload;

          // Save to Cloudflare KV if bound
          if (env && env.MEDICITAS_KV && typeof env.MEDICITAS_KV.put === 'function') {
            try {
              await env.MEDICITAS_KV.put('cloud_config', JSON.stringify(payload));
            } catch {
              // ignore KV errors
            }
          }

          // Save to Cloudflare Edge Cache so other devices (phones/PCs) on the edge receive it
          if (cache) {
            try {
              const cachedResponse = new Response(JSON.stringify(payload), {
                status: 200,
                headers: {
                  'Content-Type': 'application/json; charset=utf-8',
                  'Cache-Control': 'public, max-age=31536000, s-maxage=31536000',
                },
              });
              if (ctx && typeof ctx.waitUntil === 'function') {
                ctx.waitUntil(cache.put(cacheKey, cachedResponse));
              } else {
                await cache.put(cacheKey, cachedResponse);
              }
            } catch {
              // ignore cache errors
            }
          }

          return new Response(
            JSON.stringify({
              success: true,
              message: 'Configuración guardada en el servidor Cloudflare. Ahora otros dispositivos se sincronizan con la misma base de datos.',
              configured: true,
            }),
            { status: 200, headers: corsHeaders }
          );
        } catch {
          return new Response(
            JSON.stringify({ success: false, message: 'Error al guardar configuración en Cloudflare.' }),
            { status: 500, headers: corsHeaders }
          );
        }
      }

      if (request.method === 'DELETE') {
        memoryConfig = { url: '', anonKey: '', configured: false };
        if (env && env.MEDICITAS_KV && typeof env.MEDICITAS_KV.delete === 'function') {
          try {
            await env.MEDICITAS_KV.delete('cloud_config');
          } catch {
            // ignore
          }
        }
        if (cache) {
          try {
            await cache.delete(cacheKey);
          } catch {
            // ignore
          }
        }
        return new Response(
          JSON.stringify({ success: true, message: 'Configuración de la Nube eliminada.' }),
          { status: 200, headers: corsHeaders }
        );
      }

      // GET /api/config/supabase
      // Priority 1: Cloudflare KV if bound
      if (env && env.MEDICITAS_KV && typeof env.MEDICITAS_KV.get === 'function') {
        try {
          const kvRaw = await env.MEDICITAS_KV.get('cloud_config');
          if (kvRaw) {
            const parsed = JSON.parse(kvRaw);
            if (parsed && parsed.url && parsed.anonKey) {
              return new Response(
                JSON.stringify({ url: parsed.url, anonKey: parsed.anonKey, configured: true, source: 'kv' }),
                { status: 200, headers: corsHeaders }
              );
            }
          }
        } catch {
          // ignore
        }
      }

      // Priority 2: Cloudflare Edge Cache
      if (cache) {
        try {
          const matched = await cache.match(cacheKey);
          if (matched) {
            const parsed = await matched.json();
            if (parsed && parsed.url && parsed.anonKey) {
              memoryConfig = parsed;
              return new Response(
                JSON.stringify({ url: parsed.url, anonKey: parsed.anonKey, configured: true, source: 'edge-cache' }),
                { status: 200, headers: corsHeaders }
              );
            }
          }
        } catch {
          // ignore
        }
      }

      // Priority 3: Worker in-memory state
      if (memoryConfig && memoryConfig.url && memoryConfig.anonKey) {
        return new Response(
          JSON.stringify({ url: memoryConfig.url, anonKey: memoryConfig.anonKey, configured: true, source: 'memory' }),
          { status: 200, headers: corsHeaders }
        );
      }

      // Priority 4: Cloudflare Pages Environment Variables
      const envUrl = (env && (env.VITE_SUPABASE_URL || env.SUPABASE_URL)) || '';
      const envKey = (env && (env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY)) || '';
      if (envUrl && envKey && !String(envUrl).includes('your-project-id')) {
        return new Response(
          JSON.stringify({
            url: String(envUrl).trim(),
            anonKey: String(envKey).trim(),
            configured: true,
            source: 'env',
          }),
          { status: 200, headers: corsHeaders }
        );
      }

      // Priority 5: Static /cloud-config.json file if bundled
      if (env && env.ASSETS) {
        try {
          const assetRes = await env.ASSETS.fetch(new Request(`${url.origin}/cloud-config.json`));
          if (assetRes.ok) {
            const parsed = await assetRes.json();
            if (parsed && parsed.url && parsed.anonKey) {
              return new Response(
                JSON.stringify({
                  url: String(parsed.url).trim(),
                  anonKey: String(parsed.anonKey).trim(),
                  configured: true,
                  source: 'file',
                }),
                { status: 200, headers: corsHeaders }
              );
            }
          }
        } catch {
          // ignore
        }
      }

      return new Response(
        JSON.stringify({ url: '', anonKey: '', configured: false }),
        { status: 200, headers: corsHeaders }
      );
    }

    // 2. Serve all static assets and SPA routes via Cloudflare Pages ASSETS binding
    if (env && env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return fetch(request);
  },
};
