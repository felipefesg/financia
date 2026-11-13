# Como ativar o consultor de IA no FinancIA

O FinancIA funciona localmente sem conta. O único recurso que usa a nuvem é o consultor de IA opcional, que envia um resumo financeiro sem dados pessoais para um Cloudflare Worker.

## 1. Pré-requisitos

- Conta Cloudflare com Workers habilitado.
- `wrangler` autenticado na máquina.
- Uma chave da API de IA (Google Gemini).

## 2. Configurar o Worker

1. Copie `wrangler.example.toml` para `wrangler.toml`.
2. Configure o binding de rate-limit `RATE_LIMITER` no painel da Cloudflare ou no `wrangler.toml`.
3. Cadastre o segredo da IA:

```bash
wrangler secret put GEMINI_API_KEY
```

4. Publique o worker:

```bash
wrangler deploy
```

O worker expõe apenas `POST /gemini`. Se `RATE_LIMITER` não estiver configurado, a rota responde `503` e não chama a IA.

## 3. Ativar no App

No `worker.js`, ajuste `ALLOWED_ORIGIN` para o domínio onde o app é servido (ou `null` para `file://`).

1. Abra o FinancIA no navegador.
2. Vá até a tela do consultor de IA.
3. Gere o diagnóstico financeiro.

O `index.html` vem com `IA_API` vazio. Defina a URL do seu worker nessa constante. Exemplo: `https://SEU_WORKER.exemplo.workers.dev`.

## 4. Modo demonstração

Na tela **Configurações**, o card **Modo demonstração** permite:

- **Ativar dados de exemplo:** guarda os dados reais no `localStorage` e mostra um conjunto fictício.
- **Desativar e restaurar meus dados:** volta ao backup salvo.

O service worker cuida apenas do cache offline.