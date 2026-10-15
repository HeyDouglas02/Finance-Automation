import { useState, type InputHTMLAttributes } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  atualizarDebito, atualizarGasolina, atualizarRenda, buscarCartoesManuais, buscarFontesRenda, buscarOpcoes,
  lancarDebito, lancarGasolina, lancarRenda,
  type CartaoManual, type Editavel, type Opcao,
} from '../lib/dados';
import { competenciaGasolina, diaMesCurto, nomeMes, reais } from '../lib/formato';
import { Chip, DIVISAO_MINHA, Divisao, Titulo, calcularDivisao, estadoDeRateios, type EstadoDivisao } from './Divisao';

/*
 * Formulários de renda, débito e gasolina. Usados pra lançar (aba Lançar) e pra
 * corrigir (tela Editar lançamento): com "editando", vêm preenchidos, mostram o
 * mês e salvam por cima em vez de criar.
 */

type EditandoRenda = Extract<Editavel, { tipo: 'renda' }>;
type EditandoDebito = Extract<Editavel, { tipo: 'debito' }>;
type EditandoGasolina = Extract<Editavel, { tipo: 'gasolina' }>;

// "12,5" ou "12.5" → 12.5; vazio ou inválido → 0
const numero = (texto: string) => Number(texto.replace(',', '.')) || 0;
// valor gravado → texto do campo: 1200 → "1200,00"
const textoValor = (valor: number) => valor.toFixed(2).replace('.', ',');
// <input type="month"> usa "2026-10"; o banco, "2026-10-01"
const paraMes = (competencia: string) => competencia.slice(0, 7);
const doMes = (mes: string) => `${mes}-01`;

function Campo({ id, rotulo, ...input }: { id: string; rotulo: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label htmlFor={id} style={{ fontSize: 15, fontWeight: 600, margin: '6px 4px 0' }}>{rotulo}</label>
      <input id={id} className="pilula" style={{ height: 46, padding: '0 16px', fontSize: 16 }} {...input} />
    </div>
  );
}

/** Botão Salvar com erro embaixo; "depois" só roda se deu certo. */
function useSalvar(acao: () => Promise<void>, depois: () => void) {
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const salvar = async () => {
    setSalvando(true);
    setErro('');
    try { await acao(); depois(); } catch (e) { setErro((e as Error).message); }
    setSalvando(false);
  };
  return { salvando, erro, salvar };
}

export function FormRenda({ competencia, salvou, editando }: { competencia: string; salvou: (t: string) => void; editando?: EditandoRenda }) {
  const fontes = useQuery({ queryKey: ['fontesRenda'], queryFn: buscarFontesRenda }).data ?? [];
  const [fonte, setFonte] = useState(editando?.fonte ?? '');
  const [valor, setValor] = useState(editando ? textoValor(editando.valor) : '');
  const [mes, setMes] = useState(paraMes(editando?.competencia ?? competencia));
  const comp = editando ? doMes(mes) : competencia;

  const { salvando, erro, salvar } = useSalvar(
    () => editando ? atualizarRenda(editando.id, comp, fonte, numero(valor)) : lancarRenda(comp, fonte, numero(valor)),
    () => {
      salvou(editando ? 'Renda corrigida.' : `Renda de ${fonte} lançada em ${nomeMes(comp).toLowerCase()}.`);
      if (!editando) setValor('');
    },
  );

  return <>
    <Titulo>Fonte</Titulo>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {fontes.map(f => <Chip key={f} ativo={fonte === f} onClick={() => setFonte(f)}>{f}</Chip>)}
    </div>
    <Campo id="renda-fonte" rotulo="Ou outra fonte" placeholder="Ex.: Freela" value={fontes.includes(fonte) ? '' : fonte}
      onChange={e => setFonte(e.target.value)} />
    <Campo id="renda-valor" rotulo="Valor" inputMode="decimal" placeholder="0,00" value={valor} onChange={e => setValor(e.target.value)} />
    {editando && <Campo id="renda-mes" rotulo="Mês do orçamento" type="month" value={mes} onChange={e => setMes(e.target.value)} />}
    <p className="mutado" style={{ fontSize: 12, lineHeight: 1.5, margin: '0 4px' }}>
      A renda de {nomeMes(comp).toLowerCase()} é a que paga as contas de {nomeMes(comp).toLowerCase()} (normalmente recebida no mês seguinte).
    </p>
    {erro && <div role="alert" style={{ color: 'var(--negativo)' }}>{erro}</div>}
    <button className="botao-mel" disabled={!fonte.trim() || numero(valor) <= 0 || !mes || salvando} onClick={salvar}>
      {salvando ? 'Salvando…' : editando ? 'Salvar alterações' : 'Lançar renda'}
    </button>
  </>;
}

export function FormDebito({ competencia, salvou, editando }: { competencia: string; salvou: (t: string) => void; editando?: EditandoDebito }) {
  const opcoes: { categorias: Opcao[]; pessoas: Opcao[] } = useQuery({ queryKey: ['opcoes'], queryFn: buscarOpcoes }).data ?? { categorias: [], pessoas: [] };
  const [descricao, setDescricao] = useState(editando?.descricao ?? '');
  const [valor, setValor] = useState(editando ? textoValor(editando.valor) : '');
  const [parcelas, setParcelas] = useState(String(editando?.parcelas ?? 1));
  const [categoriaId, setCategoriaId] = useState<number | null>(editando?.categoriaId ?? null);
  const [divisao, setDivisao] = useState<EstadoDivisao>(editando ? estadoDeRateios(editando.rateios, Math.abs(editando.valor)) : DIVISAO_MINHA);
  const [mes, setMes] = useState(paraMes(editando?.competencia ?? competencia));
  const comp = editando ? doMes(mes) : competencia;

  const n = Math.max(1, Math.floor(numero(parcelas)));
  const { rateios, passou, incompleta } = calcularDivisao(divisao, Math.abs(numero(valor)));
  const { salvando, erro, salvar } = useSalvar(
    () => editando
      ? atualizarDebito(editando.id, comp, descricao, numero(valor), n, categoriaId!, rateios)
      : lancarDebito(comp, descricao, numero(valor), n, categoriaId!, rateios),
    () => {
      salvou(editando ? 'Débito corrigido.' : `${descricao.trim()} lançado${n > 1 ? ` em ${n} parcelas` : ''}.`);
      if (!editando) { setDescricao(''); setValor(''); setParcelas('1'); setCategoriaId(null); setDivisao(DIVISAO_MINHA); }
    },
  );

  return <>
    <Campo id="deb-desc" rotulo="Descrição" placeholder="Ex.: Pizza Hut" value={descricao} onChange={e => setDescricao(e.target.value)} />
    <div style={{ display: 'flex', gap: 10 }}>
      <div style={{ flex: 2 }}>
        <Campo id="deb-valor" rotulo={n > 1 ? 'Valor de cada parcela' : 'Valor'} inputMode="decimal" placeholder="0,00"
          value={valor} onChange={e => setValor(e.target.value)} />
      </div>
      <div style={{ flex: 1 }}>
        <Campo id="deb-parc" rotulo="Parcelas" inputMode="numeric" value={parcelas} onChange={e => setParcelas(e.target.value)} />
      </div>
    </div>
    {editando && <Campo id="deb-mes" rotulo={n > 1 ? 'Primeira parcela em' : 'Mês do orçamento'} type="month" value={mes} onChange={e => setMes(e.target.value)} />}
    {n > 1 && numero(valor) !== 0 && (
      <div className="mutado" style={{ fontSize: 13, padding: '0 4px' }}>
        {n}× R$ {reais(numero(valor))} = R$ {reais(n * numero(valor))}, de {nomeMes(comp).toLowerCase()} em diante
      </div>
    )}

    <Titulo>De quem é?</Titulo>
    <Divisao pessoas={opcoes.pessoas} estado={divisao} mudar={setDivisao} total={Math.abs(numero(valor))} />

    <Titulo>Categoria</Titulo>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {opcoes.categorias.map(c => <Chip key={c.id} ativo={categoriaId === c.id} onClick={() => setCategoriaId(c.id)}>{c.nome}</Chip>)}
    </div>

    {erro && <div role="alert" style={{ color: 'var(--negativo)' }}>{erro}</div>}
    <button className="botao-mel" onClick={salvar}
      disabled={!descricao.trim() || numero(valor) === 0 || categoriaId === null || passou || incompleta || !mes || salvando}>
      {salvando ? 'Salvando…' : editando ? 'Salvar alterações' : 'Lançar débito'}
    </button>
  </>;
}

export function FormGasolina({ salvou, editando }: { salvou: (t: string) => void; editando?: EditandoGasolina }) {
  const cartoes: CartaoManual[] = useQuery({ queryKey: ['cartoesManuais'], queryFn: buscarCartoesManuais }).data ?? [];
  const [escolhido, setCartaoId] = useState<number | null>(editando?.cartaoId ?? null);
  const cartaoId = escolhido ?? cartoes[0]?.id ?? null;   // primeiro cartão até você escolher outro
  const [valor, setValor] = useState(editando ? textoValor(editando.valor) : '');
  const [data, setData] = useState(editando?.data ?? new Date().toLocaleDateString('sv-SE'));

  const cartao = cartoes.find(c => c.id === cartaoId);
  const previsao = cartao && data ? competenciaGasolina(data, cartao) : null;
  const { salvando, erro, salvar } = useSalvar(
    () => editando ? atualizarGasolina(editando.id, data, numero(valor), cartaoId!) : lancarGasolina(data, numero(valor), cartaoId!),
    () => {
      salvou(editando ? 'Abastecimento corrigido.' : `Abastecimento de R$ ${reais(numero(valor))} lançado.`);
      if (!editando) setValor('');
    },
  );

  return <>
    <Campo id="gas-valor" rotulo="Quanto abasteceu?" inputMode="decimal" placeholder="0,00" value={valor} onChange={e => setValor(e.target.value)} />
    <Campo id="gas-data" rotulo="Quando?" type="date" value={data} onChange={e => setData(e.target.value)} />
    <Titulo>Em qual cartão?</Titulo>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {cartoes.map(c => <Chip key={c.id} ativo={cartaoId === c.id} onClick={() => setCartaoId(c.id)}>{c.nome}</Chip>)}
    </div>
    {previsao && (
      <div className="mutado" style={{ fontSize: 13, padding: '0 4px', lineHeight: 1.5 }}>
        Vence em {diaMesCurto(previsao.vencimento)} e entra no orçamento de {nomeMes(previsao.competencia).toLowerCase()}.
      </div>
    )}
    {erro && <div role="alert" style={{ color: 'var(--negativo)' }}>{erro}</div>}
    <button className="botao-mel" disabled={numero(valor) <= 0 || !cartaoId || !data || salvando} onClick={salvar}>
      {salvando ? 'Salvando…' : editando ? 'Salvar alterações' : 'Salvar abastecimento'}
    </button>
  </>;
}
