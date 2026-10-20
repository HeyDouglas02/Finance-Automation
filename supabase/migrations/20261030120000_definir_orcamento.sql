-- =====================================================================
-- Finance · 019 · definir_limite() e definir_orcamento() (regras 13 a 17)
-- Mudam limites e orçamento com vigência, no padrão de mudar_valor_conta_fixa:
--   · linha vigente começa no mesmo mês → só atualiza
--   · senão → encerra a vigente (fim = mês anterior) e cria a nova
--   · linhas que começariam depois do mês são descartadas (a nova manda)
-- definir_limite com valor nulo encerra o limite do grupo.
-- =====================================================================

create function public.definir_limite(p_grupo smallint, p_valor numeric, p_a_partir date)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  mes date := date_trunc('month', p_a_partir)::date;
  v   limites%rowtype;
begin
  if not exists (select 1 from grupos where id = p_grupo and tipo = 'limite') then
    raise exception 'Esse grupo não tem limite';
  end if;
  if p_valor is not null and p_valor <= 0 then
    raise exception 'Valor inválido';
  end if;

  delete from limites where grupo_id = p_grupo and inicio > mes;

  select * into v from limites
   where grupo_id = p_grupo and inicio <= mes and (fim is null or fim >= mes)
   order by inicio desc limit 1;

  if found and v.inicio = mes then
    if p_valor is null then
      delete from limites where id = v.id;
    else
      update limites set valor = p_valor, fim = null where id = v.id;
    end if;
    return;
  end if;

  if found then
    update limites set fim = (mes - interval '1 month')::date where id = v.id;
  end if;
  if p_valor is not null then
    insert into limites (grupo_id, valor, inicio) values (p_grupo, p_valor, mes);
  end if;
end;
$$;

create function public.definir_orcamento(
  p_a_partir date, p_renda_base numeric, p_reserva numeric, p_meta numeric, p_teto numeric)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  mes date := date_trunc('month', p_a_partir)::date;
  v   orcamento%rowtype;
begin
  if p_renda_base is null or p_renda_base <= 0 then
    raise exception 'Renda base inválida';
  end if;
  if coalesce(p_reserva, -1) < 0 or coalesce(p_meta, -1) < 0 then
    raise exception 'Reserva e meta não podem ser negativas';
  end if;
  if p_teto is not null and p_teto <= 0 then
    raise exception 'Teto de parcelas inválido';
  end if;

  delete from orcamento where inicio > mes;

  select * into v from orcamento
   where inicio <= mes and (fim is null or fim >= mes)
   order by inicio desc limit 1;

  if found and v.inicio = mes then
    update orcamento
       set renda_base = p_renda_base, reserva = p_reserva, meta = p_meta, teto_parcelas = p_teto, fim = null
     where id = v.id;
    return;
  end if;

  if found then
    update orcamento set fim = (mes - interval '1 month')::date where id = v.id;
  end if;
  insert into orcamento (inicio, renda_base, reserva, meta, teto_parcelas)
  values (mes, p_renda_base, p_reserva, p_meta, p_teto);
end;
$$;

revoke all on function public.definir_limite(smallint, numeric, date) from public, anon;
revoke all on function public.definir_orcamento(date, numeric, numeric, numeric, numeric) from public, anon;
grant execute on function public.definir_limite(smallint, numeric, date) to authenticated;
grant execute on function public.definir_orcamento(date, numeric, numeric, numeric, numeric) to authenticated;
