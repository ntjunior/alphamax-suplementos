let periodoFin = 'mes';
let tipoFiltro = 'todos';
let movParaExcluir = null;

// ===== Período =====
function filtrarPorPeriodoFin(items, periodo) {
  const agora = new Date();
  if (periodo === 'mes') return items.filter(m => { const d = new Date(m.createdAt); return d.getFullYear() === agora.getFullYear() && d.getMonth() === agora.getMonth(); });
  if (periodo === '7d') { const l = new Date(agora - 7 * 86400000); return items.filter(m => new Date(m.createdAt) >= l); }
  if (periodo === '30d') { const l = new Date(agora - 30 * 86400000); return items.filter(m => new Date(m.createdAt) >= l); }
  return items;
}

function setPeriodoFin(p, btn) {
  periodoFin = p;
  document.querySelectorAll('[data-pfin]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderFinanceiro();
}

function setTipoFiltro(tipo, btn) {
  tipoFiltro = tipo;
  document.querySelectorAll('[data-tfin]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderFinanceiro();
}

function getLancsFiltrados() {
  let items = filtrarPorPeriodoFin(DB.getLancamentos(), periodoFin);
  if (tipoFiltro !== 'todos') items = items.filter(m => m.tipo === tipoFiltro);
  return items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

// ===== KPIs =====
function renderKpis() {
  const todas = filtrarPorPeriodoFin(DB.getLancamentos(), periodoFin);
  const entradasLanc = todas.filter(m => m.tipo === 'entrada').reduce((s, m) => s + (m.valor || 0), 0);
  const saidas = todas.filter(m => m.tipo === 'saida').reduce((s, m) => s + (m.valor || 0), 0);

  const vendasPeriodo = filtrarPorPeriodoFin(DB.getVendas(), periodoFin);
  const totalVendas = vendasPeriodo.reduce((s, v) => s + (v.total || 0), 0);

  const totalEntradas = entradasLanc + totalVendas;
  const saldo = totalEntradas - saidas;

  document.getElementById('kpi-entradas').textContent = App.formatCurrency(totalEntradas);
  document.getElementById('kpi-entradas-sub').textContent = `${App.formatCurrency(totalVendas)} em vendas PDV`;
  document.getElementById('kpi-saidas').textContent = App.formatCurrency(saidas);
  document.getElementById('kpi-saldo').textContent = App.formatCurrency(saldo);
  document.getElementById('kpi-saldo').style.color = saldo >= 0 ? 'var(--green)' : 'var(--red)';
  document.getElementById('kpi-total-lancamentos').textContent = todas.length + vendasPeriodo.length;
}

// ===== Tabela =====
function renderFinanceiro() {
  renderKpis();

  const lancs = getLancsFiltrados();
  const nomesPag = { dinheiro: 'Dinheiro', pix: 'PIX', credito: 'Crédito', debito: 'Débito' };

  const vendasLinhas = (tipoFiltro === 'todos' || tipoFiltro === 'entrada')
    ? filtrarPorPeriodoFin(DB.getVendas(), periodoFin).map(v => ({
        _isVenda: true,
        createdAt: v.createdAt,
        tipo: 'entrada',
        categoria: 'Venda PDV',
        descricaoDisplay: `${v.clienteNome || 'Consumidor Final'} — ${nomesPag[v.pagamento] || v.pagamento || ''}`,
        obs: '',
        valor: v.total || 0
      }))
    : [];

  const linhasLanc = lancs.map(m => ({
    _isVenda: false,
    id: m.id,
    createdAt: m.createdAt,
    tipo: m.tipo,
    categoria: m.categoria || '',
    descricaoDisplay: m.descricao || '',
    obs: m.obs || '',
    valor: m.valor || 0
  }));

  const todas = [...linhasLanc, ...vendasLinhas].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const tbody = document.getElementById('tbody-financeiro');

  if (todas.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="empty-state-icon"><i data-lucide="landmark"></i></div><div class="empty-state-text">Nenhum lançamento encontrado</div></div></td></tr>`;
    if (window.lucide) lucide.createIcons();
    return;
  }

  tbody.innerHTML = todas.map(m => {
    const isEntrada = m.tipo === 'entrada';
    const badge = isEntrada
      ? `<span class="badge badge-entrada">${m._isVenda ? 'Venda PDV' : 'Entrada'}</span>`
      : '<span class="badge badge-saida">Saída</span>';
    const valorColor = isEntrada ? 'var(--green)' : 'var(--red)';
    const sinal = isEntrada ? '+' : '−';
    const acoes = m._isVenda
      ? '<span style="font-size:11px;color:var(--text-muted);">PDV</span>'
      : `<div style="display:flex;gap:4px;">
           <button class="btn btn-ghost btn-sm" onclick="editarLancamento('${m.id}')"><i data-lucide="pencil"></i></button>
           <button class="btn btn-ghost btn-sm" style="color:var(--red);" onclick="confirmarExcluirLanc('${m.id}')"><i data-lucide="trash-2"></i></button>
         </div>`;
    return `
      <tr>
        <td style="white-space:nowrap;">${App.formatDate(m.createdAt)}</td>
        <td>${badge}</td>
        <td>${m.categoria || '—'}</td>
        <td style="max-width:220px;">${m.descricaoDisplay || '—'}${m.obs ? `<div style="font-size:11px;color:var(--text-muted);">${m.obs}</div>` : ''}</td>
        <td class="text-right font-bold" style="color:${valorColor};">${sinal} ${App.formatCurrency(m.valor)}</td>
        <td>${acoes}</td>
      </tr>`;
  }).join('');
  if (window.lucide) lucide.createIcons();
}

// ===== Modal =====
let tipoModal = 'saida';

function setTipoModal(tipo, btn) {
  tipoModal = tipo;
  document.querySelectorAll('#modal-lancamento .payment-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  atualizarCategorias(tipo);
}

function atualizarCategorias(tipo) {
  const sel = document.getElementById('lanc-categoria');
  const cats = tipo === 'entrada'
    ? ['Venda', 'Serviço', 'Investimento', 'Empréstimo', 'Outros']
    : ['Aluguel', 'Fornecedor', 'Salário', 'Marketing', 'Conta de Luz/Água/Net', 'Frete', 'Imposto', 'Equipamento', 'Outros'];
  sel.innerHTML = cats.map(c => `<option value="${c}">${c}</option>`).join('');
}

function abrirModalLancamento() {
  document.getElementById('lanc-id').value = '';
  document.getElementById('lanc-valor').value = '';
  document.getElementById('lanc-descricao').value = '';
  document.getElementById('lanc-obs').value = '';
  document.getElementById('lanc-data').value = new Date().toISOString().slice(0, 10);
  tipoModal = 'saida';
  document.getElementById('btn-tipo-entrada').classList.remove('active');
  document.getElementById('btn-tipo-saida').classList.add('active');
  atualizarCategorias('saida');
  document.querySelectorAll('#modal-lancamento .form-error').forEach(e => e.classList.remove('show'));
  document.getElementById('modal-lancamento-titulo').textContent = 'Novo Lançamento';
  document.getElementById('modal-lancamento').classList.add('show');
  if (window.lucide) lucide.createIcons();
  setTimeout(() => document.getElementById('lanc-valor').focus(), 100);
}

function editarLancamento(id) {
  const m = DB.getLancamentos().find(x => x.id === id);
  if (!m) return;
  document.getElementById('lanc-id').value = m.id;
  document.getElementById('lanc-valor').value = m.valor || '';
  document.getElementById('lanc-descricao').value = m.descricao || '';
  document.getElementById('lanc-obs').value = m.obs || '';
  document.getElementById('lanc-data').value = m.createdAt ? m.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10);
  tipoModal = m.tipo || 'saida';
  document.getElementById('btn-tipo-entrada').classList.toggle('active', tipoModal === 'entrada');
  document.getElementById('btn-tipo-saida').classList.toggle('active', tipoModal === 'saida');
  atualizarCategorias(tipoModal);
  document.getElementById('lanc-categoria').value = m.categoria || '';
  document.querySelectorAll('#modal-lancamento .form-error').forEach(e => e.classList.remove('show'));
  document.getElementById('modal-lancamento-titulo').textContent = 'Editar Lançamento';
  document.getElementById('modal-lancamento').classList.add('show');
  if (window.lucide) lucide.createIcons();
}

function salvarLancamento() {
  const id = document.getElementById('lanc-id').value;
  const valor = parseFloat(document.getElementById('lanc-valor').value);
  const descricao = document.getElementById('lanc-descricao').value.trim();
  const obs = document.getElementById('lanc-obs').value.trim();
  const categoria = document.getElementById('lanc-categoria').value;
  const dataVal = document.getElementById('lanc-data').value;

  const errValor = document.getElementById('err-lanc-valor');
  errValor.classList.toggle('show', !valor || valor <= 0);
  if (!valor || valor <= 0) return;

  const createdAt = dataVal ? new Date(dataVal + 'T12:00:00').toISOString() : new Date().toISOString();

  if (id) {
    DB.updateLancamento(id, { tipo: tipoModal, valor, descricao, obs, categoria, createdAt });
    App.showToast('Lançamento atualizado!', 'success');
  } else {
    DB.addLancamento({ tipo: tipoModal, valor, descricao, obs, categoria, createdAt });
    App.showToast('Lançamento registrado!', 'success');
  }

  fecharModal('modal-lancamento');
  renderFinanceiro();
}

// ===== Excluir =====
function confirmarExcluirLanc(id) {
  movParaExcluir = id;
  document.getElementById('modal-excluir-lanc').classList.add('show');
}

document.getElementById('btn-confirmar-excluir-lanc').addEventListener('click', () => {
  if (!movParaExcluir) return;
  DB.deleteLancamento(movParaExcluir);
  movParaExcluir = null;
  fecharModal('modal-excluir-lanc');
  App.showToast('Lançamento excluído!', 'success');
  renderFinanceiro();
});

function fecharModal(id) { document.getElementById(id).classList.remove('show'); }

document.querySelectorAll('.modal-overlay').forEach(m => {
  m.addEventListener('click', e => { if (e.target === m) m.classList.remove('show'); });
});

(async () => {
  await App.initPage('financeiro');
  renderFinanceiro();
})();
