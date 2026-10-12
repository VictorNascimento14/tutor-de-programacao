/**
 * Script de teste automatizado para validar o Cache de Conversa dos Chatbots.
 *
 * Testa cenarios multi-turno sem repeticao de perguntas:
 * 1. Selecao de servico e pedido de datas/horarios
 * 2. Adicao acumulativa de multiplos servicos (ex: Manutencao + Instalacao)
 * 3. Escolha de horario e confirmacao de agendamento com protocolo
 * 4. Carrinho progressivo de Delivery (itens anteriores preservados)
 */
import { processChatbotMessage } from '../server/services/chatbotService.js';
import { getChatbotCache, clearChatbotCache } from '../server/services/chatbotCache.js';

const TEST_SESSION = `test-sess-${Date.now()}`;

function logSection(title) {
  console.log(`\n======================================================================`);
  console.log(`  ${title}`);
  console.log(`======================================================================`);
}

async function run() {
  console.log('\n--- INICIANDO TESTES DO CACHE MULTI-TURNO DOS CHATBOTS ---\n');
  console.log(`Sessao de teste: ${TEST_SESSION}\n`);

  // Limpa qualquer cache previo
  clearChatbotCache(TEST_SESSION);

  // -------------------------------------------------------------------------
  // CENARIO 1: Selecao inicial de servico
  // -------------------------------------------------------------------------
  logSection('TURNO 1: Usuario escolhe Manutencao');
  const res1 = await processChatbotMessage({
    sessionId: TEST_SESSION,
    botId: 'servicos',
    message: 'Quero agendar uma manutencao preventiva',
    currentState: 'inicio',
    vars: {},
  });

  console.log('Resposta do Bot:', res1.reply);
  console.log('Proximo Estado :', res1.nextState);
  console.log('Variaveis Salvas:', res1.vars);

  if (!res1.vars?.servicos?.includes('Manutencao')) {
    throw new Error('FALHA: "Manutencao" nao foi salva no cache de servicos!');
  }
  console.log('✓ Servico salvo no cache com sucesso!');

  // -------------------------------------------------------------------------
  // CENARIO 2: Usuario pede datas sem o bot repetir "qual servico voce precisa?"
  // -------------------------------------------------------------------------
  logSection('TURNO 2: Usuario pergunta datas ("já selecionei meus serviços, me diga as datas disponiveis")');
  const res2 = await processChatbotMessage({
    sessionId: TEST_SESSION,
    botId: 'servicos',
    message: 'já selecionei meus serviços, me diga as datas disponiveis',
    currentState: res1.nextState || 'agendar_data',
    vars: res1.vars,
  });

  console.log('Resposta do Bot:', res2.reply);
  console.log('Proximo Estado :', res2.nextState);
  console.log('Variaveis Salvas:', res2.vars);

  // Verifica se o bot NAO repetiu a pergunta "Qual serviço você precisa?"
  const repetiuPergunta = /qual servi[cç]o voc[eê] precisa/i.test(res2.reply);
  if (repetiuPergunta) {
    throw new Error('FALHA: O bot repetiu a pergunta de selecao de servicos!');
  }
  if (res2.nextState === 'agendar_tipo') {
    throw new Error('FALHA: O bot regrediu indevidamente para "agendar_tipo"!');
  }
  console.log('✓ Bot manteve o fluxo sem repetir a pergunta de servicos!');

  // -------------------------------------------------------------------------
  // CENARIO 3: Adicao cumulativa de servico ("quero uma instalacao tambem")
  // -------------------------------------------------------------------------
  logSection('TURNO 3: Usuario adiciona "quero uma instalacao tambem"');
  const res3 = await processChatbotMessage({
    sessionId: TEST_SESSION,
    botId: 'servicos',
    message: 'quero uma instalação também',
    currentState: res2.nextState || 'agendar_data',
    vars: res2.vars,
  });

  console.log('Resposta do Bot:', res3.reply);
  console.log('Proximo Estado :', res3.nextState);
  console.log('Variaveis Salvas:', res3.vars);

  const temAmbos =
    res3.vars?.servicos?.includes('Manutencao') &&
    res3.vars?.servicos?.includes('Instalacao');

  if (!temAmbos) {
    throw new Error(`FALHA: O cache deveria conter ambos os servicos, mas tem: ${JSON.stringify(res3.vars?.servicos)}`);
  }
  console.log('✓ Cache acumulou Manutencao + Instalacao com sucesso!');

  // -------------------------------------------------------------------------
  // CENARIO 4: Selecao de horario e geracao de protocolo
  // -------------------------------------------------------------------------
  logSection('TURNO 4: Usuario escolhe horario ("pode ser amanhã às 10:30")');
  const res4 = await processChatbotMessage({
    sessionId: TEST_SESSION,
    botId: 'servicos',
    message: 'pode ser amanhã às 10:30',
    currentState: res3.nextState || 'agendar_data',
    vars: res3.vars,
  });

  console.log('Resposta do Bot:', res4.reply);
  console.log('Proximo Estado :', res4.nextState);
  console.log('Variaveis Salvas:', res4.vars);

  if (res4.vars?.horario !== '10:30') {
    throw new Error(`FALHA: Horario 10:30 nao foi registrado! Recebido: ${res4.vars?.horario}`);
  }
  if (!res4.vars?.protocolo) {
    throw new Error('FALHA: Protocolo de agendamento nao foi gerado!');
  }
  if (res4.nextState !== 'agendar_confirma') {
    throw new Error(`FALHA: Deveria transicionar para agendar_confirma, mas foi: ${res4.nextState}`);
  }
  console.log(`✓ Agendamento concluido com protocolo ${res4.vars.protocolo}!`);

  // -------------------------------------------------------------------------
  // CENARIO 4B: Correcao de agendamento para Emergencia Imediata
  // -------------------------------------------------------------------------
  logSection('TURNO 4B: Usuario corrige ("isso é uma emergencia, preciso pra agora")');
  const res4b = await processChatbotMessage({
    sessionId: TEST_SESSION,
    botId: 'servicos',
    message: 'isso é uma emergencia, preciso pra agora',
    currentState: 'agendar_confirma',
    vars: res4.vars,
  });

  console.log('Resposta do Bot:', res4b.reply);
  console.log('Proximo Estado :', res4b.nextState);
  console.log('Variaveis Salvas:', res4b.vars);

  if (res4b.nextState !== 'agendar_emergencia') {
    throw new Error(`FALHA: Deveria transicionar para agendar_emergencia, mas foi: ${res4b.nextState}`);
  }
  if (!res4b.vars?.servicos?.includes('Emergencia')) {
    throw new Error(`FALHA: Servico deveria ser Emergencia, mas foi: ${JSON.stringify(res4b.vars?.servicos)}`);
  }
  if (!res4b.vars?.protocolo?.startsWith('#EMERG-')) {
    throw new Error(`FALHA: Protocolo deveria ser emergencial (#EMERG-...), recebido: ${res4b.vars?.protocolo}`);
  }
  if (res4b.vars?.data !== 'Hoje (imediato)') {
    throw new Error(`FALHA: Data deveria ser 'Hoje (imediato)', recebido: ${res4b.vars?.data}`);
  }
  console.log('✓ Agendamento corrigido com sucesso para Atendimento de Emergência (#EMERG-...)!');

  // -------------------------------------------------------------------------
  // CENARIO 5: Delivery - Carrinho acumulativo em cache
  // -------------------------------------------------------------------------
  logSection('TURNO 5: Delivery - Pedido direto e acumulacao');
  const deliv1 = await processChatbotMessage({
    sessionId: TEST_SESSION,
    botId: 'delivery',
    message: 'Quero 2 hamburgueres e 1 pizza margherita',
    currentState: 'inicio',
    vars: {},
  });

  console.log('Resposta do Ze 1:', deliv1.reply);
  console.log('Itens do Carrinho 1:', deliv1.vars?.carrinho);

  const deliv2 = await processChatbotMessage({
    sessionId: TEST_SESSION,
    botId: 'delivery',
    message: 'Adiciona um guarana e me diz o total',
    currentState: deliv1.nextState || 'carrinho',
    vars: deliv1.vars,
  });

  console.log('Resposta do Ze 2:', deliv2.reply);
  console.log('Itens do Carrinho 2:', deliv2.vars?.carrinho);

  const itensTitulos = (deliv2.vars?.carrinho || []).map((i) => i.title);
  const contemBebida = itensTitulos.some((t) => /guarana/i.test(t));
  const contemPizza = itensTitulos.some((t) => /margherita/i.test(t));

  if (!contemPizza || !contemBebida) {
    throw new Error(`FALHA: O carrinho deveria ter a pizza inicial E o guarana! Atual: ${JSON.stringify(itensTitulos)}`);
  }
  console.log('✓ Delivery manteve itens anteriores e acumulou novos no carrinho em cache!');

  // -------------------------------------------------------------------------
  // CENARIO 5B: Delivery - Pedido ambiguo/generico sem vazar raciocinio em ingles
  // Exemplo relatado pelo usuario: "na verdade eu quero adicionar um hamburguer"
  // tendo 1x Calabresa no carrinho
  // -------------------------------------------------------------------------
  logSection('TURNO 5B: Delivery - Adicao generica ("na verdade eu quero adicionar um hamburguer")');
  const sessAmbiguo = `test-ambig-${Date.now()}`;
  const delivAmb1 = await processChatbotMessage({
    sessionId: sessAmbiguo,
    botId: 'delivery',
    message: 'Quero uma pizza calabresa',
    currentState: 'inicio',
    vars: {},
  });
  console.log('Resposta do Ze (Turno 1):', delivAmb1.reply);
  console.log('Carrinho (Turno 1):', delivAmb1.vars?.carrinho);

  const delivAmb2 = await processChatbotMessage({
    sessionId: sessAmbiguo,
    botId: 'delivery',
    message: 'na verdade eu quero adicionar um hamburguer',
    currentState: delivAmb1.nextState || 'carrinho',
    vars: delivAmb1.vars,
  });
  console.log('Resposta do Ze (Turno 2):', delivAmb2.reply);
  console.log('Carrinho (Turno 2):', delivAmb2.vars?.carrinho);

  // Valida que NENHUM monologo em ingles vazou na resposta
  const vazouIngles = /we need|need follow|user wants|respond only json|format requires/i.test(delivAmb2.reply);
  if (vazouIngles) {
    throw new Error(`FALHA: Monologo interno em ingles vazou na resposta do bot: ${delivAmb2.reply}`);
  }

  if (delivAmb2.nextState !== 'cat_burgers') {
    throw new Error(`FALHA: Ao pedir hamburguer sem sabor, deveria abrir 'cat_burgers', mas foi: ${delivAmb2.nextState}`);
  }

  // Turno 3: Cliente escolhe o sabor do burger
  const delivAmb3 = await processChatbotMessage({
    sessionId: sessAmbiguo,
    botId: 'delivery',
    message: 'Pode ser um clássico',
    currentState: delivAmb2.nextState || 'cat_burgers',
    vars: delivAmb2.vars,
  });
  console.log('Resposta do Ze (Turno 3):', delivAmb3.reply);
  console.log('Carrinho (Turno 3):', delivAmb3.vars?.carrinho);

  const itensAmb = (delivAmb3.vars?.carrinho || []).map((i) => i.title);
  const temPizzaCalabresa = itensAmb.some((t) => /calabresa/i.test(t));
  const temBurger = itensAmb.some((t) => /classico/i.test(t));

  if (!temPizzaCalabresa || !temBurger) {
    throw new Error(`FALHA: Carrinho final deveria conter a pizza calabresa E o hamburguer classico! Atual: ${JSON.stringify(itensAmb)}`);
  }
  console.log('✓ Pedido tratado com perfeicao: cardapio oferecido e sabor escolhido adicionado ao carrinho!');

  // -------------------------------------------------------------------------
  // CENARIO 5C: Selecao de 1 sabor unico de pizza deve adicionar exatamente 1 (nao 2)
  // -------------------------------------------------------------------------
  logSection('TURNO 5C: Selecao de sabor ("Quero 1 pizza de calabresa") - quantidade exata');
  const sessUnico = `test-single-${Date.now()}`;
  const delivSingle = await processChatbotMessage({
    sessionId: sessUnico,
    botId: 'delivery',
    message: 'Quero uma pizza calabresa',
    currentState: 'cat_pizzas',
    vars: { carrinho: [] },
  });

  console.log('Resposta do Ze:', delivSingle.reply);
  console.log('Itens retornados:', delivSingle.items);
  console.log('Carrinho em cache:', delivSingle.vars?.carrinho);

  const totalPizzas = (delivSingle.vars?.carrinho || []).reduce(
    (acc, i) => acc + (Number(i.qty) || 1),
    0,
  );

  if (totalPizzas !== 1) {
    throw new Error(`FALHA: Deveria ter adicionado exatamente 1 pizza, mas adicionou ${totalPizzas}! Carrinho: ${JSON.stringify(delivSingle.vars?.carrinho)}`);
  }
  console.log(`✓ Quantidade verificada com perfeicao: exatamente 1 pizza adicionada!`);

  // -------------------------------------------------------------------------
  // CENARIO 5D: Pedido generico "Quero uma pizza" deve abrir cardapio (cat_pizzas)
  // e NUNCA adicionar Margherita automaticamente ao carrinho!
  // -------------------------------------------------------------------------
  logSection('TURNO 5D: Pedido generico ("Quero uma pizza") -> deve abrir cardapio sem auto-adicionar');
  const sessGenerica = `test-gen-pizza-${Date.now()}`;
  const delivGen = await processChatbotMessage({
    sessionId: sessGenerica,
    botId: 'delivery',
    message: 'Quero uma pizza',
    currentState: 'inicio',
    vars: { carrinho: [] },
  });

  console.log('Resposta do Ze:', delivGen.reply);
  console.log('Itens retornados:', delivGen.items);
  console.log('Proximo Estado :', delivGen.nextState);
  console.log('Carrinho em cache:', delivGen.vars?.carrinho);

  if (delivGen.nextState !== 'cat_pizzas') {
    throw new Error(`FALHA: Estado deveria ser 'cat_pizzas' (cardapio), mas foi: ${delivGen.nextState}`);
  }
  if (Array.isArray(delivGen.vars?.carrinho) && delivGen.vars?.carrinho.length > 0) {
    throw new Error(`FALHA: Carrinho deveria estar vazio ao pedir pizza generica, mas contem: ${JSON.stringify(delivGen.vars?.carrinho)}`);
  }
  if (Array.isArray(delivGen.items) && delivGen.items.length > 0) {
    throw new Error(`FALHA: Nao deveria retornar itens para adicao direta, mas retornou: ${JSON.stringify(delivGen.items)}`);
  }
  console.log('✓ Pedido generico "Quero uma pizza" abriu o cardapio com sucesso, sem colocar Margherita automaticamente no carrinho!');

  // -------------------------------------------------------------------------
  // CENARIO 6: Inspecao direta do cache
  // -------------------------------------------------------------------------
  logSection('TURNO 6: Inspecao do registro de cache em memoria');
  const cacheServicos = getChatbotCache(TEST_SESSION, 'servicos');
  console.log('Historico de turnos salvos:', cacheServicos.history.length);
  console.log('Servicos finais em memoria:', cacheServicos.vars.servicos);

  if (cacheServicos.history.length < 8) {
    throw new Error(`FALHA: Historico incompleto. Esperado >= 8, obtido: ${cacheServicos.history.length}`);
  }
  console.log('✓ Historico e variaveis persistem intactos na memoria do servidor!');

  logSection('TODOS OS TESTES DE CACHE FORAM EXECUTADOS COM SUCESSO (100% OK)');
}

run().catch((err) => {
  console.error('\n❌ ERRO NO TESTE DE CACHE:', err.message);
  process.exit(1);
});
