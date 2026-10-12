/** Regras para JavaScript, TypeScript e React/JSX. */

const JS = ['javascript', 'typescript', 'jsx'];
const TS = ['typescript', 'jsx'];

export const javascriptRules = [
  // ---------------------------------------------------------------- seguranca
  {
    id: 'js/no-eval',
    title: 'Uso de eval()',
    severity: 'critical',
    category: 'security',
    languages: JS,
    test: /(^|[^.\w])eval\s*\(/,
    message: 'eval() executa qualquer string como codigo.',
    why:
      'Se qualquer parte dessa string vier do usuario, ele passa a executar codigo dentro da sua aplicacao. ' +
      'Alem disso eval impede otimizacoes do motor JavaScript e quebra o escopo lexical.',
    how:
      'Para interpretar dados use JSON.parse. Para acesso dinamico a propriedades use obj[chave]. ' +
      'Para despachar comportamento use um mapa de funcoes.',
    concept: 'Injecao de codigo',
    fix: {
      before: 'const resultado = eval(expressaoDoUsuario);',
      after:
        'const operacoes = {\n  soma: (a, b) => a + b,\n  subtracao: (a, b) => a - b,\n};\n\nconst operacao = operacoes[nomeDaOperacao];\nif (!operacao) throw new Error("Operacao nao suportada");\nconst resultado = operacao(a, b);',
    },
  },
  {
    id: 'js/new-function',
    title: 'Construtor Function com string',
    severity: 'high',
    category: 'security',
    languages: JS,
    test: /new\s+Function\s*\(/,
    message: 'new Function() compila uma string em codigo, igual ao eval.',
    why: 'Mesma superficie de ataque do eval, com a mesma penalidade de performance.',
    how: 'Reescreva usando funcoes de primeira classe.',
    concept: 'Injecao de codigo',
  },
  {
    id: 'js/innerhtml',
    title: 'Atribuicao direta a innerHTML',
    severity: 'high',
    category: 'security',
    languages: JS,
    test: /\.(innerHTML|outerHTML)\s*(\+?)=/,
    message: 'innerHTML interpreta o conteudo como HTML.',
    why:
      'Se o valor contiver algo como <img src=x onerror=...>, o navegador executa esse script. ' +
      'E o vetor classico de XSS: roubo de sessao, acoes em nome do usuario, exfiltracao de dados.',
    how:
      'Use textContent quando for texto. Quando precisar de HTML, construa os elementos com ' +
      'createElement/append ou sanitize com uma biblioteca dedicada.',
    concept: 'XSS (Cross-Site Scripting)',
    fix: {
      before: 'container.innerHTML = `<p>Ola, ${nomeDoUsuario}</p>`;',
      after:
        'const p = document.createElement("p");\np.textContent = `Ola, ${nomeDoUsuario}`;\ncontainer.replaceChildren(p);',
    },
  },
  {
    id: 'js/document-write',
    title: 'Uso de document.write',
    severity: 'high',
    category: 'security',
    languages: JS,
    test: /document\.write(ln)?\s*\(/,
    message: 'document.write reescreve o documento e abre brecha de XSS.',
    why: 'Depois do carregamento da pagina, ele apaga todo o documento. E injeta HTML sem sanitizacao.',
    how: 'Manipule o DOM com createElement e append.',
    concept: 'XSS (Cross-Site Scripting)',
  },
  {
    id: 'js/sql-injection',
    title: 'Possivel SQL injection',
    severity: 'critical',
    category: 'security',
    languages: JS,
    test: /(select|insert\s+into|update|delete\s+from|where)\b[^;'"`]{0,120}(\$\{|"\s*\+\s*|'\s*\+\s*)/i,
    message: 'Consulta SQL montada por concatenacao ou template string.',
    why:
      'Se o valor interpolado vier do usuario, ele pode fechar a string e emendar o proprio SQL: ' +
      "um input como `1 OR 1=1 --` transforma sua consulta em outra coisa. " +
      'Da leitura de tabelas inteiras ate DROP TABLE.',
    how:
      'Use consultas parametrizadas: o driver envia o SQL e os valores separadamente, ' +
      'entao o valor nunca e interpretado como comando.',
    concept: 'SQL Injection',
    fix: {
      before: 'db.query(`SELECT * FROM usuarios WHERE email = \'${email}\'`);',
      after: 'db.query("SELECT * FROM usuarios WHERE email = $1", [email]);',
    },
  },
  {
    id: 'js/insecure-random',
    title: 'Math.random() para valor sensivel',
    severity: 'medium',
    category: 'security',
    languages: JS,
    test: /\b(token|senha|password|secret|id|uuid|otp|code|salt|nonce)\w*\s*=\s*[^;\n]*Math\.random/i,
    message: 'Math.random() nao e criptograficamente seguro.',
    why:
      'Math.random() usa um gerador pseudoaleatorio previsivel: dado um valor, e possivel inferir os proximos. ' +
      'Para token de sessao ou de recuperacao de senha, isso significa que um atacante pode adivinhar.',
    how: 'Use crypto.randomUUID() ou crypto.getRandomValues() para qualquer valor com papel de seguranca.',
    concept: 'Aleatoriedade criptografica',
    fix: {
      before: 'const token = Math.random().toString(36).slice(2);',
      after: 'import { randomBytes } from "node:crypto";\n\nconst token = randomBytes(32).toString("hex");',
    },
  },
  {
    id: 'js/token-in-localstorage',
    title: 'Token em localStorage',
    severity: 'medium',
    category: 'security',
    languages: JS,
    test: /(localStorage|sessionStorage)\.setItem\s*\(\s*["'][^"']*(token|jwt|auth|senha|password|secret)/i,
    message: 'Credencial guardada em localStorage.',
    why:
      'localStorage e acessivel por qualquer script da pagina. ' +
      'Um unico XSS, inclusive vindo de uma dependencia comprometida, le o token e assume a sessao.',
    how: 'Prefira cookie httpOnly + Secure + SameSite, inacessivel ao JavaScript.',
    concept: 'Armazenamento de sessao',
  },

  // ----------------------------------------------------------------- bugs
  {
    id: 'js/loose-equality',
    title: 'Comparacao com == em vez de ===',
    severity: 'medium',
    category: 'bug',
    languages: JS,
    test: /[^=!<>]==[^=]|[^=!]!=[^=]/,
    exclude: /==\s*null|!=\s*null/,
    message: 'Comparacao frouxa aplica conversao implicita de tipos.',
    why:
      'O operador == converte os operandos antes de comparar, e as regras surpreendem: ' +
      '"" == 0 e verdadeiro, "0" == false e verdadeiro, null == 0 e falso. ' +
      'Validacoes passam quando deveriam falhar.',
    how: 'Use === e !==. Para checar nulo ou indefinido de uma vez, `valor == null` e o idioma aceito.',
    concept: 'Coercao de tipos',
    fix: {
      before: 'if (quantidade == 0) {\n  // tambem entra com "" e com false\n}',
      after: 'if (quantidade === 0) {\n  // somente o numero zero\n}',
    },
  },
  {
    id: 'js/parseint-radix',
    title: 'parseInt sem base numerica',
    severity: 'low',
    category: 'bug',
    languages: JS,
    test: /parseInt\s*\(\s*[^,)]+\)/,
    message: 'parseInt chamado sem o segundo argumento.',
    why:
      'Sem a base explicita, a interpretacao depende do formato da string. ' +
      'Historicamente "08" podia ser lido como octal. Deixar implicito e pedir surpresa.',
    how: 'Passe sempre a base: parseInt(valor, 10). Ou use Number(valor) quando aceitar decimais.',
    concept: 'Conversao numerica',
  },
  {
    id: 'js/async-foreach',
    title: 'async dentro de forEach',
    severity: 'high',
    category: 'bug',
    languages: JS,
    test: /\.forEach\s*\(\s*(async\b|async\s*\()/,
    message: 'forEach ignora a Promise devolvida pelo callback.',
    why:
      'forEach nao espera nada: ele dispara todas as chamadas e retorna na hora. ' +
      'O codigo seguinte roda antes das operacoes terminarem, e qualquer erro dentro do callback ' +
      'vira uma rejeicao nao tratada que ninguem captura.',
    how:
      'Use for...of com await para rodar em sequencia, ou Promise.all com map para rodar em paralelo.',
    concept: 'Programacao assincrona',
    fix: {
      before: 'itens.forEach(async (item) => {\n  await salvar(item);\n});\nconsole.log("terminou"); // mentira',
      after:
        '// sequencial (preserva ordem, mais lento)\nfor (const item of itens) {\n  await salvar(item);\n}\n\n// paralelo (mais rapido)\nawait Promise.all(itens.map((item) => salvar(item)));\n\nconsole.log("terminou"); // agora e verdade',
    },
  },
  {
    id: 'js/await-in-loop',
    title: 'await dentro de laco',
    severity: 'low',
    category: 'performance',
    languages: JS,
    test: /\b(for|while)\s*\(.*\)\s*\{?[^\n]*$/,
    requiresFollowing: /await\s+/,
    message: 'Operacao assincrona executada em serie dentro de um laco.',
    why:
      'Cada iteracao espera a anterior terminar. Com 100 itens de 50ms, sao 5 segundos ' +
      'em vez dos 50ms que o paralelismo daria. Em requisicoes de rede independentes isso e desperdicio puro.',
    how:
      'Se as iteracoes nao dependem uma da outra, troque por Promise.all(...map(...)). ' +
      'Mantenha em serie apenas quando houver dependencia real ou limite de taxa.',
    concept: 'Concorrencia',
  },
  {
    id: 'js/promise-without-catch',
    title: 'Promise sem tratamento de erro',
    severity: 'medium',
    category: 'bug',
    languages: JS,
    test: /\.then\s*\(/,
    excludeLine: /\.catch\s*\(/,
    message: 'Cadeia .then() sem .catch() correspondente.',
    why:
      'Uma Promise rejeitada sem catch gera unhandledRejection. ' +
      'No Node moderno isso derruba o processo; no navegador, falha em silencio e o usuario ve a tela travada.',
    how: 'Encadeie .catch(), ou troque para async/await envolvido em try/catch.',
    concept: 'Promises',
  },
  {
    id: 'js/json-parse-unprotected',
    title: 'JSON.parse sem protecao',
    severity: 'medium',
    category: 'bug',
    languages: JS,
    test: /JSON\.parse\s*\(/,
    excludeNearby: /try\s*\{/,
    message: 'JSON.parse lanca excecao com entrada invalida.',
    why:
      'Qualquer string malformada - resposta HTML de erro em vez de JSON, corpo vazio, ' +
      'conteudo truncado - faz JSON.parse lancar SyntaxError e derruba o fluxo.',
    how: 'Envolva em try/catch e decida o valor padrao, ou valide a resposta antes.',
    concept: 'Parsing defensivo',
    fix: {
      before: 'const dados = JSON.parse(resposta);',
      after:
        'function parseSeguro(texto, padrao = null) {\n  try {\n    return JSON.parse(texto);\n  } catch {\n    return padrao;\n  }\n}\n\nconst dados = parseSeguro(resposta, {});',
    },
  },
  {
    id: 'js/settimeout-string',
    title: 'setTimeout com string',
    severity: 'high',
    category: 'security',
    languages: JS,
    test: /set(Timeout|Interval)\s*\(\s*["'`]/,
    message: 'O primeiro argumento e uma string, avaliada como codigo.',
    why: 'Equivale a um eval com atraso: mesma brecha, mesma perda de escopo.',
    how: 'Passe uma funcao: setTimeout(() => minhaFuncao(), 1000).',
    concept: 'Injecao de codigo',
  },
  {
    id: 'js/array-delete',
    title: 'delete em elemento de array',
    severity: 'medium',
    category: 'bug',
    languages: JS,
    test: /\bdelete\s+\w+\s*\[\s*\w+\s*\]/,
    message: 'delete remove o valor mas mantem o espaco no array.',
    why:
      'O comprimento nao muda e sobra um "buraco" (empty slot). ' +
      'Metodos como map e forEach pulam o buraco, mas length mente e o indice seguinte sai do lugar.',
    how: 'Use splice(indice, 1) para remover de fato, ou filter para criar um novo array.',
    concept: 'Mutacao de arrays',
  },
  {
    id: 'js/assign-in-condition',
    title: 'Atribuicao dentro de condicao',
    severity: 'medium',
    category: 'bug',
    languages: JS,
    test: /\bif\s*\(\s*[\w.$[\]]+\s*=\s*[^=]/,
    message: 'Dentro do if ha uma atribuicao (=), nao uma comparacao.',
    why:
      'A condicao sempre avalia o valor atribuido, entao o if quase sempre entra. ' +
      'E um erro de digitacao que o interpretador aceita calado.',
    how: 'Se a intencao era comparar, use ===.',
    concept: 'Operadores',
  },

  // ------------------------------------------------------- boas praticas
  {
    id: 'js/no-var',
    title: 'Declaracao com var',
    severity: 'low',
    category: 'best-practice',
    languages: JS,
    test: /(^|[^\w.$])var\s+\w/,
    message: 'var tem escopo de funcao e sofre hoisting.',
    why:
      'var ignora o escopo de bloco: uma variavel declarada dentro de um if vaza para toda a funcao. ' +
      'Em lacos com callbacks, todas as iteracoes acabam compartilhando a mesma variavel - ' +
      'causa classica de "todos os botoes imprimem o ultimo indice".',
    how: 'Use const por padrao; let somente quando o valor precisa mudar.',
    concept: 'Escopo e hoisting',
    fix: {
      before: 'for (var i = 0; i < 3; i++) {\n  setTimeout(() => console.log(i)); // 3, 3, 3\n}',
      after: 'for (let i = 0; i < 3; i++) {\n  setTimeout(() => console.log(i)); // 0, 1, 2\n}',
    },
  },
  {
    id: 'js/console-left',
    title: 'console.log esquecido',
    severity: 'low',
    category: 'best-practice',
    languages: JS,
    test: /\bconsole\.(log|debug|info|table|dir)\s*\(/,
    message: 'Chamada de console deixada no codigo.',
    why:
      'Em producao isso vaza estado interno no painel do navegador, suja os logs do servidor ' +
      'e, em caminho quente, custa performance.',
    how: 'Remova, ou troque por um logger com niveis que possa ser desligado por ambiente.',
    concept: 'Observabilidade',
  },
  {
    id: 'js/ts-ignore',
    title: 'Erro de tipo silenciado',
    severity: 'medium',
    category: 'best-practice',
    languages: TS,
    test: /@ts-(ignore|nocheck)/,
    skipComments: false,
    onlyComments: true,
    message: '@ts-ignore desliga a verificacao de tipos na linha seguinte.',
    why:
      'Voce desliga exatamente o mecanismo que existe para pegar o erro. ' +
      'O problema continua la, agora invisivel para o compilador e para quem revisa.',
    how:
      'Prefira @ts-expect-error (que falha se o erro desaparecer) e sempre com um comentario ' +
      'explicando o motivo. Melhor ainda: corrija o tipo.',
    concept: 'Sistema de tipos',
  },
  {
    id: 'ts/explicit-any',
    title: 'Tipo any explicito',
    severity: 'low',
    category: 'best-practice',
    languages: TS,
    test: /:\s*any\b|<any>|as\s+any\b/,
    message: 'O tipo any desativa a checagem naquele ponto.',
    why:
      'any se propaga: tudo que toca aquele valor tambem perde a verificacao. ' +
      'Na pratica, um any no lugar errado anula o TypeScript de um modulo inteiro.',
    how: 'Use unknown e estreite o tipo com validacao, ou declare a interface real.',
    concept: 'Sistema de tipos',
  },
  {
    id: 'js/mixed-modules',
    title: 'require e import no mesmo arquivo',
    severity: 'low',
    category: 'best-practice',
    languages: JS,
    collect({ code, push }) {
      const hasRequire = /(^|[^\w.])require\s*\(/m.test(code);
      const hasImport = /^\s*import\s+[^(]/m.test(code);
      if (hasRequire && hasImport) {
        const line = code.split(/\r?\n/).findIndex((l) => /require\s*\(/.test(l)) + 1;
        push({ line: Math.max(1, line) });
      }
    },
    message: 'O arquivo mistura CommonJS (require) e ESM (import).',
    why:
      'Os dois sistemas tem semanticas diferentes de carregamento e de cache. ' +
      'Misturar costuma resultar em "Cannot use import statement outside a module" ou em modulo carregado duas vezes.',
    how: 'Escolha um sistema por projeto. Em ESM use import/export em todos os arquivos.',
    concept: 'Sistemas de modulos',
  },

  // -------------------------------------------------------------- React
  {
    id: 'react/key-index',
    title: 'Indice do array usado como key',
    severity: 'low',
    category: 'bug',
    languages: ['jsx', 'typescript', 'javascript'],
    test: /key\s*=\s*\{\s*(index|i|idx)\s*\}/,
    message: 'A key da lista usa a posicao do item.',
    why:
      'A key diz ao React qual elemento e qual entre renderizacoes. ' +
      'Se a lista for reordenada ou tiver item removido do meio, as posicoes mudam de dono: ' +
      'o estado interno (texto digitado, foco, animacao) vai para a linha errada.',
    how: 'Use um identificador estavel do proprio dado, como item.id.',
    concept: 'Reconciliacao do React',
    fix: {
      before: '{itens.map((item, index) => <Linha key={index} dados={item} />)}',
      after: '{itens.map((item) => <Linha key={item.id} dados={item} />)}',
    },
  },
  {
    id: 'react/effect-no-deps',
    title: 'useEffect sem array de dependencias',
    severity: 'medium',
    category: 'bug',
    languages: ['jsx', 'typescript', 'javascript'],
    test: /useEffect\s*\(\s*(\(\s*\)|async)\s*=>/,
    excludeNearby: /\}\s*,\s*\[/,
    message: 'useEffect aparentemente sem o segundo argumento.',
    why:
      'Sem o array, o efeito roda depois de toda renderizacao. ' +
      'Se o efeito atualiza estado, ele dispara nova renderizacao, que dispara o efeito: laco infinito.',
    how:
      'Declare as dependencias reais. Array vazio para rodar so na montagem; ' +
      'liste os valores que o efeito realmente le quando ele precisa reagir.',
    concept: 'Ciclo de vida de efeitos',
  },
  {
    id: 'react/async-effect',
    title: 'Callback de useEffect declarado como async',
    severity: 'medium',
    category: 'bug',
    languages: ['jsx', 'typescript', 'javascript'],
    test: /useEffect\s*\(\s*async\b/,
    message: 'O callback do useEffect foi declarado async.',
    why:
      'O React espera que o efeito devolva uma funcao de limpeza ou nada. ' +
      'Uma funcao async devolve uma Promise, entao a limpeza nunca acontece - ' +
      'e voce ganha vazamento de memoria e atualizacao de componente desmontado.',
    how: 'Declare uma funcao async por dentro e chame-a; devolva a limpeza normalmente.',
    concept: 'Ciclo de vida de efeitos',
    fix: {
      before: 'useEffect(async () => {\n  const dados = await buscar();\n  setDados(dados);\n}, []);',
      after:
        'useEffect(() => {\n  let ativo = true;\n  const controlador = new AbortController();\n\n  (async () => {\n    const dados = await buscar({ signal: controlador.signal });\n    if (ativo) setDados(dados);\n  })();\n\n  return () => {\n    ativo = false;\n    controlador.abort();\n  };\n}, []);',
    },
  },
  {
    id: 'react/handler-invoked',
    title: 'Handler executado na renderizacao',
    severity: 'high',
    category: 'bug',
    languages: ['jsx', 'typescript', 'javascript'],
    test: /\bon[A-Z]\w*\s*=\s*\{\s*(?!\(|async|function|\s*\w+\s*\})\w+\s*\([^)]*\)\s*\}/,
    message: 'A funcao esta sendo CHAMADA no atributo, nao passada como referencia.',
    why:
      'O `{}` no JSX avalia a expressao durante a renderizacao. ' +
      'Com `onClick={salvar()}`, a funcao roda na hora de renderizar e o que vai para o onClick ' +
      'e o RETORNO dela. Se ela atualiza estado, cada render dispara outro render: ' +
      'e a causa mais comum de "Too many re-renders".',
    how:
      'Passe a referencia: `onClick={salvar}`. Quando precisar de argumentos, ' +
      'envolva em arrow function: `onClick={() => salvar(id)}`.',
    concept: 'Renderizacao e handlers no React',
    fix: {
      before: '<button onClick={concluir(item.id)}>Concluir</button>',
      after: '<button onClick={() => concluir(item.id)}>Concluir</button>',
    },
  },
  {
    id: 'react/state-mutation',
    title: 'Mutacao direta de estado',
    severity: 'high',
    category: 'bug',
    languages: ['jsx', 'typescript', 'javascript'],
    /**
     * Descobre os nomes de estado declarados com useState e procura mutacoes
     * neles. Evita o falso positivo de mutar um array local qualquer.
     */
    collect({ code, lines, push }) {
      const nomesDeEstado = new Set();
      const declaracao = /\b(?:const|let)\s*\[\s*(\w+)\s*,\s*set\w+\s*\]\s*=\s*useState/g;

      for (const match of code.matchAll(declaracao)) {
        nomesDeEstado.add(match[1]);
      }
      if (!nomesDeEstado.size) return;

      const mutadores = /\.(push|pop|splice|shift|unshift|sort|reverse)\s*\(/;

      lines.forEach((linha, indice) => {
        if (/^\s*(\/\/|\/\*|\*)/.test(linha)) return;

        for (const nome of nomesDeEstado) {
          const direta = new RegExp(`\\b${nome}\\s*${mutadores.source}`);
          const porIndice = new RegExp(`\\b${nome}\\s*\\[[^\\]]+\\]\\s*(\\.\\w+\\s*)?=[^=]`);

          if (direta.test(linha) || porIndice.test(linha)) {
            push({ line: indice + 1, extra: `estado "${nome}"` });
            return;
          }
        }
      });
    },
    message: 'O estado foi alterado no lugar, em vez de substituido.',
    why:
      'O React compara referencias para decidir se precisa renderizar. ' +
      'push muda o conteudo sem trocar a referencia, entao a comparacao diz "nada mudou" ' +
      'e a tela nao atualiza - mesmo com o dado correto na memoria.',
    how: 'Crie um novo array: setItens([...itens, novo]), ou use toSorted/toReversed.',
    concept: 'Imutabilidade',
    fix: {
      before: 'itens.push(novo);\nsetItens(itens); // mesma referencia: nao re-renderiza',
      after: 'setItens([...itens, novo]); // nova referencia: re-renderiza',
    },
  },
];
