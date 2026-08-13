let carrinho = [];
let pagamentoSelecionado = '';
let descontoTipo = 'pct';
let ultimaVenda = null;
let cupomAtual = null;

function carregarProdutos(busca = '', cat = '') {
  let produtos = DB.getProdutos();
  if (busca) {
    busca = busca.toLowerCase();
    produtos = produtos.filter(p => p.nome.toLowerCase().includes(busca) || (p.codigoBarras && p.codigoBarras.includes(busca)));
  }
  if (cat) produtos = produtos.filter(p => p.categoria === cat);

  const grid = document.getElementById('grade-produtos');
  if (produtos.length === 0) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><div class="empty-state-icon"><i data-lucide="search-x"></i></div><div class="empty-state-text">Nenhum produto encontrado</div></div>';
    return;
  }
  const htmlProd = produtos.map(p => `
    <div class="produto-card ${p.estoque === 0 ? 'sem-estoque' : ''}" onclick="adicionarAoCarrinho('${p.id}')">
      <div class="produto-card-img" style="overflow:hidden;display:flex;align-items:center;justify-content:center;">
        ${p.imagemUrl ? `<img src="${p.imagemUrl}" alt="${p.nome}" style="width:100%;height:100%;object-fit:contain;padding:4px;" onerror="this.style.display='none';this.insertAdjacentHTML('afterend','<i data-lucide=\\'package\\'></i>')">` : `<i data-lucide="package"></i>`}
      </div>
      <div class="produto-card-nome">${p.nome}</div>
      <div class="produto-card-marca">${p.marca || ''}</div>
      <div class="produto-card-preco">${App.formatCurrency(p.precoVenda)}</div>
      <div class="produto-card-estoque">Estoque: ${p.estoque} un</div>
    </div>
  `).join('');
  grid.innerHTML = htmlProd;
  if (window.lucide) lucide.createIcons();
}

function carregarCategorias() {
  const produtos = DB.getProdutos();
  const cats = [...new Set(produtos.map(p => p.categoria).filter(Boolean))];
  const container = document.getElementById('filtro-categorias');
  container.innerHTML = '<button class="pill active" data-cat="" onclick="filtrarCategoria(this, \'\')">Todos</button>' +
    cats.map(c => `<button class="pill" data-cat="${c}" onclick="filtrarCategoria(this, '${c}')">${c}</button>`).join('');
}

function carregarClientes() {
  const clientes = DB.getClientes();
  const sel = document.getElementById('select-cliente');
  sel.innerHTML = '<option value="">Consumidor Final</option>' +
    clientes.map(c => `<option value="${c.id}">${c.nome} ${c.telefone ? '— ' + c.telefone : ''}</option>`).join('');
}

let catAtiva = '';
function filtrarCategoria(btn, cat) {
  catAtiva = cat;
  document.querySelectorAll('#filtro-categorias .pill').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const busca = document.getElementById('busca-produto').value;
  carregarProdutos(busca, cat);
}

function adicionarAoCarrinho(produtoId) {
  if (!DB.getCaixaAberto()) { App.showToast('Abra o caixa antes de iniciar uma venda!', 'warning'); return; }
  const produto = DB.getProdutoById(produtoId);
  if (!produto || produto.estoque <= 0) { App.showToast('Produto sem estoque!', 'error'); return; }
  const existente = carrinho.find(i => i.produtoId === produtoId);
  if (existente) {
    if (existente.quantidade >= produto.estoque) { App.showToast('Quantidade máxima atingida!', 'warning'); return; }
    existente.quantidade++;
    existente.subtotal = existente.quantidade * existente.precoUnitario;
  } else {
    carrinho.push({
      produtoId,
      nome: produto.nome,
      precoUnitario: produto.precoVenda,
      precoCusto: produto.precoCusto,
      quantidade: 1,
      subtotal: produto.precoVenda,
      estoqueDisp: produto.estoque
    });
  }
  App.showToast(`${produto.nome.substring(0, 30)}... adicionado`, 'success');
  renderCarrinho();
  atualizarTotais();
}

function renderCarrinho() {
  const list = document.getElementById('cart-list');
  const empty = document.getElementById('cart-empty');
  const btnFinalizar = document.getElementById('btn-finalizar');

  if (carrinho.length === 0) {
    list.innerHTML = `<div class="cart-empty" id="cart-empty"><div class="empty-state-icon" style="margin-bottom:8px;"><i data-lucide="shopping-cart"></i></div><div>Carrinho vazio</div><div style="font-size:12px;color:var(--text-muted);margin-top:4px;">Clique em um produto para adicionar</div></div>`;
    btnFinalizar.disabled = true;
    return;
  }

  btnFinalizar.disabled = pagamentoSelecionado === '';

  list.innerHTML = carrinho.map((item, idx) => `
    <div class="cart-item">
      <div style="flex:1;min-width:0;">
        <div class="cart-item-name">${item.nome}</div>
        <div class="cart-item-sub">${App.formatCurrency(item.precoUnitario)} × ${item.quantidade}</div>
      </div>
      <div class="cart-qty">
        <button class="cart-qty-btn" onclick="alterarQtd(${idx}, -1)">−</button>
        <input type="number" class="cart-qty-input" value="${item.quantidade}" min="1" max="${item.estoqueDisp}" onchange="setQtd(${idx}, this.value)">
        <button class="cart-qty-btn" onclick="alterarQtd(${idx}, 1)">+</button>
      </div>
      <div class="cart-item-total">${App.formatCurrency(item.subtotal)}</div>
      <button class="cart-item-remove" onclick="removerItem(${idx})">✕</button>
    </div>
  `).join('');
}

function alterarQtd(idx, delta) {
  const item = carrinho[idx];
  const nova = item.quantidade + delta;
  if (nova < 1) { removerItem(idx); return; }
  if (nova > item.estoqueDisp) { App.showToast('Estoque insuficiente!', 'warning'); return; }
  item.quantidade = nova;
  item.subtotal = item.quantidade * item.precoUnitario;
  renderCarrinho();
  atualizarTotais();
}

function setQtd(idx, val) {
  const item = carrinho[idx];
  const nova = parseInt(val) || 1;
  if (nova < 1) { item.quantidade = 1; } else if (nova > item.estoqueDisp) { item.quantidade = item.estoqueDisp; App.showToast('Estoque insuficiente!', 'warning'); } else { item.quantidade = nova; }
  item.subtotal = item.quantidade * item.precoUnitario;
  renderCarrinho();
  atualizarTotais();
}

function removerItem(idx) {
  carrinho.splice(idx, 1);
  renderCarrinho();
  atualizarTotais();
}

function limparCarrinho() {
  carrinho = [];
  pagamentoSelecionado = '';
  cupomAtual = null;
  document.querySelectorAll('.payment-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('input-desconto').value = '';
  document.getElementById('dinheiro-wrapper').classList.add('hidden');
  document.getElementById('valor-recebido') && (document.getElementById('valor-recebido').value = '');
  document.getElementById('input-cupom').value = '';
  document.getElementById('cupom-status').className = 'hidden';
  document.getElementById('cupom-status').textContent = '';
  renderCarrinho();
  atualizarTotais();
}

function aplicarCupom() {
  const codigo = document.getElementById('input-cupom').value.trim().toUpperCase();
  const statusEl = document.getElementById('cupom-status');
  if (!codigo) { statusEl.className = ''; statusEl.style.cssText = 'margin-top:6px;font-size:12px;padding:6px 10px;border-radius:var(--radius);background:var(--bg-input);color:var(--text-muted);'; statusEl.textContent = 'Digite o código do cupom.'; return; }
  const cupom = DB.getCupomByCodigo(codigo);
  if (!cupom) {
    cupomAtual = null;
    statusEl.className = '';
    statusEl.style.cssText = 'margin-top:6px;font-size:12px;padding:6px 10px;border-radius:var(--radius);background:rgba(239,68,68,0.12);color:var(--red);';
    statusEl.textContent = `Cupom "${codigo}" não encontrado ou inativo.`;
    return;
  }
  cupomAtual = cupom;
  statusEl.className = '';
  statusEl.style.cssText = 'margin-top:6px;font-size:12px;padding:6px 10px;border-radius:var(--radius);background:rgba(34,197,94,0.12);color:var(--green);';
  statusEl.textContent = `Cupom "${cupom.codigo}" aplicado — ${cupom.nome} (${cupom.comissaoPct}% comissão)`;
}

function limparCupom() {
  cupomAtual = null;
  document.getElementById('input-cupom').value = '';
  document.getElementById('cupom-status').className = 'hidden';
}

function setDescontoTipo(tipo) {
  descontoTipo = tipo;
  document.getElementById('btn-desc-pct').classList.toggle('active', tipo === 'pct');
  document.getElementById('btn-desc-val').classList.toggle('active', tipo === 'val');
  atualizarTotais();
}

function atualizarTotais() {
  const subtotal = carrinho.reduce((s, i) => s + i.subtotal, 0);
  const descRaw = parseFloat(document.getElementById('input-desconto').value) || 0;
  let desconto = 0;
  if (descontoTipo === 'pct') { desconto = subtotal * (descRaw / 100); } else { desconto = Math.min(descRaw, subtotal); }
  const total = subtotal - desconto;

  document.getElementById('subtotal-display').textContent = App.formatCurrency(subtotal);
  document.getElementById('desconto-display').textContent = '- ' + App.formatCurrency(desconto);
  document.getElementById('total-display').textContent = App.formatCurrency(total);

  const btnFinalizar = document.getElementById('btn-finalizar');
  btnFinalizar.disabled = carrinho.length === 0 || pagamentoSelecionado === '';

  calcularTroco();
}

function selecionarPagamento(pag) {
  pagamentoSelecionado = pag;
  document.querySelectorAll('.payment-btn').forEach(b => b.classList.toggle('active', b.dataset.pag === pag));
  const wrapper = document.getElementById('dinheiro-wrapper');
  wrapper.classList.toggle('hidden', pag !== 'dinheiro');
  if (pag !== 'dinheiro') {
    const td = document.getElementById('troco-display');
    if (td) td.style.display = 'none';
  }
  const btnFinalizar = document.getElementById('btn-finalizar');
  btnFinalizar.disabled = carrinho.length === 0;
  calcularTroco();
}

function calcularTroco() {
  if (pagamentoSelecionado !== 'dinheiro') return;
  const subtotal = carrinho.reduce((s, i) => s + i.subtotal, 0);
  const descRaw = parseFloat(document.getElementById('input-desconto').value) || 0;
  let desconto = descontoTipo === 'pct' ? subtotal * (descRaw / 100) : Math.min(descRaw, subtotal);
  const total = subtotal - desconto;
  const recebido = parseFloat(document.getElementById('valor-recebido').value) || 0;
  const trocoDisplay = document.getElementById('troco-display');
  if (recebido > 0) {
    trocoDisplay.style.display = 'block';
    const troco = Math.max(0, recebido - total);
    document.getElementById('troco-value').textContent = App.formatCurrency(troco);
    if (recebido < total) { document.getElementById('troco-value').style.color = 'var(--red)'; document.getElementById('troco-value').textContent = 'Valor insuficiente!'; } else { document.getElementById('troco-value').style.color = 'var(--green)'; }
  } else { trocoDisplay.style.display = 'none'; }
}

function finalizarVenda() {
  if (!DB.getCaixaAberto()) { App.showToast('Abra o caixa antes de finalizar uma venda!', 'error'); return; }
  if (carrinho.length === 0) { App.showToast('Carrinho vazio!', 'error'); return; }
  if (!pagamentoSelecionado) { App.showToast('Selecione a forma de pagamento!', 'warning'); return; }

  if (pagamentoSelecionado === 'dinheiro') {
    const subtotal = carrinho.reduce((s, i) => s + i.subtotal, 0);
    const descRaw = parseFloat(document.getElementById('input-desconto').value) || 0;
    let desconto = descontoTipo === 'pct' ? subtotal * (descRaw / 100) : Math.min(descRaw, subtotal);
    const total = subtotal - desconto;
    const recebido = parseFloat(document.getElementById('valor-recebido').value) || 0;
    if (recebido > 0 && recebido < total) { App.showToast('Valor recebido insuficiente!', 'error'); return; }
  }

  const subtotal = carrinho.reduce((s, i) => s + i.subtotal, 0);
  const descRaw = parseFloat(document.getElementById('input-desconto').value) || 0;
  let desconto = descontoTipo === 'pct' ? subtotal * (descRaw / 100) : Math.min(descRaw, subtotal);
  const total = subtotal - desconto;

  const sel = document.getElementById('select-cliente');
  const clienteId = sel.value;
  const clienteNome = clienteId ? DB.getClienteById(clienteId)?.nome : '';

  const nomesPag = { dinheiro: 'Dinheiro', pix: 'PIX', credito: 'Cartão Crédito', debito: 'Cartão Débito' };
  const caixa = DB.getCaixaAberto();

  const comissaoValor = cupomAtual ? parseFloat((total * cupomAtual.comissaoPct / 100).toFixed(2)) : 0;

  const userLogado = DB.getUsuarioLogado();
  const vendedorComissaoPct = userLogado?.comissaoPct || 0;
  const comissaoVendedorValor = vendedorComissaoPct > 0 ? parseFloat((total * vendedorComissaoPct / 100).toFixed(2)) : 0;

  const venda = DB.addVenda({
    itens: carrinho.map(i => ({ ...i })),
    subtotal, desconto, total,
    pagamento: pagamentoSelecionado,
    pagamentoNome: nomesPag[pagamentoSelecionado],
    clienteId, clienteNome,
    status: 'pago',
    caixaId: caixa ? caixa.id : null,
    cupomId: cupomAtual ? cupomAtual.id : null,
    cupomCodigo: cupomAtual ? cupomAtual.codigo : null,
    comissaoValor,
    vendedorId: userLogado ? userLogado.id : null,
    vendedorNome: userLogado ? userLogado.nome : null,
    comissaoVendedorPct: vendedorComissaoPct || null,
    comissaoVendedorValor: comissaoVendedorValor || null
  });

  if (caixa) {
    const vendedorDesc = userLogado ? ` — ${userLogado.nome}` : '';
    DB.addMovimentacaoCaixa(caixa.id, { tipo: 'venda', descricao: `Venda #${venda.id.slice(-6).toUpperCase()}${vendedorDesc}`, valor: total });
  }

  carrinho.forEach(item => {
    const p = DB.getProdutoById(item.produtoId);
    if (p) {
      const ant = p.estoque;
      DB.updateProduto(item.produtoId, { estoque: Math.max(0, p.estoque - item.quantidade) });
      DB.addMovimentacao({ produtoId: item.produtoId, nomeProduto: item.nome, tipo: 'venda', quantidade: item.quantidade, saldoAnterior: ant, saldoAtual: Math.max(0, ant - item.quantidade), motivo: `Venda #${venda.id.slice(-6).toUpperCase()}`, responsavel: 'Operador' });
    }
  });

  ultimaVenda = venda;
  mostrarRecibo(venda);
  App.showToast('Venda finalizada com sucesso!', 'success');
}

function mostrarRecibo(venda) {
  const nomesPag = { dinheiro: 'Dinheiro', pix: 'PIX', credito: 'Cartão Crédito', debito: 'Cartão Débito' };
  const recibido = pagamentoSelecionado === 'dinheiro' ? parseFloat(document.getElementById('valor-recebido').value) || 0 : 0;
  const troco = Math.max(0, recibido - venda.total);

  document.getElementById('recibo-content').innerHTML = `
    <div class="recibo">
      <div class="recibo-title">SUPLEMENTOS PRO</div>
      <div style="text-align:center;font-size:12px;color:var(--text-muted);margin-bottom:8px;">${App.formatDate(venda.createdAt)}</div>
      <div class="recibo-divider"></div>
      ${venda.itens.map(i => `
        <div class="recibo-row" style="font-size:13px;margin-bottom:4px;">
          <span>${i.nome.substring(0,25)}</span>
          <span>${App.formatCurrency(i.subtotal)}</span>
        </div>
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px;">${i.quantidade}x ${App.formatCurrency(i.precoUnitario)}</div>
      `).join('')}
      <div class="recibo-divider"></div>
      <div class="recibo-row" style="font-size:13px;"><span>Subtotal</span><span>${App.formatCurrency(venda.subtotal)}</span></div>
      ${venda.desconto > 0 ? `<div class="recibo-row" style="font-size:13px;color:var(--green);"><span>Desconto</span><span>- ${App.formatCurrency(venda.desconto)}</span></div>` : ''}
      <div class="recibo-row recibo-total" style="font-size:16px;font-weight:700;color:var(--red);margin-top:6px;"><span>TOTAL</span><span>${App.formatCurrency(venda.total)}</span></div>
      <div class="recibo-divider"></div>
      <div class="recibo-row" style="font-size:12px;"><span>Pagamento</span><span>${nomesPag[venda.pagamento]}</span></div>
      ${recibido > 0 ? `<div class="recibo-row" style="font-size:12px;"><span>Recebido</span><span>${App.formatCurrency(recibido)}</span></div><div class="recibo-row" style="font-size:13px;color:var(--green);"><span>Troco</span><span>${App.formatCurrency(troco)}</span></div>` : ''}
      ${venda.clienteNome ? `<div class="recibo-row" style="font-size:12px;margin-top:4px;"><span>Cliente</span><span>${venda.clienteNome}</span></div>` : ''}
      ${venda.cupomCodigo ? `<div class="recibo-row" style="font-size:12px;margin-top:4px;color:var(--green);"><span>Cupom</span><span>${venda.cupomCodigo}</span></div>` : ''}
      <div class="recibo-divider"></div>
      <div style="text-align:center;font-size:11px;color:var(--text-muted);">Obrigado pela preferência!</div>
    </div>
  `;
  document.getElementById('modal-recibo').classList.add('show');
}

function novaVenda() {
  document.getElementById('modal-recibo').classList.remove('show');
  limparCupom();
  limparCarrinho();
  carregarProdutos('', catAtiva);
}

document.getElementById('busca-produto').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') {
    const busca = this.value.trim();
    const produtos = DB.getProdutos().filter(p => p.nome.toLowerCase().includes(busca.toLowerCase()) || p.codigoBarras === busca);
    if (produtos.length === 1) {
      adicionarAoCarrinho(produtos[0].id);
      this.value = '';
      carregarProdutos('', catAtiva);
    } else {
      carregarProdutos(busca, catAtiva);
    }
  }
});

document.getElementById('busca-produto').addEventListener('input', function() {
  carregarProdutos(this.value, catAtiva);
});

function verificarCaixaAberto() {
  const overlay = document.getElementById('overlay-caixa-fechado');
  if (!overlay) return;
  if (!DB.getCaixaAberto()) {
    overlay.classList.remove('hidden');
    overlay.style.display = 'flex';
    if (window.lucide) lucide.createIcons();
  } else {
    overlay.classList.add('hidden');
    overlay.style.display = 'none';
  }
}


(async () => {
  await App.initPage('pdv');
  carregarCategorias();
  carregarProdutos();
  carregarClientes();
  verificarCaixaAberto();
})();
