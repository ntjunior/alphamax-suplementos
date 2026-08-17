let periodoAtual = 'mes';
let periodoVendAtual = 'mes';
let abaAtual = 'cupons';
let cupomExcluirId = null;

// ===================== ABAS =====================
function trocarAba(aba) {
  abaAtual = aba;
  document.getElementById('aba-cupons').classList.toggle('hidden', aba !== 'cupons');
  document.getElementById('aba-vendedores').classList.toggle('hidden', aba !== 'vendedores');
  document.getElementById('tab-btn-cupons').classList.toggle('active', aba === 'cupons');
  document.getElementById('tab-btn-vendedores').classList.toggle('active', aba === 'vendedores');
  if (aba === 'vendedores') { renderKpisVendedor(); renderVendedores(); renderRankingVendedores(); renderVendasVendedor(); }
  if (window.lucide) lucide.createIcons();
}

// ===================== PERÍODO =====================
function filtrarPorPeriodo(vendas, periodo) {
  const agora = new Date();
  if (periodo === 'mes') return vendas.filter(v => { const d = new Date(v.createdAt); return d.getFullYear() === agora.getFullYear() && d.getMonth() === agora.getMonth(); });
  if (periodo === '7d') { const l = new Date(agora - 7 * 86400000); return vendas.filter(v => new Date(v.createdAt) >= l); }
  if (periodo === '30d') { const l = new Date(agora - 30 * 86400000); return vendas.filter(v => new Date(v.createdAt) >= l); }
  return vendas;
}

function setPeriodo(p, btn) {
  periodoAtual = p;
  document.querySelectorAll('[data-periodo]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderKpisCupom(); renderResumoCupons(); renderVendas();
}

function setPeriodoVend(p, btn) {
  periodoVendAtual = p;
  document.querySelectorAll('[data-periodoV]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderKpisVendedor(); renderVendedores(); renderRankingVendedores(); renderVendasVendedor();
}

// ===================== ABA CUPONS =====================
function getVendasCupomFiltradas() {
  const filtro = document.getElementById('filtro-cupom').value;
  let vendas = filtrarPorPeriodo(DB.getVendas().filter(v => v.cupomCodigo), periodoAtual);
  if (filtro) vendas = vendas.filter(v => v.cupomCodigo === filtro);
  return vendas;
}

function renderKpisCupom() {
  const cupons = DB.getCupons();
  document.getElementById('kpi-cupons-ativos').textContent = cupons.filter(c => c.ativo).length;
  const vendas = getVendasCupomFiltradas();
  document.getElementById('kpi-vendas-cupom').textContent = vendas.length;
  document.getElementById('kpi-total-indicado').textContent = App.formatCurrency(vendas.reduce((s, v) => s + (v.total || 0), 0));
  document.getElementById('kpi-total-comissoes').textContent = App.formatCurrency(vendas.reduce((s, v) => s + (v.comissaoValor || 0), 0));
}

function renderCupons() {
  const cupons = DB.getCupons();
  const filtroSelect = document.getElementById('filtro-cupom');
  const prevVal = filtroSelect.value;
  filtroSelect.innerHTML = '<option value="">Todos os cupons</option>' +
    cupons.map(c => `<option value="${c.codigo}"${prevVal === c.codigo ? ' selected' : ''}>${c.codigo} — ${c.nome}</option>`).join('');

  const tbody = document.getElementById('tbody-cupons');
  if (cupons.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:24px;">Nenhum cupom cadastrado</td></tr>';
    return;
  }
  tbody.innerHTML = cupons.map(c => `
    <tr>
      <td><strong style="font-family:monospace;letter-spacing:1px;">${c.codigo}</strong></td>
      <td>
        <div>${c.nome}</div>
        ${c.whatsapp ? `<div style="font-size:11px;color:var(--text-muted);">${c.whatsapp}</div>` : ''}
      </td>
      <td>${c.comissaoPct}%${c.descontoPct ? ` <span style="font-size:11px;color:var(--text-muted);">(cliente -${c.descontoPct}%)</span>` : ''}</td>
      <td><span class="badge ${c.ativo ? 'badge-ok' : 'badge-zero'}">${c.ativo ? 'Ativo' : 'Inativo'}</span></td>
      <td>
        <div style="display:flex;gap:4px;">
          <button class="btn btn-ghost btn-sm" onclick="editarCupom('${c.id}')"><i data-lucide="pencil"></i></button>
          <button class="btn btn-ghost btn-sm" style="color:var(--red);" onclick="confirmarExcluirCupom('${c.id}', '${c.codigo}')"><i data-lucide="trash-2"></i></button>
        </div>
      </td>
    </tr>
  `).join('');
}

function renderResumoCupons() {
  const vendas = getVendasCupomFiltradas();
  const tbody = document.getElementById('tbody-resumo-cupons');
  const mapa = {};
  vendas.forEach(v => {
    if (!mapa[v.cupomCodigo]) {
      const cupom = DB.getCupons().find(c => c.codigo === v.cupomCodigo);
      mapa[v.cupomCodigo] = { codigo: v.cupomCodigo, nome: cupom ? cupom.nome : '—', qtd: 0, total: 0, comissao: 0 };
    }
    mapa[v.cupomCodigo].qtd++;
    mapa[v.cupomCodigo].total += v.total || 0;
    mapa[v.cupomCodigo].comissao += v.comissaoValor || 0;
  });
  const linhas = Object.values(mapa).sort((a, b) => b.comissao - a.comissao);
  if (!linhas.length) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:24px;">Nenhuma venda no período</td></tr>'; return; }
  tbody.innerHTML = linhas.map(r => `
    <tr>
      <td><div style="font-weight:600;font-family:monospace;">${r.codigo}</div><div style="font-size:11px;color:var(--text-muted);">${r.nome}</div></td>
      <td class="text-right">${r.qtd}</td>
      <td class="text-right">${App.formatCurrency(r.total)}</td>
      <td class="text-right" style="color:var(--green);font-weight:600;">${App.formatCurrency(r.comissao)}</td>
    </tr>
  `).join('');
}

function renderVendas() {
  const vendas = getVendasCupomFiltradas().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const tbody = document.getElementById('tbody-vendas-cupom');
  if (!vendas.length) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:24px;">Nenhuma venda com cupom no período</td></tr>'; return; }
  const nomesPag = { dinheiro: 'Dinheiro', pix: 'PIX', credito: 'Crédito', debito: 'Débito' };
  tbody.innerHTML = vendas.map(v => {
    const cupom = DB.getCupons().find(c => c.codigo === v.cupomCodigo);
    return `<tr>
      <td style="white-space:nowrap;">${App.formatDate(v.createdAt)}</td>
      <td><strong style="font-family:monospace;">${v.cupomCodigo}</strong></td>
      <td>${cupom ? cupom.nome : '—'}</td>
      <td>${v.clienteNome || 'Consumidor Final'}</td>
      <td>${nomesPag[v.pagamento] || v.pagamento}</td>
      <td class="text-right">${App.formatCurrency(v.total)}</td>
      <td class="text-right" style="color:var(--green);font-weight:600;">${App.formatCurrency(v.comissaoValor || 0)}</td>
    </tr>`;
  }).join('');
}

// ===================== ABA VENDEDORES =====================
function getVendasVendFiltradas() {
  const filtro = document.getElementById('filtro-vendedor').value;
  let vendas = filtrarPorPeriodo(DB.getVendas(), periodoVendAtual);
  if (filtro) vendas = vendas.filter(v => v.vendedorId === filtro);
  return vendas;
}

function renderKpisVendedor() {
  const usuarios = DB.getUsuarios().filter(u => u.comissaoPct > 0 && u.ativo);
  document.getElementById('kpi-vend-ativos').textContent = usuarios.length;
  const vendas = getVendasVendFiltradas();
  document.getElementById('kpi-vend-vendas').textContent = vendas.length;
  document.getElementById('kpi-vend-total').textContent = App.formatCurrency(vendas.reduce((s, v) => s + (v.total || 0), 0));
  document.getElementById('kpi-vend-comissoes').textContent = App.formatCurrency(vendas.reduce((s, v) => s + (v.comissaoVendedorValor || 0), 0));
}

function renderVendedores() {
  const usuarios = DB.getUsuarios();
  const filtroSelect = document.getElementById('filtro-vendedor');
  const prevVal = filtroSelect.value;
  filtroSelect.innerHTML = '<option value="">Todos os vendedores</option>' +
    usuarios.map(u => `<option value="${u.id}"${prevVal === u.id ? ' selected' : ''}>${u.nome}</option>`).join('');

  const todasVendas = filtrarPorPeriodo(DB.getVendas(), periodoVendAtual);
  const tbody = document.getElementById('tbody-vendedores');

  if (!usuarios.length) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:24px;">Nenhum usuário cadastrado</td></tr>'; return; }

  tbody.innerHTML = usuarios.map(u => {
    const vendasU = todasVendas.filter(v => v.vendedorId === u.id);
    const totalVendas = vendasU.reduce((s, v) => s + (v.total || 0), 0);
    const totalComissao = vendasU.reduce((s, v) => s + (v.comissaoVendedorValor || 0), 0);
    const pct = u.comissaoPct != null ? u.comissaoPct : null;
    return `<tr>
      <td>
        <div style="font-weight:600;">${u.nome}</div>
        <div style="font-size:11px;color:var(--text-muted);">${u.login}</div>
      </td>
      <td><span class="badge ${u.perfil === 'admin' ? 'badge-pix' : 'badge-entrada'}">${u.perfil === 'admin' ? 'Admin' : 'Vendedor'}</span></td>
      <td class="text-right">${pct != null ? pct + '%' : '<span style="color:var(--text-muted);">—</span>'}</td>
      <td class="text-right">${vendasU.length}</td>
      <td class="text-right">${App.formatCurrency(totalVendas)}</td>
      <td class="text-right" style="color:var(--green);font-weight:600;">${totalComissao > 0 ? App.formatCurrency(totalComissao) : '<span style="color:var(--text-muted);">—</span>'}</td>
    </tr>`;
  }).join('');
}

function renderRankingVendedores() {
  const vendas = filtrarPorPeriodo(DB.getVendas(), periodoVendAtual);
  const mapa = {};
  vendas.forEach(v => {
    if (!v.vendedorId) return;
    if (!mapa[v.vendedorId]) mapa[v.vendedorId] = { id: v.vendedorId, nome: v.vendedorNome || '—', qtd: 0, total: 0, comissao: 0 };
    mapa[v.vendedorId].qtd++;
    mapa[v.vendedorId].total += v.total || 0;
    mapa[v.vendedorId].comissao += v.comissaoVendedorValor || 0;
  });
  const ranking = Object.values(mapa).sort((a, b) => b.total - a.total);
  const tbody = document.getElementById('tbody-ranking-vendedores');
  if (!ranking.length) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:24px;">Nenhuma venda no período</td></tr>'; return; }
  const medalhas = ['🥇', '🥈', '🥉'];
  tbody.innerHTML = ranking.map((r, i) => `
    <tr>
      <td style="font-size:16px;">${medalhas[i] || (i + 1)}</td>
      <td style="font-weight:600;">${r.nome}</td>
      <td class="text-right">${r.qtd}</td>
      <td class="text-right">${App.formatCurrency(r.total)}</td>
      <td class="text-right" style="color:var(--green);font-weight:600;">${r.comissao > 0 ? App.formatCurrency(r.comissao) : '—'}</td>
    </tr>
  `).join('');
}

function renderVendasVendedor() {
  const vendas = getVendasVendFiltradas().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const tbody = document.getElementById('tbody-vendas-vendedor');
  if (!vendas.length) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:24px;">Nenhuma venda no período</td></tr>'; return; }
  const nomesPag = { dinheiro: 'Dinheiro', pix: 'PIX', credito: 'Crédito', debito: 'Débito' };
  tbody.innerHTML = vendas.map(v => `
    <tr>
      <td style="white-space:nowrap;">${App.formatDate(v.createdAt)}</td>
      <td style="font-weight:600;">${v.vendedorNome || '<span style="color:var(--text-muted);">—</span>'}</td>
      <td>${v.clienteNome || 'Consumidor Final'}</td>
      <td>${nomesPag[v.pagamento] || v.pagamento}</td>
      <td class="text-right">${App.formatCurrency(v.total)}</td>
      <td class="text-right">${v.comissaoVendedorPct != null ? v.comissaoVendedorPct + '%' : '—'}</td>
      <td class="text-right" style="color:var(--green);font-weight:600;">${v.comissaoVendedorValor > 0 ? App.formatCurrency(v.comissaoVendedorValor) : '—'}</td>
    </tr>
  `).join('');
}

// ===================== CRUD CUPONS =====================
function abrirModalCupom() {
  document.getElementById('cupom-id').value = '';
  document.getElementById('cupom-codigo').value = '';
  document.getElementById('cupom-nome').value = '';
  document.getElementById('cupom-comissao').value = '5';
  document.getElementById('cupom-desconto').value = '';
  document.getElementById('cupom-ativo').value = '1';
  document.getElementById('cupom-whatsapp').value = '';
  document.getElementById('cupom-senha').value = '';
  document.getElementById('cupom-codigo').removeAttribute('readonly');
  document.getElementById('modal-cupom-titulo').innerHTML = '<i data-lucide="tag"></i> Novo Cupom';
  document.querySelectorAll('#modal-cupom .form-error').forEach(e => e.classList.remove('show'));
  document.getElementById('modal-cupom').classList.add('show');
  if (window.lucide) lucide.createIcons();
  setTimeout(() => document.getElementById('cupom-codigo').focus(), 100);
}

function editarCupom(id) {
  const c = DB.getCupomById(id);
  if (!c) return;
  document.getElementById('cupom-id').value = c.id;
  document.getElementById('cupom-codigo').value = c.codigo;
  document.getElementById('cupom-codigo').setAttribute('readonly', true);
  document.getElementById('cupom-nome').value = c.nome;
  document.getElementById('cupom-whatsapp').value = c.whatsapp || '';
  document.getElementById('cupom-senha').value = '';
  document.getElementById('cupom-comissao').value = c.comissaoPct;
  document.getElementById('cupom-desconto').value = c.descontoPct || '';
  document.getElementById('cupom-ativo').value = c.ativo ? '1' : '0';
  document.getElementById('modal-cupom-titulo').innerHTML = '<i data-lucide="pencil"></i> Editar Cupom';
  document.querySelectorAll('#modal-cupom .form-error').forEach(e => e.classList.remove('show'));
  document.getElementById('modal-cupom').classList.add('show');
  if (window.lucide) lucide.createIcons();
}

function salvarCupom() {
  const id = document.getElementById('cupom-id').value;
  const codigo = document.getElementById('cupom-codigo').value.trim().toUpperCase();
  const nome = document.getElementById('cupom-nome').value.trim();
  const whatsapp = document.getElementById('cupom-whatsapp').value.trim();
  const senhaRaw = document.getElementById('cupom-senha').value.trim();
  const comissaoPct = parseFloat(document.getElementById('cupom-comissao').value);
  const descontoPct = parseFloat(document.getElementById('cupom-desconto').value) || 0;
  const ativo = document.getElementById('cupom-ativo').value === '1';

  let ok = true;
  const showErr = (eid, show) => document.getElementById(eid).classList.toggle('show', show);
  showErr('err-cupom-codigo', !codigo); if (!codigo) ok = false;
  showErr('err-cupom-nome', !nome); if (!nome) ok = false;
  showErr('err-cupom-comissao', !comissaoPct || comissaoPct <= 0); if (!comissaoPct || comissaoPct <= 0) ok = false;
  if (!ok) return;

  if (id) {
    const upd = { nome, whatsapp, comissaoPct, descontoPct, ativo };
    if (senhaRaw) upd.senha = btoa(senhaRaw);
    DB.updateCupom(id, upd);
    App.showToast('Cupom atualizado!', 'success');
  } else {
    const novoCupom = { codigo, nome, whatsapp, comissaoPct, descontoPct, ativo };
    if (senhaRaw) novoCupom.senha = btoa(senhaRaw);
    if (!DB.addCupom(novoCupom)) { App.showToast('Código já existe!', 'error'); return; }
    App.showToast('Cupom criado!', 'success');
  }
  fecharModal('modal-cupom');
  renderCupons(); renderKpisCupom(); renderResumoCupons();
  if (window.lucide) lucide.createIcons();
}

function confirmarExcluirCupom(id, codigo) {
  cupomExcluirId = id;
  document.getElementById('nome-excluir-cupom').textContent = codigo;
  document.getElementById('modal-excluir-cupom').classList.add('show');
}

document.getElementById('btn-confirmar-excluir-cupom').onclick = function () {
  if (!cupomExcluirId) return;
  DB.deleteCupom(cupomExcluirId);
  cupomExcluirId = null;
  fecharModal('modal-excluir-cupom');
  App.showToast('Cupom excluído!', 'success');
  renderCupons(); renderKpisCupom(); renderResumoCupons();
  if (window.lucide) lucide.createIcons();
};

function fecharModal(id) { document.getElementById(id).classList.remove('show'); }

document.querySelectorAll('.modal-overlay').forEach(el => {
  el.addEventListener('click', function (e) { if (e.target === this) fecharModal(this.id); });
});

(async () => {
  await App.initPage('comissoes');
  const user = DB.getUsuarioLogado();
  if (user && user.perfil !== 'admin') {
    App.showToast('Acesso restrito a administradores!', 'error');
    setTimeout(() => { window.location.href = 'index.html'; }, 1500);
    return;
  }
  renderKpisCupom();
  renderCupons();
  renderResumoCupons();
  renderVendas();
})();
