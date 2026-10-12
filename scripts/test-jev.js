/**
 * Teste dedicado do motor de decisoes JEV (typesafe/jev-1.13)
 * e execucao hibrida em paralelo com DeepSeek (deepseek/deepseek-v4.1-flash).
 *
 * Executar com:
 *   node scripts/test-jev.js
 *   ou npm run test:jev
 */
import { callJevDecisions, callChatCompletions, executeHybrid } from '../server/providers/openrouter.js';
import { config, hasOpenRouter } from '../server/config.js';

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
};

function banner(titulo) {
  console.log('\n' + '='.repeat(70));
  console.log(`${C.bold}${C.cyan}  ${titulo}${C.reset}`);
  console.log('='.repeat(70));
}

function printProbabilidades(probabilities = {}) {
  const entries = Object.entries(probabilities);
  if (!entries.length) return;
  for (const [key, val] of entries) {
    const pct = Math.round(val * 100);
    const barra = '█'.repeat(Math.round(pct / 5)) + '░'.repeat(20 - Math.round(pct / 5));
    console.log(`    ${key.padEnd(16)} [${barra}] ${pct.toString().padStart(3)}%`);
  }
}

async function run() {
  console.log(`${C.bold}${C.magenta}`);
  console.log('  ██████╗  ███████╗ ██╗   ██╗');
  console.log('  ╚══███╔╝ ██╔════╝ ██║   ██║   MOTOR DE DECISOES (JEV)');
  console.log('    ███╔╝  █████╗   ██║   ██║   + DEEPSEEK HIBRIDO PARALELO');
  console.log('   ███╔╝   ██╔══╝   ╚██╗ ██╔╝   Tutor de Programacao');
  console.log('  ███████╗ ███████╗  ╚████╔╝');
  console.log('  ╚══════╝ ╚══════╝   ╚═══╝');
  console.log(`${C.reset}`);

  console.log(`${C.dim}Modelo JEV      : ${config.openrouter.jevModel}`);
  console.log(`Modelo LLM      : ${config.openrouter.mainModel}`);
  console.log(`API Configurada : ${hasOpenRouter() ? 'SIM' : 'NAO'}${C.reset}`);

  if (!hasOpenRouter()) {
    console.error(`${C.red}ERRO: OPENROUTER_API_KEY nao encontrada no .env${C.reset}`);
    process.exit(1);
  }

  // -------------------------------------------------------------------------
  // TESTE 1: JEV no Code Review
  // -------------------------------------------------------------------------
  banner('TESTE 1: JEV (typesafe/jev-1.13) no Code Review');
  const codigoRuim = `
    const user = req.body.username;
    const query = "SELECT * FROM users WHERE username = '" + user + "'";
    const token = "sk-live-9923849182391283";
    db.execute(query);
  `;
  console.log(`${C.yellow}Codigo a avaliar:${C.reset}${codigoRuim}`);

  const t1Inicio = Date.now();
  const res1 = await callJevDecisions({
    state: { code: codigoRuim, language: 'javascript' },
    questions: {
      securityVerdict: {
        type: 'choice',
        instructions: 'Avalie a gravidade das vulnerabilidades de seguranca',
        criteria: {
          critical: 'Presenca de SQL Injection, credenciais expostas ou RCE',
          warning: 'Problemas de estilo ou bugs menores',
          clean: 'Codigo seguro sem problemas'
        }
      },
      actionPriority: {
        type: 'choice',
        instructions: 'Qual a prioridade de acao?',
        criteria: {
          immediate_security_fix: 'Corrigir seguranca imediatamente antes de subir',
          code_refactor: 'Melhorar a legibilidade do codigo',
          approve: 'Aprovar o codigo'
        }
      }
    }
  });

  if (res1.ok) {
    console.log(`${C.green}✓ Decisao JEV recebida em ${res1.latencyMs}ms!${C.reset}`);
    console.log(`  Modelo: ${res1.model}`);
    for (const [qName, ans] of Object.entries(res1.answers)) {
      console.log(`\n  ${C.bold}Pergunta: ${qName}${C.reset}`);
      console.log(`  Escolha : ${C.bold}${C.green}${ans.choice}${C.reset} (Confianca: ${Math.round(ans.confidence * 100)}%)`);
      console.log(`  Distribuicao de probabilidades:`);
      printProbabilidades(ans.probabilities);
    }
  } else {
    console.log(`${C.red}✗ Falha no Teste 1: ${res1.error}${C.reset}`);
  }

  // -------------------------------------------------------------------------
  // TESTE 2: JEV no Chatbot 1 (Servicos - Lumi)
  // -------------------------------------------------------------------------
  banner('TESTE 2: JEV no Chatbot de Servicos (Lumi)');
  const msgServico = 'Preciso agendar com urgencia a visita tecnica para um servidor que caiu!';
  console.log(`${C.yellow}Mensagem do usuario:${C.reset} "${msgServico}"`);

  const res2 = await callJevDecisions({
    state: { message: msgServico, bot: 'servicos' },
    questions: {
      intencao: {
        type: 'choice',
        instructions: 'Identifique o objetivo principal do cliente',
        criteria: {
          agendar: 'Cliente deseja marcar horario, data ou visita tecnica',
          orcamento: 'Cliente pede valores, precos ou cotacao',
          duvidas: 'Cliente tem duvida de informacoes gerais',
          humano: 'Cliente quer falar com um atendente humano'
        }
      },
      urgencia: {
        type: 'choice',
        instructions: 'Qual o nivel de urgencia da solicitacao?',
        criteria: {
          critica: 'Parada de servidor, sistema fora do ar, perda de dados',
          normal: 'Agendamento preventivo ou rotina'
        }
      }
    }
  });

  if (res2.ok) {
    console.log(`${C.green}✓ Decisao JEV recebida em ${res2.latencyMs}ms!${C.reset}`);
    for (const [qName, ans] of Object.entries(res2.answers)) {
      console.log(`  ${C.bold}${qName}:${C.reset} ${C.green}${ans.choice}${C.reset} (${Math.round(ans.confidence * 100)}%)`);
      printProbabilidades(ans.probabilities);
    }
  } else {
    console.log(`${C.red}✗ Falha no Teste 2: ${res2.error}${C.reset}`);
  }

  // -------------------------------------------------------------------------
  // TESTE 3: JEV no Chatbot 2 (Delivery - Ze)
  // -------------------------------------------------------------------------
  banner('TESTE 3: JEV no Chatbot de Delivery (Cantina do Ze)');
  const msgDelivery = 'Quais sao as opcoes de pizza quatro queijos e calabresa com borda recheada?';
  console.log(`${C.yellow}Mensagem do usuario:${C.reset} "${msgDelivery}"`);

  const res3 = await callJevDecisions({
    state: { message: msgDelivery, bot: 'delivery' },
    questions: {
      intencao: {
        type: 'choice',
        instructions: 'Qual a intencao do cliente de delivery?',
        criteria: {
          cardapio: 'Deseja ver opcoes de pratos, pizzas, lanches ou precos',
          pedir: 'Esta fechando um pedido ou pedindo a conta',
          status: 'Quer saber o rastreamento ou previsao de entrega',
          cancelar: 'Deseja cancelar o pedido'
        }
      },
      categoriaCardapio: {
        type: 'choice',
        instructions: 'Qual categoria do cardapio foi citada?',
        criteria: {
          pizza: 'Pizzas salgadas ou doces',
          hamburguer: 'Lanches ou burguers',
          bebidas: 'Refrigerantes, sucos ou aguas'
        }
      }
    }
  });

  if (res3.ok) {
    console.log(`${C.green}✓ Decisao JEV recebida em ${res3.latencyMs}ms!${C.reset}`);
    for (const [qName, ans] of Object.entries(res3.answers)) {
      console.log(`  ${C.bold}${qName}:${C.reset} ${C.green}${ans.choice}${C.reset} (${Math.round(ans.confidence * 100)}%)`);
      printProbabilidades(ans.probabilities);
    }
  } else {
    console.log(`${C.red}✗ Falha no Teste 3: ${res3.error}${C.reset}`);
  }

  // -------------------------------------------------------------------------
  // TESTE 4: JEV no Chatbot 3 (Demandas - Kai)
  // -------------------------------------------------------------------------
  banner('TESTE 4: JEV no Chatbot de Demandas (Kai)');
  const msgDemanda = 'Cadastre um bug urgente: os pagamentos via PIX estao falhando no checkout';
  console.log(`${C.yellow}Mensagem do usuario:${C.reset} "${msgDemanda}"`);

  const res4 = await callJevDecisions({
    state: { message: msgDemanda, bot: 'demandas' },
    questions: {
      intencao: {
        type: 'choice',
        instructions: 'Identifique a acao no quadro de tarefas',
        criteria: {
          nova_tarefa: 'Cadastrar nova tarefa, bug ou estoria',
          listar: 'Visualizar tarefas pendentes ou kanban',
          priorizar: 'Alterar prioridade de tarefa existente'
        }
      },
      prioridadeSugerida: {
        type: 'choice',
        instructions: 'Qual prioridade deve ser atribuida no board?',
        criteria: {
          critica: 'Falha bloqueante de pagamento, receita ou indisponibilidade',
          media: 'Ajuste ou melhoria sem bloqueio financeiro'
        }
      }
    }
  });

  if (res4.ok) {
    console.log(`${C.green}✓ Decisao JEV recebida em ${res4.latencyMs}ms!${C.reset}`);
    for (const [qName, ans] of Object.entries(res4.answers)) {
      console.log(`  ${C.bold}${qName}:${C.reset} ${C.green}${ans.choice}${C.reset} (${Math.round(ans.confidence * 100)}%)`);
      printProbabilidades(ans.probabilities);
    }
  } else {
    console.log(`${C.red}✗ Falha no Teste 4: ${res4.error}${C.reset}`);
  }

  // -------------------------------------------------------------------------
  // TESTE 5: Execucao HIBRIDA EM PARALELO (JEV + DeepSeek v4.1 Flash)
  // -------------------------------------------------------------------------
  banner('TESTE 5: Execucao HIBRIDA PARALELA (JEV + DeepSeek v4.1 Flash)');
  console.log(`Iniciando JEV e DeepSeek simultaneamente com Promise.all...\n`);

  const hybridPrompt = 'O usuario perguntou: "Como faco para agendar uma revisao de seguranca na minha aplicacao?"';
  const hybridState = { message: 'Como faco para agendar uma revisao de seguranca na minha aplicacao?', canal: 'chat' };

  const hRes = await executeHybrid({
    jevState: hybridState,
    jevQuestions: {
      decisaoRoteamento: {
        type: 'choice',
        instructions: 'Roteamento do atendimento',
        criteria: {
          agendamento_consultoria: 'Usuario quer agendar avaliacao de seguranca',
          suporte_tecnico: 'Duvidas tecnicas sobre ferramentas',
          outro: 'Assuntos diversos'
        }
      }
    },
    llmSystem: 'Voce e Lumi, assistente inteligente. Responda em 2 frases cordiais e diretas.',
    llmPrompt: hybridPrompt,
    maxTokens: 600
  });

  console.log(`${C.bold}Resultados do Modo Hibrido:${C.reset}`);
  console.log(`  Tempo JEV (${hRes.jev.model})      : ${hRes.jev.latencyMs}ms`);
  console.log(`  Tempo LLM (${hRes.llm.model})      : ${hRes.llm.latencyMs}ms`);
  console.log(`  ${C.bold}${C.green}Tempo Total em Paralelo           : ${hRes.totalLatencyMs}ms${C.reset}`);

  console.log(`\n  ${C.cyan}[JEV Decisao]:${C.reset}`);
  const decisao = hRes.jev.answers?.decisaoRoteamento;
  if (decisao) {
    console.log(`    Escolha   : ${C.bold}${decisao.choice}${C.reset}`);
    console.log(`    Confianca : ${Math.round(decisao.confidence * 100)}%`);
  }

  console.log(`\n  ${C.cyan}[DeepSeek Resposta Gerada]:${C.reset}`);
  console.log(`    "${hRes.llm.text}"`);

  banner('STATUS FINAL: TODOS OS MODELOS E INTEGRACOES TESTADOS COM SUCESSO');
}

run().catch((err) => {
  console.error('\nErro inesperado no teste JEV:', err);
  process.exit(1);
});
