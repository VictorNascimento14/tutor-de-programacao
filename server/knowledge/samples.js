/**
 * Exemplos prontos para carregar no editor.
 * Cada um contem problemas reais e didaticos para o motor encontrar.
 */

export const exemplos = [
  {
    id: 'js-api-insegura',
    tipo: 'review',
    titulo: 'API Node com falhas de seguranca',
    descricao: 'Credencial no codigo, SQL por concatenacao, erro engolido e promise sem catch',
    linguagem: 'javascript',
    codigo: `const express = require('express');
import { createPool } from 'mysql2/promise';

const app = express();
const API_KEY = "sk-live-9f8a7b6c5d4e3f2a1b0c9d8e";

const pool = createPool({
  host: 'http://127.0.0.1:3306',
  user: 'root',
  password: 'admin123456',
});

app.get('/usuarios', async (req, res) => {
  var termo = req.query.q;

  const sql = "SELECT * FROM usuarios WHERE nome LIKE '%" + termo + "%'";
  const [linhas] = await pool.query(sql);

  res.json(linhas);
});

app.post('/login', (req, res) => {
  const { email, senha } = req.body;

  pool.query(\`SELECT * FROM usuarios WHERE email = '\${email}'\`)
    .then(([linhas]) => {
      if (linhas.length == 0) {
        return res.status(404).json({ erro: 'nao encontrado' });
      }

      const token = Math.random().toString(36).slice(2);
      console.log('token gerado:', token, 'para', email);

      res.json({ token: token, usuario: linhas[0] });
    });
});

app.post('/importar', async (req, res) => {
  try {
    const itens = JSON.parse(req.body.payload);

    itens.forEach(async (item) => {
      await pool.query("INSERT INTO itens SET ?", item);
    });

    res.json({ importados: itens.length });
  } catch (e) {}
});

app.get('/relatorio', async (req, res) => {
  const pedidos = await pool.query("SELECT * FROM pedidos");
  const resultado = [];

  for (var i = 0; i < pedidos.length; i++) {
    const cliente = await pool.query("SELECT * FROM clientes WHERE id = " + pedidos[i].cliente_id);
    if (cliente) {
      if (cliente[0]) {
        if (cliente[0].ativo == true) {
          if (pedidos[i].valor > 10000) {
            resultado.push({ pedido: pedidos[i], cliente: cliente[0] });
          }
        }
      }
    }
  }

  res.json(resultado);
});

app.listen(3000);`,
  },
  {
    id: 'react-estado',
    tipo: 'review',
    titulo: 'Componente React com problemas de estado',
    descricao: 'Mutacao de estado, key por indice, efeito async e innerHTML',
    linguagem: 'jsx',
    codigo: `import React, { useState, useEffect } from 'react';

export default function ListaDeTarefas({ usuarioId }) {
  const [tarefas, setTarefas] = useState([]);
  const [total, setTotal] = useState(0);
  const [texto, setTexto] = useState('');

  useEffect(async () => {
    const resposta = await fetch('/api/tarefas?usuario=' + usuarioId);
    const dados = await resposta.json();
    setTarefas(dados);
  });

  useEffect(() => {
    setTotal(tarefas.length);
  });

  function adicionar() {
    tarefas.push({ id: Date.now(), texto: texto, feita: false });
    setTarefas(tarefas);
    setTexto('');
  }

  function concluir(indice) {
    tarefas[indice].feita = true;
    setTarefas(tarefas);
  }

  function renderizarResumo() {
    const el = document.getElementById('resumo');
    el.innerHTML = '<strong>' + texto + '</strong> - ' + total + ' tarefas';
  }

  const pendentes = tarefas.filter(function (t) {
    return t.feita == false;
  });

  return (
    <div className="lista">
      <div id="resumo" />

      <input value={texto} onChange={(e) => setTexto(e.target.value)} />
      <button onClick={adicionar()}>Adicionar</button>

      {tarefas.map((tarefa, index) => (
        <div key={index} className="item">
          <span>{tarefa.texto}</span>
          <button onClick={() => concluir(index)}>Concluir</button>
        </div>
      ))}

      <footer>{pendentes.length} pendentes de {total}</footer>
    </div>
  );
}`,
  },
  {
    id: 'python-servico',
    tipo: 'review',
    titulo: 'Servico Python com armadilhas classicas',
    descricao: 'Argumento padrao mutavel, except nu, shell=True e f-string em SQL',
    linguagem: 'python',
    codigo: `import os
import random
import subprocess
from datetime import datetime

DB_PASSWORD = "P@ssw0rd_producao_2024"
API_TOKEN = "ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789"

cache_global = {}


def registrar_evento(nome, tags=[], metadados={}):
    tags.append(nome)
    metadados['hora'] = datetime.now()
    cache_global[nome] = metadados
    return tags


def buscar_usuario(conexao, email):
    cursor = conexao.cursor()
    cursor.execute(f"SELECT * FROM usuarios WHERE email = '{email}'")
    linha = cursor.fetchone()

    if linha == None:
        return None

    return linha


def processar_arquivo(caminho):
    f = open(caminho)
    linhas = f.readlines()

    resultado = []

    for i in range(len(linhas) + 1):
        try:
            partes = linhas[i].split(',')
            valor = int(partes[2])

            if type(valor) == int:
                if valor > 1000:
                    if partes[0] != None:
                        resultado.append({'nome': partes[0], 'valor': valor})
        except:
            pass

    f.close()
    return resultado


def gerar_token_recuperacao(usuario_id):
    token = ''.join([str(random.randint(0, 9)) for _ in range(6)])
    print(f"token de {usuario_id}: {token}")
    return token


def converter_imagem(arquivo_entrada, arquivo_saida):
    comando = f"convert {arquivo_entrada} -resize 800x600 {arquivo_saida}"
    subprocess.run(comando, shell=True)


def validar_permissao(usuario):
    assert usuario.is_admin, "usuario sem permissao"
    return True


def calcular_media(valores):
    global cache_global
    total = sum(valores)
    return total / len(valores)


formatar = lambda v: f"R$ {v:.2f}"`,
  },
  {
    id: 'erro-undefined',
    tipo: 'debug',
    titulo: 'TypeError: cannot read properties of undefined',
    descricao: 'O erro mais comum de JavaScript, com stack trace completo',
    linguagem: 'javascript',
    erro: `TypeError: Cannot read properties of undefined (reading 'nome')
    at formatarPerfil (C:\\projeto\\src\\services\\perfil.js:42:31)
    at montarResposta (C:\\projeto\\src\\controllers\\usuario.js:18:20)
    at async handler (C:\\projeto\\src\\routes\\usuarios.js:27:18)
    at Layer.handle [as handle_request] (C:\\projeto\\node_modules\\express\\lib\\router\\layer.js:95:5)
    at next (C:\\projeto\\node_modules\\express\\lib\\router\\route.js:144:13)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)`,
    codigo: `export function formatarPerfil(resposta) {
  const usuario = resposta.data.usuario;

  return {
    nomeCompleto: usuario.perfil.nome + ' ' + usuario.perfil.sobrenome,
    email: usuario.email,
    cidade: usuario.endereco.cidade,
  };
}

export async function buscarPerfil(id) {
  const resposta = await fetch(\`/api/usuarios/\${id}\`);
  const json = await resposta.json();

  return formatarPerfil(json);
}`,
  },
  {
    id: 'erro-python-none',
    tipo: 'debug',
    titulo: "AttributeError: 'NoneType' object has no attribute",
    descricao: 'Traceback de Python com funcao sem return em um dos caminhos',
    linguagem: 'python',
    erro: `Traceback (most recent call last):
  File "app/main.py", line 58, in <module>
    relatorio = gerar_relatorio(pedidos)
  File "app/relatorios.py", line 31, in gerar_relatorio
    total = calcular_total(pedido).valor
AttributeError: 'NoneType' object has no attribute 'valor'`,
    codigo: `class Total:
    def __init__(self, valor):
        self.valor = valor


def calcular_total(pedido):
    if pedido.status == 'confirmado':
        soma = sum(item.preco * item.quantidade for item in pedido.itens)
        return Total(soma)
    # quando o status e diferente, a funcao devolve None silenciosamente


def gerar_relatorio(pedidos):
    linhas = []

    for pedido in pedidos:
        total = calcular_total(pedido).valor
        linhas.append({'id': pedido.id, 'total': total})

    return linhas`,
  },
  {
    id: 'erro-react-render',
    tipo: 'debug',
    titulo: 'Too many re-renders',
    descricao: 'Laco infinito de renderizacao no React',
    linguagem: 'jsx',
    erro: `Error: Too many re-renders. React limits the number of renders to prevent an infinite loop.
    at renderWithHooks (react-dom.development.js:16305:11)
    at mountIndeterminateComponent (react-dom.development.js:20074:13)
    at beginWork (react-dom.development.js:21587:16)
    at Painel (src/components/Painel.jsx:14:3)`,
    codigo: `import { useState, useEffect } from 'react';

export function Painel({ itens }) {
  const [filtrados, setFiltrados] = useState([]);
  const [contador, setContador] = useState(0);

  setContador(contador + 1);

  useEffect(() => {
    setFiltrados(itens.filter((i) => i.ativo));
  });

  return (
    <div>
      <p>Render numero {contador}</p>
      <button onClick={setContador(0)}>Zerar</button>

      {filtrados.map((item) => (
        <span key={item.id}>{item.nome}</span>
      ))}
    </div>
  );
}`,
  },
  {
    id: 'codigo-limpo',
    tipo: 'review',
    titulo: 'Codigo bem escrito (controle)',
    descricao: 'Para comparar: mesmo dominio, escrito com cuidado',
    linguagem: 'javascript',
    codigo: `/**
 * Calculo de frete.
 * A regra de negocio e pura: nao le relogio, nao acessa rede, nao grava log.
 * Isso a torna trivial de testar e segura para reaproveitar.
 */

const TAXA_BASE_CENTAVOS = 1000;
const CUSTO_POR_KG_CENTAVOS = 150;
const CUSTO_POR_KM_CENTAVOS = 20;
const PESO_MAXIMO_KG = 30;

/**
 * @param {{ pesoKg: number, distanciaKm: number, ehPremium: boolean }} params
 * @returns {number} valor do frete em centavos
 */
export function calcularFrete({ pesoKg, distanciaKm, ehPremium }) {
  validarParametros({ pesoKg, distanciaKm });

  if (ehPremium) return 0;

  return (
    TAXA_BASE_CENTAVOS +
    Math.round(pesoKg * CUSTO_POR_KG_CENTAVOS) +
    Math.round(distanciaKm * CUSTO_POR_KM_CENTAVOS)
  );
}

function validarParametros({ pesoKg, distanciaKm }) {
  if (!Number.isFinite(pesoKg) || pesoKg <= 0) {
    throw new RangeError(\`pesoKg deve ser positivo, recebido: \${pesoKg}\`);
  }

  if (pesoKg > PESO_MAXIMO_KG) {
    throw new RangeError(\`pesoKg acima do limite de \${PESO_MAXIMO_KG}kg\`);
  }

  if (!Number.isFinite(distanciaKm) || distanciaKm < 0) {
    throw new RangeError(\`distanciaKm invalida: \${distanciaKm}\`);
  }
}

/**
 * Agrupa entregas por regiao em uma unica passagem.
 * Indexar com Map evita o laco aninhado que tornaria isso O(n*m).
 */
export function agruparPorRegiao(entregas, regioes) {
  const regiaoPorCep = new Map(regioes.map((regiao) => [regiao.cep, regiao]));

  const grupos = new Map();

  for (const entrega of entregas) {
    const regiao = regiaoPorCep.get(entrega.cep);
    if (!regiao) continue;

    const atual = grupos.get(regiao.id) ?? { regiao, entregas: [] };
    atual.entregas.push(entrega);
    grupos.set(regiao.id, atual);
  }

  return [...grupos.values()];
}`,
  },
];
