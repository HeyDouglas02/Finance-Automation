-- =====================================================================
-- Finance · 012 · Telefone de cada pessoa (cobrança pelo WhatsApp, regra 9)
-- Só dígitos, com DDI e DDD (ex.: 5541999998888), formato que o wa.me pede.
-- Os números são cadastrados pelo app (aba Mais → Pessoas).
-- =====================================================================

alter table pessoas
  add column telefone text check (telefone ~ '^\d{12,13}$');
