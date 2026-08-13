-- ============================================================
-- SUPLEMENTOS PRO — Execute no SQL Editor do Supabase
-- ============================================================

create table if not exists usuarios (
  id text primary key,
  nome text not null,
  login text unique not null,
  senha text not null,
  perfil text not null default 'vendedor',
  ativo boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz
);

create table if not exists produtos (
  id text primary key,
  nome text not null,
  marca text,
  categoria text,
  codigo_barras text,
  preco_custo numeric(12,2) default 0,
  preco_venda numeric(12,2) default 0,
  estoque integer default 0,
  estoque_min integer default 10,
  emoji text,
  created_at timestamptz default now(),
  updated_at timestamptz
);

create table if not exists clientes (
  id text primary key,
  nome text not null,
  telefone text,
  email text,
  observacoes text,
  created_at timestamptz default now(),
  updated_at timestamptz
);

create table if not exists vendas (
  id text primary key,
  itens jsonb not null default '[]',
  subtotal numeric(12,2) default 0,
  desconto numeric(12,2) default 0,
  total numeric(12,2) default 0,
  pagamento text,
  pagamento_nome text,
  cliente_id text,
  cliente_nome text,
  status text default 'pago',
  caixa_id text,
  created_at timestamptz default now()
);

create table if not exists caixas (
  id text primary key,
  status text not null default 'aberto',
  saldo_inicial numeric(12,2) default 0,
  saldo_final numeric(12,2),
  aberto_em timestamptz default now(),
  fechado_em timestamptz,
  operador text,
  movimentacoes jsonb default '[]'
);

create table if not exists movimentacoes (
  id text primary key,
  produto_id text,
  nome_produto text,
  tipo text,
  quantidade integer,
  saldo_anterior integer,
  saldo_atual integer,
  motivo text,
  responsavel text,
  created_at timestamptz default now()
);

-- Permitir acesso total via chave anon (app interno)
alter table usuarios  disable row level security;
alter table produtos  disable row level security;
alter table clientes  disable row level security;
alter table vendas    disable row level security;
alter table caixas    disable row level security;
alter table movimentacoes disable row level security;
