function carregarSelectsProdutos() {
  const produtos = DB.getProdutos().sort((a, b) => a.nome.localeCompare(b.nome));
  const opts = '<option value="">Selecionar produto...</option>' + produtos.map(p => `<option value="${p.id}">${p.nome} (Estoque: ${p.estoque})</option>`).join('');
  document.getElementById('entrada-produto').innerHTML = opts;
  document.getElementById('ajuste-produto').innerHTML = opts;
}

function renderKPIs() {
  const produtos = DB.getProdutos();
  const total = produtos.length;
  const ok = produtos.filter(p => p.estoque >= (p.estoqueMin || 10)).length;
  const baixo = produtos.filter(p => p.estoque > 0 && p.estoque < (p.estoqueMin || 10)).length;
  const zero = produtos.filter(p => p.estoque === 0).length;
  document.getElementById('kpi-total').textContent = total;
  document.getElementById('kpi-ok').textContent = ok;
  document.getElementById('kpi-baixo').textContent = baixo;
  document.getElementById('kpi-zero').textContent = zero;
}

function renderPosicaoEstoque() {
  const busca = document.getElementById('busca-estoque').value.toLowerCase();
  const filtroStatus = document.getElementById('filtro-status-estoque').value;
  let produtos = DB.getProdutos();

  if (busca) produtos = produtos.filter(p => p.nome.toLowerCase().includes(busca) || (p.categoria && p.categoria.toLowerCase().includes(busca)));

  if (filtroStatus === 'ok') produtos = produtos.filter(p => p.estoque >= (p.estoqueMin || 10));
  else if (filtroStatus === 'baixo') produtos = produtos.filter(p => p.estoque > 0 && p.estoque < (p.estoqueMin || 10));
  else if (filtroStatus === 'zero') produtos = produtos.filter(p => p.estoque === 0);

  produtos.sort((a, b) => a.estoque - b.estoque);

  const tbody = document.getElementById('tbody-estoque-pos');
  if (produtos.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><div class="empty-state-icon"><i data-lucide="package"></i></div><div>Nenhum produto encontrado</div></div></td></tr>';
    return;
  }

  const estoqueRows = produtos.map(p => {
    const valorEstoque = (p.precoVenda || 0) * p.estoque;
    return `
      <tr>
        <td style="text-align:center;"><i data-lucide="package"></i></td>
        <td style="font-weight:600;">${p.nome}<br><span style="font-size:11px;color:var(--text-muted);">${p.marca || ''}</span></td>
        <td>${p.categoria || '—'}</td>
        <td class="text-right font-bold" style="font-size:18px;">${p.estoque}</td>
        <td class="text-right text-muted">${p.estoqueMin || 10}</td>
        <td>${App.getStockBadge(p.estoque, p.estoqueMin)}</td>
        <td class="text-right">${App.formatCurrency(valorEstoque)}</td>
      </tr>
    `;
  }).join('');
  tbody.innerHTML = estoqueRows;
  if (window.lucide) lucide.createIcons();
}

function renderMovimentacoes() {
  const filtroTipo = document.getElementById('filtro-tipo-mov').value;
  let movs = DB.getMovimentacoes();

  if (filtroTipo) movs = movs.filter(m => m.tipo === filtroTipo);
  movs = [...movs].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 100);

  const tbody = document.getElementById('tbody-movimentacoes');
  if (movs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><div class="empty-state-icon"><i data-lucide="scroll-text"></i></div><div>Nenhuma movimentação encontrada</div></div></td></tr>';
    return;
  }

  tbody.innerHTML = movs.map(m => {
    const tipoBadge = m.tipo === 'entrada' ? '<span class="badge badge-entrada">Entrada</span>' : m.tipo === 'venda' ? '<span class="badge badge-venda">Venda</span>' : '<span class="badge badge-saida">Saída</span>';
    const sinalQtd = m.tipo === 'entrada' ? '+' : '−';
    const corQtd = m.tipo === 'entrada' ? 'var(--green)' : 'var(--red)';
    return `
      <tr>
        <td style="white-space:nowrap;">${App.formatDate(m.createdAt)}</td>
        <td>${m.nomeProduto || '—'}</td>
        <td>${tipoBadge}</td>
        <td class="text-right font-bold" style="color:${corQtd};">${sinalQtd}${m.quantidade}</td>
        <td class="text-right text-muted">${m.saldoAnterior ?? '—'}</td>
        <td class="text-right font-bold">${m.saldoAtual ?? '—'}</td>
        <td style="max-width:200px;font-size:12px;">${m.motivo || '—'}</td>
      </tr>
    `;
  }).join('');
}

function registrarEntrada() {
  const produtoId = document.getElementById('entrada-produto').value;
  const qtd = parseInt(document.getElementById('entrada-qtd').value);
  const motivo = document.getElementById('entrada-motivo').value;
  const obs = document.getElementById('entrada-obs').value.trim();

  if (!produtoId) { App.showToast('Selecione um produto!', 'error'); return; }
  if (!qtd || qtd <= 0) { App.showToast('Informe uma quantidade válida!', 'error'); return; }

  const produto = DB.getProdutoById(produtoId);
  if (!produto) return;

  const ant = produto.estoque;
  const novoEst = ant + qtd;
  DB.updateProduto(produtoId, { estoque: novoEst });
  DB.addMovimentacao({
    produtoId,
    nomeProduto: produto.nome,
    tipo: 'entrada',
    quantidade: qtd,
    saldoAnterior: ant,
    saldoAtual: novoEst,
    motivo: motivo + (obs ? ` — ${obs}` : ''),
    responsavel: DB.getUsuarioLogado()?.nome || 'Operador'
  });

  App.showToast(`Entrada de ${qtd} un. registrada para ${produto.nome}!`, 'success');
  document.getElementById('entrada-produto').value = '';
  document.getElementById('entrada-qtd').value = '';
  document.getElementById('entrada-obs').value = '';
  carregarSelectsProdutos();
  renderKPIs();
  renderPosicaoEstoque();
  renderMovimentacoes();
}

function registrarAjuste() {
  const produtoId = document.getElementById('ajuste-produto').value;
  const qtd = parseInt(document.getElementById('ajuste-qtd').value);
  const tipo = document.getElementById('ajuste-tipo').value;
  const motivo = document.getElementById('ajuste-motivo').value.trim();

  if (!produtoId) { App.showToast('Selecione um produto!', 'error'); return; }
  if (!qtd || qtd <= 0) { App.showToast('Informe uma quantidade válida!', 'error'); return; }
  if (!motivo) { App.showToast('Informe o motivo do ajuste!', 'error'); return; }

  const produto = DB.getProdutoById(produtoId);
  if (!produto) return;

  const ant = produto.estoque;
  let novoEst = tipo === 'entrada' ? ant + qtd : ant - qtd;
  if (novoEst < 0) { App.showToast('Estoque não pode ser negativo!', 'error'); return; }

  DB.updateProduto(produtoId, { estoque: novoEst });
  DB.addMovimentacao({
    produtoId,
    nomeProduto: produto.nome,
    tipo,
    quantidade: qtd,
    saldoAnterior: ant,
    saldoAtual: novoEst,
    motivo: `Ajuste: ${motivo}`,
    responsavel: DB.getUsuarioLogado()?.nome || 'Operador'
  });

  App.showToast(`Ajuste aplicado com sucesso!`, 'success');
  document.getElementById('ajuste-produto').value = '';
  document.getElementById('ajuste-qtd').value = '';
  document.getElementById('ajuste-motivo').value = '';
  carregarSelectsProdutos();
  renderKPIs();
  renderPosicaoEstoque();
  renderMovimentacoes();
}

document.getElementById('busca-estoque').addEventListener('input', renderPosicaoEstoque);
document.getElementById('filtro-status-estoque').addEventListener('change', renderPosicaoEstoque);
document.getElementById('filtro-tipo-mov').addEventListener('change', renderMovimentacoes);


(async () => {
  await App.initPage('estoque');
  carregarSelectsProdutos();
  renderKPIs();
  renderPosicaoEstoque();
  renderMovimentacoes();
})();
