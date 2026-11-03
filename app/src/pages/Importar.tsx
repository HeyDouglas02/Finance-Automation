import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { dadosMudaram } from '../lib/cache';
import {
  buscarOpcoes, buscarPessoas, criarPessoa, importarMes, lembrarAppDaPessoa, lerPacote, mesmoNome, type Pacote, type Pessoa,
} from '../lib/dados';
import { nomeMes, reais } from '../lib/formato';
import { Chip } from '../components/Divisao';

// categoria comparada sem acento nem maiúscula ("Saúde" = "saude"), regra 23
const chave = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

const ler = (hash: string) => {
  try { return { pacote: lerPacote(hash), erro: '' }; } catch (e) { return { pacote: null, erro: (e as Error).message }; }
};

/**
 * Importar (regra 23): aberta pelo link da cobrança, ou por Mais → Importar colando o link
 * (no iPhone o link abre no Safari, não no app instalado). Mostra o mês que a outra pessoa mandou e grava ao confirmar.
 */
export function Importar() {
  const navegar = useNavigate();
  const [lido, setLido] = useState<{ pacote: Pacote | null; erro: string }>(() =>
    window.location.hash ? ler(window.location.hash) : { pacote: null, erro: '' });
  const [colado, setColado] = useState('');
  const pessoas: Pessoa[] = useQuery({ queryKey: ['pessoas'], queryFn: buscarPessoas }).data ?? [];
  const categorias = useQuery({ queryKey: ['opcoes'], queryFn: buscarOpcoes }).data?.categorias ?? [];
  const [escolhida, setEscolhida] = useState<number | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const p = lido.pacote;
  const ativas = pessoas.filter(x => !x.arquivada);
  // sugestão: quem tem o endereço do app de onde veio; senão, o mesmo nome
  const sugerida = p ? ativas.find(x => x.appUrl === p.de.app) ?? ativas.find(x => mesmoNome(x.nome, p.de.nome)) : undefined;
  const pessoa = ativas.find(x => x.id === (escolhida ?? sugerida?.id));
  const total = p ? p.itens.reduce((t, i) => t + i[1], 0) : 0;
  const mes = p ? nomeMes(p.mes).split(' ')[0].toLowerCase() : '';

  const importar = async () => {
    if (!p || !pessoa) return;
    setSalvando(true);
    setErro('');
    try {
      const idCategoria = (nome: string | null) => nome ? categorias.find(c => chave(c.nome) === chave(nome))?.id ?? null : null;
      await importarMes(pessoa.nome, p.mes, p.itens.map(([descricao, valor, categoria, data, parcela_num, parcela_total]) =>
        ({ descricao, valor, categoria_id: idCategoria(categoria), data, parcela_num, parcela_total })));
      if (!pessoa.appUrl) await lembrarAppDaPessoa(pessoa.id, p.de.app);
      dadosMudaram();
      navegar(`/fechamento?mes=${p.mes}`, { replace: true });
    } catch (e) { setErro((e as Error).message); setSalvando(false); }
  };

  const criar = async () => {
    if (!p) return;
    setErro('');
    try { await criarPessoa(p.de.nome, '', p.de.app); dadosMudaram(); } catch (e) { setErro((e as Error).message); }
  };

  return (
    <main className="tela" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h1 className="titulo">Importar</h1>

      {!p && (
        <section className="vidro" style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label htmlFor="link-importar" className="mutado" style={{ fontSize: 13, lineHeight: 1.5 }}>
            Copie o link que veio na mensagem do WhatsApp e cole aqui.
          </label>
          <textarea id="link-importar" value={colado} onChange={e => setColado(e.target.value)} rows={3}
            autoCapitalize="off" autoCorrect="off" spellCheck={false} placeholder="https://.../importar#..."
            className="pilula" style={{ padding: '10px 12px', fontSize: 14, width: '100%', borderRadius: 16, resize: 'none' }} />
          <button className="botao-mel" disabled={!colado.includes('#')}
            onClick={() => setLido(ler(colado.slice(colado.indexOf('#')).trim()))}>Ler link</button>
        </section>
      )}

      {lido.erro && <div role="alert" style={{ color: 'var(--negativo)' }}>{lido.erro}</div>}

      {p && <>
        <section className="vidro" style={{ padding: '16px 18px' }}>
          <div className="mutado" style={{ fontSize: 14 }}>{p.de.nome} mandou {mes}</div>
          <div style={{ fontSize: 28, fontWeight: 800, marginTop: 4 }}>R$ {reais(total)}</div>
          <div className="mutado" style={{ fontSize: 13, marginTop: 2 }}>{p.itens.length} {p.itens.length === 1 ? 'compra' : 'compras'}</div>
        </section>

        <section className="vidro" style={{ padding: '6px 16px' }}>
          {p.itens.map(([descricao, valor, categoria, , n, t], k) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '9px 0', fontSize: 14,
              borderTop: k ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
              <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {descricao}{n ? ` ${n}/${t}` : ''}{categoria ? <span className="mutado"> · {categoria}</span> : null}
              </span>
              <span style={{ flexShrink: 0, fontWeight: 600 }}>R$ {reais(valor)}</span>
            </div>
          ))}
        </section>

        <div style={{ fontSize: 15, fontWeight: 600, margin: '6px 4px 0' }}>Quem é {p.de.nome} aqui?</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {ativas.map(x => <Chip key={x.id} ativo={pessoa?.id === x.id} onClick={() => setEscolhida(x.id)}>{x.nome}</Chip>)}
          {!ativas.some(x => mesmoNome(x.nome, p.de.nome)) && (
            <button onClick={criar} style={{ color: 'var(--mel)', fontWeight: 600, fontSize: 14, padding: '0 8px' }}>+ Criar {p.de.nome}</button>
          )}
        </div>

        {pessoa && (
          <p className="mutado" style={{ fontSize: 13, lineHeight: 1.5, margin: '0 4px' }}>
            Vai substituir o que já foi importado de {pessoa.nome} em {mes}. No Fechamento, entra em "Pagar {pessoa.nome}".
          </p>
        )}
        {erro && <div role="alert" style={{ color: 'var(--negativo)' }}>{erro}</div>}
        <button className="botao-mel" disabled={!pessoa || salvando} onClick={importar}>
          {salvando ? 'Importando…' : `Importar ${mes}`}
        </button>
      </>}
    </main>
  );
}
