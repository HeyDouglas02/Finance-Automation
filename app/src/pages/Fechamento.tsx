import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dadosMudaram } from '../lib/cache';
import { useSearchParams } from 'react-router-dom';
import {
  buscarAcertos, buscarFechamento, buscarItensAcerto, buscarItensOrigem, buscarPerfil, desfazerPagamento, desmarcarBaixa, marcarBaixa, registrarPagamento,
  type Acerto, type ItemAcerto, type LinhaFechamento,
} from '../lib/dados';
import { diaMesCurto, mesAtual, nomeMes, reais, reaisComSinal, somaMes, venceOuVenceu } from '../lib/formato';
import { SeletorMes } from '../components/SeletorMes';
import { Icone } from '../components/Icone';
import { TituloAba } from '../components/BotaoOlho';

/**
 * Aba Fechamento (regra 18): entradas do mês (renda + acertos) com Recebi e saídas
 * (faturas, contas fixas no débito, débitos) com Paguei. Sobra = entradas − saídas.
 * Sem mês na URL abre o mês anterior: as contas de um mês são pagas no começo do seguinte.
 */
export function Fechamento() {
  const [params] = useSearchParams();
  const competencia = params.get('mes') ?? somaMes(mesAtual(), -1);
  const [aberta, setAberta] = useState<string | null>(null);
  const consulta = useQuery({ queryKey: ['fechamento', competencia], queryFn: () => buscarFechamento(competencia) });
  const consultaAcertos = useQuery({ queryKey: ['acertos', competencia], queryFn: () => buscarAcertos(competencia) });
  const erro = consulta.error?.message ?? consultaAcertos.error?.message ?? '';
  const fechamento = consulta.data ?? null;
  const acertos: Acerto[] = consultaAcertos.data ?? [];

  useEffect(() => { setAberta(null); }, [competencia]);

  const soma = (linhas: LinhaFechamento[]) => linhas.reduce((t, l) => t + l.valor, 0);
  const rendas = fechamento?.entradas.filter(l => l.pessoaId === null) ?? [];
  const faltaReceber = soma(fechamento?.entradas.filter(l => !l.marcado) ?? []);
  const faltaPagar = soma(fechamento?.saidas.filter(l => !l.marcado) ?? []);
  const sobra = soma(fechamento?.entradas ?? []) - soma(fechamento?.saidas ?? []);
  // conferência com o banco: o que já entrou menos o que já saiu
  const naConta = soma(fechamento?.entradas.filter(l => l.marcado) ?? []) - soma(fechamento?.saidas.filter(l => l.marcado) ?? []);

  return (
    <main className="tela" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <TituloAba>Fechamento</TituloAba>
      <SeletorMes competencia={competencia} rota="/fechamento" />

      {erro && <div role="alert" style={{ color: 'var(--negativo)' }}>Erro: {erro}</div>}
      {!fechamento && !erro && <div className="mutado">Carregando…</div>}

      {fechamento && !erro && (
        <>
          <section className="vidro" style={{ padding: '16px 18px' }}>
            <div className="mutado" style={{ fontSize: 14 }}>Sobra de {nomeMes(competencia).split(' ')[0].toLowerCase()}</div>
            <div style={{ fontSize: 28, fontWeight: 800, marginTop: 4, color: sobra < 0 ? 'var(--negativo)' : 'var(--texto)' }}>
              {reaisComSinal(sobra)}
            </div>
            <div className="mutado" style={{ fontSize: 13, marginTop: 2 }}>
              {faltaReceber < 0.01 && faltaPagar < 0.01 ? 'Mês fechado: tudo recebido e pago'
                : `Falta receber R$ ${reais(faltaReceber)} · falta pagar R$ ${reais(faltaPagar)}`}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, marginTop: 12, paddingTop: 12,
              borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={{ fontSize: 14 }}>Deveria ter na conta</span>
              <span style={{ fontSize: 18, fontWeight: 700, color: naConta < 0 ? 'var(--negativo)' : 'var(--texto)' }}>{reaisComSinal(naConta)}</span>
            </div>
            <div className="mutado" style={{ fontSize: 12, marginTop: 2 }}>o que você marcou como recebido menos o que marcou como pago</div>
          </section>

          <h2 style={{ fontSize: 16, fontWeight: 600, margin: '8px 4px 0' }}>Entradas</h2>
          {rendas.map(l => <LinhaBaixa key={l.ref} linha={l} acao="Recebi" />)}
          {acertos.map(a => (
            <CartaoPessoa key={competencia + a.pessoa} acerto={a} competencia={competencia}
              aberta={aberta === a.pessoa} alternar={() => setAberta(aberta === a.pessoa ? null : a.pessoa)}
              mudou={dadosMudaram} />
          ))}
          {!rendas.length && !acertos.length && <div className="mutado" style={{ padding: '0 4px' }}>Nenhuma entrada neste mês.</div>}

          <h2 style={{ fontSize: 16, fontWeight: 600, margin: '8px 4px 0' }}>Saídas</h2>
          {fechamento.saidas.map(l => <LinhaBaixa key={l.ref} linha={l} acao="Paguei" />)}
          {!fechamento.saidas.length && <div className="mutado" style={{ padding: '0 4px' }}>Nenhuma saída neste mês.</div>}
        </>
      )}
    </main>
  );
}

/** Renda ou saída: toque em Recebi/Paguei marca; toque no ✓ desmarca. */
function LinhaBaixa({ linha: l, acao }: { linha: LinhaFechamento; acao: 'Recebi' | 'Paguei' }) {
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [aberta, setAberta] = useState(false);
  // "Pagar <origem>" junta débitos de outra pessoa: tocar no nome mostra os itens (ref = origem:<nome>:<mês>)
  const origem = l.ref.startsWith('origem:') ? l.ref.slice(7, l.ref.lastIndexOf(':')) : null;
  const competencia = l.ref.slice(l.ref.lastIndexOf(':') + 1) + '-01';
  const itens = useQuery({
    queryKey: ['itensOrigem', competencia, origem], queryFn: () => buscarItensOrigem(competencia, origem!), enabled: aberta && !!origem,
  }).data ?? null;

  const alternar = async () => {
    setSalvando(true);
    setErro('');
    try { await (l.marcado ? desmarcarBaixa(l.ref) : marcarBaixa(l.ref)); dadosMudaram(); } catch (e) { setErro((e as Error).message); }
    setSalvando(false);
  };

  const rodape = l.marcado && l.marcadoEm ? `${acao === 'Recebi' ? 'Recebido' : 'Pago'} em ${diaMesCurto(l.marcadoEm)}`
    : l.vencimento ? `${venceOuVenceu(l.vencimento)} ${diaMesCurto(l.vencimento)}` : null;

  const nome = <>
    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 16, fontWeight: 600 }}>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.descricao}</span>
      {origem && <span style={{ display: 'flex', flexShrink: 0, transform: aberta ? 'rotate(180deg)' : 'none' }}><Icone nome="baixo" tamanho={14} cor="#C9C2B7" /></span>}
    </span>
    {rodape && <span className="mutado" style={{ display: 'block', fontSize: 13, marginTop: 2 }}>{rodape}</span>}
    {erro && <span role="alert" style={{ display: 'block', color: 'var(--negativo)', fontSize: 13, marginTop: 2 }}>{erro}</span>}
  </>;

  return (
    <section className="vidro" style={{ padding: '12px 16px' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      {origem
        ? <button onClick={() => setAberta(!aberta)} aria-expanded={aberta} style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>{nome}</button>
        : <span style={{ flex: 1, minWidth: 0 }}>{nome}</span>}
      <span style={{ flexShrink: 0, fontSize: 16, fontWeight: 700 }}>R$ {reais(l.valor)}</span>
      {l.marcado ? (
        <button onClick={alternar} disabled={salvando} aria-label={`Desfazer ${acao}`}
          style={{ width: 44, height: 44, flexShrink: 0, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(143,207,158,0.16)' }}>
          <Icone nome="certo" tamanho={20} cor="var(--positivo)" />
        </button>
      ) : (
        <button className="pilula" onClick={alternar} disabled={salvando}
          style={{ height: 44, padding: '0 14px', flexShrink: 0, fontSize: 14, fontWeight: 600 }}>
          {salvando ? '…' : acao}
        </button>
      )}
    </div>
    {aberta && (
      <div style={{ marginTop: 10 }}>
        {itens === null && <div className="mutado" style={{ fontSize: 13 }}>Carregando…</div>}
        {itens?.map((i, k) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 0',
            borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: 14 }}>
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {i.descricao}{i.categoria ? <span className="mutado"> · {i.categoria}</span> : null}
            </span>
            <span style={{ flexShrink: 0, fontWeight: 600 }}>R$ {reais(i.valor)}</span>
          </div>
        ))}
      </div>
    )}
    </section>
  );
}

function CartaoPessoa({ acerto: a, competencia, aberta, alternar, mudou }: {
  acerto: Acerto; competencia: string; aberta: boolean; alternar: () => void; mudou: () => void;
}) {
  // itens só são buscados quando o cartão abre (e ficam em cache)
  const itensConsulta = useQuery({
    queryKey: ['itensAcerto', competencia, a.pessoa], queryFn: () => buscarItensAcerto(competencia, a.pessoa), enabled: aberta,
  });
  const itens: ItemAcerto[] | null = itensConsulta.data ?? null;
  const [confirmando, setConfirmando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => { if (!aberta) setConfirmando(false); }, [aberta]);

  const executar = async (acao: () => Promise<void>) => {
    setSalvando(true);
    setErro('');
    try { await acao(); setConfirmando(false); mudou(); } catch (e) { setErro((e as Error).message); }
    setSalvando(false);
  };

  return (
    <section className="vidro" style={{ padding: '14px 16px' }}>
      <button onClick={alternar} aria-expanded={aberta}
        style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 16, fontWeight: 600 }}>{a.pessoa}</span>
          <span className="mutado" style={{ display: 'block', fontSize: 13, marginTop: 2 }}>
            {a.pago && a.ultimoPagamento ? `Pagou em ${diaMesCurto(a.ultimoPagamento)}` : `${a.itens} ${a.itens === 1 ? 'item' : 'itens'} · Pendente`}
          </span>
        </span>
        <span style={{ textAlign: 'right' }}>
          <span style={{ display: 'block', fontSize: 16, fontWeight: 700 }}>R$ {reais(a.devido)}</span>
          {a.pago && <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--positivo)', marginTop: 2 }}>Pago</span>}
        </span>
        <span style={{ display: 'flex', transform: aberta ? 'rotate(180deg)' : 'none' }}><Icone nome="baixo" tamanho={16} cor="#C9C2B7" /></span>
      </button>

      {aberta && (
        <div style={{ marginTop: 10 }}>
          {itens === null && !erro && <div className="mutado" style={{ fontSize: 13 }}>Carregando…</div>}
          {itens?.map((i, k) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 0',
              borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: 14 }}>
              <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {i.descricao}{i.previsto ? <span className="mutado"> (prevista)</span> : null}
              </span>
              <span style={{ flexShrink: 0, fontWeight: 600 }}>R$ {reais(i.valor)}</span>
            </div>
          ))}

          {(erro || itensConsulta.error) && <div role="alert" style={{ color: 'var(--negativo)', fontSize: 13, marginTop: 8 }}>{erro || itensConsulta.error?.message}</div>}

          {a.pago ? (
            <button onClick={() => executar(() => desfazerPagamento(competencia, a.pessoaId))} disabled={salvando}
              className="mutado" style={{ marginTop: 10, fontSize: 13, textDecoration: 'underline' }}>
              Desfazer "Recebi"
            </button>
          ) : confirmando ? (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 14, marginBottom: 8 }}>Registrar R$ {reais(a.falta)} recebido de {a.pessoa} hoje?</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="pilula" onClick={() => setConfirmando(false)} style={{ flex: 1, height: 46, fontSize: 15 }}>Cancelar</button>
                <button className="botao-mel" disabled={salvando} onClick={() => executar(() => registrarPagamento(competencia, a.pessoaId, a.falta))}
                  style={{ flex: 1 }}>{salvando ? 'Salvando…' : 'Confirmar'}</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <BotaoWhatsApp acerto={a} itens={itens} competencia={competencia} />
              <button className="botao-mel" onClick={() => setConfirmando(true)} style={{ flex: 1 }}>Recebi</button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/** Abre o WhatsApp da pessoa com a cobrança escrita (o envio é com você). */
function BotaoWhatsApp({ acerto: a, itens, competencia }: { acerto: Acerto; itens: ItemAcerto[] | null; competencia: string }) {
  const pix = useQuery({ queryKey: ['perfil'], queryFn: buscarPerfil }).data?.chavePix;
  if (!a.telefone) {
    return <span className="mutado" style={{ flex: 1, fontSize: 12, alignSelf: 'center', lineHeight: 1.4 }}>Sem telefone cadastrado</span>;
  }
  const mes = nomeMes(competencia).split(' ')[0].toLowerCase();
  const mensagem = [
    `Oi, ${a.pessoa}! Acerto de ${mes}:`,
    ...(itens ?? []).map(i => `• ${i.descricao}: R$ ${reais(i.valor)}`),
    '',
    `Total: R$ ${reais(a.falta)}`,
    ...(pix ? [`Pix: ${pix}`] : []),
  ].join('\n');
  return (
    <a href={`https://wa.me/${a.telefone}?text=${encodeURIComponent(mensagem)}`} target="_blank" rel="noreferrer"
      className="pilula" aria-disabled={!itens}
      style={{ flex: 1, height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        fontSize: 15, fontWeight: 600, color: 'var(--texto)', textDecoration: 'none', pointerEvents: itens ? 'auto' : 'none' }}>
      Cobrar no WhatsApp
    </a>
  );
}
