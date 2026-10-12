/**
 * Base de conhecimento de erros comuns.
 * Cada entrada traz: explicacao em linguagem clara, causas provaveis com confianca,
 * roteiro de investigacao e correcoes com codigo.
 */

export const errorKnowledge = [
  // -------------------------------------------------------- JavaScript / Node
  {
    id: 'js/undefined-property',
    languages: ['javascript'],
    match: [
      /cannot read propert(?:y|ies)\s+'?([\w$]+)'?\s+of\s+(undefined|null)/i,
      /cannot read propert(?:y|ies)\s+of\s+(undefined|null)/i,
      /\(reading\s+'([^']+)'\)/i,
    ],
    title: 'Acesso a propriedade de um valor inexistente',
    severity: 'high',
    plain:
      'Seu codigo pediu uma propriedade de algo que nao existe. ' +
      'O JavaScript chegou em `undefined` (ou `null`) e, ao tentar ler um campo dentro disso, parou. ' +
      'O detalhe importante: o erro acontece onde voce LEU o valor, mas a causa esta onde ele deveria ter sido PREENCHIDO.',
    causes: [
      {
        title: 'A resposta da API tem formato diferente do esperado',
        detail:
          'Voce acessa `resposta.dados.itens`, mas a API devolve `{ data: { items: [] } }` ou um envelope como `{ result: ... }`. ' +
          'Imprima a resposta inteira antes de acessar os campos.',
        confidence: 0.3,
      },
      {
        title: 'O dado ainda nao chegou (estado assincrono)',
        detail:
          'O componente renderiza antes da requisicao terminar. No primeiro render o estado e `null` ou `undefined`, ' +
          'e so depois recebe o valor. O erro acontece nesse primeiro instante.',
        confidence: 0.28,
      },
      {
        title: 'Busca em array ou objeto que nao encontrou nada',
        detail:
          '`array.find(...)` devolve `undefined` quando nenhum item satisfaz a condicao, ' +
          'e `objeto[chave]` devolve `undefined` quando a chave nao existe. Nenhum dos dois lanca erro - eles s() devolvem vazio.',
        confidence: 0.22,
      },
      {
        title: 'Erro de digitacao no nome da propriedade',
        detail:
          'JavaScript nao reclama de nome errado: `usuario.nmoe` simplesmente vale `undefined`. ' +
          'O erro aparece um passo depois, quando voce acessa algo dentro disso.',
        confidence: 0.2,
      },
    ],
    checklist: [
      'Localize no stack trace o primeiro arquivo do SEU projeto (ignore node_modules) - e ali que a investigacao comeca.',
      'Imprima o objeto-pai inteiro, nao a propriedade: `console.log(JSON.stringify(objeto, null, 2))`.',
      'Confirme se o valor chega preenchido: o problema e o dado estar ausente ou o caminho estar errado?',
      'Se for codigo assincrono, verifique se existe tratamento para o estado de carregamento.',
      'Confira maiusculas e minusculas nos nomes das propriedades.',
    ],
    fixes: [
      {
        title: 'Optional chaining com valor padrao',
        explanation:
          'O `?.` interrompe a leitura e devolve `undefined` em vez de lancar erro. ' +
          'O `??` entra com o valor padrao. Resolve o sintoma de forma segura.',
        code:
          '// antes\nconst nome = resposta.usuario.perfil.nome;\n\n// depois\nconst nome = resposta?.usuario?.perfil?.nome ?? "Visitante";',
      },
      {
        title: 'Guarda explicita no inicio',
        explanation:
          'Melhor que mascarar: valide uma vez no inicio e deixe o resto do codigo trabalhar com dado garantido.',
        code:
          'const usuario = lista.find((u) => u.id === id);\n\nif (!usuario) {\n  throw new Error(`Usuario ${id} nao encontrado`);\n}\n\n// daqui para baixo, usuario existe com certeza\nreturn usuario.perfil.nome;',
      },
      {
        title: 'Tratamento do estado de carregamento (React)',
        explanation: 'Renderize o estado intermediario em vez de assumir que o dado ja existe.',
        code:
          'const [dados, setDados] = useState(null);\n\nif (!dados) return <Carregando />;\n\nreturn <Perfil nome={dados.usuario.nome} />;',
      },
    ],
    concept: 'Valores nulos e undefined',
    prevention:
      'Valide os dados na fronteira do sistema (ao receber da API, do formulario, do banco). ' +
      'Dentro do dominio, trabalhe com estruturas garantidas.',
  },
  {
    id: 'js/not-a-function',
    languages: ['javascript'],
    match: [/(\S+)\s+is not a function/i],
    title: 'Chamada de algo que nao e funcao',
    severity: 'high',
    plain:
      'Voce usou `()` em um valor que nao e funcao. ' +
      'Normalmente ele e `undefined`, um objeto, ou uma funcao que existe em outro tipo.',
    causes: [
      {
        title: 'Importacao com formato errado (default x nomeada)',
        detail:
          '`import x from "mod"` pega a exportacao padrao; `import { x }` pega a nomeada. ' +
          'Se trocar, `x` vem `undefined` e a chamada falha.',
        confidence: 0.3,
      },
      {
        title: 'Metodo que nao existe naquele tipo',
        detail:
          '`.map` existe em array, nao em objeto. `.replace` existe em string, nao em numero. ' +
          'Verifique o tipo real com `typeof` ou `Array.isArray`.',
        confidence: 0.28,
      },
      {
        title: 'Perda do contexto `this`',
        detail:
          'Ao passar `objeto.metodo` como callback, o metodo se desprende do objeto. ' +
          'Dentro dele, `this` nao e mais o objeto e a chamada interna falha.',
        confidence: 0.22,
      },
      {
        title: 'Dependencia circular entre modulos',
        detail:
          'A quebra nos dois sentidos faz um dos modulos ser lido antes de estar pronto, ' +
          'entao a funcao importada ainda e `undefined` no momento da chamada.',
        confidence: 0.2,
      },
    ],
    checklist: [
      'Antes da chamada, imprima o valor: `console.log(typeof minhaFuncao, minhaFuncao)`.',
      'Se for `undefined`, o problema esta na importacao ou na atribuicao, nao na chamada.',
      'Abra o modulo de origem e confirme se a exportacao e default ou nomeada.',
      'Se for um metodo, confirme o tipo do objeto - array, objeto puro, string?',
      'Se o valor vem de um callback, verifique se o `this` foi preservado.',
    ],
    fixes: [
      {
        title: 'Corrigir a forma da importacao',
        explanation: 'Alinhe a importacao com o que o modulo realmente exporta.',
        code:
          '// modulo.js\nexport default function principal() {}\nexport function auxiliar() {}\n\n// consumo correto\nimport principal, { auxiliar } from "./modulo.js";',
      },
      {
        title: 'Preservar o contexto com arrow function',
        explanation:
          'A arrow function nao cria o proprio `this`: ela herda o do escopo onde foi escrita. ' +
          'Por isso o metodo continua ligado ao objeto.',
        code:
          '// perde o this\nbotao.addEventListener("click", this.salvar);\n\n// preserva\nbotao.addEventListener("click", () => this.salvar());\n\n// ou amarre no construtor\nthis.salvar = this.salvar.bind(this);',
      },
    ],
    concept: 'Funcoes de primeira classe e `this`',
    prevention: 'Em TypeScript, esse erro e pego em tempo de compilacao - vale ativar `strict`.',
  },
  {
    id: 'js/not-defined',
    languages: ['javascript'],
    match: [/(\w+) is not defined/i, /ReferenceError/i],
    title: 'Variavel ou funcao inexistente no escopo',
    severity: 'high',
    plain:
      'O nome usado nao existe em nenhum escopo acessivel naquele ponto. ' +
      'Diferente de `undefined` (declarado, sem valor), aqui o identificador nunca foi declarado.',
    causes: [
      {
        title: 'Falta a importacao',
        detail: 'O nome existe em outro arquivo, mas nao foi importado neste.',
        confidence: 0.35,
      },
      {
        title: 'Erro de digitacao no nome',
        detail: 'Maiusculas e minusculas importam: `MinhaClasse` e `minhaClasse` sao nomes diferentes.',
        confidence: 0.25,
      },
      {
        title: 'API indisponivel neste ambiente',
        detail:
          '`window`, `document` e `localStorage` nao existem no Node. ' +
          '`require`, `__dirname` e `process` nao existem no navegador nem em modulos ESM.',
        confidence: 0.25,
      },
      {
        title: 'Uso antes da declaracao (temporal dead zone)',
        detail:
          '`let` e `const` sao elevados mas ficam inacessiveis ate a linha da declaracao. ' +
          'Ler antes disso lanca ReferenceError.',
        confidence: 0.15,
      },
    ],
    checklist: [
      'Confira a grafia exata, incluindo maiusculas.',
      'Procure a declaracao original: ela esta exportada do arquivo de origem?',
      'Esse nome existe no ambiente onde o codigo roda (navegador x Node)?',
      'A declaracao aparece antes do uso no fluxo de execucao?',
    ],
    fixes: [
      {
        title: 'Importar explicitamente',
        explanation: 'Todo nome externo precisa ser trazido para o escopo do arquivo.',
        code: 'import { minhaFuncao } from "./utils.js";\n\nminhaFuncao();',
      },
      {
        title: 'Proteger APIs especificas de ambiente',
        explanation: 'Verifique a existencia antes de usar, quando o mesmo codigo roda nos dois lados.',
        code:
          'const noNavegador = typeof window !== "undefined";\n\nif (noNavegador) {\n  localStorage.setItem("tema", "escuro");\n}',
      },
    ],
    concept: 'Escopo e resolucao de nomes',
  },
  {
    id: 'js/unexpected-token',
    languages: ['javascript'],
    match: [/unexpected token/i, /unexpected end of (input|json)/i, /SyntaxError/i],
    title: 'Erro de sintaxe',
    severity: 'critical',
    plain:
      'O interpretador encontrou um caractere onde esperava outro e nao consegue nem comecar a executar. ' +
      'A posicao apontada e onde a leitura FALHOU, e o erro real costuma estar algumas linhas acima.',
    causes: [
      {
        title: 'Parentese, chave ou colchete nao fechado',
        detail:
          'Um `{` sem `}` faz o interpretador seguir lendo e reclamar muito depois, ' +
          'frequentemente no fim do arquivo.',
        confidence: 0.35,
      },
      {
        title: 'JSON.parse recebendo algo que nao e JSON',
        detail:
          '"Unexpected token < in JSON" quase sempre significa que a resposta era uma pagina HTML de erro (404/500), ' +
          'nao JSON. O `<` e o inicio de `<!DOCTYPE html>`.',
        confidence: 0.3,
      },
      {
        title: 'Virgula sobrando ou faltando',
        detail: 'Virgula depois do ultimo item e invalida em JSON (embora valida em objeto JavaScript).',
        confidence: 0.2,
      },
      {
        title: 'Sintaxe moderna em ambiente antigo',
        detail: 'Optional chaining, campos privados ou JSX sem transpilacao causam o mesmo erro.',
        confidence: 0.15,
      },
    ],
    checklist: [
      'Olhe de 5 a 10 linhas ACIMA da posicao indicada.',
      'Use a indentacao automatica do editor: um bloco que nao alinha revela a chave faltando.',
      'Se o erro menciona JSON, imprima o texto cru antes do parse e veja o que realmente chegou.',
      'Confirme o status HTTP da resposta antes de tentar interpretar o corpo.',
    ],
    fixes: [
      {
        title: 'Validar a resposta antes do parse',
        explanation: 'Checar status e Content-Type transforma um erro de sintaxe confuso em mensagem clara.',
        code:
          'const resposta = await fetch(url);\n\nif (!resposta.ok) {\n  throw new Error(`HTTP ${resposta.status}: ${resposta.statusText}`);\n}\n\nconst tipo = resposta.headers.get("content-type") || "";\nif (!tipo.includes("application/json")) {\n  const texto = await resposta.text();\n  throw new Error(`Esperava JSON, recebi: ${texto.slice(0, 120)}`);\n}\n\nreturn resposta.json();',
      },
    ],
    concept: 'Parsing e analise sintatica',
  },
  {
    id: 'js/max-callstack',
    languages: ['javascript'],
    match: [/maximum call stack size exceeded/i, /stack overflow/i],
    title: 'Pilha de chamadas esgotada (recursao infinita)',
    severity: 'critical',
    plain:
      'Cada chamada de funcao ocupa um espaco na pilha. ' +
      'Algo esta chamando sem parar e a pilha encheu - na pratica, uma recursao que nunca atinge o caso base.',
    causes: [
      {
        title: 'Recursao sem caso base alcancavel',
        detail:
          'Existe um caso base, mas a condicao nunca se torna verdadeira: ' +
          'o parametro nao se aproxima do limite a cada chamada.',
        confidence: 0.4,
      },
      {
        title: 'Laco entre getter e setter',
        detail: 'Um getter que le a propria propriedade, ou um setter que atribui a si mesmo.',
        confidence: 0.2,
      },
      {
        title: 'Estrutura de dados circular',
        detail: 'Percorrer um grafo com ciclo sem marcar os nos visitados.',
        confidence: 0.2,
      },
      {
        title: 'Efeito que dispara a si mesmo (React)',
        detail: 'Um useEffect que atualiza um estado presente no proprio array de dependencias.',
        confidence: 0.2,
      },
    ],
    checklist: [
      'Identifique no stack trace qual funcao se repete - ela e a recursiva.',
      'Pergunte: qual e o caso base? Em qual chamada ele e atingido?',
      'Imprima o argumento no inicio de cada chamada: ele esta se aproximando do caso base?',
      'Em React, confira se o efeito altera algo que esta nas proprias dependencias.',
    ],
    fixes: [
      {
        title: 'Garantir que o caso base seja alcancado',
        explanation: 'Todo caminho recursivo precisa reduzir o problema em direcao ao caso base.',
        code:
          '// laco infinito: n nunca diminui\nfunction fatorial(n) {\n  return n * fatorial(n);\n}\n\n// correto\nfunction fatorial(n) {\n  if (n < 0) throw new RangeError("n deve ser >= 0");\n  if (n <= 1) return 1;       // caso base\n  return n * fatorial(n - 1);  // o problema encolhe\n}',
      },
      {
        title: 'Marcar nos visitados em grafos',
        explanation: 'Um conjunto de visitados quebra o ciclo.',
        code:
          'function percorrer(no, visitados = new Set()) {\n  if (!no || visitados.has(no.id)) return;\n  visitados.add(no.id);\n\n  for (const filho of no.filhos) {\n    percorrer(filho, visitados);\n  }\n}',
      },
    ],
    concept: 'Recursao e pilha de chamadas',
  },
  {
    id: 'js/cors',
    languages: ['javascript'],
    match: [/cors/i, /access-control-allow-origin/i, /cross-origin request blocked/i],
    title: 'Requisicao bloqueada por CORS',
    severity: 'medium',
    plain:
      'O navegador fez a requisicao, o servidor respondeu, e o NAVEGADOR descartou a resposta. ' +
      'Isso nao e um bug no seu codigo de front-end: e uma politica de seguranca. ' +
      'O servidor precisa autorizar explicitamente a origem que esta chamando.',
    causes: [
      {
        title: 'O servidor nao envia o cabecalho Access-Control-Allow-Origin',
        detail: 'Sem esse cabecalho, o navegador recusa entregar a resposta ao JavaScript da pagina.',
        confidence: 0.45,
      },
      {
        title: 'A requisicao de preflight (OPTIONS) nao e tratada',
        detail:
          'Metodos como PUT/DELETE, ou cabecalhos customizados, disparam um OPTIONS previo. ' +
          'Se o servidor nao responder a ele, a requisicao real nunca sai.',
        confidence: 0.3,
      },
      {
        title: 'Credenciais com origem curinga',
        detail:
          'Com `credentials: "include"`, o `Access-Control-Allow-Origin: *` e invalido. ' +
          'O servidor precisa devolver a origem exata e `Access-Control-Allow-Credentials: true`.',
        confidence: 0.25,
      },
    ],
    checklist: [
      'Abra a aba Rede e veja se existe uma requisicao OPTIONS antes da sua.',
      'Inspecione os cabecalhos da RESPOSTA: existe Access-Control-Allow-Origin?',
      'O valor do cabecalho corresponde exatamente a origem da sua pagina (protocolo, host e porta)?',
      'Teste o mesmo endpoint via curl: se funcionar, confirma que o bloqueio e do navegador.',
    ],
    fixes: [
      {
        title: 'Liberar a origem no servidor',
        explanation: 'CORS se resolve no servidor. Em desenvolvimento, libere a origem do seu front-end.',
        code:
          '// Node / Express\napp.use((req, res, next) => {\n  res.setHeader("Access-Control-Allow-Origin", "http://localhost:5173");\n  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");\n  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");\n\n  if (req.method === "OPTIONS") return res.sendStatus(204);\n  next();\n});',
      },
      {
        title: 'Usar proxy no servidor de desenvolvimento',
        explanation:
          'O proxy faz o navegador ver tudo na mesma origem, entao o CORS deixa de se aplicar. ' +
          'Serve para desenvolvimento; em producao o servidor ainda precisa autorizar.',
        code:
          '// vite.config.js\nexport default {\n  server: {\n    proxy: {\n      "/api": {\n        target: "http://localhost:3000",\n        changeOrigin: true,\n      },\n    },\n  },\n};',
      },
    ],
    concept: 'Same-origin policy e CORS',
  },
  {
    id: 'node/module-not-found',
    languages: ['javascript'],
    match: [/cannot find module/i, /module_not_found/i, /failed to resolve import/i],
    title: 'Modulo nao encontrado',
    severity: 'high',
    plain: 'O Node (ou o bundler) procurou o arquivo ou pacote nos caminhos conhecidos e nao achou.',
    causes: [
      {
        title: 'Dependencia nao instalada',
        detail: 'O pacote esta no package.json mas node_modules nao foi atualizado.',
        confidence: 0.35,
      },
      {
        title: 'Caminho relativo errado',
        detail:
          '`./` e a pasta atual, `../` sobe um nivel. Esquecer o ponto faz o Node procurar em node_modules.',
        confidence: 0.3,
      },
      {
        title: 'Extensao ausente em ESM',
        detail:
          'Com `"type": "module"`, a extensao e obrigatoria: `import "./utils"` falha, `import "./utils.js"` funciona.',
        confidence: 0.2,
      },
      {
        title: 'Diferenca de maiusculas',
        detail:
          'Windows e macOS ignoram caixa; Linux nao. O codigo funciona na sua maquina e quebra no servidor.',
        confidence: 0.15,
      },
    ],
    checklist: [
      'Rode `npm install` e confira se o pacote aparece em node_modules.',
      'Confirme o nome exato do pacote (hifens, escopo @org/).',
      'Para arquivos locais, verifique o caminho a partir do arquivo que importa, nao da raiz.',
      'Em ESM, inclua a extensao .js.',
      'Compare a caixa das letras no nome do arquivo com o que esta no import.',
    ],
    fixes: [
      {
        title: 'Reinstalar as dependencias do zero',
        explanation: 'Resolve node_modules em estado inconsistente.',
        code: 'rm -rf node_modules package-lock.json\nnpm install',
      },
    ],
    concept: 'Resolucao de modulos',
  },
  {
    id: 'node/eaddrinuse',
    languages: ['javascript'],
    match: [/eaddrinuse/i, /address already in use/i, /port \d+ is already in use/i],
    title: 'Porta ja esta em uso',
    severity: 'low',
    plain:
      'Outro processo ja escuta nessa porta. Normalmente e uma execucao anterior do seu proprio servidor ' +
      'que nao encerrou direito.',
    causes: [
      {
        title: 'Instancia anterior ainda rodando',
        detail: 'Terminal fechado sem Ctrl+C, ou processo orfao deixado pelo nodemon.',
        confidence: 0.6,
      },
      {
        title: 'Outro servico usa a mesma porta',
        detail: 'Conflito comum com 3000, 5000, 8080 - varios frameworks usam esses padroes.',
        confidence: 0.4,
      },
    ],
    checklist: [
      'Descubra quem usa a porta e encerre o processo.',
      'Ou simplesmente mude a porta da sua aplicacao.',
    ],
    fixes: [
      {
        title: 'Encontrar e encerrar o processo',
        explanation: 'Identifique o PID que ocupa a porta e finalize.',
        code:
          '# Windows (PowerShell)\nGet-NetTCPConnection -LocalPort 3000 | Select-Object OwningProcess\nStop-Process -Id <PID>\n\n# macOS / Linux\nlsof -i :3000\nkill -9 <PID>',
      },
      {
        title: 'Tornar a porta configuravel',
        explanation: 'Evita o conflito de vez e deixa o deploy mais flexivel.',
        code: 'const porta = process.env.PORT || 3000;\n\nservidor.listen(porta);',
      },
    ],
    concept: 'Portas e processos',
  },
  {
    id: 'node/econnrefused',
    languages: ['javascript'],
    match: [/econnrefused/i, /connection refused/i, /fetch failed/i],
    title: 'Conexao recusada',
    severity: 'high',
    plain:
      'Seu codigo tentou conectar e nao havia ninguem escutando naquele endereco e porta. ' +
      'A recusa e imediata, o que indica host alcancavel mas servico ausente (diferente de timeout).',
    causes: [
      {
        title: 'O servico de destino nao esta rodando',
        detail: 'Banco de dados, API interna ou container ainda nao iniciado.',
        confidence: 0.4,
      },
      {
        title: 'Host ou porta incorretos',
        detail: 'Erro de digitacao, ou variavel de ambiente ausente fazendo a URL virar `undefined`.',
        confidence: 0.3,
      },
      {
        title: 'localhost dentro de container',
        detail:
          'Em Docker, `localhost` e o proprio container. Para alcancar outro servico, use o nome dele na rede.',
        confidence: 0.3,
      },
    ],
    checklist: [
      'O servico de destino esta no ar? Teste direto no navegador ou com curl.',
      'Imprima a URL final montada - alguma variavel pode estar vazia.',
      'Em Docker, troque localhost pelo nome do servico declarado no compose.',
    ],
    fixes: [
      {
        title: 'Falhar com mensagem clara e tentar novamente',
        explanation: 'Retentativa com espera crescente resolve o caso de servico ainda subindo.',
        code:
          'async function conectarComRetry(tentativas = 5) {\n  for (let i = 1; i <= tentativas; i += 1) {\n    try {\n      return await conectar();\n    } catch (erro) {\n      if (i === tentativas) {\n        throw new Error(`Falha ao conectar em ${URL} apos ${tentativas} tentativas`, { cause: erro });\n      }\n      await new Promise((r) => setTimeout(r, 2 ** i * 100));\n    }\n  }\n}',
      },
    ],
    concept: 'Rede e conectividade',
  },
  {
    id: 'js/circular-json',
    languages: ['javascript'],
    match: [/converting circular structure to json/i, /circular reference/i],
    title: 'Estrutura circular em JSON.stringify',
    severity: 'medium',
    plain:
      'O objeto contem uma referencia que aponta de volta para ele mesmo. ' +
      'JSON.stringify percorreria essa volta para sempre, entao ele para e lanca o erro.',
    causes: [
      {
        title: 'Relacao bidirecional entre objetos',
        detail: 'Pai aponta para filho e filho aponta de volta para o pai.',
        confidence: 0.4,
      },
      {
        title: 'Serializacao de objeto de framework',
        detail: 'Objetos de request/response, elementos do DOM e sockets contem ciclos internos.',
        confidence: 0.4,
      },
      {
        title: 'Objeto de erro com `cause`',
        detail: 'Cadeias de erro aninhadas podem formar ciclo.',
        confidence: 0.2,
      },
    ],
    checklist: [
      'A mensagem do erro geralmente indica qual propriedade fecha o ciclo.',
      'Serialize apenas os campos que voce realmente precisa.',
    ],
    fixes: [
      {
        title: 'Selecionar explicitamente os campos',
        explanation: 'Mais previsivel e mais seguro: evita vazar dados internos no log.',
        code:
          '// em vez de JSON.stringify(usuario)\nconst paraLog = {\n  id: usuario.id,\n  email: usuario.email,\n  plano: usuario.plano?.nome,\n};\n\nlogger.info("usuario carregado", paraLog);',
      },
      {
        title: 'Filtrar referencias repetidas',
        explanation: 'Um conjunto de objetos ja vistos corta o ciclo durante a serializacao.',
        code:
          'function stringifySeguro(valor) {\n  const vistos = new WeakSet();\n\n  return JSON.stringify(valor, (chave, v) => {\n    if (typeof v !== "object" || v === null) return v;\n    if (vistos.has(v)) return "[Circular]";\n    vistos.add(v);\n    return v;\n  }, 2);\n}',
      },
    ],
    concept: 'Serializacao',
  },
  {
    id: 'js/const-assignment',
    languages: ['javascript'],
    match: [/assignment to constant variable/i, /invalid assignment to const/i],
    title: 'Reatribuicao de const',
    severity: 'medium',
    plain:
      '`const` impede trocar o VALOR da variavel. ' +
      'Note que ela nao congela o conteudo: `const lista = []` proibe `lista = [1]`, mas permite `lista.push(1)`.',
    causes: [
      {
        title: 'A variavel precisa mudar de valor',
        detail: 'O caso legitimo de `let`: contador, acumulador, valor recalculado em laco.',
        confidence: 0.6,
      },
      {
        title: 'Confusao entre reatribuir e mutar',
        detail: 'A intencao era alterar o conteudo do objeto, nao trocar a referencia.',
        confidence: 0.4,
      },
    ],
    checklist: [
      'Essa variavel realmente precisa mudar? Se sim, use `let`.',
      'Se a intencao era alterar o conteudo, use os metodos do objeto em vez de reatribuir.',
    ],
    fixes: [
      {
        title: 'Escolher entre let e mutacao',
        explanation: 'Deixe explicito se o que muda e a referencia ou o conteudo.',
        code:
          '// a referencia muda -> let\nlet total = 0;\nfor (const item of itens) total += item.valor;\n\n// o conteudo muda -> const serve\nconst acumulado = [];\nfor (const item of itens) acumulado.push(item.valor);',
      },
    ],
    concept: 'Declaracoes e imutabilidade',
  },
  {
    id: 'react/too-many-renders',
    languages: ['javascript'],
    match: [/too many re-?renders/i, /maximum update depth exceeded/i],
    title: 'Laco infinito de renderizacao (React)',
    severity: 'critical',
    plain:
      'Renderizar mudou o estado, e mudar o estado dispara nova renderizacao. ' +
      'O React detectou o ciclo e interrompeu antes de travar a aba.',
    causes: [
      {
        title: 'setState chamado direto no corpo do componente',
        detail: 'Toda renderizacao executa o corpo, entao a atualizacao acontece em toda renderizacao.',
        confidence: 0.35,
      },
      {
        title: 'Funcao chamada em vez de passada no onClick',
        detail: '`onClick={salvar()}` executa durante a renderizacao. O correto e `onClick={salvar}`.',
        confidence: 0.3,
      },
      {
        title: 'useEffect sem dependencias atualizando estado',
        detail: 'Sem o array, o efeito roda apos cada renderizacao e realimenta o ciclo.',
        confidence: 0.2,
      },
      {
        title: 'Objeto ou array novo nas dependencias',
        detail:
          'Um literal criado na renderizacao tem referencia nova a cada vez, ' +
          'entao a comparacao de dependencias sempre indica mudanca.',
        confidence: 0.15,
      },
    ],
    checklist: [
      'Procure chamadas de set... fora de efeito, callback ou manipulador de evento.',
      'Em cada `on...={...}`, confirme que ha uma referencia de funcao e nao uma chamada.',
      'Todo useEffect tem array de dependencias?',
      'Alguma dependencia e objeto, array ou funcao criados na renderizacao?',
    ],
    fixes: [
      {
        title: 'Passar referencia, nao resultado',
        explanation: 'Com parametros, envolva em arrow function.',
        code:
          '// executa na renderizacao: laco\n<button onClick={salvar()}>Salvar</button>\n\n// executa no clique\n<button onClick={salvar}>Salvar</button>\n<button onClick={() => salvar(id)}>Salvar</button>',
      },
      {
        title: 'Derivar em vez de guardar em estado',
        explanation:
          'Se um valor pode ser calculado a partir de outros, ele nao precisa de estado proprio - ' +
          'e assim nao ha o que sincronizar.',
        code:
          '// problema: estado espelhando estado\nconst [itens, setItens] = useState([]);\nconst [total, setTotal] = useState(0);\nuseEffect(() => setTotal(itens.length)); // laco\n\n// solucao: derivar\nconst [itens, setItens] = useState([]);\nconst total = itens.length;',
      },
    ],
    concept: 'Renderizacao e estado no React',
  },
  {
    id: 'react/invalid-hook',
    languages: ['javascript'],
    match: [/invalid hook call/i, /hooks can only be called inside/i, /rendered more hooks than/i],
    title: 'Chamada invalida de hook (React)',
    severity: 'high',
    plain:
      'O React identifica cada hook pela ORDEM em que e chamado dentro do componente. ' +
      'Se a ordem muda entre renderizacoes, ele associa o estado ao hook errado - por isso a regra e rigida.',
    causes: [
      {
        title: 'Hook dentro de condicao ou laco',
        detail: 'A quantidade de chamadas passa a variar e a ordem deixa de ser estavel.',
        confidence: 0.4,
      },
      {
        title: 'Hook chamado fora de componente',
        detail: 'Hooks funcionam em componentes de funcao e em hooks customizados (nome iniciando com `use`).',
        confidence: 0.3,
      },
      {
        title: 'Duas copias do React no projeto',
        detail: 'Versoes duplicadas em node_modules quebram o rastreamento interno de hooks.',
        confidence: 0.3,
      },
    ],
    checklist: [
      'Todos os hooks estao no nivel mais externo do componente?',
      'Existe hook dentro de if, for, try ou callback?',
      'Rode `npm ls react` e confirme que ha uma unica versao.',
    ],
    fixes: [
      {
        title: 'Mover a condicao para dentro do hook',
        explanation: 'O hook roda sempre; a condicao fica no corpo dele.',
        code:
          '// errado\nif (usuarioLogado) {\n  const [dados, setDados] = useState(null);\n}\n\n// correto\nconst [dados, setDados] = useState(null);\n\nuseEffect(() => {\n  if (!usuarioLogado) return;\n  carregar().then(setDados);\n}, [usuarioLogado]);',
      },
    ],
    concept: 'Regras dos hooks',
  },
  {
    id: 'js/unhandled-rejection',
    languages: ['javascript'],
    match: [/unhandled(?:promise)?rejection/i, /uncaught \(in promise\)/i],
    title: 'Promise rejeitada sem tratamento',
    severity: 'high',
    plain:
      'Uma operacao assincrona falhou e ninguem capturou o erro. ' +
      'No Node moderno isso encerra o processo; no navegador, falha em silencio.',
    causes: [
      {
        title: 'Chamada async sem await e sem catch',
        detail: 'Chamar `salvar()` sem await nem `.catch()` deixa a rejeicao solta.',
        confidence: 0.4,
      },
      {
        title: 'await fora de try/catch',
        detail: 'O await propaga a rejeicao como excecao; sem try/catch ela sobe sem destino.',
        confidence: 0.35,
      },
      {
        title: 'Erro dentro de callback assincrono',
        detail: 'Callbacks de setTimeout, forEach ou manipuladores de evento tem pilha propria.',
        confidence: 0.25,
      },
    ],
    checklist: [
      'Procure chamadas de funcao async sem await.',
      'Cada await relevante esta dentro de um try/catch?',
      'Registre um handler global para nao perder o diagnostico.',
    ],
    fixes: [
      {
        title: 'Capturar na origem',
        explanation: 'Trate onde voce sabe o que fazer com a falha.',
        code:
          '// solta a rejeicao\nsalvarNoServidor(dados);\n\n// trata\ntry {\n  await salvarNoServidor(dados);\n} catch (erro) {\n  mostrarAviso("Nao foi possivel salvar. Tente novamente.");\n  logger.error("falha ao salvar", erro);\n}',
      },
      {
        title: 'Rede de seguranca global',
        explanation: 'Nao substitui o tratamento local, mas garante log antes de o processo cair.',
        code:
          '// Node\nprocess.on("unhandledRejection", (motivo) => {\n  logger.error("rejeicao nao tratada", motivo);\n  process.exit(1);\n});\n\n// navegador\nwindow.addEventListener("unhandledrejection", (evento) => {\n  reportarErro(evento.reason);\n});',
      },
    ],
    concept: 'Promises e tratamento de erros',
  },
  {
    id: 'js/not-iterable',
    languages: ['javascript'],
    match: [/is not iterable/i, /is not a valid iterator/i],
    title: 'Valor nao iteravel',
    severity: 'medium',
    plain:
      'Voce usou `for...of`, espalhamento (`...`) ou desestruturacao de array em algo que nao e iteravel. ' +
      'Objetos puros nao sao iteraveis; arrays, strings, Map e Set sao.',
    causes: [
      {
        title: 'O valor e undefined ou null',
        detail: 'A requisicao falhou ou a propriedade nao existe, e o resultado nunca chegou a ser array.',
        confidence: 0.4,
      },
      {
        title: 'O valor e um objeto, nao um array',
        detail: 'A API devolveu `{ itens: [...] }` e voce iterou o envelope.',
        confidence: 0.4,
      },
      {
        title: 'Desestruturacao de array aplicada a objeto',
        detail: '`const [a] = objeto` exige iteravel; use `const { a } = objeto`.',
        confidence: 0.2,
      },
    ],
    checklist: [
      'Imprima o valor e o `Array.isArray(valor)` antes do laco.',
      'Se vier objeto, use Object.entries/values para iterar.',
      'Garanta um array vazio como padrao quando o dado pode faltar.',
    ],
    fixes: [
      {
        title: 'Normalizar para array antes de iterar',
        explanation: 'Um valor padrao evita que a ausencia de dado quebre o fluxo.',
        code:
          'const itens = resposta?.dados?.itens ?? [];\n\nfor (const item of itens) {\n  processar(item);\n}\n\n// iterando um objeto\nfor (const [chave, valor] of Object.entries(configuracao)) {\n  aplicar(chave, valor);\n}',
      },
    ],
    concept: 'Protocolo de iteracao',
  },

  // ------------------------------------------------------------------ Python
  {
    id: 'py/nonetype-attribute',
    languages: ['python'],
    match: [/attributeerror.*'nonetype'/i, /'nonetype' object has no attribute/i],
    title: "AttributeError em 'NoneType'",
    severity: 'high',
    plain:
      'Voce acessou um atributo ou metodo de um valor `None`. ' +
      'Em Python, uma funcao sem `return` explicito devolve `None` - essa e a origem mais frequente.',
    causes: [
      {
        title: 'Funcao sem return em algum caminho',
        detail:
          'Se o `return` esta dentro de um `if` e a condicao e falsa, a funcao devolve `None` silenciosamente.',
        confidence: 0.35,
      },
      {
        title: 'Metodo que modifica no lugar e devolve None',
        detail:
          '`lista.sort()`, `lista.append()` e `lista.reverse()` alteram a lista e devolvem `None`. ' +
          '`x = lista.sort()` deixa x como None.',
        confidence: 0.3,
      },
      {
        title: 'Busca sem resultado',
        detail: '`dict.get(chave)` e `re.match(...)` devolvem `None` quando nao encontram.',
        confidence: 0.25,
      },
      {
        title: 'Atributo nao inicializado',
        detail: 'Declarado como None no __init__ e nunca preenchido antes do uso.',
        confidence: 0.1,
      },
    ],
    checklist: [
      'No traceback, o ultimo frame mostra a linha do acesso; suba a pilha para achar a origem do None.',
      'Verifique se todos os caminhos da funcao chamada tem `return`.',
      'Confirme se voce atribuiu o resultado de um metodo in-place.',
      'Em buscas, trate o caso "nao encontrado" explicitamente.',
    ],
    fixes: [
      {
        title: 'Separar mutacao de retorno',
        explanation: 'Metodos in-place alteram o objeto; use a funcao equivalente quando quiser um novo valor.',
        code:
          '# devolve None\nordenada = lista.sort()\n\n# devolve nova lista ordenada\nordenada = sorted(lista)\n\n# ou ordene no lugar e use a propria lista\nlista.sort()\nprint(lista)',
      },
      {
        title: 'Tratar ausencia explicitamente',
        explanation: 'Deixe claro o que acontece quando o valor nao existe.',
        code:
          'usuario = banco.buscar(id)\n\nif usuario is None:\n    raise UsuarioNaoEncontrado(f"id {id}")\n\nreturn usuario.nome\n\n# ou com valor padrao\nnome = (banco.buscar(id) or UsuarioAnonimo()).nome',
      },
    ],
    concept: 'None e valores opcionais',
  },
  {
    id: 'py/keyerror',
    languages: ['python'],
    match: [/keyerror/i],
    title: 'KeyError: chave inexistente',
    severity: 'medium',
    plain:
      'A chave pedida nao existe no dicionario. ' +
      'Diferente de `.get()`, o acesso com colchetes exige que a chave exista.',
    causes: [
      {
        title: 'A chave realmente nao vem nos dados',
        detail: 'Campo opcional na API, coluna ausente no CSV, configuracao nao definida.',
        confidence: 0.4,
      },
      {
        title: 'Diferenca de grafia ou caixa',
        detail: '"userId" e "userid" sao chaves distintas.',
        confidence: 0.3,
      },
      {
        title: 'Tipo da chave diferente',
        detail: '`d[1]` e `d["1"]` sao chaves diferentes - comum ao ler JSON.',
        confidence: 0.3,
      },
    ],
    checklist: [
      'Imprima as chaves disponiveis: `print(sorted(d.keys()))`.',
      'Compare grafia, caixa e tipo com o que voce esta pedindo.',
      'Decida: a chave e obrigatoria (erro) ou opcional (padrao)?',
    ],
    fixes: [
      {
        title: 'Usar .get() para chaves opcionais',
        explanation: 'Devolve o padrao em vez de lancar excecao.',
        code:
          "nome = dados.get('nome', 'Sem nome')\n\n# aninhado\ncidade = dados.get('endereco', {}).get('cidade')\n\n# obrigatoria: erro com mensagem util\nif 'email' not in dados:\n    raise ValueError(f\"campo 'email' ausente. Recebido: {list(dados)}\")",
      },
    ],
    concept: 'Dicionarios',
  },
  {
    id: 'py/indexerror',
    languages: ['python'],
    match: [/indexerror/i, /list index out of range/i],
    title: 'IndexError: indice fora do intervalo',
    severity: 'medium',
    plain:
      'Voce pediu uma posicao que nao existe na sequencia. ' +
      'Indices vao de 0 a len-1: uma lista de 3 itens tem indices 0, 1 e 2.',
    causes: [
      {
        title: 'Sequencia vazia',
        detail: 'Acessar `[0]` de uma lista vazia. Resultado de filtro sem correspondencia, ou arquivo sem linhas.',
        confidence: 0.4,
      },
      {
        title: 'Erro de um a mais no laco',
        detail: '`range(len(lista) + 1)` passa uma posicao do fim.',
        confidence: 0.3,
      },
      {
        title: 'Modificar a lista durante a iteracao',
        detail: 'Remover itens enquanto percorre faz os indices se deslocarem sob os pes do laco.',
        confidence: 0.3,
      },
    ],
    checklist: [
      'Imprima `len(sequencia)` imediatamente antes do acesso.',
      'A sequencia pode estar vazia nesse ponto?',
      'Se ha remocao durante o laco, itere sobre uma copia.',
    ],
    fixes: [
      {
        title: 'Iterar direto, sem indices',
        explanation: 'Sem indice manual, nao existe indice invalido.',
        code:
          '# fragil\nfor i in range(len(itens)):\n    print(itens[i])\n\n# idiomatico\nfor item in itens:\n    print(item)\n\n# quando o indice importa\nfor i, item in enumerate(itens):\n    print(i, item)',
      },
      {
        title: 'Verificar antes de acessar',
        explanation: 'Fatiamento nao lanca erro, acesso por indice lanca.',
        code:
          "primeiro = itens[0] if itens else None\n\n# fatiamento e seguro\nprimeiros_tres = itens[:3]  # funciona mesmo com lista menor",
      },
    ],
    concept: 'Indexacao de sequencias',
  },
  {
    id: 'py/indentation',
    languages: ['python'],
    match: [/indentationerror/i, /taberror/i, /unexpected indent/i, /expected an indented block/i],
    title: 'Erro de indentacao',
    severity: 'critical',
    plain:
      'Em Python a indentacao define os blocos - ela e sintaxe, nao estilo. ' +
      'O interpretador encontrou um recuo inconsistente.',
    causes: [
      {
        title: 'Mistura de tabs e espacos',
        detail:
          'Visualmente identicos, diferentes para o interpretador. ' +
          'A causa mais comum quando o codigo "parece certo".',
        confidence: 0.45,
      },
      {
        title: 'Bloco vazio',
        detail: 'Depois de `if`, `for` ou `def` com dois-pontos, e obrigatorio ter um corpo indentado.',
        confidence: 0.3,
      },
      {
        title: 'Recuo inconsistente no mesmo bloco',
        detail: 'Uma linha com 4 espacos e outra com 2 no mesmo nivel.',
        confidence: 0.25,
      },
    ],
    checklist: [
      'Ative a exibicao de caracteres invisiveis no editor.',
      'Converta tudo para espacos (PEP 8 recomenda 4).',
      'Confirme que todo `:` e seguido de um bloco indentado.',
    ],
    fixes: [
      {
        title: 'Padronizar com 4 espacos',
        explanation: 'Configure o editor e converta o arquivo inteiro de uma vez.',
        code:
          '# VS Code: Converter indentacao em espacos\n# Linha de comando:\nautopep8 --in-place --aggressive arquivo.py\n\n# bloco ainda nao implementado precisa de pass\ndef processar():\n    pass',
      },
    ],
    concept: 'Sintaxe significativa por indentacao',
  },
  {
    id: 'py/typeerror-operand',
    languages: ['python'],
    match: [
      /typeerror.*unsupported operand/i,
      /can only concatenate/i,
      /must be str, not/i,
      /not supported between instances/i,
    ],
    title: 'TypeError: operacao entre tipos incompativeis',
    severity: 'medium',
    plain:
      'Python nao converte tipos automaticamente em operacoes aritmeticas ou de concatenacao. ' +
      '`"5" + 5` e erro, nao 10 nem "55".',
    causes: [
      {
        title: 'Entrada lida como texto',
        detail: '`input()` sempre devolve string, mesmo quando o usuario digita numero.',
        confidence: 0.4,
      },
      {
        title: 'Valor de JSON, CSV ou formulario sem conversao',
        detail: 'Esses formatos entregam strings; a conversao e sua responsabilidade.',
        confidence: 0.35,
      },
      {
        title: 'Concatenacao de string com numero',
        detail: 'Para montar texto, converta com f-string ou str().',
        confidence: 0.25,
      },
    ],
    checklist: [
      'Imprima `type(valor)` dos dois operandos.',
      'Converta na entrada, nao no meio do calculo.',
      'Para texto, use f-string: ela converte automaticamente.',
    ],
    fixes: [
      {
        title: 'Converter na fronteira',
        explanation: 'Converta uma vez ao receber o dado e trabalhe com o tipo correto no resto do codigo.',
        code:
          "idade = int(input('Idade: '))      # converte na entrada\npreco = float(dados['preco'])\n\n# texto com f-string\nmensagem = f'Total: {total} reais'\n\n# conversao com validacao\ntry:\n    quantidade = int(entrada)\nexcept ValueError:\n    raise ValueError(f'{entrada!r} nao e um numero inteiro')",
      },
    ],
    concept: 'Tipagem dinamica e forte',
  },
  {
    id: 'py/module-not-found',
    languages: ['python'],
    match: [/modulenotfounderror/i, /importerror/i, /no module named/i],
    title: 'Modulo Python nao encontrado',
    severity: 'high',
    plain:
      'O Python procurou o modulo nos caminhos de `sys.path` e nao achou. ' +
      'Muitas vezes o pacote esta instalado - mas em outro ambiente.',
    causes: [
      {
        title: 'Ambiente virtual nao ativado',
        detail:
          'O pacote foi instalado no venv, mas voce esta rodando o Python global (ou o contrario). ' +
          'E a causa mais comum.',
        confidence: 0.4,
      },
      {
        title: 'Pacote nao instalado',
        detail: 'Falta rodar `pip install -r requirements.txt`.',
        confidence: 0.25,
      },
      {
        title: 'Nome de instalacao diferente do de importacao',
        detail: 'Instala-se `pillow` e importa-se `PIL`; `opencv-python` importa como `cv2`.',
        confidence: 0.2,
      },
      {
        title: 'Falta __init__.py no pacote local',
        detail: 'Em estruturas antigas, a pasta sem __init__.py nao e reconhecida como pacote.',
        confidence: 0.15,
      },
    ],
    checklist: [
      'Rode `python -c "import sys; print(sys.executable)"` e veja QUAL Python esta executando.',
      'Compare com o resultado de `pip -V`: os dois precisam apontar para o mesmo ambiente.',
      'Instale sempre com `python -m pip install ...` para garantir o mesmo interpretador.',
      'Confira o nome de importacao na documentacao do pacote.',
    ],
    fixes: [
      {
        title: 'Alinhar interpretador e pip',
        explanation: 'Usar `python -m pip` elimina a ambiguidade entre ambientes.',
        code:
          '# ativar o ambiente virtual\n# Windows\n.venv\\Scripts\\activate\n# macOS / Linux\nsource .venv/bin/activate\n\n# instalar no interpretador atual\npython -m pip install -r requirements.txt\n\n# conferir\npython -c "import sys; print(sys.executable)"',
      },
    ],
    concept: 'Ambientes virtuais e sys.path',
  },
  {
    id: 'py/unbound-local',
    languages: ['python'],
    match: [/unboundlocalerror/i, /local variable .* referenced before assignment/i],
    title: 'Variavel local usada antes de ser atribuida',
    severity: 'medium',
    plain:
      'Se uma funcao atribui a um nome em qualquer ponto, Python trata esse nome como LOCAL em toda a funcao. ' +
      'Ler antes da atribuicao lanca este erro - mesmo quando existe uma variavel global com o mesmo nome.',
    causes: [
      {
        title: 'Tentativa de modificar variavel global',
        detail: 'Ler funciona; atribuir cria uma variavel local que sombreia a global.',
        confidence: 0.5,
      },
      {
        title: 'Atribuicao apenas dentro de um if',
        detail: 'Se a condicao for falsa, o nome nunca recebe valor e a leitura seguinte falha.',
        confidence: 0.5,
      },
    ],
    checklist: [
      'Existe atribuicao a esse nome em algum ponto da funcao?',
      'Todos os caminhos passam por essa atribuicao?',
      'A intencao era alterar uma variavel de fora?',
    ],
    fixes: [
      {
        title: 'Inicializar antes das condicoes',
        explanation: 'Garantir um valor inicial elimina o caminho sem atribuicao.',
        code:
          "resultado = None  # garante existencia\n\nif condicao:\n    resultado = calcular()\n\nreturn resultado",
      },
      {
        title: 'Receber e devolver em vez de usar global',
        explanation: 'Fluxo de dados explicito e testavel, sem acoplamento invisivel.',
        code:
          '# acoplado\ncontador = 0\ndef incrementar():\n    global contador\n    contador += 1\n\n# explicito\ndef incrementar(contador):\n    return contador + 1\n\ncontador = incrementar(contador)',
      },
    ],
    concept: 'Escopo de funcoes em Python',
  },
  {
    id: 'py/valueerror-int',
    languages: ['python'],
    match: [/invalid literal for int/i, /could not convert string to float/i, /valueerror/i],
    title: 'ValueError na conversao de valor',
    severity: 'medium',
    plain:
      'O tipo do valor e certo (string), mas o conteudo nao representa o numero esperado. ' +
      '`int("abc")`, `int("")` e `int("12.5")` todos falham.',
    causes: [
      {
        title: 'String vazia ou com espacos',
        detail: 'Campo de formulario nao preenchido, ou linha final vazia de arquivo.',
        confidence: 0.35,
      },
      {
        title: 'Formato numerico diferente',
        detail: '`int("12.5")` falha - para decimais, use float. Separador de milhar tambem quebra.',
        confidence: 0.3,
      },
      {
        title: 'Virgula como separador decimal',
        detail: '"3,14" nao converte: Python espera ponto.',
        confidence: 0.2,
      },
      {
        title: 'Caracteres invisiveis',
        detail: 'BOM, \\n ou espacos nao quebraveis vindos de CSV ou copia e cola.',
        confidence: 0.15,
      },
    ],
    checklist: [
      'Imprima o valor com `repr()`: revela espacos e caracteres invisiveis.',
      'Aplique `.strip()` antes de converter.',
      'Para decimais, use float; troque virgula por ponto quando necessario.',
    ],
    fixes: [
      {
        title: 'Conversao defensiva com padrao',
        explanation: 'Centraliza a limpeza e deixa o comportamento explicito.',
        code:
          "def para_inteiro(valor, padrao=0):\n    try:\n        return int(str(valor).strip().replace('.', '').replace(',', ''))\n    except (ValueError, TypeError):\n        return padrao\n\nquantidade = para_inteiro(linha['qtd'])",
      },
    ],
    concept: 'Validacao e conversao de dados',
  },
  {
    id: 'py/zero-division',
    languages: ['python'],
    match: [/zerodivisionerror/i, /division by zero/i],
    title: 'Divisao por zero',
    severity: 'medium',
    plain: 'O divisor chegou em zero. Em medias e percentuais, costuma ser uma colecao vazia.',
    causes: [
      {
        title: 'Media de colecao vazia',
        detail: '`soma / len(itens)` com `itens` vazio.',
        confidence: 0.5,
      },
      {
        title: 'Divisor vindo de dado externo',
        detail: 'Campo ausente, nulo convertido em zero, ou total que ainda nao foi calculado.',
        confidence: 0.5,
      },
    ],
    checklist: [
      'A colecao pode estar vazia nesse ponto?',
      'Qual resultado faz sentido quando nao ha dados: zero, None, ou erro?',
    ],
    fixes: [
      {
        title: 'Tratar o caso vazio explicitamente',
        explanation: 'Decida o significado de "sem dados" em vez de deixar a excecao decidir.',
        code:
          'def media(valores):\n    if not valores:\n        return 0.0  # ou None, dependendo do dominio\n    return sum(valores) / len(valores)',
      },
    ],
    concept: 'Casos de borda',
  },
  {
    id: 'py/recursion',
    languages: ['python'],
    match: [/recursionerror/i, /maximum recursion depth/i],
    title: 'Limite de recursao atingido',
    severity: 'critical',
    plain:
      'Python limita a profundidade de recursao (1000 por padrao) para evitar estouro de pilha. ' +
      'O limite ser atingido quase sempre indica recursao que nao termina.',
    causes: [
      {
        title: 'Caso base nunca alcancado',
        detail: 'O parametro nao converge para a condicao de parada.',
        confidence: 0.6,
      },
      {
        title: 'Profundidade legitimamente grande',
        detail: 'Arvore muito profunda ou lista encadeada longa - caso em que iteracao e melhor.',
        confidence: 0.4,
      },
    ],
    checklist: [
      'Imprima o argumento no inicio de cada chamada: ele caminha para o caso base?',
      'Existe algum caminho que nao reduz o problema?',
      'Se a profundidade e real, reescreva de forma iterativa - nao aumente o limite.',
    ],
    fixes: [
      {
        title: 'Converter para iteracao',
        explanation: 'A versao iterativa usa memoria constante e nao depende da pilha.',
        code:
          '# recursiva: estoura com n grande\ndef soma(n):\n    return 0 if n == 0 else n + soma(n - 1)\n\n# iterativa: sem limite de pilha\ndef soma(n):\n    total = 0\n    for i in range(1, n + 1):\n        total += i\n    return total',
      },
    ],
    concept: 'Recursao x iteracao',
  },
  {
    id: 'py/not-subscriptable',
    languages: ['python'],
    match: [/object is not subscriptable/i, /object does not support item assignment/i],
    title: 'Objeto nao suporta acesso por indice',
    severity: 'medium',
    plain:
      'Voce usou `[...]` em um tipo que nao suporta isso. ' +
      'Com `None`, significa que o valor esperado nunca chegou; com funcao, falta a chamada.',
    causes: [
      {
        title: 'O valor e None',
        detail: 'A funcao que deveria devolver a estrutura devolveu None.',
        confidence: 0.4,
      },
      {
        title: 'Falta chamar a funcao',
        detail: '`minha_funcao[0]` em vez de `minha_funcao()[0]`.',
        confidence: 0.3,
      },
      {
        title: 'Tipo imutavel em atribuicao',
        detail: 'Tuplas e strings nao aceitam `x[0] = valor`.',
        confidence: 0.3,
      },
    ],
    checklist: [
      'Imprima `type(valor)` antes do acesso.',
      'Se for None, investigue a funcao de origem.',
      'Se for tupla ou string, crie um novo valor em vez de atribuir.',
    ],
    fixes: [
      {
        title: 'Converter para tipo mutavel quando precisar alterar',
        explanation: 'Tupla e string sao imutaveis por design.',
        code:
          "t = (1, 2, 3)\n# t[0] = 9  -> TypeError\n\nlista = list(t)\nlista[0] = 9\nt = tuple(lista)\n\n# strings: construa uma nova\ntexto = 'a' + texto[1:]",
      },
    ],
    concept: 'Mutabilidade',
  },

  // ---------------------------------------------------------------- generico
  {
    id: 'generic/null-pointer',
    languages: ['java', 'csharp'],
    match: [/nullpointerexception/i, /nullreferenceexception/i, /object reference not set/i],
    title: 'Referencia nula',
    severity: 'high',
    plain:
      'Voce chamou um metodo ou acessou um campo de uma referencia que aponta para nada. ' +
      'O stack trace indica onde foi USADA; a causa esta onde ela deveria ter sido inicializada.',
    causes: [
      {
        title: 'Campo nunca inicializado',
        detail: 'Objetos recem-criados tem campos de referencia em null por padrao.',
        confidence: 0.35,
      },
      {
        title: 'Metodo que devolve null',
        detail: 'Buscas sem resultado frequentemente devolvem null em vez de lancar excecao.',
        confidence: 0.35,
      },
      {
        title: 'Dependencia nao injetada',
        detail: 'Em frameworks de injecao, um componente nao registrado chega como null.',
        confidence: 0.3,
      },
    ],
    checklist: [
      'Identifique a linha exata e quais referencias ela usa.',
      'Para cada uma, pergunte: onde ela recebe valor? esse caminho sempre executa?',
      'Verifique se a configuracao de injecao de dependencia esta completa.',
    ],
    fixes: [
      {
        title: 'Tornar a ausencia explicita no tipo',
        explanation: 'Optional (Java) e tipos anulaveis (C#) forcam o tratamento em tempo de compilacao.',
        code:
          '// Java\nOptional<Usuario> encontrado = repositorio.buscarPorId(id);\n\nreturn encontrado\n    .map(Usuario::getNome)\n    .orElseThrow(() -> new UsuarioNaoEncontrado(id));\n\n// C# com tipos anulaveis habilitados\nUsuario? usuario = repositorio.BuscarPorId(id);\nreturn usuario?.Nome ?? throw new UsuarioNaoEncontradoException(id);',
      },
    ],
    concept: 'Seguranca contra nulos',
  },
  {
    id: 'http/4xx-5xx',
    languages: ['*'],
    match: [
      /\b(40[0-9]|41[0-9]|42[0-9]|50[0-4])\b.*\b(error|status|request|failed)\b/i,
      /request failed with status code/i,
      /\b(unauthorized|forbidden|not found|internal server error|bad gateway)\b/i,
    ],
    title: 'Erro em requisicao HTTP',
    severity: 'medium',
    plain:
      'A comunicacao funcionou, mas a resposta trouxe um status de erro. ' +
      'A familia 4xx indica problema na requisicao (sua); 5xx indica problema no servidor.',
    causes: [
      {
        title: '401 / 403 - autenticacao ou permissao',
        detail:
          '401 e "nao sei quem voce e" (token ausente, invalido ou expirado). ' +
          '403 e "sei quem voce e, mas voce nao pode" (falta permissao).',
        confidence: 0.3,
      },
      {
        title: '404 - rota ou recurso inexistente',
        detail: 'URL errada, barra sobrando, versao da API diferente, ou o registro nao existe mais.',
        confidence: 0.25,
      },
      {
        title: '400 / 422 - corpo invalido',
        detail: 'Campo obrigatorio ausente, tipo errado, ou Content-Type nao declarado.',
        confidence: 0.25,
      },
      {
        title: '500 / 502 - falha no servidor',
        detail: 'Erro nao tratado no backend, ou servico intermediario indisponivel. Olhe os logs do servidor.',
        confidence: 0.2,
      },
    ],
    checklist: [
      'Leia o CORPO da resposta de erro: APIs costumam explicar o motivo ali.',
      'Confira a URL completa, incluindo versao e barras.',
      'Verifique o cabecalho Authorization e a validade do token.',
      'Confirme Content-Type: application/json quando enviar JSON.',
      'Se for 5xx, o diagnostico esta nos logs do servidor, nao no cliente.',
    ],
    fixes: [
      {
        title: 'Expor o corpo do erro em vez de so o status',
        explanation: 'A mensagem util quase sempre esta no corpo da resposta.',
        code:
          'const resposta = await fetch(url, opcoes);\n\nif (!resposta.ok) {\n  const detalhe = await resposta.text();\n  throw new Error(`${resposta.status} ${resposta.statusText} em ${url}\\n${detalhe}`);\n}\n\nreturn resposta.json();',
      },
    ],
    concept: 'Protocolo HTTP e codigos de status',
  },
  {
    id: 'generic/timeout',
    languages: ['*'],
    match: [/timeout/i, /etimedout/i, /timed out/i, /deadline exceeded/i],
    title: 'Tempo limite excedido',
    severity: 'medium',
    plain:
      'A operacao demorou mais que o limite configurado. ' +
      'Diferente de conexao recusada: aqui ninguem respondeu "nao", simplesmente nao respondeu.',
    causes: [
      {
        title: 'Operacao lenta no destino',
        detail: 'Consulta sem indice, processamento pesado, ou servico sobrecarregado.',
        confidence: 0.35,
      },
      {
        title: 'Limite configurado muito curto',
        detail: 'Padroes de 5 ou 10 segundos nao servem para toda operacao.',
        confidence: 0.25,
      },
      {
        title: 'Bloqueio de rede silencioso',
        detail: 'Firewall que descarta pacotes sem responder produz timeout em vez de recusa.',
        confidence: 0.2,
      },
      {
        title: 'Esgotamento do pool de conexoes',
        detail: 'Conexoes nao devolvidas ao pool fazem as proximas esperarem indefinidamente.',
        confidence: 0.2,
      },
    ],
    checklist: [
      'Meca quanto tempo a operacao realmente leva, isolada.',
      'Teste o destino direto (curl, cliente do banco) para separar rede de aplicacao.',
      'Verifique se conexoes estao sendo liberadas apos o uso.',
    ],
    fixes: [
      {
        title: 'Timeout explicito com cancelamento',
        explanation: 'Falhar rapido e previsivel e melhor que travar o recurso indefinidamente.',
        code:
          'async function buscarComLimite(url, limiteMs = 8000) {\n  const controlador = new AbortController();\n  const timer = setTimeout(() => controlador.abort(), limiteMs);\n\n  try {\n    return await fetch(url, { signal: controlador.signal });\n  } catch (erro) {\n    if (erro.name === "AbortError") {\n      throw new Error(`${url} nao respondeu em ${limiteMs}ms`);\n    }\n    throw erro;\n  } finally {\n    clearTimeout(timer);\n  }\n}',
      },
    ],
    concept: 'Resiliencia e timeouts',
  },
  {
    id: 'generic/permission',
    languages: ['*'],
    match: [/eacces/i, /permission denied/i, /eperm/i, /access is denied/i],
    title: 'Permissao negada',
    severity: 'medium',
    plain: 'O sistema operacional bloqueou a operacao: o usuario do processo nao tem o direito necessario.',
    causes: [
      {
        title: 'Escrita em diretorio protegido',
        detail: 'Instalacao global de pacotes, ou gravacao em pasta do sistema.',
        confidence: 0.35,
      },
      {
        title: 'Porta privilegiada',
        detail: 'Portas abaixo de 1024 exigem privilegio elevado em sistemas Unix.',
        confidence: 0.25,
      },
      {
        title: 'Arquivo em uso ou somente leitura',
        detail: 'No Windows, um arquivo aberto por outro processo nao pode ser substituido.',
        confidence: 0.2,
      },
      {
        title: 'Dono dos arquivos diferente',
        detail: 'Uso anterior de sudo deixou arquivos pertencentes ao root.',
        confidence: 0.2,
      },
    ],
    checklist: [
      'Qual caminho exato a mensagem cita? Quem e o dono dele?',
      'O processo roda com qual usuario?',
      'Evite sudo como solucao: ele costuma piorar o problema de dono.',
    ],
    fixes: [
      {
        title: 'Corrigir a propriedade em vez de elevar privilegio',
        explanation: 'Rodar como root cria arquivos que depois so o root consegue alterar.',
        code:
          '# devolver a pasta ao seu usuario\nsudo chown -R $(whoami) ~/.npm\n\n# usar uma porta nao privilegiada e redirecionar no proxy\nconst porta = process.env.PORT || 3000;',
      },
    ],
    concept: 'Permissoes do sistema de arquivos',
  },
];

/**
 * Encontra as entradas que combinam com o texto do erro.
 * @returns {Array<{entry: object, score: number}>}
 */
export function matchErrorKnowledge(text, language = 'unknown') {
  const subject = String(text || '');
  if (!subject.trim()) return [];

  const results = [];
  for (const entry of errorKnowledge) {
    let score = 0;
    for (const pattern of entry.match) {
      if (pattern.test(subject)) score += 1;
    }
    if (!score) continue;

    // Bonus quando a linguagem detectada confere.
    if (entry.languages.includes(language)) score += 1.5;
    else if (entry.languages.includes('*')) score += 0.5;
    else if (language !== 'unknown') score -= 0.5;

    results.push({ entry, score });
  }

  return results.sort((a, b) => b.score - a.score);
}
