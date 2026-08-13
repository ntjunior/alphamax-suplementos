-- Execute no Supabase > SQL Editor

-- 1) Novas colunas na tabela produtos
alter table produtos add column if not exists sabor text;
alter table produtos add column if not exists descricao text;
alter table produtos add column if not exists imagem_url text;
alter table produtos add column if not exists ativo boolean default true;

-- 2) Criar bucket para fotos (execute UMA VEZ)
-- Depois vá em: Storage > New bucket > nome: "produtos" > marcar Public
-- OU rode:
insert into storage.buckets (id, name, public)
values ('produtos', 'produtos', true)
on conflict (id) do nothing;

-- 3) Política para uploads públicos (anon pode fazer upload)
create policy "Upload publico produtos"
on storage.objects for insert
to anon
with check (bucket_id = 'produtos');

create policy "Leitura publica produtos"
on storage.objects for select
to anon
using (bucket_id = 'produtos');
