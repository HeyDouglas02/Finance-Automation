import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  buscarAcertos, buscarItensAcerto, desfazerPagamento, registrarPagamento,
  type Acerto, type ItemAcerto,
} from '../lib/dados';
import { diaMesCurto, mesAtual, nomeMes, reais, somaMes } from '../lib/formato';
import { SeletorMes } from '../components/SeletorMes';
import { Icone } from '../components/Icone';

/** Aba Acertos: quem deve quanto no mês, cobrança pelo WhatsApp e "Recebi" (regra 9). */
export function Acertos() {
  const [params] = useSearchParams();
  const competencia = params.get('mes') ?? mesAtual();
  const [acertos, setAcertos] = useState<Acerto[] | null>(null);
  const [aberta, setAberta] = useState<string | null>(null);
  const [erro, setErro] = useState('');
  const [recarregar, setRecarregar] = useState(0);

  useEffect(() => {
    let valido = true;   // trocou de mês antes da resposta chegar: descarta a antiga
    setErro('');
    buscarAcertos(competencia)
      .then(a => { if (valido) setAcertos(a); })
      .catch(e => { if (valido) { setErro(e.message); setAcertos([]); } });
    return () => { valido = false; };
  }, [competencia, recarregar]);

  useEffect(() => { setAcertos(null); setAberta(null); }, [competencia]);

  const falta = (acertos ?? []).reduce((t, a) => t + (a.pago ? 0 : a.falta), 0);
  const mesCobranca = nomeMes(somaMes(competencia, 1)).split(' ')[0].toLowerCase();

  return (
    <main className="tela" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h1 className="titulo">Acertos</h1>
      <SeletorMes competencia={competencia} rota="/acertos" />

      {erro && <div role="alert" style={{ color: 'var(--negativo)' }}>Erro: {erro}</div>}
      {acertos === null && <div className="mutado">Carregando…</div>}

      {acertos && !erro && (
        <section className="vidro" style={{ padding: '16px 18px' }}>
          <div className="mutado" style={{ fontSize: 14 }}>Cobrança em {mesCobranca}</div>
          <div style={{ fontSize: 28, fontWeight: 800, marginTop: 4, color: falta > 0 ? 'var(--texto)' : 'var(--positivo)' }}>
            {falta > 0 ? `R$ ${reais(falta)}` : 'Tudo recebido'}
          </div>
          {falta > 0 && <div className="mutado" style={{ fontSize: 13, marginTop: 2 }}>ainda falta receber</div>}
        </section>
      )}

      {acertos?.length === 0 && !erro && <div className="mutado" style={{ padding: '0 4px' }}>Ninguém te deve nada neste mês.</div>}

      {acertos?.map(a => (
        <CartaoPessoa key={competencia + a.pessoa} acerto={a} competencia={competencia}
          aberta={aberta === a.pessoa} alternar={() => setAberta(aberta === a.pessoa ? null : a.pessoa)}
          mudou={() => setRecarregar(recarregar + 1)} />
      ))}
    </main>
  );
}

function CartaoPessoa({ acerto: a, competencia, aberta, alternar, mudou }: {
  acerto: Acerto; competencia: string; aberta: boolean; alternar: () => void; mudou: () => void;
}) {
  const [itens, setItens] = useState<ItemAcerto[] | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (aberta && itens === null) buscarItensAcerto(competencia, a.pessoa).then(setItens).catch(e => setErro(e.message));
    if (!aberta) setConfirmando(false);
  }, [aberta, itens, competencia, a.pessoa]);

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

          {erro && <div role="alert" style={{ color: 'var(--negativo)', fontSize: 13, marginTop: 8 }}>{erro}</div>}

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
  if (!a.telefone) {
    return <span className="mutado" style={{ flex: 1, fontSize: 12, alignSelf: 'center', lineHeight: 1.4 }}>Sem telefone cadastrado</span>;
  }
  const mes = nomeMes(competencia).split(' ')[0].toLowerCase();
  const pix = import.meta.env.VITE_PIX_CHAVE;
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
