-- Tabela de pedidos online
create table if not exists pedidos_online (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  telefone text,
  endereco text,
  itens_texto text,
  total numeric default 0,
  status text default 'aguardando',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Habilita acesso via anon key
alter table pedidos_online enable row level security;
create policy "anon_all" on pedidos_online for all using (true) with check (true);
