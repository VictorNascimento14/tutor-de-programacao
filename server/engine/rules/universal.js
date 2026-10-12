/**
 * Regras validas para qualquer linguagem.
 * Cada regra pode usar `test` (regex por linha) ou `collect` (analise global).
 */

export const universalRules = [
  {
    id: 'sec/hardcoded-secret',
    title: 'Credencial escrita direto no codigo',
    severity: 'critical',
    category: 'security',
    test: /\b(api[_-]?key|apikey|secret|password|passwd|senha|token|auth[_-]?token|private[_-]?key|client[_-]?secret)\b\s*[:=]\s*["'][^"']{8,}["']/i,
    message: 'Ha um segredo (chave, senha ou token) escrito literalmente no codigo.',
    why:
      'Qualquer pessoa com acesso ao repositorio passa a ter acesso ao sistema. ' +
      'E o historico do Git guarda o segredo para sempre, mesmo que voce apague a linha depois.',
    how:
      'Mova o valor para uma variavel de ambiente e leia-o em tempo de execucao. ' +
      'Adicione o arquivo de ambiente ao .gitignore e rotacione a credencial exposta.',
    concept: 'Gestao de segredos',
    fix: {
      before: 'const apiKey = "sk-live-1234567890abcdef";',
      after: 'const apiKey = process.env.API_KEY;\nif (!apiKey) throw new Error("API_KEY ausente");',
    },
  },
  {
    id: 'sec/private-ip-url',
    title: 'URL ou IP fixo no codigo',
    severity: 'low',
    category: 'maintainability',
    test: /https?:\/\/(localhost|127\.0\.0\.1|\d{1,3}(\.\d{1,3}){3})(:\d+)?/i,
    message: 'Endereco de servidor fixo no codigo.',
    why:
      'Um endereco fixo funciona na sua maquina e quebra em producao. ' +
      'Cada ambiente (dev, staging, prod) precisa apontar para um host diferente.',
    how: 'Extraia a URL base para configuracao por ambiente.',
    concept: 'Configuracao por ambiente',
  },
  {
    id: 'quality/empty-catch',
    title: 'Bloco de tratamento de erro vazio',
    severity: 'high',
    category: 'bug',
    test: /\b(catch|except)\b[^{\n:]*[{:]\s*(\}|pass\b|$)/,
    message: 'O erro e capturado e silenciosamente descartado.',
    why:
      'Engolir o erro faz o bug desaparecer da tela, mas nao do sistema. ' +
      'O programa segue com estado invalido e a falha reaparece depois, longe da causa real. ' +
      'E o tipo de bug que custa horas para rastrear.',
    how:
      'No minimo registre o erro com contexto. Decida de forma explicita: ' +
      'recuperar com um valor padrao, repropagar, ou converter em um erro de dominio.',
    concept: 'Tratamento de erros',
    fix: {
      before: 'try {\n  salvar(dados);\n} catch (e) {}',
      after:
        'try {\n  salvar(dados);\n} catch (erro) {\n  logger.error("falha ao salvar", { id: dados.id, erro });\n  throw new ErroDePersistencia("Nao foi possivel salvar", { cause: erro });\n}',
    },
  },
  {
    id: 'quality/todo-comment',
    title: 'Pendencia marcada no codigo',
    severity: 'info',
    category: 'maintainability',
    test: /\b(TODO|FIXME|HACK|XXX|GAMBIARRA|WORKAROUND)\b/,
    skipComments: false,
    onlyComments: true,
    message: 'Existe uma pendencia anotada neste ponto.',
    why:
      'Comentarios de pendencia envelhecem: viram ruido e ninguem sabe se ainda valem. ' +
      'Pendencia real pertence ao rastreador de tarefas, nao ao codigo.',
    how: 'Resolva agora, ou abra uma tarefa e referencie o identificador dela no comentario.',
    concept: 'Divida tecnica',
  },
  {
    id: 'quality/commented-code',
    title: 'Codigo comentado',
    severity: 'low',
    category: 'maintainability',
    test: /^\s*(\/\/|#)\s*(if|for|while|return|function|def|const|let|var|console\.|print\()/,
    onlyComments: true,
    skipComments: false,
    message: 'Ha codigo desativado por comentario.',
    why:
      'Codigo comentado confunde quem le: funciona? era um teste? pode apagar? ' +
      'O controle de versao ja guarda o historico, voce nao precisa do cadaver no arquivo.',
    how: 'Apague. Se um dia precisar, recupere pelo Git.',
    concept: 'Codigo morto',
  },
  {
    id: 'quality/long-line',
    title: 'Linha muito longa',
    severity: 'info',
    category: 'style',
    collect({ lines, push }) {
      lines.forEach((line, index) => {
        if (line.length > 120) {
          push({ line: index + 1, extra: `${line.length} caracteres` });
        }
      });
    },
    message: 'Linha acima de 120 caracteres.',
    why:
      'Linhas longas forcam rolagem horizontal e escondem o lado direito do codigo, ' +
      'justamente onde costumam estar os detalhes que importam na revisao.',
    how: 'Quebre a expressao, extraia variaveis intermediarias com nomes descritivos.',
    concept: 'Legibilidade',
  },
  {
    id: 'quality/magic-number',
    title: 'Numero magico',
    severity: 'low',
    category: 'maintainability',
    test: /[^\w.$]\d{3,}(?![\w.])/,
    ignoreStrings: true,
    // Ignora constantes nomeadas (o numero ja tem significado) e valores convencionais.
    exclude:
      /^\s*(?:export\s+)?(?:const|let|var|final|static)?\s*[A-Z][A-Z0-9_]{2,}\s*[:=]|\b(port|status|code|http|ms|timeout|version|year|1000|60000|86400|200|201|400|401|403|404|422|500)\b/i,
    message: 'Valor numerico sem nome aparece direto na expressao.',
    why:
      'Daqui a duas semanas ninguem lembra o que 86400 significava. ' +
      'Um nome transforma o numero em intencao e deixa a mudanca em um unico lugar.',
    how: 'Extraia para uma constante nomeada, por exemplo SEGUNDOS_POR_DIA.',
    concept: 'Constantes nomeadas',
    fix: {
      before: 'if (idade > 18 && saldo > 5000) { ... }',
      after:
        'const IDADE_MINIMA = 18;\nconst SALDO_MINIMO_CENTAVOS = 5000;\nif (idade > IDADE_MINIMA && saldo > SALDO_MINIMO_CENTAVOS) { ... }',
    },
  },
  {
    id: 'quality/deep-nesting',
    title: 'Aninhamento profundo',
    severity: 'medium',
    category: 'maintainability',
    collect({ metrics, push }) {
      if (metrics.maxNesting > 4) {
        push({ line: 1, extra: `${metrics.maxNesting} niveis de profundidade` });
      }
    },
    message: 'O codigo chega a mais de 4 niveis de aninhamento.',
    why:
      'Cada nivel e uma condicao que o leitor precisa manter na cabeca ao mesmo tempo. ' +
      'Acima de tres ou quatro, a memoria de trabalho estoura e o bug passa despercebido na revisao.',
    how:
      'Use retorno antecipado (early return) para tratar os casos de borda no inicio, ' +
      'e extraia os blocos internos para funcoes com nomes que digam o que elas fazem.',
    concept: 'Complexidade ciclomatica',
    fix: {
      before:
        'if (usuario) {\n  if (usuario.ativo) {\n    if (usuario.saldo > 0) {\n      processar(usuario);\n    }\n  }\n}',
      after:
        'if (!usuario) return;\nif (!usuario.ativo) return;\nif (usuario.saldo <= 0) return;\n\nprocessar(usuario);',
    },
  },
  {
    id: 'quality/long-function',
    title: 'Funcao longa demais',
    severity: 'medium',
    category: 'maintainability',
    collect({ metrics, push }) {
      for (const fn of metrics.functionList) {
        if (fn.length > 50) {
          push({ line: fn.line, extra: `${fn.name} tem ${fn.length} linhas` });
        }
      }
    },
    message: 'Funcao com mais de 50 linhas.',
    why:
      'Uma funcao longa quase sempre faz mais de uma coisa. ' +
      'Isso dificulta nomear, testar isoladamente e reaproveitar. ' +
      'Quando ela quebra, voce nao sabe qual das cinco responsabilidades falhou.',
    how:
      'Identifique os blocos logicos (validar, transformar, persistir, notificar) ' +
      'e extraia cada um para a sua propria funcao.',
    concept: 'Responsabilidade unica',
  },
  {
    id: 'quality/too-many-params',
    title: 'Muitos parametros',
    severity: 'medium',
    category: 'maintainability',
    collect({ metrics, push }) {
      for (const fn of metrics.functionList) {
        if (fn.params > 5) {
          push({ line: fn.line, extra: `${fn.name} recebe ${fn.params} parametros` });
        }
      }
    },
    message: 'Funcao com mais de 5 parametros.',
    why:
      'Com muitos parametros e facil trocar a ordem na chamada sem o compilador reclamar, ' +
      'e a assinatura deixa de comunicar qualquer coisa.',
    how:
      'Agrupe os parametros relacionados em um objeto de configuracao, ' +
      'ou separe a funcao em operacoes menores.',
    concept: 'Objeto de parametros',
    fix: {
      before: 'function criarUsuario(nome, email, idade, cidade, estado, cep, ativo) { ... }',
      after:
        'function criarUsuario({ nome, email, idade, endereco, ativo }) { ... }\n\n// chamada fica autoexplicativa:\ncriarUsuario({ nome: "Ana", email, idade: 30, endereco, ativo: true });',
    },
  },
  {
    id: 'quality/high-complexity',
    title: 'Complexidade ciclomatica alta',
    severity: 'medium',
    category: 'maintainability',
    collect({ metrics, push }) {
      for (const fn of metrics.functionList) {
        if (fn.complexity > 10) {
          push({ line: fn.line, extra: `${fn.name} com complexidade ${fn.complexity}` });
        }
      }
    },
    message: 'Funcao com muitos caminhos de execucao.',
    why:
      'Complexidade ciclomatica e o numero de caminhos independentes pelo codigo. ' +
      'Ela e exatamente o numero minimo de testes para cobrir a funcao. ' +
      'Complexidade 15 significa 15 cenarios de teste.',
    how: 'Troque cadeias de if/else por tabelas de decisao, polimorfismo ou funcoes guardas.',
    concept: 'Complexidade ciclomatica',
  },
  {
    id: 'quality/duplicated-block',
    title: 'Bloco duplicado',
    severity: 'medium',
    category: 'maintainability',
    collect({ metrics, push }) {
      for (const dup of metrics.duplicatedBlocks.slice(0, 5)) {
        push({ line: dup.line, extra: `repete o bloco da linha ${dup.originalLine}` });
      }
    },
    message: 'Sequencia de linhas repetida no arquivo.',
    why:
      'Codigo duplicado multiplica o custo de cada correcao: voce precisa lembrar de todas as copias. ' +
      'Na pratica, uma delas fica para tras e nasce um bug silencioso.',
    how: 'Extraia o trecho para uma funcao e chame-a nos dois lugares.',
    concept: 'DRY (Dont Repeat Yourself)',
  },
  {
    id: 'quality/missing-comments',
    title: 'Ausencia total de documentacao',
    severity: 'info',
    category: 'maintainability',
    collect({ metrics, push }) {
      if (metrics.sloc > 60 && metrics.comments === 0) {
        push({ line: 1, extra: `${metrics.sloc} linhas sem um unico comentario` });
      }
    },
    message: 'Arquivo relevante sem nenhum comentario.',
    why:
      'Codigo bom se explica sozinho no "como". O que ele nao explica e o "por que": ' +
      'a regra de negocio estranha, o workaround obrigatorio, a decisao de arquitetura.',
    how: 'Documente as decisoes e as regras nao obvias, nao a sintaxe.',
    concept: 'Documentacao de codigo',
  },
];
