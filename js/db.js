const DB = {
  URL: 'https://kefhuzwqfzkjcpavcamq.supabase.co',
  KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtlZmh1endxZnpramNwYXZjYW1xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzODA4NDcsImV4cCI6MjEwMTk1Njg0N30.cRsgIVcLfgfaeJQseWMqwrEuIgF7SydSEMsaYjcJROY',

  _cache: { produtos: [], vendas: [], clientes: [], caixas: [], movimentacoes: [], usuarios: [], cupons: [] },

  _h() {
    return {
      'apikey': this.KEY,
      'Authorization': `Bearer ${this.KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };
  },

  async _select(table, qs = '') {
    const r = await fetch(`${this.URL}/rest/v1/${table}?${qs}`, { headers: this._h() });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },

  async _insert(table, data) {
    const body = Array.isArray(data) ? data.map(d => this._snake(d)) : this._snake(data);
    const r = await fetch(`${this.URL}/rest/v1/${table}`, {
      method: 'POST', headers: this._h(), body: JSON.stringify(body)
    });
    if (!r.ok) throw new Error(await r.text());
    const rows = await r.json();
    if (Array.isArray(data)) return rows.map(row => this._camel(row));
    return rows[0] ? this._camel(rows[0]) : data;
  },

  async _update(table, id, data) {
    const { id: _, createdAt, created_at, ...fields } = data;
    const r = await fetch(`${this.URL}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH', headers: this._h(), body: JSON.stringify(this._snake(fields))
    });
    if (!r.ok) throw new Error(await r.text());
    const rows = await r.json();
    return rows[0] ? this._camel(rows[0]) : null;
  },

  async _delete(table, id) {
    const r = await fetch(`${this.URL}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE', headers: this._h()
    });
    if (!r.ok) throw new Error(await r.text());
  },

  _camel(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [
      k.replace(/_([a-z])/g, (_, c) => c.toUpperCase()), v
    ]));
  },

  _snake(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [
      k.replace(/[A-Z]/g, c => '_' + c.toLowerCase()), v
    ]));
  },

  _id() { return (Date.now() + Math.random()).toString(36) + Math.random().toString(36).slice(2); },

  // ===================== SESSION =====================
  getUsuarioLogado() {
    const id = localStorage.getItem('pdv_sessao');
    if (!id) return null;
    return this._cache.usuarios.find(u => u.id === id) || null;
  },
  setUsuarioLogado(user) {
    if (user) localStorage.setItem('pdv_sessao', user.id);
    else localStorage.removeItem('pdv_sessao');
  },
  logout() { localStorage.removeItem('pdv_sessao'); },
  autenticar(login, senha) {
    return this._cache.usuarios.find(u => u.login === login && u.senha === btoa(senha) && u.ativo) || null;
  },
  initUsuarios() { /* handled in init() */ },

  // ===================== INIT =====================
  async init() {
    const [produtos, vendas, clientes, caixas, movs, usuarios, cupons] = await Promise.all([
      this._select('produtos', 'order=created_at'),
      this._select('vendas', 'order=created_at'),
      this._select('clientes', 'order=created_at'),
      this._select('caixas', 'order=aberto_em'),
      this._select('movimentacoes', 'order=created_at'),
      this._select('usuarios', 'order=created_at'),
      this._select('cupons', 'order=created_at'),
    ]);
    this._cache.produtos      = produtos.map(p => this._camel(p));
    this._cache.vendas        = vendas.map(v => this._camel(v));
    this._cache.clientes      = clientes.map(c => this._camel(c));
    this._cache.caixas        = caixas.map(c => this._camel(c));
    this._cache.movimentacoes = movs.map(m => this._camel(m));
    this._cache.usuarios      = usuarios.map(u => this._camel(u));
    this._cache.cupons        = cupons.map(c => this._camel(c));

    if (this._cache.usuarios.length === 0) {
      const admin = {
        id: 'admin_default', nome: 'Administrador', login: 'admin',
        senha: btoa('1234'), perfil: 'admin', ativo: true,
        createdAt: new Date().toISOString()
      };
      await this._insert('usuarios', admin);
      this._cache.usuarios.push(admin);
    }

    if (this._cache.produtos.length === 0) await this.initDemoData();
  },

  // ===================== PRODUTOS =====================
  getProdutos()         { return this._cache.produtos; },
  getProdutoById(id)    { return this._cache.produtos.find(p => p.id === id) || null; },
  saveProdutos(arr)     { this._cache.produtos = arr; },

  addProduto(p) {
    p.id = p.id || this._id();
    p.createdAt = p.createdAt || new Date().toISOString();
    this._cache.produtos.push(p);
    this._insert('produtos', p).catch(e => { console.error(e); if(window.App) App.showToast('Erro ao salvar produto!','error'); });
    return p;
  },

  updateProduto(id, data) {
    const idx = this._cache.produtos.findIndex(p => p.id === id);
    if (idx !== -1) {
      data.updatedAt = new Date().toISOString();
      this._cache.produtos[idx] = { ...this._cache.produtos[idx], ...data };
      this._update('produtos', id, data).catch(e => console.error(e));
      return this._cache.produtos[idx];
    }
    return null;
  },

  deleteProduto(id) {
    this._cache.produtos = this._cache.produtos.filter(p => p.id !== id);
    this._delete('produtos', id).catch(e => console.error(e));
  },

  // ===================== VENDAS =====================
  getVendas()       { return this._cache.vendas; },
  getVendaById(id)  { return this._cache.vendas.find(v => v.id === id) || null; },
  saveVendas(arr)   { this._cache.vendas = arr; },

  addVenda(v) {
    v.id = v.id || this._id();
    v.createdAt = v.createdAt || new Date().toISOString();
    this._cache.vendas.push(v);
    this._insert('vendas', v).catch(e => { console.error(e); if(window.App) App.showToast('Erro ao registrar venda!','error'); });
    return v;
  },

  // ===================== CLIENTES =====================
  getClientes()        { return this._cache.clientes; },
  getClienteById(id)   { return this._cache.clientes.find(c => c.id === id) || null; },
  saveClientes(arr)    { this._cache.clientes = arr; },

  addCliente(c) {
    c.id = c.id || this._id();
    c.createdAt = c.createdAt || new Date().toISOString();
    this._cache.clientes.push(c);
    this._insert('clientes', c).catch(e => console.error(e));
    return c;
  },

  updateCliente(id, data) {
    const idx = this._cache.clientes.findIndex(c => c.id === id);
    if (idx !== -1) {
      data.updatedAt = new Date().toISOString();
      this._cache.clientes[idx] = { ...this._cache.clientes[idx], ...data };
      this._update('clientes', id, data).catch(e => console.error(e));
      return this._cache.clientes[idx];
    }
    return null;
  },

  deleteCliente(id) {
    this._cache.clientes = this._cache.clientes.filter(c => c.id !== id);
    this._delete('clientes', id).catch(e => console.error(e));
  },

  // ===================== CAIXAS =====================
  getCaixas()       { return this._cache.caixas; },
  saveCaixas(arr)   { this._cache.caixas = arr; },
  getCaixaAberto()  { return this._cache.caixas.find(c => c.status === 'aberto') || null; },

  abrirCaixa(saldoInicial, operador = 'Operador') {
    const caixa = {
      id: this._id(), status: 'aberto',
      saldoInicial: parseFloat(saldoInicial) || 0,
      saldoFinal: null,
      abertoEm: new Date().toISOString(),
      fechadoEm: null,
      operador,
      movimentacoes: []
    };
    this._cache.caixas.push(caixa);
    this._insert('caixas', caixa).catch(e => console.error(e));
    return caixa;
  },

  fecharCaixa(id, saldoFinal) {
    const idx = this._cache.caixas.findIndex(c => c.id === id);
    if (idx !== -1) {
      this._cache.caixas[idx].status = 'fechado';
      this._cache.caixas[idx].saldoFinal = parseFloat(saldoFinal) || 0;
      this._cache.caixas[idx].fechadoEm = new Date().toISOString();
      this._update('caixas', id, {
        status: 'fechado',
        saldoFinal: this._cache.caixas[idx].saldoFinal,
        fechadoEm: this._cache.caixas[idx].fechadoEm
      }).catch(e => console.error(e));
      return this._cache.caixas[idx];
    }
    return null;
  },

  addMovimentacaoCaixa(caixaId, mov) {
    const idx = this._cache.caixas.findIndex(c => c.id === caixaId);
    if (idx !== -1) {
      mov.id = this._id();
      mov.createdAt = new Date().toISOString();
      if (!this._cache.caixas[idx].movimentacoes) this._cache.caixas[idx].movimentacoes = [];
      this._cache.caixas[idx].movimentacoes.push(mov);
      this._update('caixas', caixaId, { movimentacoes: this._cache.caixas[idx].movimentacoes })
        .catch(e => console.error(e));
      return mov;
    }
    return null;
  },

  // ===================== MOVIMENTAÇÕES =====================
  getMovimentacoes() { return this._cache.movimentacoes; },

  addMovimentacao(m) {
    m.id = m.id || this._id();
    m.createdAt = m.createdAt || new Date().toISOString();
    this._cache.movimentacoes.push(m);
    this._insert('movimentacoes', m).catch(e => console.error(e));
    return m;
  },

  // ===================== USUÁRIOS =====================
  getUsuarios()     { return this._cache.usuarios; },
  saveUsuarios(arr) { this._cache.usuarios = arr; },

  addUsuario(u) {
    if (this._cache.usuarios.find(x => x.login === u.login)) return null;
    u.id = u.id || this._id();
    u.createdAt = u.createdAt || new Date().toISOString();
    u.ativo = u.ativo !== undefined ? u.ativo : true;
    u.senha = btoa(u.senha);
    this._cache.usuarios.push(u);
    this._insert('usuarios', u).catch(e => console.error(e));
    return u;
  },

  updateUsuario(id, data) {
    const idx = this._cache.usuarios.findIndex(u => u.id === id);
    if (idx === -1) return null;
    if (data.senha) data.senha = btoa(data.senha);
    data.updatedAt = new Date().toISOString();
    this._cache.usuarios[idx] = { ...this._cache.usuarios[idx], ...data };
    this._update('usuarios', id, data).catch(e => console.error(e));
    return this._cache.usuarios[idx];
  },

  deleteUsuario(id) {
    this._cache.usuarios = this._cache.usuarios.filter(u => u.id !== id);
    this._delete('usuarios', id).catch(e => console.error(e));
  },

  // ===================== CUPONS =====================
  getCupons()              { return this._cache.cupons; },
  getCupomByCodigo(codigo) { return this._cache.cupons.find(c => c.codigo === codigo.toUpperCase() && c.ativo) || null; },
  getCupomById(id)         { return this._cache.cupons.find(c => c.id === id) || null; },

  addCupom(c) {
    if (this._cache.cupons.find(x => x.codigo === c.codigo.toUpperCase())) return null;
    c.id = c.id || this._id();
    c.codigo = c.codigo.toUpperCase();
    c.createdAt = new Date().toISOString();
    this._cache.cupons.push(c);
    this._insert('cupons', c).catch(e => console.error(e));
    return c;
  },

  updateCupom(id, data) {
    const idx = this._cache.cupons.findIndex(c => c.id === id);
    if (idx !== -1) {
      if (data.codigo) data.codigo = data.codigo.toUpperCase();
      data.updatedAt = new Date().toISOString();
      this._cache.cupons[idx] = { ...this._cache.cupons[idx], ...data };
      this._update('cupons', id, data).catch(e => console.error(e));
      return this._cache.cupons[idx];
    }
    return null;
  },

  deleteCupom(id) {
    this._cache.cupons = this._cache.cupons.filter(c => c.id !== id);
    this._delete('cupons', id).catch(e => console.error(e));
  },

  // ===================== DEMO DATA =====================
  async initDemoData() {
    const now = new Date();

    const produtosRaw = [
      { nome: 'Whey Protein Gold Standard 2lbs', marca: 'Optimum Nutrition', categoria: 'Proteínas', codigoBarras: '7891234567001', precoCusto: 180, precoVenda: 289.90, estoque: 45, estoqueMin: 10 },
      { nome: 'Whey Protein Iso 100 5lbs', marca: 'Dymatize', categoria: 'Proteínas', codigoBarras: '7891234567002', precoCusto: 290, precoVenda: 459.90, estoque: 22, estoqueMin: 8 },
      { nome: 'Creatina Monohidratada 300g', marca: 'Growth Supplements', categoria: 'Creatina', codigoBarras: '7891234567003', precoCusto: 40, precoVenda: 79.90, estoque: 60, estoqueMin: 15 },
      { nome: 'Creatina HCL 90 caps', marca: 'Kaged Muscle', categoria: 'Creatina', codigoBarras: '7891234567004', precoCusto: 85, precoVenda: 149.90, estoque: 18, estoqueMin: 10 },
      { nome: 'Pré-treino C4 Original 60 doses', marca: 'Cellucor', categoria: 'Pré-treino', codigoBarras: '7891234567005', precoCusto: 120, precoVenda: 199.90, estoque: 30, estoqueMin: 10 },
      { nome: 'Pré-treino Halo 300g', marca: 'Integralmédica', categoria: 'Pré-treino', codigoBarras: '7891234567006', precoCusto: 55, precoVenda: 99.90, estoque: 8, estoqueMin: 10 },
      { nome: 'BCAA 2400 240 caps', marca: 'Optimum Nutrition', categoria: 'Aminoácidos', codigoBarras: '7891234567007', precoCusto: 60, precoVenda: 109.90, estoque: 35, estoqueMin: 10 },
      { nome: 'Glutamina 300g', marca: 'Growth Supplements', categoria: 'Aminoácidos', codigoBarras: '7891234567008', precoCusto: 35, precoVenda: 64.90, estoque: 42, estoqueMin: 10 },
      { nome: 'Vitamina D3 + K2 60 caps', marca: 'Sundown', categoria: 'Vitaminas', codigoBarras: '7891234567009', precoCusto: 25, precoVenda: 49.90, estoque: 55, estoqueMin: 15 },
      { nome: 'Multivitamínico Animal Pak 44 packs', marca: 'Universal Nutrition', categoria: 'Vitaminas', codigoBarras: '7891234567010', precoCusto: 130, precoVenda: 229.90, estoque: 14, estoqueMin: 8 },
      { nome: 'Thermo Upper 120 caps', marca: 'Iridium Labs', categoria: 'Termogênicos', codigoBarras: '7891234567011', precoCusto: 45, precoVenda: 89.90, estoque: 6, estoqueMin: 10 },
      { nome: 'Lipo 6 Black 120 caps', marca: 'Nutrex', categoria: 'Termogênicos', codigoBarras: '7891234567012', precoCusto: 95, precoVenda: 169.90, estoque: 0, estoqueMin: 8 },
      { nome: 'Waxy Maize 1kg', marca: 'Atlhetica Nutrition', categoria: 'Carboidratos', codigoBarras: '7891234567013', precoCusto: 22, precoVenda: 44.90, estoque: 28, estoqueMin: 10 },
      { nome: 'Dextrose 1kg', marca: 'Growth Supplements', categoria: 'Carboidratos', codigoBarras: '7891234567014', precoCusto: 12, precoVenda: 24.90, estoque: 40, estoqueMin: 15 },
      { nome: 'Ômega 3 Fish Oil 120 caps', marca: 'Natrol', categoria: 'Ômega', codigoBarras: '7891234567015', precoCusto: 30, precoVenda: 59.90, estoque: 50, estoqueMin: 12 },
      { nome: 'Mass Titanium 17500 3kg', marca: 'Max Titanium', categoria: 'Carboidratos', codigoBarras: '7891234567016', precoCusto: 75, precoVenda: 139.90, estoque: 3, estoqueMin: 5 },
      { nome: 'Whey Zero Lactose 900g', marca: 'Adaptogen', categoria: 'Proteínas', codigoBarras: '7891234567017', precoCusto: 95, precoVenda: 179.90, estoque: 17, estoqueMin: 8 },
      { nome: 'ZMA 90 caps', marca: 'Growth Supplements', categoria: 'Vitaminas', codigoBarras: '7891234567018', precoCusto: 28, precoVenda: 54.90, estoque: 33, estoqueMin: 10 }
    ];

    const produtosComId = produtosRaw.map(p => ({
      ...p, id: this._id(), createdAt: new Date(now.getTime() - 7 * 86400000).toISOString()
    }));

    const clientesRaw = [
      { nome: 'João Silva', telefone: '(11) 99001-1234', email: 'joao@email.com', observacoes: 'Cliente fiel, pratica musculação' },
      { nome: 'Maria Santos', telefone: '(11) 98765-4321', email: 'maria@email.com', observacoes: 'Foco em emagrecimento' },
      { nome: 'Pedro Oliveira', telefone: '(11) 97654-3210', email: 'pedro@email.com', observacoes: 'Atleta de crossfit' },
      { nome: 'Ana Costa', telefone: '(11) 96543-2109', email: 'ana@email.com', observacoes: 'Corredora, foco em resistência' },
      { nome: 'Lucas Ferreira', telefone: '(11) 95432-1098', email: 'lucas@email.com', observacoes: '' }
    ];

    const clientesComId = clientesRaw.map(c => ({
      ...c, id: this._id(), createdAt: new Date().toISOString()
    }));

    const pagamentos = ['dinheiro', 'pix', 'credito', 'debito'];
    const nomesPag = { dinheiro: 'Dinheiro', pix: 'PIX', credito: 'Cartão Crédito', debito: 'Cartão Débito' };
    const vendas = [];

    for (let i = 6; i >= 0; i--) {
      const qtd = Math.floor(Math.random() * 5) + 2;
      for (let j = 0; j < qtd; j++) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        d.setHours(8 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 60));
        const sel = produtosComId.filter(p => p.estoque > 0).sort(() => Math.random() - 0.5).slice(0, Math.floor(Math.random() * 3) + 1);
        const itens = sel.map(p => {
          const quantidade = Math.floor(Math.random() * 2) + 1;
          return { produtoId: p.id, nome: p.nome, precoUnitario: p.precoVenda, precoCusto: p.precoCusto, quantidade, subtotal: p.precoVenda * quantidade, estoqueDisp: p.estoque };
        });
        const subtotal = itens.reduce((s, it) => s + it.subtotal, 0);
        const desconto = Math.random() > 0.7 ? parseFloat((subtotal * 0.05).toFixed(2)) : 0;
        const total = subtotal - desconto;
        const pag = pagamentos[Math.floor(Math.random() * pagamentos.length)];
        const cli = clientesComId[Math.floor(Math.random() * clientesComId.length)];
        vendas.push({
          id: this._id(), createdAt: d.toISOString(),
          itens, subtotal, desconto, total,
          pagamento: pag, pagamentoNome: nomesPag[pag],
          clienteId: cli.id, clienteNome: cli.nome,
          status: 'pago', caixaId: null
        });
      }
    }

    const movs = produtosComId.map(p => ({
      id: this._id(), produtoId: p.id, nomeProduto: p.nome,
      tipo: 'entrada', quantidade: p.estoque + 10,
      saldoAnterior: 0, saldoAtual: p.estoque + 10,
      motivo: 'Estoque inicial', responsavel: 'Admin',
      createdAt: new Date(now.getTime() - 7 * 86400000).toISOString()
    }));

    await Promise.all([
      this._insert('produtos', produtosComId),
      this._insert('clientes', clientesComId),
      this._insert('vendas', vendas),
      this._insert('movimentacoes', movs)
    ]);

    this._cache.produtos = produtosComId;
    this._cache.clientes = clientesComId;
    this._cache.vendas = vendas;
    this._cache.movimentacoes = movs;
  }
};
