-- Tabela de cupons de indicação
create table if not exists cupons (
  id text primary key,
  codigo text unique not null,
  nome text not null,
  comissao_pct numeric(5,2) not null default 5,
  ativo boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz
);
alter table cupons disable row level security;

-- Adicionar campos de cupom/comissão nas vendas
alter table vendas add column if not exists cupom_id text;
alter table vendas add column if not exists cupom_codigo text;
alter table vendas add column if not exists comissao_valor numeric(12,2) default 0;
