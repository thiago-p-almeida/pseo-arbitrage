# Fase 3: AdTech Server-Side e Blueprint para Agentes de IA

---

## SEÇÃO 5: Pilha AdTech & Tracking Server-Side

Para contornar AdBlockers, restrições do iOS (ITP) e garantir a precisão do funil de arbitragem, todo o rastreamento de conversões e eventos de página será feito no servidor (Server-Side). Não utilizaremos contêineres pagos do Google Cloud; o próprio **Cloudflare Worker** atuará como o proxy de tracking.

### 5.1. Tracking First-Party (Proxy GTM SS)
1.  **Coleta no Cliente (Browser):** Um script leve (First-Party) no front-end captura eventos (`PageView`, `ViewContent`, `ClickOut_Affiliate`) e envia um payload JSON simples para um endpoint no próprio domínio: `https://meusite.com/api/track`.
2.  **Processamento no Edge:** O Cloudflare Worker recebe o payload, enriquece com o IP do usuário, User-Agent e o `sub_id` (gerado na Seção 1), e formata os dados para os padrões exigidos pelas APIs de destino.

### 5.2. Implementação Assíncrona (CRÍTICO: `ctx.waitUntil`)
Para garantir que o TTFB (Time to First Byte) permaneça abaixo de 50ms e os Core Web Vitals fiquem zerados, o Worker **nunca** deve aguardar a resposta do Meta ou do Google para devolver a página ao usuário.

**Hashing Obrigatório no Edge (Meta CAPI):**
O Meta exige que dados de usuários (e-mail, telefone, IP) sejam cacheados em SHA-256 antes do envio. Como o ambiente Edge proíbe a biblioteca `crypto` nativa do Node.js, é **obrigatório** utilizar a Web Crypto API para qualquer rotina de hashing:
`const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));`

**Padrão Arquitetural Obrigatório no Worker:**
```javascript
export default {
  async fetch(request, env, ctx) {
    // 1. Processa a requisição do usuário (Cache ou SSR)
    const response = await handleUserRequest(request, env);
    
    // 2. Extrai dados para tracking (ex: URL, Referrer, Cookies)
    const eventData = extractTrackingData(request);

    // 3. DISPARO ASSÍNCRONO: O Worker continua rodando em background
    // após a resposta ser enviada ao usuário.
    ctx.waitUntil(
      Promise.all([
        sendToMetaCAPI(eventData, env.META_TOKEN),
        sendToGoogleAdsAPI(eventData, env.GADS_TOKEN)
      ]).catch(err => console.error("Tracking Error:", err))
    );

    // 4. Retorna a resposta instantaneamente (< 50ms)
    return response;
  }
}
```

### 5.3. Compliance & Performance (Consent Mode v2)
*   **Implementação Nativa:** O estado padrão do Consent Mode (`ad_storage='denied'`, `analytics_storage='denied'`) é injetado diretamente no HTML via Astro, antes de qualquer outro script.
*   **Cookieless Pings:** Se o usuário negar o consentimento, o Worker respeita a decisão. Ele remove identificadores pessoais (IP, User-Agent detalhado, Cookies) do payload e envia apenas "pings anônimos" para o Google Ads SS, permitindo a modelagem de conversões sem violar a LGPD/GDPR.

---

## SEÇÃO 6: Blueprint para Desenvolvimento via Agentes de I.A. (VS Code + Cline)

Os artefatos abaixo devem ser fornecidos ao agente de IA (Cline/Cursor) para garantir que ele construa a aplicação respeitando as restrições da Stack Zero-Cost.

### 6.1. `CLINERULES.md` (System Instructions para a IA)
*(Crie um arquivo chamado `.clinerules` na raiz do projeto e cole o texto abaixo)*

```markdown
# DIRETRIZES ARQUITETURAIS ESTritas (NÃO VIOLE)

Você está construindo uma plataforma pSEO + Arbitragem usando Astro v4 e Cloudflare (Pages, Workers, D1). A infraestrutura deve operar com CUSTO ZERO.

1. **Restrição de Ambiente (Edge):** NUNCA utilize bibliotecas Node.js nativas (como `fs`, `path`, `crypto` nativo) no código de runtime. O target de build é o Cloudflare Edge. Use APIs Web Standard.
2. **Proteção do Banco de Dados (D1):** O tier gratuito do D1 permite apenas 5M leituras/dia. É ESTRITAMENTE PROIBIDO fazer consultas diretas ao D1 em rotas GET sem envolver a chamada na **Cloudflare Cache API** (Stale-While-Revalidate).
3. **Segurança SQL:** Todas as consultas ao D1 devem ser parametrizadas (`stmt.bind()`) para evitar SQL Injection.
4. **Tracking Assíncrono:** Qualquer disparo de evento para APIs externas (Meta CAPI, Google Ads) dentro de um Worker ou Pages Function DEVE obrigatoriamente ser encapsulado em `ctx.waitUntil()`. A resposta HTTP não pode ser bloqueada.
5. **Estilização:** Utilize TailwindCSS puro. Não instale bibliotecas de componentes pesadas (MUI, Chakra) que prejudiquem o LCP.
6. **Roteamento Híbrido:** Configure o Astro para `output: 'hybrid'`. Páginas institucionais são pré-renderizadas (SSG). Páginas de produto (`[...slug].astro`) são renderizadas no servidor (SSR).
```

### 6.2. Estrutura de Arquivos e Pastas (Tree)
O agente deve inicializar o projeto com a seguinte estrutura modular:

```text
/
├── .github/
│   └── workflows/
│       ├── etl-curve-a.yml      # Scraping 4h (Curva A)
│       └── etl-curve-bc.yml     # Scraping Semanal (Curva B/C)
├── db/
│   ├── schema.sql               # DDL do Cloudflare D1 (Seção 3.1)
│   └── migrations/
├── src/
│   ├── components/              # UI Components (Tailwind)
│   │   ├── AdUnit.astro         # Bloco de anúncio (Lazy Load)
│   │   └── PriceTable.astro     # Tabela de ofertas
│   ├── layouts/
│   │   └── Layout.astro         # Base HTML, injeção de JSON-LD e Consent Mode
│   ├── pages/
│   │   ├── index.astro          # SSG (Home)
│   │   ├── eletronicos/[...slug].astro # SSR (Produtos)
│   │   ├── pecas/[...slug].astro       # SSR (Peças)
│   │   └── api/
│   │       └── track.ts         # Endpoint do Worker para CAPI (Proxy GTM)
│   └── lib/
│       ├── d1.ts                # Wrapper do D1 Client
│       ├── cache.ts             # Lógica da Cache API (SWR)
│       └── subid.ts             # Lógica de criptografia AES-GCM (Stateless Sub-ID)
├── astro.config.mjs             # Configurado com @astrojs/cloudflare
├── tailwind.config.mjs
└── wrangler.toml                # Configuração de bindings (D1, KV, Pages)
```

### 6.3. Registros de Decisão Arquitetural (ADRs)
O agente de IA deve ser instruído a ler e respeitar estas 5 decisões imutáveis antes de escrever qualquer código:

1.  **ADR-001: Renderização Híbrida (Astro).** O sistema não é um SPA (Single Page Application). É um site multi-page focado em SEO. O JavaScript no cliente deve ser mínimo.
2.  **ADR-002: Cache First, DB Second.** Nenhuma rota SSR pode consultar o D1 sem antes verificar a Cache API. O TTL padrão do cache de produtos é de 4 horas.
3.  **ADR-003: Zero Client-Side Tracking.** Pixels do Meta e Google não rodam no navegador. Tudo flui via `/api/track` para o Worker (CAPI).
4.  **ADR-004: Desnormalização de Dados.** O D1 não fará JOINs complexos em runtime. O ETL no GitHub Actions é responsável por pré-calcular e salvar o JSON de ofertas na coluna `offers_json` da tabela `products`.
5.  **ADR-005: Stateless Sub-ID Tracking (Arbitragem).** O rastreamento de cliques não utiliza banco de dados na entrada. Todo link de saída (outbound) para afiliados recebe um `sub_id` que é o Click ID original (`fbclid`/`gclid`) criptografado via AES-GCM (Web Crypto API). Isso garante rastreabilidade com zero custo de escrita no D1.

---

### CONCLUSÃO 

A documentação completa foi gerada com sucesso. Um **Blueprint Arquitetural de Nível Staff Engineer**, perfeitamente otimizado para a Stack Zero-Cost e pronto para ser entregue ao seu agente de IA (Cline/Cursor).