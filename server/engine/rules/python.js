/** Regras para Python. */

const PY = ['python'];

export const pythonRules = [
  {
    id: 'py/bare-except',
    title: 'except sem tipo de excecao',
    severity: 'high',
    category: 'bug',
    languages: PY,
    test: /^\s*except\s*:/,
    message: 'O except captura absolutamente qualquer excecao.',
    why:
      'Um except nu captura tambem KeyboardInterrupt e SystemExit, ' +
      'entao o programa deixa de responder ao Ctrl+C e resiste ao encerramento. ' +
      'E esconde erros de digitacao: um NameError vira "erro tratado".',
    how: 'Declare as excecoes que voce sabe tratar. Se precisar de um guarda-chuva, use `except Exception`.',
    concept: 'Hierarquia de excecoes',
    fix: {
      before: 'try:\n    processar()\nexcept:\n    pass',
      after:
        'try:\n    processar()\nexcept (ValueError, KeyError) as erro:\n    logger.warning("entrada invalida: %s", erro)\n    raise ErroDeValidacao(str(erro)) from erro',
    },
  },
  {
    id: 'py/except-pass',
    title: 'Excecao capturada e ignorada',
    severity: 'high',
    category: 'bug',
    languages: PY,
    test: /^\s*except\b[^\n:]*:\s*$/,
    requiresFollowing: /^\s*pass\s*$/,
    message: 'O bloco except contem apenas `pass`.',
    why:
      'O erro desaparece sem deixar rastro. Quando o bug aparecer em producao, ' +
      'nao havera log nem stack trace para investigar.',
    how: 'Registre o erro com contexto, mesmo quando decidir seguir adiante.',
    concept: 'Tratamento de erros',
  },
  {
    id: 'py/eval-exec',
    title: 'Uso de eval ou exec',
    severity: 'critical',
    category: 'security',
    languages: PY,
    test: /(^|[^.\w])(eval|exec)\s*\(/,
    message: 'eval/exec executam strings como codigo Python.',
    why:
      'Com entrada do usuario, o atacante executa codigo arbitrario no seu processo: ' +
      'leitura de arquivos, variaveis de ambiente, conexao de saida. E comprometimento total.',
    how: 'Para dados use json.loads; para expressoes literais, ast.literal_eval; para despacho, um dicionario de funcoes.',
    concept: 'Injecao de codigo',
    fix: {
      before: 'resultado = eval(entrada_do_usuario)',
      after: 'import ast\n\nresultado = ast.literal_eval(entrada_do_usuario)  # aceita apenas literais',
    },
  },
  {
    id: 'py/shell-true',
    title: 'subprocess com shell=True',
    severity: 'critical',
    category: 'security',
    languages: PY,
    test: /shell\s*=\s*True/,
    message: 'O comando passa pelo shell do sistema.',
    why:
      'Com shell=True, caracteres como `;`, `|` e `&&` sao interpretados. ' +
      'Um nome de arquivo como `a.txt; rm -rf /` deixa de ser nome e vira dois comandos.',
    how: 'Passe o comando como lista de argumentos e mantenha shell=False (o padrao).',
    concept: 'Injecao de comandos',
    fix: {
      before: 'subprocess.run(f"convert {arquivo} saida.png", shell=True)',
      after: 'subprocess.run(["convert", arquivo, "saida.png"], check=True)',
    },
  },
  {
    id: 'py/os-system',
    title: 'Uso de os.system',
    severity: 'high',
    category: 'security',
    languages: PY,
    test: /os\.(system|popen)\s*\(/,
    message: 'os.system executa a string no shell.',
    why: 'Mesma brecha do shell=True, e sem forma decente de capturar saida e codigo de erro.',
    how: 'Use subprocess.run com lista de argumentos.',
    concept: 'Injecao de comandos',
  },
  {
    id: 'py/pickle',
    title: 'Desserializacao com pickle',
    severity: 'high',
    category: 'security',
    languages: PY,
    test: /pickle\.(load|loads)\s*\(/,
    message: 'pickle executa codigo durante a desserializacao.',
    why:
      'O formato pickle pode conter instrucoes de construcao de objetos. ' +
      'Carregar um pickle de origem nao confiavel equivale a rodar um script que o remetente escreveu.',
    how: 'Para dados externos use JSON. Reserve pickle para arquivos que voce mesmo gerou e controla.',
    concept: 'Desserializacao insegura',
  },
  {
    id: 'py/sql-fstring',
    title: 'SQL montado com f-string',
    severity: 'critical',
    category: 'security',
    languages: PY,
    test: /(execute|executemany)\s*\(\s*f["']|f["'](select|insert|update|delete)\b/i,
    message: 'Consulta SQL interpolada com f-string.',
    why:
      'O valor entra na consulta como texto, nao como parametro. ' +
      'Uma entrada com apostrofo fecha a string e emenda SQL novo.',
    how: 'Use placeholders do driver e passe os valores em tupla.',
    concept: 'SQL Injection',
    fix: {
      before: 'cursor.execute(f"SELECT * FROM usuarios WHERE email = \'{email}\'")',
      after: 'cursor.execute("SELECT * FROM usuarios WHERE email = %s", (email,))',
    },
  },
  {
    id: 'py/mutable-default',
    title: 'Valor padrao mutavel em parametro',
    severity: 'high',
    category: 'bug',
    languages: PY,
    test: /def\s+\w+\s*\([^)]*=\s*(\[\s*\]|\{\s*\}|set\s*\(\s*\))/,
    message: 'O parametro tem lista, dicionario ou set como valor padrao.',
    why:
      'O valor padrao e criado uma unica vez, quando a funcao e definida - nao a cada chamada. ' +
      'Todas as chamadas compartilham o mesmo objeto, entao o que uma adiciona a proxima encontra. ' +
      'E um dos bugs mais confusos de Python justamente porque o codigo parece correto.',
    how: 'Use None como padrao e crie o objeto dentro da funcao.',
    concept: 'Argumentos padrao',
    fix: {
      before:
        'def adicionar(item, lista=[]):\n    lista.append(item)\n    return lista\n\nadicionar(1)  # [1]\nadicionar(2)  # [1, 2] <- surpresa',
      after:
        'def adicionar(item, lista=None):\n    if lista is None:\n        lista = []\n    lista.append(item)\n    return lista\n\nadicionar(1)  # [1]\nadicionar(2)  # [2]',
    },
  },
  {
    id: 'py/compare-none',
    title: 'Comparacao com None usando ==',
    severity: 'low',
    category: 'best-practice',
    languages: PY,
    test: /[!=]=\s*None\b/,
    message: 'Use `is None` em vez de `== None`.',
    why:
      'None e um singleton: existe uma unica instancia. `is` compara identidade e e mais rapido. ' +
      'Alem disso, uma classe pode sobrescrever __eq__ e fazer `== None` mentir.',
    how: 'Troque por `if valor is None` ou `if valor is not None`.',
    concept: 'Identidade x igualdade',
  },
  {
    id: 'py/compare-bool',
    title: 'Comparacao explicita com True/False',
    severity: 'info',
    category: 'style',
    languages: PY,
    test: /[!=]=\s*(True|False)\b/,
    message: 'Comparacao redundante com booleano.',
    why: 'A propria condicao ja avalia a verdade do valor. A comparacao so adiciona ruido.',
    how: 'Escreva `if ativo:` ou `if not ativo:`.',
    concept: 'Idiomatica Python',
  },
  {
    id: 'py/type-equality',
    title: 'Verificacao de tipo com type()',
    severity: 'low',
    category: 'best-practice',
    languages: PY,
    test: /type\s*\([^)]+\)\s*==/,
    message: 'Comparacao direta do resultado de type().',
    why:
      'type() == ignora heranca: uma subclasse legitima e rejeitada. ' +
      'Isso quebra o polimorfismo e deixa o codigo fragil a refatoracao.',
    how: 'Use isinstance(valor, Tipo), que aceita subclasses.',
    concept: 'Polimorfismo',
  },
  {
    id: 'py/wildcard-import',
    title: 'Importacao com asterisco',
    severity: 'medium',
    category: 'best-practice',
    languages: PY,
    test: /^\s*from\s+[\w.]+\s+import\s+\*/,
    message: 'from modulo import * traz todos os nomes publicos.',
    why:
      'Voce perde o rastro da origem de cada nome, e dois modulos podem sobrescrever ' +
      'silenciosamente o mesmo nome. Ferramentas de analise tambem param de detectar nome inexistente.',
    how: 'Importe explicitamente o que usa, ou importe o modulo e use o prefixo.',
    concept: 'Namespaces',
  },
  {
    id: 'py/open-without-with',
    title: 'open() sem gerenciador de contexto',
    severity: 'medium',
    category: 'bug',
    languages: PY,
    test: /(^|[^.\w])open\s*\(/,
    excludeLine: /\bwith\b|=\s*open\s*\([^)]*\)\s*$/,
    excludeNearby: /\bwith\s+open/,
    message: 'Arquivo aberto fora de um bloco `with`.',
    why:
      'Se uma excecao ocorrer antes do close(), o descritor de arquivo fica aberto. ' +
      'Em um servico de longa duracao isso acumula e termina em "too many open files".',
    how: 'Use `with open(...) as f:` - o arquivo fecha mesmo quando ha excecao.',
    concept: 'Gerenciadores de contexto',
    fix: {
      before: "f = open('dados.txt')\nconteudo = f.read()\nf.close()  # nunca executa se read() falhar",
      after: "with open('dados.txt', encoding='utf-8') as f:\n    conteudo = f.read()",
    },
  },
  {
    id: 'py/assert-validation',
    title: 'assert usado para validar entrada',
    severity: 'medium',
    category: 'security',
    languages: PY,
    test: /^\s*assert\s+/,
    message: 'assert pode ser removido pelo interpretador.',
    why:
      'Com a flag -O (otimizacao), o Python descarta todos os asserts. ' +
      'Se a validacao de permissao ou de entrada esta num assert, ela simplesmente deixa de existir em producao.',
    how: 'Reserve assert para invariantes de desenvolvimento. Para validacao real, lance a excecao explicitamente.',
    concept: 'Validacao de entrada',
    fix: {
      before: 'assert usuario.is_admin, "sem permissao"',
      after: 'if not usuario.is_admin:\n    raise PermissionError("sem permissao")',
    },
  },
  {
    id: 'py/print-left',
    title: 'print() de depuracao',
    severity: 'low',
    category: 'best-practice',
    languages: PY,
    test: /^\s*print\s*\(/,
    message: 'Chamada de print deixada no codigo.',
    why:
      'print escreve direto na saida padrao, sem nivel, sem timestamp e sem como desligar. ' +
      'Em producao polui os logs e pode vazar dados sensiveis.',
    how: 'Use o modulo logging, que permite controlar nivel e destino por ambiente.',
    concept: 'Observabilidade',
  },
  {
    id: 'py/insecure-random',
    title: 'random para valor sensivel',
    severity: 'medium',
    category: 'security',
    languages: PY,
    test: /\b(token|senha|password|secret|otp|codigo|salt)\w*\s*=\s*[^\n]*\brandom\./i,
    message: 'O modulo random nao e criptograficamente seguro.',
    why: 'Mersenne Twister e deterministico: observando saidas suficientes, o estado interno pode ser reconstruido.',
    how: 'Use o modulo secrets: secrets.token_urlsafe(32).',
    concept: 'Aleatoriedade criptografica',
  },
  {
    id: 'py/global-statement',
    title: 'Uso de global',
    severity: 'medium',
    category: 'maintainability',
    languages: PY,
    test: /^\s*global\s+\w/,
    message: 'A funcao modifica estado global.',
    why:
      'Estado global cria acoplamento invisivel: a funcao passa a depender de quem rodou antes. ' +
      'Testes ficam dependentes de ordem e o fluxo de dados deixa de ser rastreavel.',
    how: 'Receba o valor por parametro e devolva o resultado, ou encapsule o estado em uma classe.',
    concept: 'Estado compartilhado',
  },
  {
    id: 'py/lambda-assign',
    title: 'lambda atribuido a nome',
    severity: 'info',
    category: 'style',
    languages: PY,
    test: /^\s*\w+\s*=\s*lambda\b/,
    message: 'Uma funcao nomeada foi escrita como lambda.',
    why:
      'A lambda nao recebe nome proprio, entao o stack trace mostra "<lambda>" em vez do nome real. ' +
      'Ela tambem nao aceita docstring nem anotacoes de tipo confortavelmente.',
    how: 'Use `def` para funcoes nomeadas. Reserve lambda para callbacks curtos e inline.',
    concept: 'Idiomatica Python',
  },
];
