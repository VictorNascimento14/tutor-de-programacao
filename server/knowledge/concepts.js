/**
 * Base de conceitos do modo Tutor.
 * Estrutura pensada para ensino: analogia, explicacao em camadas, exemplo,
 * erros comuns e exercicio pratico.
 */

export const concepts = [
  {
    id: 'closures',
    title: 'Closures',
    tags: ['closure', 'fechamento', 'escopo', 'funcao dentro de funcao', 'lexical'],
    level: 'intermediario',
    tldr:
      'Uma closure e uma funcao que lembra o ambiente onde foi criada, ' +
      'mesmo depois que esse ambiente deixou de existir.',
    analogy:
      'Pense em uma mochila. Quando uma funcao e criada dentro de outra, ela guarda na mochila ' +
      'uma referencia as variaveis que estavam por perto. A funcao externa termina, o escopo dela ' +
      'deveria desaparecer - mas a mochila continua com a funcao interna. Enquanto a funcao existir, ' +
      'o conteudo da mochila nao e coletado pelo garbage collector.',
    sections: [
      {
        heading: 'O mecanismo',
        body:
          'Toda funcao em JavaScript carrega uma referencia ao escopo lexical onde foi DEFINIDA - ' +
          'nao onde e chamada. Isso significa que a busca por uma variavel segue a estrutura do codigo ' +
          'escrito, nao o caminho de execucao. Quando a funcao interna sobrevive a externa (porque foi ' +
          'retornada, guardada em uma variavel ou registrada como callback), ela mantem viva a parte do ' +
          'escopo que realmente usa.',
      },
      {
        heading: 'Por que isso importa na pratica',
        body:
          'Closure e o mecanismo por tras de quase tudo que parece magica em JavaScript: ' +
          'estado privado sem classes, memoizacao, debounce e throttle, modulos, hooks do React e ' +
          'funcoes que se configuram (currying). Entender closure e o que separa "sei a sintaxe" de ' +
          '"entendo o que esta acontecendo".',
      },
      {
        heading: 'O custo',
        body:
          'A mochila ocupa memoria. Uma closure que captura um objeto grande mantem esse objeto vivo ' +
          'enquanto ela existir. Listeners de evento que nunca sao removidos, mas capturam o componente ' +
          'inteiro, sao uma fonte classica de vazamento de memoria.',
      },
    ],
    example: {
      language: 'javascript',
      code:
        'function criarContador(inicial = 0) {\n' +
        '  let valor = inicial; // nao existe fora daqui\n' +
        '\n' +
        '  return {\n' +
        '    incrementar: () => (valor += 1),\n' +
        '    ler: () => valor,\n' +
        '  };\n' +
        '}\n' +
        '\n' +
        'const contador = criarContador(10);\n' +
        'contador.incrementar();\n' +
        'console.log(contador.ler()); // 11\n' +
        'console.log(contador.valor); // undefined - inacessivel de fora\n' +
        '\n' +
        '// cada chamada cria um ambiente independente\n' +
        'const outro = criarContador();\n' +
        'console.log(outro.ler()); // 0, nao foi afetado',
    },
    mistakes: [
      {
        title: 'Achar que a closure copia o valor',
        detail:
          'Ela captura a VARIAVEL, nao uma foto do valor. Se a variavel mudar depois, ' +
          'a closure ve o valor novo. Esse e exatamente o motivo do classico laco com `var` ' +
          'imprimir sempre o ultimo indice: as tres closures compartilham a mesma variavel.',
      },
      {
        title: 'Criar closures dentro de laco sem perceber',
        detail:
          'Com `let`, cada iteracao cria um binding novo e cada closure tem o seu. ' +
          'Com `var`, existe uma unica variavel para todas.',
      },
    ],
    exercise:
      'Implemente `umaVezSo(fn)`: devolve uma funcao que executa `fn` apenas na primeira chamada ' +
      'e, nas seguintes, devolve o resultado guardado. Depois implemente `debounce(fn, ms)`. ' +
      'Nos dois casos, o estado precisa viver na closure - sem variavel global.',
    related: ['async-await', 'this-binding', 'memoization'],
  },
  {
    id: 'async-await',
    title: 'async/await e o event loop',
    tags: ['async', 'await', 'promise', 'assincrono', 'event loop', 'callback'],
    level: 'intermediario',
    tldr:
      'async/await e uma forma de escrever codigo assincrono com a aparencia de sincrono. ' +
      'Nada vira sincrono de verdade: o await apenas pausa a FUNCAO, nunca a thread.',
    analogy:
      'Voce pede um cafe e recebe uma senha. Com callbacks, voce entrega ao barista um papel dizendo ' +
      '"quando ficar pronto, faca isto". Com Promise, voce fica com a senha e pode consultar o estado. ' +
      'Com await, voce declara "vou esperar aqui" - e importante: a CAFETERIA continua atendendo outras ' +
      'pessoas enquanto voce espera. Esse e o ponto: uma unica thread, muitos pedidos em andamento.',
    sections: [
      {
        heading: 'Uma thread, nao-bloqueante',
        body:
          'JavaScript executa seu codigo em uma unica thread. Operacoes de entrada e saida (rede, disco, timers) ' +
          'nao sao feitas por ela: sao delegadas ao ambiente (navegador ou libuv, no Node). ' +
          'Quando a operacao termina, o callback entra em uma fila. O event loop pega a proxima tarefa da fila ' +
          'somente quando a pilha de execucao esta vazia. Por isso um laco pesado e sincrono CONGELA a pagina: ' +
          'ele nao devolve o controle ao loop.',
      },
      {
        heading: 'Microtasks x macrotasks',
        body:
          'Promises resolvem em microtasks, que tem prioridade sobre macrotasks (setTimeout, eventos de I/O). ' +
          'A fila de microtasks e drenada por completo entre cada macrotask. ' +
          'Isso explica por que um `Promise.resolve().then(...)` executa antes de um `setTimeout(..., 0)` ' +
          'registrado antes dele.',
      },
      {
        heading: 'O que await faz exatamente',
        body:
          'O await transforma o resto da funcao em uma continuacao agendada como microtask. ' +
          'A funcao devolve o controle imediatamente ao chamador (entregando uma Promise) e retoma depois. ' +
          'Toda funcao `async` devolve Promise, mesmo quando o corpo nao tem nenhum await.',
      },
      {
        heading: 'Sequencial x paralelo',
        body:
          'Esse e o erro de performance mais comum. Dois awaits em sequencia esperam um apos o outro. ' +
          'Se as operacoes sao independentes, dispare as duas primeiro e espere depois, com Promise.all. ' +
          'Use Promise.allSettled quando precisar do resultado de todas, inclusive das que falharam.',
      },
    ],
    example: {
      language: 'javascript',
      code:
        '// SEQUENCIAL: 300ms (100 + 200)\n' +
        'const usuario = await buscarUsuario(id);   // 100ms\n' +
        'const pedidos = await buscarPedidos(id);   // 200ms\n' +
        '\n' +
        '// PARALELO: 200ms (o maior dos dois)\n' +
        'const [usuario, pedidos] = await Promise.all([\n' +
        '  buscarUsuario(id),\n' +
        '  buscarPedidos(id),\n' +
        ']);\n' +
        '\n' +
        '// quando ha dependencia real, sequencial e obrigatorio\n' +
        'const usuario = await buscarUsuario(id);\n' +
        'const empresa = await buscarEmpresa(usuario.empresaId); // precisa do anterior\n' +
        '\n' +
        '// ordem de execucao\n' +
        'console.log("1");\n' +
        'setTimeout(() => console.log("4"), 0);      // macrotask\n' +
        'Promise.resolve().then(() => console.log("3")); // microtask\n' +
        'console.log("2");\n' +
        '// saida: 1, 2, 3, 4',
    },
    mistakes: [
      {
        title: 'await dentro de forEach',
        detail:
          'forEach descarta o retorno do callback, entao nao ha o que esperar. ' +
          'Use for...of (sequencial) ou Promise.all com map (paralelo).',
      },
      {
        title: 'Esquecer o await e tratar a Promise como valor',
        detail:
          'Sem await voce recebe o objeto Promise. `if (minhaPromise)` e sempre verdadeiro, ' +
          'e `promise.length` e undefined - sem nenhum erro aparente.',
      },
      {
        title: 'Serializar operacoes independentes',
        detail: 'Varios awaits em sequencia quando nenhum depende do anterior desperdicam tempo total.',
      },
    ],
    exercise:
      'Escreva `buscarComRetry(url, tentativas)` que tenta a requisicao com espera exponencial ' +
      '(100ms, 200ms, 400ms...) e devolve o resultado ou lanca o ultimo erro. ' +
      'Depois escreva `limitarConcorrencia(tarefas, limite)` que executa no maximo N por vez.',
    related: ['closures', 'promises', 'concurrency'],
  },
  {
    id: 'big-o',
    title: 'Complexidade de algoritmos (Big-O)',
    tags: ['big-o', 'complexidade', 'performance', 'algoritmo', 'otimizacao', 'notacao assintotica'],
    level: 'intermediario',
    tldr:
      'Big-O descreve como o tempo (ou memoria) de um algoritmo CRESCE conforme a entrada cresce. ' +
      'Nao mede velocidade absoluta - mede escalabilidade.',
    analogy:
      'Procurar um nome em uma lista telefonica. Lendo pagina por pagina, dobrar o numero de nomes ' +
      'dobra o trabalho: O(n). Abrindo no meio e descartando metade a cada passo, dobrar os nomes ' +
      'adiciona UM passo: O(log n). Com 1 milhao de nomes, a diferenca e 1.000.000 de passos contra 20.',
    sections: [
      {
        heading: 'As classes que aparecem no dia a dia',
        body:
          'O(1) constante - acesso a indice de array, leitura de chave em Map. ' +
          'O(log n) logaritmica - busca binaria, operacoes em arvore balanceada. ' +
          'O(n) linear - percorrer uma colecao uma vez. ' +
          'O(n log n) - ordenacao eficiente (e o melhor possivel para ordenacao por comparacao). ' +
          'O(n^2) quadratica - laco dentro de laco sobre a mesma colecao. ' +
          'O(2^n) exponencial - recursao que ramifica sem memoizacao.',
      },
      {
        heading: 'A regra pratica mais util',
        body:
          'Laco aninhado sobre a mesma colecao e O(n^2) e quase sempre pode virar O(n) com um Map ou Set. ' +
          'Esse e o truque que resolve a maioria dos problemas reais de performance: ' +
          'troque busca repetida por indexacao previa.',
      },
      {
        heading: 'O que o Big-O esconde',
        body:
          'Constantes sao descartadas, e elas importam para n pequeno: um O(n^2) com operacoes baratas ' +
          'pode ganhar de um O(n log n) com overhead alto quando n e 20. ' +
          'Big-O tambem ignora cache, localidade de memoria e custo de alocacao. ' +
          'Use-o para escolher a abordagem; use medicao para decidir otimizacao fina.',
      },
    ],
    example: {
      language: 'javascript',
      code:
        '// O(n^2): para cada pedido, percorre todos os usuarios\n' +
        'function juntar(pedidos, usuarios) {\n' +
        '  return pedidos.map((pedido) => ({\n' +
        '    ...pedido,\n' +
        '    usuario: usuarios.find((u) => u.id === pedido.usuarioId),\n' +
        '  }));\n' +
        '}\n' +
        '// 10.000 pedidos x 10.000 usuarios = 100.000.000 comparacoes\n' +
        '\n' +
        '// O(n): indexa uma vez, depois consulta em tempo constante\n' +
        'function juntar(pedidos, usuarios) {\n' +
        '  const porId = new Map(usuarios.map((u) => [u.id, u]));\n' +
        '\n' +
        '  return pedidos.map((pedido) => ({\n' +
        '    ...pedido,\n' +
        '    usuario: porId.get(pedido.usuarioId),\n' +
        '  }));\n' +
        '}\n' +
        '// 10.000 + 10.000 = 20.000 operacoes',
    },
    mistakes: [
      {
        title: 'Otimizar antes de medir',
        detail:
          'O gargalo quase nunca esta onde a intuicao aponta. Meca primeiro: ' +
          'um O(n^2) que roda sobre 50 itens nao e o seu problema.',
      },
      {
        title: 'Ignorar a complexidade de espaco',
        detail:
          'Indexar com Map troca tempo por memoria. Para colecoes gigantes, ' +
          'essa troca pode nao caber.',
      },
      {
        title: 'Esquecer o custo de metodos de biblioteca',
        detail:
          '`includes` em array e O(n). Dentro de um laco, voce acabou de escrever um O(n^2) ' +
          'sem ver nenhum laco aninhado no codigo.',
      },
    ],
    exercise:
      'Dado um array com um milhao de numeros, encontre o primeiro valor repetido. ' +
      'Escreva a versao O(n^2) com lacos aninhados e a versao O(n) com Set. ' +
      'Meca as duas com console.time e compare.',
    related: ['data-structures', 'memoization'],
  },
  {
    id: 'solid',
    title: 'Principios SOLID',
    tags: ['solid', 'srp', 'ocp', 'lsp', 'isp', 'dip', 'orientacao a objetos', 'design'],
    level: 'avancado',
    tldr:
      'Cinco principios para reduzir o custo de MUDAR o codigo. ' +
      'Todos atacam o mesmo problema: acoplamento que faz uma alteracao exigir dez outras.',
    analogy:
      'Pense em uma tomada eletrica. Voce troca o abajur sem reformar a parede porque a interface ' +
      '(a tomada) e estavel e o abajur depende dela, nao do contrario. ' +
      'SOLID e o conjunto de regras para que seu codigo tenha tomadas em vez de fios soldados.',
    sections: [
      {
        heading: 'S - Responsabilidade unica',
        body:
          'Uma classe deve ter um unico motivo para mudar. A versao util do principio nao e ' +
          '"faz so uma coisa", e sim "responde a um unico stakeholder". ' +
          'Uma classe que formata relatorio E calcula imposto muda quando o design muda E quando a lei muda - ' +
          'dois motivos, duas classes.',
      },
      {
        heading: 'O - Aberto/fechado',
        body:
          'Deve ser possivel adicionar comportamento sem editar o codigo existente. ' +
          'Na pratica: quando toda forma de pagamento nova exige mais um `case` no mesmo switch, ' +
          'esse switch e o ponto a inverter - troque-o por um registro de implementacoes.',
      },
      {
        heading: 'L - Substituicao de Liskov',
        body:
          'Uma subclasse deve poder substituir a superclasse sem quebrar quem a usa. ' +
          'O exemplo classico: Quadrado herdando de Retangulo quebra quem espera ' +
          'definir largura e altura de forma independente. Se a subclasse precisa lancar excecao ' +
          'em um metodo herdado, a heranca esta errada.',
      },
      {
        heading: 'I - Segregacao de interfaces',
        body:
          'Melhor varias interfaces pequenas que uma grande. ' +
          'Uma interface com 15 metodos forca cada implementacao a lidar com os 15 - ' +
          'e aparecem metodos vazios ou que lancam "nao suportado".',
      },
      {
        heading: 'D - Inversao de dependencia',
        body:
          'O que importa nao deve depender do que e detalhe. ' +
          'A regra de negocio define a interface que precisa (um Port); o banco de dados, ' +
          'o servico de email e a fila implementam essa interface (Adapters). ' +
          'Assim trocar Postgres por MongoDB nao toca na regra de negocio - e os testes dispensam infraestrutura.',
      },
    ],
    example: {
      language: 'javascript',
      code:
        '// ANTES: o caso de uso conhece a implementacao concreta\n' +
        'import { PostgresClient } from "./postgres.js";\n' +
        'import { SendGrid } from "./sendgrid.js";\n' +
        '\n' +
        'class CriarPedido {\n' +
        '  async executar(dados) {\n' +
        '    const db = new PostgresClient(process.env.DATABASE_URL);\n' +
        '    await db.query("INSERT INTO pedidos ...");\n' +
        '    await new SendGrid().enviar(dados.email, "Pedido criado");\n' +
        '  }\n' +
        '}\n' +
        '// Para testar: precisa de banco de verdade e manda email de verdade.\n' +
        '\n' +
        '// DEPOIS: o caso de uso declara o que precisa\n' +
        'class CriarPedido {\n' +
        '  constructor({ pedidos, notificador }) {\n' +
        '    this.pedidos = pedidos;        // interface: salvar(pedido)\n' +
        '    this.notificador = notificador; // interface: enviar(destino, msg)\n' +
        '  }\n' +
        '\n' +
        '  async executar(dados) {\n' +
        '    const pedido = await this.pedidos.salvar(dados);\n' +
        '    await this.notificador.enviar(dados.email, "Pedido criado");\n' +
        '    return pedido;\n' +
        '  }\n' +
        '}\n' +
        '\n' +
        '// em producao\nnew CriarPedido({ pedidos: new PedidosPostgres(db), notificador: new EmailSendGrid() });\n' +
        '\n' +
        '// no teste: nada de infraestrutura\n' +
        'new CriarPedido({\n' +
        '  pedidos: { salvar: async (p) => ({ ...p, id: 1 }) },\n' +
        '  notificador: { enviar: async () => {} },\n' +
        '});',
    },
    mistakes: [
      {
        title: 'Aplicar SOLID em tudo, desde o inicio',
        detail:
          'Abstracao tem custo: mais arquivos, mais indirecao, mais dificuldade de seguir o fluxo. ' +
          'Introduza a abstracao quando a segunda implementacao aparecer, nao antes de ela existir.',
      },
      {
        title: 'Confundir interface com arquivo de interface',
        detail:
          'Criar uma interface usada por uma unica classe nao inverte nada - ' +
          'e indirecao sem beneficio. A inversao so vale quando ha troca real ou teste.',
      },
    ],
    exercise:
      'Pegue uma funcao sua que acessa banco, chama API e aplica regra de negocio. ' +
      'Separe em tres: a regra pura (sem I/O), e dois adaptadores. ' +
      'Escreva um teste da regra sem nenhum mock de framework.',
    related: ['dependency-injection', 'clean-architecture', 'testing'],
  },
  {
    id: 'immutability',
    title: 'Imutabilidade',
    tags: ['imutabilidade', 'imutavel', 'mutacao', 'spread', 'referencia', 'estado'],
    level: 'intermediario',
    tldr:
      'Em vez de alterar um valor existente, crie um novo com a mudanca aplicada. ' +
      'Isso elimina uma classe inteira de bugs: alteracao a distancia.',
    analogy:
      'Editar um documento compartilhado versus enviar uma nova versao. ' +
      'No primeiro caso, quem estava lendo ve o texto mudar sob os olhos. ' +
      'No segundo, cada um tem uma versao estavel e voce sabe exatamente o que mudou entre elas.',
    sections: [
      {
        heading: 'O problema que ela resolve',
        body:
          'Objetos e arrays sao passados por referencia. Quando voce passa um array para uma funcao ' +
          'e ela faz push, o array de QUEM CHAMOU muda. O bug aparece longe da causa, ' +
          'em um lugar que nao tem nenhuma linha de codigo suspeita.',
      },
      {
        heading: 'Por que frameworks dependem disso',
        body:
          'React, Vue e Redux detectam mudanca comparando referencias (`anterior !== atual`), ' +
          'porque comparar conteudo profundo seria caro. ' +
          'Se voce mutar o objeto, a referencia continua a mesma e a conclusao e "nada mudou": ' +
          'o dado esta correto na memoria e a tela nao atualiza.',
      },
      {
        heading: 'Raso x profundo',
        body:
          'Spread e Object.assign copiam apenas o primeiro nivel. ' +
          'Objetos aninhados continuam compartilhados, entao mutar `copia.endereco.cidade` ' +
          'tambem muda o original. Para estruturas profundas use structuredClone, ' +
          'atualizacao nivel a nivel, ou uma biblioteca como Immer.',
      },
      {
        heading: 'O custo',
        body:
          'Copiar aloca memoria e gera pressao no garbage collector. ' +
          'Em laco quente com arrays grandes, imutabilidade ingenua custa caro. ' +
          'Nesses casos, mutacao LOCAL (dentro de uma funcao, sobre um valor que ninguem mais ve) ' +
          'e perfeitamente legitima.',
      },
    ],
    example: {
      language: 'javascript',
      code:
        '// MUTACAO: efeito colateral a distancia\n' +
        'function adicionarTaxa(itens) {\n' +
        '  itens.push({ nome: "taxa", valor: 10 }); // altera o array do chamador\n' +
        '  return itens;\n' +
        '}\n' +
        '\n' +
        'const meusItens = [{ nome: "livro", valor: 50 }];\n' +
        'const comTaxa = adicionarTaxa(meusItens);\n' +
        'console.log(meusItens.length); // 2 - surpresa!\n' +
        '\n' +
        '// IMUTAVEL: a entrada permanece intacta\n' +
        'function adicionarTaxa(itens) {\n' +
        '  return [...itens, { nome: "taxa", valor: 10 }];\n' +
        '}\n' +
        '\n' +
        '// operacoes imutaveis comuns\n' +
        'const adicionado = [...lista, novo];\n' +
        'const removido = lista.filter((i) => i.id !== id);\n' +
        'const atualizado = lista.map((i) => (i.id === id ? { ...i, visto: true } : i));\n' +
        'const ordenado = lista.toSorted((a, b) => a.valor - b.valor); // nao muta\n' +
        '\n' +
        '// aninhado: cada nivel precisa de uma copia nova\n' +
        'const novoEstado = {\n' +
        '  ...estado,\n' +
        '  usuario: {\n' +
        '    ...estado.usuario,\n' +
        '    endereco: { ...estado.usuario.endereco, cidade: "Recife" },\n' +
        '  },\n' +
        '};',
    },
    mistakes: [
      {
        title: 'Achar que spread faz copia profunda',
        detail:
          'Ele copia um nivel. Objetos internos continuam compartilhados com o original, ' +
          'e mutar um deles afeta os dois.',
      },
      {
        title: 'Esquecer que sort e reverse mutam',
        detail:
          '`array.sort()` ordena no lugar E devolve o mesmo array. ' +
          'Use `toSorted()`/`toReversed()`, ou copie antes: `[...array].sort()`.',
      },
      {
        title: 'Confundir const com imutavel',
        detail:
          '`const` impede trocar a referencia, nao alterar o conteudo. ' +
          '`const lista = []` permite `lista.push(1)`. Para congelar, use Object.freeze.',
      },
    ],
    exercise:
      'Implemente `atualizarEm(objeto, caminho, valor)` que devolve um NOVO objeto com o valor ' +
      'alterado no caminho informado (ex: "usuario.endereco.cidade"), sem mutar nada do original. ' +
      'Teste que o objeto de entrada permanece identico.',
    related: ['pure-functions', 'react-state', 'data-structures'],
  },
  {
    id: 'pure-functions',
    title: 'Funcoes puras e efeitos colaterais',
    tags: ['funcao pura', 'pura', 'efeito colateral', 'side effect', 'funcional', 'determinismo'],
    level: 'iniciante',
    tldr:
      'Uma funcao pura devolve sempre o mesmo resultado para a mesma entrada e nao altera nada fora dela. ' +
      'Previsivel, testavel e segura para reaproveitar.',
    analogy:
      'Uma calculadora e pura: 2 + 2 e sempre 4, e usar a calculadora nao muda nada no mundo. ' +
      'Uma impressora nao e pura: o resultado depende de ter papel e tinta, ' +
      'e usar a impressora altera o estado do mundo (consome papel).',
    sections: [
      {
        heading: 'As duas regras',
        body:
          'Primeira: o retorno depende apenas dos argumentos - nada de ler data atual, aleatorio, ' +
          'variavel global ou banco. Segunda: nada fora da funcao muda - nada de alterar o argumento ' +
          'recebido, escrever em arquivo, chamar API ou tocar no DOM.',
      },
      {
        heading: 'Por que isso compensa',
        body:
          'Funcao pura e trivial de testar: chama com uma entrada, compara a saida. Sem mock, sem setup, ' +
          'sem banco. Tambem e segura para memoizar (mesma entrada, mesma saida) e para rodar em paralelo. ' +
          'E, quando um bug aparece, voce sabe que a causa esta nos argumentos.',
      },
      {
        heading: 'Efeitos sao necessarios - a questao e onde',
        body:
          'Um programa sem efeito nenhum nao faz nada util. ' +
          'A estrategia e concentrar os efeitos nas BORDAS (controllers, repositorios, adaptadores) ' +
          'e manter o nucleo de regras de negocio puro. ' +
          'E a mesma ideia que sustenta Clean Architecture e Hexagonal.',
      },
    ],
    example: {
      language: 'javascript',
      code:
        '// IMPURA: depende de fora, altera de fora, e nao testavel sem contexto\n' +
        'let desconto = 0;\n' +
        '\n' +
        'function calcularTotal(carrinho) {\n' +
        '  desconto = carrinho.length > 3 ? 0.1 : 0;        // muda estado externo\n' +
        '  const hoje = new Date();                          // depende do relogio\n' +
        '  if (hoje.getDay() === 3) desconto += 0.05;        // resultado muda por dia\n' +
        '\n' +
        '  const total = carrinho.reduce((s, i) => s + i.preco, 0);\n' +
        '  console.log("total:", total);                     // efeito de I/O\n' +
        '  return total * (1 - desconto);\n' +
        '}\n' +
        '\n' +
        '// PURA: tudo que influencia o resultado entra por parametro\n' +
        'function calcularDesconto({ quantidadeItens, diaDaSemana }) {\n' +
        '  let desconto = quantidadeItens > 3 ? 0.1 : 0;\n' +
        '  if (diaDaSemana === 3) desconto += 0.05;\n' +
        '  return desconto;\n' +
        '}\n' +
        '\n' +
        'function calcularTotal(carrinho, desconto) {\n' +
        '  const subtotal = carrinho.reduce((s, i) => s + i.preco, 0);\n' +
        '  return subtotal * (1 - desconto);\n' +
        '}\n' +
        '\n' +
        '// o efeito fica na borda, onde e explicito\n' +
        'const desconto = calcularDesconto({\n' +
        '  quantidadeItens: carrinho.length,\n' +
        '  diaDaSemana: new Date().getDay(),\n' +
        '});\n' +
        'const total = calcularTotal(carrinho, desconto);\n' +
        'logger.info("total calculado", { total });\n' +
        '\n' +
        '// teste sem nenhum mock\n' +
        'expect(calcularDesconto({ quantidadeItens: 4, diaDaSemana: 3 })).toBe(0.15);',
    },
    mistakes: [
      {
        title: 'Mutar o argumento recebido',
        detail:
          'Parece inofensivo, mas quebra a pureza e cria efeito a distancia: ' +
          'quem chamou a funcao tem o dado alterado sem saber.',
      },
      {
        title: 'Esconder dependencia de tempo ou aleatorio',
        detail:
          '`new Date()` e `Math.random()` dentro da funcao tornam o teste nao deterministico. ' +
          'Receba-os como parametro.',
      },
    ],
    exercise:
      'Pegue uma funcao sua que le configuracao global, consulta data atual e grava log. ' +
      'Separe em: uma funcao pura com toda a regra, e um invocador que injeta os valores e faz o log. ' +
      'Escreva tres testes da parte pura sem nenhum mock.',
    related: ['immutability', 'solid', 'testing'],
  },
  {
    id: 'testing',
    title: 'Testes automatizados',
    tags: ['teste', 'testes', 'tdd', 'unitario', 'integracao', 'mock', 'cobertura', 'jest', 'vitest'],
    level: 'intermediario',
    tldr:
      'Teste e codigo que verifica codigo. O valor principal nao e achar bug hoje: ' +
      'e permitir que voce ALTERE o sistema amanha sem medo.',
    analogy:
      'Teste e o cinto de seguranca de uma refatoracao. Sem ele, mexer em codigo que funciona ' +
      'e aposta. Com ele, voce muda a estrutura por dentro e a suite diz na hora se o comportamento mudou.',
    sections: [
      {
        heading: 'A piramide (e quando inverte-la)',
        body:
          'Muitos testes unitarios (rapidos, isolados, precisos), alguns de integracao ' +
          '(verificam as conexoes reais entre partes), poucos de ponta a ponta ' +
          '(lentos e fragis, mas os unicos que provam que o sistema inteiro funciona). ' +
          'A proporcao depende do sistema: um CRUD fino ganha mais com integracao que com unitario de getter.',
      },
      {
        heading: 'A estrutura de todo teste',
        body:
          'Arrange (prepare o cenario), Act (execute a acao), Assert (verifique o resultado). ' +
          'Um teste verifica UM comportamento. Quando ele falha, o nome deve ser suficiente ' +
          'para voce saber o que quebrou - sem abrir o codigo.',
      },
      {
        heading: 'Teste comportamento, nao implementacao',
        body:
          'Se renomear um metodo privado quebra dez testes, eles estao acoplados a implementacao - ' +
          'e isso e o oposto do objetivo. Teste pela interface publica: ' +
          'dado esta entrada, espero esta saida ou este efeito observavel.',
      },
      {
        heading: 'Cobertura e uma metrica traicoeira',
        body:
          '100% de cobertura significa que toda linha executou, nao que o comportamento esta correto: ' +
          'um teste sem assert nenhum da cobertura cheia. ' +
          'Use cobertura para achar areas esquecidas, nunca como meta.',
      },
      {
        heading: 'TDD em uma frase',
        body:
          'Escreva o teste que falha, faca passar da forma mais simples, refatore. ' +
          'O ganho real do TDD nao e o teste: e que escrever o teste primeiro forca voce ' +
          'a projetar a interface do ponto de vista de quem a usa.',
      },
    ],
    example: {
      language: 'javascript',
      code:
        '// a funcao sob teste\n' +
        'export function calcularFrete({ pesoKg, distanciaKm, ehPremium }) {\n' +
        '  if (pesoKg <= 0) throw new RangeError("peso deve ser positivo");\n' +
        '  if (ehPremium) return 0;\n' +
        '\n' +
        '  const base = 10;\n' +
        '  return base + pesoKg * 1.5 + distanciaKm * 0.2;\n' +
        '}\n' +
        '\n' +
        '// testes: cada um verifica UM comportamento\n' +
        'describe("calcularFrete", () => {\n' +
        '  it("isenta frete para cliente premium", () => {\n' +
        '    const frete = calcularFrete({ pesoKg: 10, distanciaKm: 500, ehPremium: true });\n' +
        '    expect(frete).toBe(0);\n' +
        '  });\n' +
        '\n' +
        '  it("soma base, peso e distancia para cliente comum", () => {\n' +
        '    const frete = calcularFrete({ pesoKg: 2, distanciaKm: 100, ehPremium: false });\n' +
        '    expect(frete).toBe(33); // 10 + 3 + 20\n' +
        '  });\n' +
        '\n' +
        '  it("rejeita peso invalido", () => {\n' +
        '    expect(() => calcularFrete({ pesoKg: 0, distanciaKm: 10 })).toThrow(RangeError);\n' +
        '  });\n' +
        '});',
    },
    mistakes: [
      {
        title: 'Testar o framework em vez do seu codigo',
        detail:
          'Verificar que o ORM salva, ou que o React renderiza uma div, testa a biblioteca. ' +
          'Teste a SUA regra de negocio.',
      },
      {
        title: 'Mockar demais',
        detail:
          'Quando tudo e mock, o teste prova apenas que os mocks funcionam. ' +
          'Mock e para o que e lento, instavel ou tem efeito real (rede, email, pagamento).',
      },
      {
        title: 'Testes que dependem de ordem ou de estado compartilhado',
        detail:
          'Cada teste precisa montar e limpar o proprio cenario. ' +
          'Suite que falha somente quando roda em paralelo tem acoplamento escondido.',
      },
    ],
    exercise:
      'Escolha uma funcao sua com pelo menos um if. Escreva um teste para cada caminho, ' +
      'incluindo os casos de borda (vazio, zero, negativo, nulo). ' +
      'Depois refatore a funcao sem alterar os testes - eles devem continuar passando.',
    related: ['pure-functions', 'solid', 'tdd'],
  },
  {
    id: 'race-condition',
    title: 'Condicoes de corrida',
    tags: ['race condition', 'corrida', 'concorrencia', 'paralelo', 'deadlock', 'atomico', 'lock'],
    level: 'avancado',
    tldr:
      'Uma condicao de corrida acontece quando o resultado depende da ORDEM em que operacoes ' +
      'concorrentes terminam - e essa ordem nao e garantida.',
    analogy:
      'Duas pessoas olham o saldo da conta (R$ 100) ao mesmo tempo e cada uma saca R$ 80. ' +
      'As duas verificam "tem saldo?" antes de qualquer saque acontecer, as duas recebem sim, ' +
      'e a conta fica em -60. O intervalo entre VERIFICAR e AGIR e onde o bug mora.',
    sections: [
      {
        heading: 'O padrao check-then-act',
        body:
          'Quase toda condicao de corrida tem a mesma forma: ler um estado, decidir com base nele, ' +
          'e agir. Se outra execucao alterar o estado entre a leitura e a acao, a decisao fica obsoleta. ' +
          'A solucao e tornar a sequencia atomica - indivisivel.',
      },
      {
        heading: 'Elas existem mesmo em JavaScript',
        body:
          'JavaScript e single-thread, mas isso nao imuniza: entre dois awaits, outro codigo roda. ' +
          'Dois cliques rapidos disparam duas requisicoes; a resposta da primeira pode chegar DEPOIS ' +
          'da segunda e sobrescrever o estado mais novo com dado velho.',
      },
      {
        heading: 'Estrategias de solucao',
        body:
          'No banco: transacao com nivel de isolamento adequado, atualizacao condicional ' +
          '(`UPDATE ... WHERE saldo >= valor`), ou lock otimista com coluna de versao. ' +
          'Na aplicacao: idempotencia (a operacao repetida tem o mesmo efeito), ' +
          'fila serializando por chave, ou cancelamento da requisicao anterior.',
      },
    ],
    example: {
      language: 'javascript',
      code:
        '// CORRIDA: ler, decidir, escrever em passos separados\n' +
        'async function sacar(contaId, valor) {\n' +
        '  const conta = await db.buscar(contaId);        // le 100\n' +
        '  if (conta.saldo < valor) throw new Error("saldo insuficiente");\n' +
        '  // <- outra execucao pode sacar exatamente aqui\n' +
        '  await db.atualizar(contaId, { saldo: conta.saldo - valor });\n' +
        '}\n' +
        '\n' +
        '// ATOMICO: a condicao vai junto com a escrita\n' +
        'async function sacar(contaId, valor) {\n' +
        '  const { rowCount } = await db.query(\n' +
        '    "UPDATE contas SET saldo = saldo - $1 WHERE id = $2 AND saldo >= $1",\n' +
        '    [valor, contaId],\n' +
        '  );\n' +
        '\n' +
        '  if (rowCount === 0) throw new Error("saldo insuficiente");\n' +
        '}\n' +
        '\n' +
        '// no front-end: descartar resposta obsoleta\n' +
        'let requisicaoAtual = 0;\n' +
        '\n' +
        'async function buscar(termo) {\n' +
        '  const minhaVez = ++requisicaoAtual;\n' +
        '  const dados = await api.buscar(termo);\n' +
        '\n' +
        '  if (minhaVez !== requisicaoAtual) return; // chegou atrasada, ignore\n' +
        '  setResultados(dados);\n' +
        '}',
    },
    mistakes: [
      {
        title: 'Testar em ambiente sem concorrencia',
        detail:
          'O bug aparece sob carga, com dois usuarios simultaneos. ' +
          'Localmente, com uma requisicao por vez, ele nunca se manifesta.',
      },
      {
        title: 'Resolver com sleep',
        detail:
          'Esperar reduz a chance, nao elimina a corrida. ' +
          'E acrescenta lentidao garantida para evitar um problema que continua possivel.',
      },
    ],
    exercise:
      'Escreva um script que dispare 50 requisicoes simultaneas de saque na mesma conta ' +
      'com Promise.all. Verifique se o saldo final pode ficar negativo. ' +
      'Depois corrija com atualizacao condicional e rode o mesmo teste.',
    related: ['async-await', 'transactions', 'idempotency'],
  },
  {
    id: 'sql-performance',
    tags: ['sql', 'indice', 'index', 'join', 'n+1', 'query lenta', 'banco de dados', 'explain'],
    title: 'Performance em banco de dados',
    level: 'intermediario',
    tldr:
      'A maioria dos problemas de lentidao em aplicacoes esta no banco, ' +
      'e quase sempre se resume a dois: falta de indice e o problema N+1.',
    analogy:
      'Um indice e o indice de um livro. Sem ele, encontrar "fotossintese" exige ler todas as paginas ' +
      '(full table scan). Com ele, voce vai direto a pagina 247. ' +
      'E o motivo pelo qual livros tem indice - e pelo qual ele ocupa paginas extras e precisa ser ' +
      'refeito quando o livro muda.',
    sections: [
      {
        heading: 'O problema N+1',
        body:
          'Uma consulta busca 100 pedidos; depois, para cada pedido, o codigo busca o cliente. ' +
          'Sao 101 idas ao banco. Mesmo que cada uma leve 2ms, o total passa de 200ms - ' +
          'e a latencia de rede domina o custo. E o problema de performance mais comum em ORMs, ' +
          'porque o codigo parece perfeitamente normal: um laco com um acesso dentro.',
      },
      {
        heading: 'Quando o indice ajuda (e quando nao)',
        body:
          'Indexe colunas usadas em WHERE, JOIN e ORDER BY. ' +
          'Ele nao e gratuito: cada INSERT e UPDATE precisa atualizar o indice tambem, ' +
          'e ele ocupa espaco. Alem disso, o indice e IGNORADO quando voce aplica funcao na coluna ' +
          '(`WHERE LOWER(email) = ...`) ou usa LIKE com curinga no inicio (`LIKE "%ana"`).',
      },
      {
        heading: 'Indice composto e a ordem das colunas',
        body:
          'Um indice em (empresa_id, criado_em) serve para filtros por empresa_id, e por ' +
          'empresa_id + criado_em. Nao serve para filtro apenas por criado_em. ' +
          'A regra e a do dicionario: ele ajuda a achar "casa", mas nao a achar todas as palavras ' +
          'terminadas em "asa".',
      },
      {
        heading: 'Meca em vez de adivinhar',
        body:
          'EXPLAIN ANALYZE mostra o plano real: se houve Seq Scan (varredura completa) ou Index Scan, ' +
          'e quanto tempo cada etapa custou. ' +
          'Sem ler o plano, otimizacao de consulta e chute.',
      },
    ],
    example: {
      language: 'sql',
      code:
        '-- N+1 visto do lado do banco: 1 + 100 consultas\n' +
        'SELECT * FROM pedidos WHERE status = \'pendente\';         -- 1\n' +
        'SELECT * FROM clientes WHERE id = 1;                       -- 2\n' +
        'SELECT * FROM clientes WHERE id = 2;                       -- 3\n' +
        '-- ... mais 98\n' +
        '\n' +
        '-- resolvido com JOIN: uma consulta\n' +
        'SELECT p.*, c.nome AS cliente_nome, c.email\n' +
        'FROM pedidos p\n' +
        'JOIN clientes c ON c.id = p.cliente_id\n' +
        'WHERE p.status = \'pendente\';\n' +
        '\n' +
        '-- ou em duas, quando o JOIN duplicaria muitas linhas\n' +
        'SELECT * FROM clientes WHERE id = ANY($1);  -- $1 = array de ids\n' +
        '\n' +
        '-- indice para o filtro mais usado\n' +
        'CREATE INDEX idx_pedidos_status_criado\n' +
        '  ON pedidos (status, criado_em DESC);\n' +
        '\n' +
        '-- verificar se o indice esta sendo usado\n' +
        'EXPLAIN ANALYZE\n' +
        'SELECT * FROM pedidos WHERE status = \'pendente\' ORDER BY criado_em DESC LIMIT 20;\n' +
        '-- procure por "Index Scan". "Seq Scan" em tabela grande = problema.\n' +
        '\n' +
        '-- indice ignorado por funcao na coluna\n' +
        'SELECT * FROM usuarios WHERE LOWER(email) = \'ana@x.com\';  -- nao usa idx(email)\n' +
        '\n' +
        '-- solucao: indice funcional\n' +
        'CREATE INDEX idx_usuarios_email_lower ON usuarios (LOWER(email));',
    },
    mistakes: [
      {
        title: 'Indexar tudo',
        detail:
          'Cada indice encarece escrita e ocupa disco. ' +
          'Indices nunca usados sao custo puro - verifique as estatisticas de uso antes de criar mais.',
      },
      {
        title: 'SELECT * em tabela larga',
        detail:
          'Trafega colunas que voce nao usa e impede "index only scan", ' +
          'em que o banco responderia lendo apenas o indice.',
      },
      {
        title: 'Resolver lentidao com cache cedo demais',
        detail:
          'Cache sobre consulta mal indexada esconde o problema e acrescenta ' +
          'invalidacao - mais um sistema para dar errado.',
      },
    ],
    exercise:
      'Encontre no seu projeto um laco que faz consulta dentro dele. ' +
      'Meca o tempo total, reescreva com JOIN ou com uma consulta usando IN, e meca de novo. ' +
      'Rode EXPLAIN ANALYZE antes e depois.',
    related: ['big-o', 'caching', 'transactions'],
  },
  {
    id: 'git-workflow',
    title: 'Git: merge, rebase e historico',
    tags: ['git', 'merge', 'rebase', 'branch', 'conflito', 'commit', 'versionamento', 'cherry-pick'],
    level: 'intermediario',
    tldr:
      'Merge preserva o historico como aconteceu. Rebase reescreve para parecer linear. ' +
      'A regra de ouro: nunca reescreva historico que outra pessoa ja baixou.',
    analogy:
      'Merge e juntar dois diarios de viagem mantendo as datas reais, com uma nota dizendo ' +
      '"aqui os caminhos se encontraram". Rebase e reescrever o seu diario como se voce tivesse ' +
      'partido depois do outro viajante - fica mais facil de ler, mas as datas originais se perdem.',
    sections: [
      {
        heading: 'Merge',
        body:
          'Cria um commit com dois pais, unindo as duas linhas. ' +
          'O historico fica fiel ao que aconteceu, incluindo o paralelismo. ' +
          'E seguro em qualquer situacao, porque nao altera commits existentes - ' +
          'por isso e a escolha para integrar em branches compartilhadas.',
      },
      {
        heading: 'Rebase',
        body:
          'Pega seus commits, volta ao ponto de divergencia, aplica as mudancas de outra branch ' +
          'e reescreve os seus commits em cima. Os commits resultantes tem hashes NOVOS: ' +
          'sao outros commits, com o mesmo conteudo. Historico linear, mais facil de ler e de bisect.',
      },
      {
        heading: 'A regra de ouro, e o porque',
        body:
          'Se voce faz rebase de commits que outra pessoa ja tem localmente, os hashes mudam. ' +
          'Para o Git dela, os commits antigos continuam existindo, e o proximo merge duplica tudo. ' +
          'Rebase e para a SUA branch antes de abrir o PR. Branch compartilhada: merge.',
      },
      {
        heading: 'Conflito nao e erro',
        body:
          'Conflito significa que os dois lados mudaram as mesmas linhas e o Git nao tem como ' +
          'decidir sozinho qual intencao vale. Resolver e ler as duas versoes e escrever a que faz sentido - ' +
          'frequentemente nenhuma das duas literalmente.',
      },
    ],
    example: {
      language: 'bash',
      code:
        '# atualizar sua branch antes do PR (historico linear)\n' +
        'git fetch origin\n' +
        'git rebase origin/main\n' +
        '\n' +
        '# durante um conflito\n' +
        'git status                  # veja os arquivos em conflito\n' +
        '# edite os arquivos, removendo os marcadores <<<<<<< ======= >>>>>>>\n' +
        'git add arquivo-resolvido.js\n' +
        'git rebase --continue\n' +
        '\n' +
        'git rebase --abort          # desistir e voltar ao estado anterior\n' +
        '\n' +
        '# integrar em branch compartilhada\n' +
        'git checkout main\n' +
        'git merge --no-ff feature/pagamentos\n' +
        '\n' +
        '# limpar os commits antes de abrir o PR\n' +
        'git rebase -i origin/main   # squash, reword, reorder\n' +
        '\n' +
        '# desfazer com seguranca\n' +
        'git revert <hash>           # novo commit que desfaz (seguro em compartilhado)\n' +
        'git reset --soft HEAD~1     # desfaz o commit, mantem as alteracoes\n' +
        '\n' +
        '# achei que perdi tudo\n' +
        'git reflog                  # historico de TODAS as posicoes de HEAD\n' +
        'git reset --hard <hash>     # volte para qualquer uma delas',
    },
    mistakes: [
      {
        title: 'git push --force em branch compartilhada',
        detail:
          'Apaga o trabalho de quem tinha commits que voce nao tinha. ' +
          'Use `--force-with-lease`: ele recusa o push se alguem publicou algo novo.',
      },
      {
        title: 'Commits gigantes com mensagem vaga',
        detail:
          '"ajustes" em 40 arquivos impede revisao, bisect e revert seletivo. ' +
          'Um commit = uma mudanca logica completa.',
      },
      {
        title: 'Acreditar que perdeu o trabalho',
        detail:
          'O Git quase nunca apaga de verdade. ' +
          '`git reflog` mostra todas as posicoes anteriores de HEAD, inclusive apos reset --hard.',
      },
    ],
    exercise:
      'Crie um repositorio de teste. Faca duas branches que alteram a MESMA linha de um arquivo. ' +
      'Resolva o conflito por merge; depois repita o cenario e resolva por rebase. ' +
      'Compare os dois resultados com `git log --graph --oneline --all`.',
    related: ['code-review', 'ci-cd'],
  },
  {
    id: 'debugging-method',
    title: 'Metodo de depuracao',
    tags: ['debug', 'depuracao', 'bug', 'investigar', 'breakpoint', 'metodo cientifico'],
    level: 'iniciante',
    tldr:
      'Depurar nao e adivinhar: e reduzir o espaco de busca pela metade a cada passo. ' +
      'Metodo vence intuicao, sempre.',
    analogy:
      'Um encanador procurando vazamento nao abre todas as paredes. ' +
      'Ele fecha registros por setor para descobrir em qual trecho a agua ainda corre. ' +
      'Cada teste elimina metade da casa. Depurar e exatamente isso: bisseccao.',
    sections: [
      {
        heading: 'Passo 1: reproduzir de forma confiavel',
        body:
          'Bug que voce nao consegue reproduzir, voce nao consegue consertar - ' +
          'e nao tem como provar que consertou. ' +
          'Anote os passos exatos, os dados exatos, o ambiente exato. ' +
          'Reduza ao menor caso que ainda falha: muitas vezes a reducao ja revela a causa.',
      },
      {
        heading: 'Passo 2: ler o erro de verdade',
        body:
          'Leia a mensagem inteira, nao apenas a primeira linha. ' +
          'No stack trace, procure o primeiro arquivo do SEU projeto - ignore node_modules e frames internos. ' +
          'A mensagem normalmente diz o tipo do problema, e o stack diz o caminho ate ele.',
      },
      {
        heading: 'Passo 3: formular hipotese testavel',
        body:
          'Nao "deve ser o banco". Mas "acredito que `usuario` chega null quando o email tem maiuscula, ' +
          'porque a consulta compara sem normalizar". ' +
          'Uma hipotese boa pode ser confirmada ou descartada por UM teste.',
      },
      {
        heading: 'Passo 4: bissecao',
        body:
          'Ponha um ponto de observacao no meio do fluxo. O dado esta correto ali? ' +
          'Se sim, o problema esta depois; se nao, antes. ' +
          'Repita. Dez passos de bissecao cobrem mil linhas.',
      },
      {
        heading: 'Passo 5: entender antes de corrigir',
        body:
          'Se a correcao funcionou e voce nao sabe por que, voce nao corrigiu: ' +
          'voce mudou as condicoes. O bug volta mudado. ' +
          'Antes de fechar, escreva um teste que falha sem a correcao - e a prova de que voce entendeu.',
      },
    ],
    example: {
      language: 'javascript',
      code:
        '// 1. Console estruturado vence console.log solto\n' +
        'console.log({ entrada, tipo: typeof entrada, ehArray: Array.isArray(entrada) });\n' +
        'console.table(listaDeObjetos);\n' +
        'console.group("processando pedido"); console.groupEnd();\n' +
        '\n' +
        '// 2. Breakpoint condicional: para somente no caso suspeito\n' +
        'for (const item of itens) {\n' +
        '  if (item.id === 4271) debugger; // para so neste\n' +
        '  processar(item);\n' +
        '}\n' +
        '\n' +
        '// 3. Marcar a fronteira entre as camadas\n' +
        'async function buscarUsuario(id) {\n' +
        '  console.log("[repo] entrada:", { id, tipo: typeof id });\n' +
        '  const linha = await db.query("SELECT * FROM usuarios WHERE id = $1", [id]);\n' +
        '  console.log("[repo] saida:", linha.rows.length, "linha(s)");\n' +
        '  return linha.rows[0] ?? null;\n' +
        '}\n' +
        '\n' +
        '// 4. Transformar a suposicao em verificacao explicita\n' +
        'function calcular(valores) {\n' +
        '  if (!Array.isArray(valores)) {\n' +
        '    throw new TypeError(`esperava array, recebi ${typeof valores}: ${JSON.stringify(valores)}`);\n' +
        '  }\n' +
        '  // ...\n' +
        '}\n' +
        '\n' +
        '// 5. Medir em vez de supor onde esta lento\n' +
        'console.time("consulta");\n' +
        'const dados = await buscar();\n' +
        'console.timeEnd("consulta"); // consulta: 1842ms\n' +
        '\n' +
        '// 6. Bissecao no historico: o Git acha o commit que introduziu o bug\n' +
        '// git bisect start / git bisect bad / git bisect good <hash>',
    },
    mistakes: [
      {
        title: 'Mudar varias coisas ao mesmo tempo',
        detail:
          'Se funcionou, voce nao sabe qual mudanca resolveu - e levou junto tres alteracoes ' +
          'sem motivo. Uma hipotese, um teste.',
      },
      {
        title: 'Programar por tentativa e erro',
        detail:
          'Trocar `==` por `===`, inverter condicao, acrescentar await aleatoriamente. ' +
          'Eventualmente para de dar erro, e o bug segue vivo em outro lugar.',
      },
      {
        title: 'Ignorar a mensagem porque "e sempre a mesma coisa"',
        detail: 'Em geral a mensagem diz exatamente o que esta errado - e o custo de ler e de 5 segundos.',
      },
    ],
    exercise:
      'No proximo bug que encontrar, escreva antes de mexer no codigo: ' +
      '(1) passos de reproducao, (2) comportamento esperado x observado, (3) tres hipoteses, ' +
      '(4) como testar cada uma. Depois siga a lista. Compare o tempo com a sua abordagem usual.',
    related: ['testing', 'logging'],
  },
  {
    id: 'rest-api',
    title: 'APIs REST e HTTP',
    tags: ['rest', 'api', 'http', 'endpoint', 'status code', 'idempotencia', 'verbo'],
    level: 'iniciante',
    tldr:
      'REST usa os verbos e os codigos do proprio HTTP para expressar intencao. ' +
      'Recursos sao substantivos; o verbo diz o que fazer com eles.',
    analogy:
      'Pense em uma estante de arquivos. A URL e a localizacao da gaveta (/clientes/42). ' +
      'O verbo e a acao: GET e consultar sem tirar, POST e adicionar uma ficha nova, ' +
      'PUT e substituir a ficha inteira, PATCH e corrigir um campo, DELETE e remover.',
    sections: [
      {
        heading: 'Verbos e suas garantias',
        body:
          'GET e seguro (nao altera nada) e idempotente. ' +
          'PUT e DELETE sao idempotentes: repetir a mesma chamada leva ao mesmo estado final. ' +
          'POST nao e idempotente - duas chamadas criam dois recursos. ' +
          'Essas garantias nao sao decorativas: proxies, CDNs e mecanismos de retry contam com elas.',
      },
      {
        heading: 'Codigos de status que importam',
        body:
          '200 OK, 201 Created (com cabecalho Location), 204 No Content (sucesso sem corpo). ' +
          '400 corpo invalido, 401 nao autenticado, 403 autenticado sem permissao, ' +
          '404 inexistente, 409 conflito de estado, 422 validacao semantica, 429 limite de taxa. ' +
          '500 erro nao tratado no servidor, 503 indisponivel temporariamente. ' +
          'Devolver 200 com `{ "erro": ... }` no corpo quebra todo cliente que confia no status.',
      },
      {
        heading: 'Modelagem de recursos',
        body:
          'URLs sao substantivos no plural: /pedidos, /pedidos/42, /pedidos/42/itens. ' +
          'O verbo esta no metodo, nao na URL - /criarPedido e um sintoma de RPC disfarcado de REST. ' +
          'Filtro, ordenacao e paginacao vao na query string.',
      },
      {
        heading: 'Idempotencia na pratica',
        body:
          'Para POST que nao pode duplicar (pagamento!), aceite um cabecalho de chave de idempotencia. ' +
          'O servidor guarda o resultado da primeira chamada com aquela chave e devolve o MESMO resultado ' +
          'nas repeticoes. Isso e o que permite ao cliente tentar de novo sem medo apos um timeout.',
      },
    ],
    example: {
      language: 'javascript',
      code:
        '// desenho dos endpoints\n' +
        'GET    /api/pedidos?status=pendente&pagina=2&limite=20  -> 200 lista paginada\n' +
        'GET    /api/pedidos/42                                   -> 200 ou 404\n' +
        'POST   /api/pedidos                                      -> 201 + Location\n' +
        'PATCH  /api/pedidos/42                                   -> 200 recurso atualizado\n' +
        'DELETE /api/pedidos/42                                   -> 204 sem corpo\n' +
        'GET    /api/pedidos/42/itens                             -> 200 subrecurso\n' +
        '\n' +
        '// resposta de erro consistente\n' +
        '// HTTP 422\n' +
        '{\n' +
        '  "erro": {\n' +
        '    "codigo": "VALIDACAO",\n' +
        '    "mensagem": "Dados invalidos",\n' +
        '    "campos": [\n' +
        '      { "campo": "email", "problema": "formato invalido" },\n' +
        '      { "campo": "itens", "problema": "deve conter ao menos 1 item" }\n' +
        '    ]\n' +
        '  }\n' +
        '}\n' +
        '\n' +
        '// idempotencia em operacao sensivel\n' +
        'await fetch("/api/pagamentos", {\n' +
        '  method: "POST",\n' +
        '  headers: {\n' +
        '    "Content-Type": "application/json",\n' +
        '    "Idempotency-Key": chaveUnicaDestaTentativa, // mesma chave no retry\n' +
        '  },\n' +
        '  body: JSON.stringify({ pedidoId: 42, valor: 9990 }),\n' +
        '});',
    },
    mistakes: [
      {
        title: 'Verbo na URL',
        detail: '/api/getUsuarios ou /api/deletarPedido ignoram o metodo HTTP e perdem cache e retry.',
      },
      {
        title: 'Sempre devolver 200',
        detail:
          'Clientes checam `response.ok`. Erro com status 200 passa como sucesso ' +
          'e o bug aparece tres camadas depois.',
      },
      {
        title: 'Lista sem paginacao',
        detail:
          'Funciona com 50 registros e derruba a aplicacao com 500 mil. ' +
          'Pagine desde o primeiro dia e imponha um limite maximo.',
      },
    ],
    exercise:
      'Desenhe os endpoints de um sistema de biblioteca: livros, exemplares, emprestimos e reservas. ' +
      'Defina verbo, URL, status de sucesso e os de erro possiveis. ' +
      'Depois responda: qual operacao precisa de chave de idempotencia e por que?',
    related: ['http-status', 'idempotency', 'security'],
  },
];

/** Palavras muito genericas nao devem pontuar na busca. */
const STOP_WORDS = new Set([
  'o', 'a', 'os', 'as', 'de', 'do', 'da', 'em', 'um', 'uma', 'que', 'e', 'para', 'com',
  'como', 'por', 'qual', 'quais', 'me', 'eu', 'meu', 'minha', 'isso', 'esse', 'essa',
  'sobre', 'no', 'na', 'ao', 'se', 'nao', 'mais', 'muito', 'ser', 'estar', 'tem',
  'explique', 'explica', 'ensina', 'ensine', 'entender', 'funciona', 'serve', 'fazer',
]);

const normalize = (text = '') =>
  String(text)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/**
 * Busca conceitos relevantes para uma pergunta.
 * @returns {Array<{concept: object, score: number}>}
 */
export function searchConcepts(question) {
  const query = normalize(question);
  if (!query.trim()) return [];

  const words = query
    .split(/[^a-z0-9+#.-]+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));

  const results = [];
  for (const concept of concepts) {
    let score = 0;

    for (const tag of concept.tags) {
      const normalizedTag = normalize(tag);
      if (query.includes(normalizedTag)) score += normalizedTag.includes(' ') ? 5 : 3;
    }

    if (query.includes(normalize(concept.title))) score += 6;

    const haystack = normalize(
      `${concept.title} ${concept.tldr} ${concept.tags.join(' ')} ${concept.sections
        .map((s) => s.heading)
        .join(' ')}`,
    );
    for (const word of words) {
      if (haystack.includes(word)) score += 1;
    }

    if (score > 0) results.push({ concept, score });
  }

  return results.sort((a, b) => b.score - a.score);
}

export const conceptIndex = concepts.map(({ id, title, tags, level, tldr }) => ({
  id,
  title,
  tags,
  level,
  tldr,
}));
