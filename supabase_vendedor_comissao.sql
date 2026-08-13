-- Colunas de cupom nas vendas (caso ainda não tenha rodado)
alter table vendas add column if not exists cupom_id text;
alter table vendas add column if not exists cupom_codigo text;
alter table vendas add column if not exists comissao_valor numeric(12,2) default 0;

-- Colunas de vendedor nas vendas
alter table vendas add column if not exists vendedor_id text;
alter table vendas add column if not exists vendedor_nome text;
alter table vendas add column if not exists comissao_vendedor_pct numeric(5,2);
alter table vendas add column if not exists comissao_vendedor_valor numeric(12,2);

-- Comissão por vendedor no cadastro de usuários
alter table usuarios add column if not exists comissao_pct numeric(5,2);
