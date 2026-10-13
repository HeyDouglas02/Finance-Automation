-- =====================================================================
-- Finance · 010 · pg_net fora do schema public
-- Security Advisor: "Extension in Public" (pg_net). A 005 criou a extensão
-- sem schema e ela caiu no public. pg_net não pode ser movida (não é
-- relocatable), então é recriada no schema extensions.
--
-- As funções continuam em net.* (net.http_post), então o job do pg_cron,
-- que guarda só o texto da chamada, segue funcionando sem mudança.
-- Perde-se só o histórico de respostas HTTP (net._http_response).
-- =====================================================================

drop extension if exists pg_net;
create extension pg_net with schema extensions;
