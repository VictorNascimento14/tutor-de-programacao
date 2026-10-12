# Tutor de Programacao

Assistente tecnico de **code review**, **resolucao de bugs** e **tutoria de conceitos**,
com tres prototipos de chatbot. Front-end e back-end completos, **sem banco de dados** e
**sem nenhuma dependencia npm**: o servidor usa apenas modulos nativos do Node e o
front-end sao modulos ES nativos, sem etapa de build.

```bash
git clone https://github.com/VictorNascimento14/tutor-de-programacao.git
cd tutor-de-programacao
npm start
```

Abra <http://localhost:3000>.

---

## Instalacao

### 1. Requisitos

| Requisito | Versao | Observacao |
| --- | --- | --- |
| [Node.js](https://nodejs.org) | **>= 18.0.0** | Testado em Node 24. Precisa de `fetch` nativo |
| npm | qualquer | Usado apenas para rodar os scripts, nao para instalar pacotes |
| Git | qualquer | Apenas para clonar |

Confira o que voce tem:

```bash
node --version
```

Se aparecer `v18` ou maior, esta pronto. **Nao existe `npm install`** neste projeto:
o `package.json` nao declara nenhuma dependencia, portanto nao ha `node_modules`.

### 2. Clonar o projeto

```bash
git clone https://github.com/VictorNascimento14/tutor-de-programacao.git
cd tutor-de-programacao
```

### 3. Subir o servidor

```bash
npm start
```

Abra <http://localhost:3000> no navegador. A interface ja funciona por completo
neste ponto — o motor local faz toda a analise de codigo, o diagnostico de erros e
as respostas do tutor sem precisar de chave de API nenhuma.

Para desenvolvimento, use o modo que reinicia sozinho a cada alteracao:

```bash
npm run dev
```

### 4. Configurar variaveis de ambiente (opcional)

Todas as variaveis sao opcionais. O sistema funciona 100% sem nenhuma delas.

```bash
cp .env.example .env
```

No Windows (PowerShell):

```powershell
Copy-Item .env.example .env
```

Depois edite o `.env`. As variaveis estao descritas em
[Configuracao](#configuracao) e em [IA opcional](#ia-opcional).
O arquivo `.env` esta no `.gitignore` — **nunca comite suas chaves**.

### 5. Verificar a instalacao

Com o servidor rodando em outro terminal:

```bash
npm run smoke
```

O smoke test exercita as rotas principais da API e falha com codigo de saida
diferente de zero se alguma quebrar. Checagem rapida alternativa:

```bash
curl http://localhost:3000/api/health
```

### Trocar a porta ou expor na rede local

```bash
PORT=8080 npm start
```

No Windows (PowerShell):

```powershell
$env:PORT = "8080"; npm start
```

Para acessar de outro aparelho na mesma rede, faca o bind em todas as interfaces:

```bash
HOST=0.0.0.0 PORT=3000 npm start
```

### Scripts disponiveis

| Comando | O que faz |
| --- | --- |
| `npm start` | Sobe o servidor HTTP |
| `npm run dev` | Igual, com `--watch` (reinicia ao salvar um arquivo) |
| `npm run smoke` | Smoke test das rotas da API |
| `npm run test:jev` | Testa o motor de decisao JEV (precisa de `OPENROUTER_API_KEY`) |
| `npm run test:cache` | Testa o cache multi-turno dos chatbots |

### Problemas comuns

| Sintoma | Causa provavel | Solucao |
| --- | --- | --- |
| `SyntaxError` ao iniciar | Node abaixo da versao 18 | Atualize o Node |
| `EADDRINUSE: address already in use` | Porta 3000 ocupada | Suba em outra porta: `PORT=8080 npm start` |
| Pagina em branco, 404 nos `.js` | Comando rodado fora da raiz do projeto | Execute `npm start` na pasta que contem o `package.json` |
| Nao abre de outro aparelho da rede | `HOST` esta em `127.0.0.1` | Use `HOST=0.0.0.0` e libere a porta no firewall |
| Rodape mostra "motor local" mesmo com chave | `.env` nao criado, ou nome da variavel errado | Confira o nome da variavel e reinicie o servidor |
| Historico e progresso sumiram | O servidor foi reiniciado | Comportamento esperado — ver [Sem banco de dados](#sem-banco-de-dados) |

---

## O que o sistema faz

### 1. Code Review

Cole um trecho de codigo e receba uma revisao com nota de 0 a 100, metricas e a lista
de achados. Cada achado traz tres coisas que uma ferramenta de lint normalmente nao da:

- **Por que isso importa** — a consequencia concreta do problema, nao a regra.
- **Como resolver** — a acao especifica.
- **Antes e depois** — o codigo corrigido, lado a lado.

O motor local tem **57 regras** cobrindo seguranca (SQL injection, XSS, segredos no
codigo, aleatoriedade insegura), bugs provaveis (`async` em `forEach`, mutacao de
estado no React, argumento padrao mutavel em Python), performance, manutenibilidade
e boas praticas. Linguagens: JavaScript, TypeScript, React/JSX, Python, Java, C#,
PHP, Go, SQL, HTML e CSS.

Clicar em um achado abre a explicacao e destaca a linha correspondente no editor.

### 2. Resolver bug

Cole a mensagem de erro (com stack trace, se tiver) e opcionalmente o codigo.
O sistema devolve:

- O erro traduzido para linguagem clara.
- **Causas provaveis com grau de confianca** — ordenadas, somando 100%.
- O **stack trace interpretado**, com o primeiro frame do seu projeto destacado
  como ponto de partida (os frames de biblioteca ficam esmaecidos).
- **Roteiro de investigacao** interativo, em forma de checklist.
- **Correcoes com codigo** pronto para copiar.

A base cobre mais de 30 erros comuns de JavaScript/Node, React, Python, Java/C# e HTTP.

### 3. Tutor

Perguntas sobre conceitos, em tres modos:

| Modo | O que faz |
| --- | --- |
| **Explicar** | Analogia do mundo real, explicacao em camadas, exemplo, erros comuns e exercicio |
| **Socratico** | Nao entrega a resposta: devolve perguntas em ordem crescente de profundidade |
| **Exemplos** | Prioriza codigo comentado, com contraexemplo e como verificar |

12 conceitos cobertos em profundidade: closures, async/await e event loop, Big-O,
SOLID, imutabilidade, funcoes puras, testes, condicoes de corrida, performance em
banco de dados, Git (merge x rebase), metodo de depuracao e APIs REST.

A resposta chega em streaming (SSE), renderizada em Markdown com realce de sintaxe.

### 4. Chatbots

Tres prototipos de interface de chatbot, cada um uma **maquina de estados declarativa**
no front-end, com uma camada hibrida opcional no back-end
(`POST /api/chatbots/message`) que interpreta texto livre e mantem o contexto entre
turnos.

| Bot | Cobre |
| --- | --- |
| **Lumi** (servicos) | Agendamento, segunda via de boleto, status de pedido, transbordo para atendente, avaliacao (CSAT) |
| **Ze** (delivery) | Cardapio em carrossel, carrinho com badge flutuante, endereco, pagamento, recibo e rastreamento |
| **Kai** (demandas) | Criacao guiada de demanda, quadro kanban, resumo da semana com graficos |

Ao lado do simulador, o painel *Fluxo* documenta todos os estados, as transicoes, as
intencoes mapeadas e o que falta para tornar aquele bot funcional. Clicar em um estado
salta direto para ele.

Adicionar um estado novo e so acrescentar uma chave em
[`public/js/components/chatbots.js`](public/js/components/chatbots.js). Os tipos de
mensagem disponiveis sao `text`, `cards`, `summary`, `tracker`, `rating`, `kanban`
e `chart`.

---

## Arquitetura

```
server/
├── index.js              servidor HTTP (node:http puro)
├── config.js             configuracao + leitor de .env sem dependencia
├── routes/index.js       definicao de todas as rotas da API
├── http/
│   ├── router.js         router com parametros de rota, JSON e SSE
│   ├── middleware.js     CORS, parse de corpo, rate limit
│   └── static.js         arquivos estaticos + versionamento de modulos
├── engine/
│   ├── analyzer.js       executa o catalogo de regras
│   ├── languageDetect.js deteccao de linguagem por assinaturas
│   ├── metrics.js        complexidade, aninhamento, duplicacao
│   ├── stacktrace.js     parser de stack trace (JS, Python, Java)
│   └── rules/            universal.js, javascript.js, python.js
├── knowledge/
│   ├── errors.js         base de erros comuns
│   ├── concepts.js       base de conceitos do tutor
│   └── samples.js        exemplos prontos
├── services/
│   ├── reviewService.js  code review
│   ├── debugService.js   diagnostico de erros
│   ├── tutorService.js   tutor (inclui streaming)
│   ├── chatbotService.js camada hibrida dos chatbots
│   ├── chatbotCache.js   contexto multi-turno em memoria
│   └── sessionStore.js   sessao, historico e progresso em memoria
├── providers/
│   ├── ai.js             facade: escolhe o provedor disponivel
│   ├── openrouter.js     motor hibrido (decisao + conversacao)
│   └── anthropic.js      provedor legado opcional
└── utils/index.js        logger e utilitarios

public/
├── index.html
├── styles/               tokens, base, animacoes, layout, componentes, views, chatbots
└── js/
    ├── main.js           orquestracao
    ├── api.js            cliente HTTP + SSE
    ├── state.js          estado da aplicacao
    ├── lib/              dom, motion, highlight, markdown
    └── components/       editor, reviewView, debugView, chatbots
```

Nao ha etapa de build. O realce de sintaxe, o renderizador Markdown e as animacoes
sao implementados no proprio projeto.

---

## API

| Metodo | Rota | Descricao |
| --- | --- | --- |
| `GET` | `/api/health` | Status do servidor e do motor |
| `GET` | `/api/meta` | Linguagens, conceitos, exemplos e catalogo de regras |
| `GET` | `/api/samples/:id` | Um exemplo pronto |
| `POST` | `/api/review` | Code review de um trecho de codigo |
| `POST` | `/api/debug` | Diagnostico de uma mensagem de erro |
| `POST` | `/api/tutor` | Pergunta ao tutor |
| `POST` | `/api/tutor/stream` | Igual ao anterior, resposta em SSE |
| `POST` | `/api/chatbots/message` | Camada hibrida dos bots |
| `GET` | `/api/chatbots/cache` | Inspeciona o contexto multi-turno da sessao |
| `POST` | `/api/jev/test` | Testa o motor de decisao (diagnostico) |
| `GET` | `/api/session` | Progresso e historico da sessao |
| `GET` | `/api/session/history/:id` | Um item completo do historico |
| `DELETE` | `/api/session/history` | Limpa o historico |

A sessao e identificada pelo header `X-Session-Id`, devolvido na primeira resposta
e guardado pelo front-end em `localStorage`.

Exemplo:

```bash
curl -X POST http://localhost:3000/api/review \
  -H "Content-Type: application/json" \
  -d '{"code":"var x = 1;"}'
```

---

## IA opcional

O sistema funciona **completo sem nenhuma chave de API** — o motor local faz toda a
analise. Com uma chave configurada, as respostas ganham uma camada complementar:
revisao em linguagem natural sobre o codigo especifico, hipotese principal no
diagnostico, perguntas livres no tutor e interpretacao de texto livre nos chatbots.

Os provedores sao escolhidos nesta ordem por
[`server/providers/ai.js`](server/providers/ai.js):

1. **OpenRouter** (motor hibrido) — um modelo de decisao para classificar a intencao e
   um modelo principal para gerar a resposta. Ativado por `OPENROUTER_API_KEY`.
2. **Anthropic** (legado) — ativado por `ANTHROPIC_API_KEY`.
3. **Motor local** — usado quando nenhuma chave esta presente.

```bash
cp .env.example .env
# edite o .env e defina OPENROUTER_API_KEY (ou ANTHROPIC_API_KEY)
npm start
```

O indicador no rodape da barra lateral mostra qual motor esta ativo. Se a chamada a
IA falhar, o resultado do motor local e devolvido com um aviso — a analise nunca fica
bloqueada por indisponibilidade externa.

---

## Sem banco de dados

Esta e uma decisao explicita desta etapa do projeto. As consequencias:

- Historico, progresso (XP, nivel, conquistas) e sessoes vivem em memoria.
- **Reiniciar o servidor apaga tudo.**
- Ha limite de sessoes simultaneas e expiracao por inatividade (2h), para a memoria
  nao crescer indefinidamente.

O ponto de troca esta isolado em
[`server/services/sessionStore.js`](server/services/sessionStore.js): a interface
(`getSession`, `registrarAnalise`, `registrarDiagnostico`, `serializeSession`) nao
muda quando houver persistencia real.

---

## Atalhos

| Atalho | Acao |
| --- | --- |
| `Ctrl` + `K` | Busca rapida (acoes, exemplos, conceitos, chatbots) |
| `Ctrl` + `Enter` | Executa a acao da tela atual |
| `1` a `5` | Troca de secao |
| `Esc` | Fecha a busca ou o menu |
| `Tab` no editor | Indenta (com `Shift`, desindenta) |

Arrastar um arquivo sobre o editor carrega o conteudo.

---

## Configuracao

Todas as variaveis sao opcionais — ver [`.env.example`](.env.example).

| Variavel | Padrao | Descricao |
| --- | --- | --- |
| `PORT` | `3000` | Porta HTTP |
| `HOST` | `127.0.0.1` | Use `0.0.0.0` para expor na rede local |
| `OPENROUTER_API_KEY` | — | Ativa o motor hibrido de IA |
| `OPENROUTER_MAIN_MODEL` | `deepseek/deepseek-v4.1-flash` | Modelo principal (geracao) |
| `OPENROUTER_JEV_MODEL` | `typesafe/jev-1.13` | Modelo de decisao (classificacao) |
| `OPENROUTER_BASE_URL` | `https://openrouter.ai/api` | Endpoint do provedor |
| `ANTHROPIC_API_KEY` | — | Ativa a camada de IA legada |
| `ANTHROPIC_MODEL` | `claude-sonnet-5-5` | Modelo usado |
| `ANTHROPIC_MAX_TOKENS` | `3000` | Teto de tokens por resposta |
| `RATE_LIMIT_MAX` | `120` | Requisicoes por janela, por IP |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Tamanho da janela de rate limit, em ms |
| `MAX_BODY_BYTES` | `1048576` | Tamanho maximo do corpo da requisicao |
| `MAX_CODE_CHARS` | `120000` | Tamanho maximo do codigo analisado |

---

## Acessibilidade e desempenho

- Tema claro e escuro, com deteccao da preferencia do sistema e transicao circular
  onde o navegador suporta View Transitions.
- `prefers-reduced-motion` desliga todas as animacoes.
- Navegacao por teclado em toda a interface, com foco visivel.
- As animacoes que definem um valor final nao dependem apenas de
  `requestAnimationFrame` — em aba de segundo plano ele nao dispara, entao ha sempre
  um caminho alternativo. O mesmo vale para o scroll programatico.

---

## Licenca

MIT.
