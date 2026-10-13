import { useState, type InputHTMLAttributes } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dadosMudaram } from '../lib/cache';
import { useSearchParams } from 'react-router-dom';
import {
  buscarCartoesManuais, buscarFontesRenda, buscarLancados, buscarOpcoes, excluirLancado,
  lancarDebito, lancarGasolina, lancarRenda,
  type CartaoManual, type Lancado, type Opcao,
} from '../lib/dados';
import { competenciaGasolina, diaMesCurto, mesAtual, nomeMes, reais } from '../lib/formato';
import { SeletorMes } from '../components/SeletorMes';
import { Chip, DIVISAO_MINHA, Divisao, Titulo, calcularDivisao, type EstadoDivisao } from '../components/Divisao';
import { Icone } from '../components/Icone';
import { TituloAba } from '../components/BotaoOlho';

type Tipo = 'renda' | 'debito' | 'gasolina';
const NOMES: Record<Tipo, string> = { renda: 'Renda', debito: 'Débito', gasolina: 'Gasolina' };

// "12,5" ou "12.5" → 12.5; vazio ou inválido → 0
const numero = (texto: string) => Number(texto.replace(',', '.')) || 0;

/** Aba Lançar: renda, débito e gasolina (regras 2, 6 e 7). Embaixo, o que já foi lançado no mês, com excluir. */
export function Lancar() {
  const [params] = useSearchParams();
  const competencia = params.get('mes') ?? mesAtual();
  const [tipo, setTipo] = useState<Tipo>('renda');
  const [aviso, setAviso] = useState('');
  const lancados: Lancado[] | null = useQuery({ queryKey: ['lancados', competencia], queryFn: () => buscarLancados(competencia) }).data ?? null;

  const salvou = (texto: string) => { setAviso(texto); dadosMudaram(); };

  return (
    <main className="tela" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <TituloAba>Lançar</TituloAba>
      {tipo !== 'gasolina' && <SeletorMes competencia={competencia} rota="/lancar" />}

      <div style={{ display: 'flex', gap: 8 }}>
        {(Object.keys(NOMES) as Tipo[]).map(t => (
          <Chip key={t} ativo={tipo === t} onClick={() => { setTipo(t); setAviso(''); }}>{NOMES[t]}</Chip>
        ))}
      </div>

      {tipo === 'renda' && <FormRenda competencia={competencia} salvou={salvou} />}
      {tipo === 'debito' && <FormDebito competencia={competencia} salvou={salvou} />}
      {tipo === 'gasolina' && <FormGasolina salvou={salvou} />}

      {aviso && <div role="status" style={{ color: 'var(--positivo)', fontSize: 14, padding: '0 4px' }}>{aviso}</div>}

      <ListaLancados competencia={competencia} lancados={lancados} mudou={dadosMudaram} />
    </main>
  );
}

function Campo({ id, rotulo, ...input }: { id: string; rotulo: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label htmlFor={id} style={{ fontSize: 15, fontWeight: 600, margin: '6px 4px 0' }}>{rotulo}</label>
      <input id={id} className="pilula" style={{ height: 46, padding: '0 16px', fontSize: 16 }} {...input} />
    </div>
  );
}

/** Botão Salvar com erro embaixo; limpa o formulário só se deu certo. */
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

function FormRenda({ competencia, salvou }: { competencia: string; salvou: (t: string) => void }) {
  const fontes = useQuery({ queryKey: ['fontesRenda'], queryFn: buscarFontesRenda }).data ?? [];
  const [fonte, setFonte] = useState('');
  const [valor, setValor] = useState('');

  const { salvando, erro, salvar } = useSalvar(
    () => lancarRenda(competencia, fonte, numero(valor)),
    () => { salvou(`Renda de ${fonte} lançada em ${nomeMes(competencia).toLowerCase()}.`); setValor(''); },
  );

  return <>
    <Titulo>Fonte</Titulo>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {fontes.map(f => <Chip key={f} ativo={fonte === f} onClick={() => setFonte(f)}>{f}</Chip>)}
    </div>
    <Campo id="renda-fonte" rotulo="Ou outra fonte" placeholder="Ex.: Freela" value={fontes.includes(fonte) ? '' : fonte}
      onChange={e => setFonte(e.target.value)} />
    <Campo id="renda-valor" rotulo="Valor" inputMode="decimal" placeholder="0,00" value={valor} onChange={e => setValor(e.target.value)} />
    <p className="mutado" style={{ fontSize: 12, lineHeight: 1.5, margin: '0 4px' }}>
      A renda de {nomeMes(competencia).toLowerCase()} é a que paga as contas de {nomeMes(competencia).toLowerCase()} (normalmente recebida no mês seguinte).
    </p>
    {erro && <div role="alert" style={{ color: 'var(--negativo)' }}>{erro}</div>}
    <button className="botao-mel" disabled={!fonte.trim() || numero(valor) <= 0 || salvando} onClick={salvar}>
      {salvando ? 'Salvando…' : 'Lançar renda'}
    </button>
  </>;
}

function FormDebito({ competencia, salvou }: { competencia: string; salvou: (t: string) => void }) {
  const opcoes: { categorias: Opcao[]; pessoas: Opcao[] } = useQuery({ queryKey: ['opcoes'], queryFn: buscarOpcoes }).data ?? { categorias: [], pessoas: [] };
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [parcelas, setParcelas] = useState('1');
  const [categoriaId, setCategoriaId] = useState<number | null>(null);
  const [divisao, setDivisao] = useState<EstadoDivisao>(DIVISAO_MINHA);

  const n = Math.max(1, Math.floor(numero(parcelas)));
  const { rateios, passou, incompleta } = calcularDivisao(divisao, Math.abs(numero(valor)));
  const { salvando, erro, salvar } = useSalvar(
    () => lancarDebito(competencia, descricao, numero(valor), n, categoriaId!, rateios),
    () => {
      salvou(`${descricao.trim()} lançado${n > 1 ? ` em ${n} parcelas` : ''}.`);
      setDescricao(''); setValor(''); setParcelas('1'); setCategoriaId(null); setDivisao(DIVISAO_MINHA);
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
    {n > 1 && numero(valor) !== 0 && (
      <div className="mutado" style={{ fontSize: 13, padding: '0 4px' }}>
        {n}× R$ {reais(numero(valor))} = R$ {reais(n * numero(valor))}, de {nomeMes(competencia).toLowerCase()} em diante
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
      disabled={!descricao.trim() || numero(valor) === 0 || categoriaId === null || passou || incompleta || salvando}>
      {salvando ? 'Salvando…' : 'Lançar débito'}
    </button>
  </>;
}

function FormGasolina({ salvou }: { salvou: (t: string) => void }) {
  const cartoes: CartaoManual[] = useQuery({ queryKey: ['cartoesManuais'], queryFn: buscarCartoesManuais }).data ?? [];
  const [escolhido, setCartaoId] = useState<number | null>(null);
  const cartaoId = escolhido ?? cartoes[0]?.id ?? null;   // primeiro cartão até você escolher outro
  const [valor, setValor] = useState('');
  const [data, setData] = useState(new Date().toLocaleDateString('sv-SE'));

  const cartao = cartoes.find(c => c.id === cartaoId);
  const previsao = cartao && data ? competenciaGasolina(data, cartao) : null;
  const { salvando, erro, salvar } = useSalvar(
    () => lancarGasolina(data, numero(valor), cartaoId!),
    () => { salvou(`Abastecimento de R$ ${reais(numero(valor))} lançado.`); setValor(''); },
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
      {salvando ? 'Salvando…' : 'Salvar abastecimento'}
    </button>
  </>;
}

function ListaLancados({ competencia, lancados, mudou }: { competencia: string; lancados: Lancado[] | null; mudou: () => void }) {
  const [aberta, setAberta] = useState(false);
  const [confirmar, setConfirmar] = useState<string | null>(null);
  const [erro, setErro] = useState('');
  if (!lancados?.length) return null;

  const excluir = async (l: Lancado) => {
    setErro('');
    try { await excluirLancado(l.tipo, l.id); setConfirmar(null); mudou(); } catch (e) { setErro((e as Error).message); }
  };

  return <>
    {/* fechada por padrão: o foco da aba é lançar; a lista serve pra conferir e corrigir */}
    <section className="vidro" style={{ padding: '4px 16px', marginTop: 8 }}>
      <button onClick={() => setAberta(!aberta)} aria-expanded={aberta}
        style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', fontSize: 15, fontWeight: 600 }}>
        <span>Lançados em {nomeMes(competencia).toLowerCase()} <span className="mutado" style={{ fontWeight: 400 }}>({lancados.length})</span></span>
        <span style={{ display: 'flex', transform: aberta ? 'rotate(180deg)' : 'none' }}><Icone nome="baixo" tamanho={16} cor="#C9C2B7" /></span>
      </button>
      {aberta && lancados.map(l => (
        <div key={l.ref} style={{ padding: '10px 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.descricao}</span>
              <span className="mutado" style={{ display: 'block', fontSize: 12, marginTop: 2 }}>{NOMES[l.tipo]}</span>
            </span>
            <span style={{ fontSize: 15, fontWeight: 700, color: l.tipo === 'renda' ? 'var(--mel)' : undefined }}>
              {l.tipo === 'renda' ? '+ ' : ''}R$ {reais(l.valor)}
            </span>
            <button aria-label={`Excluir ${l.descricao}`} onClick={() => setConfirmar(confirmar === l.ref ? null : l.ref)}
              className="mutado" style={{ width: 32, height: 32, fontSize: 16 }}>✕</button>
          </div>
          {confirmar === l.ref && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, fontSize: 13 }}>
              <span style={{ flex: 1 }}>{l.tipo === 'debito' && /\(\d+ de \d+\)$/.test(l.descricao) ? 'Excluir todas as parcelas?' : 'Excluir este lançamento?'}</span>
              <button onClick={() => setConfirmar(null)} className="mutado">Cancelar</button>
              <button onClick={() => excluir(l)} style={{ color: 'var(--negativo)', fontWeight: 700 }}>Excluir</button>
            </div>
          )}
        </div>
      ))}
    </section>
    {erro && <div role="alert" style={{ color: 'var(--negativo)' }}>{erro}</div>}
  </>;
}
