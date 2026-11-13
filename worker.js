const ALLOWED_ORIGIN = 'https://SEU_WORKER.exemplo.workers.dev';

export default {
  async fetch(request, env) {
    const addCORS = (headers) => {
      headers.set('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
      headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
      headers.set('Access-Control-Allow-Headers', 'Content-Type');
      return headers;
    };

    const jsonError = (message, status, code) => {
      return new Response(JSON.stringify({ error: message, code }), {
        status,
        headers: addCORS(new Headers({ 'Content-Type': 'application/json' })),
      });
    };

    const jsonSuccess = (data) => {
      return new Response(JSON.stringify(data), {
        headers: addCORS(new Headers({ 'Content-Type': 'application/json' })),
      });
    };

    const parseBody = async (request, maxSize = 10 * 1024) => {
      const bodyBuffer = await request.arrayBuffer();
      if (bodyBuffer.byteLength > maxSize) {
        throw { status: 413, message: 'Dados muito grandes', code: 'PAYLOAD_TOO_LARGE' };
      }
      try {
        return JSON.parse(new TextDecoder().decode(bodyBuffer));
      } catch {
        throw { status: 400, message: 'JSON inválido', code: 'INVALID_JSON' };
      }
    };

    try {
      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: addCORS(new Headers()) });
      }

      const url = new URL(request.url);
      const path = url.pathname;

      if (request.method === 'POST' && path === '/gemini') {
        if (!env.RATE_LIMITER) {
          return jsonError('Rate limiter não configurado', 503, 'RATE_LIMITER_MISSING');
        }
        const { success } = await env.RATE_LIMITER.limit({ key: request.headers.get('cf-connecting-ip') || 'anon' });
        if (!success) {
          return jsonError('Muitas requisições. Tente novamente em instantes.', 429, 'RATE_LIMITED');
        }
      }

      if (path === '/gemini' && request.method === 'POST') {
        const body = await parseBody(request);

        if (!body || typeof body !== 'object' || Array.isArray(body)) {
          return jsonError('JSON inválido', 400, 'INVALID_JSON');
        }

        if (!body.prompt || typeof body.prompt !== 'string' || body.prompt.length > 3000) {
          return jsonError('Prompt inválido', 400, 'INVALID_PROMPT');
        }

        const apiKey = env.GEMINI_API_KEY;
        if (!apiKey) {
          return jsonError('Configuração interna indisponível', 500, 'MISSING_SECRET');
        }

        const model = 'gemini-3.5-flash-lite';
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

        console.log('Gemini request', {
          model,
          timestamp: new Date().toISOString(),
          ip: request.headers.get('cf-connecting-ip'),
        });

        let res;
        try {
          res = await fetch(geminiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': apiKey,
            },
            body: JSON.stringify({
              contents: [{ parts: [{ text: body.prompt }] }],
              generationConfig: { temperature: 0.2, maxOutputTokens: 800 },
            }),
          });
        } catch (fetchError) {
          console.log('Gemini network error', { error: fetchError.message });
          return jsonError('Falha de conexão com a IA', 502, 'NETWORK_ERROR');
        }

        console.log('Gemini response', {
          status: res.status,
          model,
          ok: res.ok,
        });

        if (!res.ok) {
          const status = res.status;
          let message, code;

          switch (status) {
            case 400: message = 'Requisição inválida. Tente novamente.'; code = 'INVALID_REQUEST'; break;
            case 401:
            case 403: message = 'Acesso negado à IA. Verifique a configuração.'; code = 'AUTH_FAILED'; break;
            case 404: message = 'Modelo de IA indisponível no momento.'; code = 'MODEL_NOT_FOUND'; break;
            case 429: message = 'Cota da IA esgotada. Tente novamente mais tarde.'; code = 'QUOTA_EXCEEDED'; break;
            default: message = 'IA temporariamente indisponível. Tente mais tarde.'; code = 'API_ERROR';
          }

          return jsonError(message, status, code);
        }

        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) {
          console.log('Gemini invalid response structure', { hasCandidates: !!data.candidates });
          return jsonError('Resposta inválida da IA', 502, 'INVALID_RESPONSE');
        }

        return jsonSuccess({ text });
      }

      return jsonError('Rota não encontrada', 404, 'NOT_FOUND');
    } catch (e) {
      if (e.status) {
        return jsonError(e.message, e.status, e.code);
      }
      console.log('Internal worker error', { error: e.message });
      return jsonError('Erro interno', 500, 'INTERNAL_ERROR');
    }
  },
};
