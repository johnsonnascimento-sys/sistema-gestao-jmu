drop function if exists public.match_documents(vector, double precision, integer);
drop function if exists public.match_documents_fts(text, integer);
drop function if exists public.match_documents_lexical(text, integer);

drop table if exists adminlog.assunto_normas cascade;
drop table if exists adminlog.modelos_index cascade;
drop table if exists adminlog.ai_generation_log cascade;
drop table if exists adminlog.ai_generation_log_legacy_20260213 cascade;
drop table if exists adminlog.normas_index cascade;
drop table if exists adminlog.normas_index_legacy_20260213 cascade;

drop extension if exists vector;
