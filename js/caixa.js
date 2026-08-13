
let sangriaType = 'suprimento';

function calcularTotaisCaixa(caixa) {
  const movs = caixa.movimentacoes || [];
  const entradas = movs.filter(m => m.tipo === 'venda' || m.tipo === 'suprimento').reduce((s, m) => s + m.valor, 0);
  const saidas = movs.filter(m => m.tipo === 'sangria').reduce((s, m) => s + m.valor, 0);
  const saldoEsperado = caixa.saldoInicial + entradas - saidas;
  return { entradas, saidas, saldoEsperado };
}

function renderEstadoCaixa() {
  const caixa = DB.getCaixaAberto();
  const secFechado = document.getElementById('caixa-fechado-section');
  const secAberto = document.getElementById('caixa-aberto-section');
  const statusLabel = document.getElementById('caixa-status-label');

  if (!caixa) {
    secFechado.classList.remove('hidden');
    secAberto.classList.add('hidden');
    statusLabel.textContent = '● Caixa fechado — clique em Abrir Caixa para iniciar';
  } else {
    secFechado.classList.add('hidden');
    secAberto.classList.remove('hidden');
    statusLabel.textContent = `● Caixa aberto desde ${App.formatDate(caixa.abertoEm)}`;

    document.getElementById('info-aberto-em').textContent = App.formatDate(caixa.abertoEm);
    document.getElementById('info-operador').textContent = caixa.operador || 'Operador';
    document.getElementById('info-saldo-inicial').textContent = App.formatCurrency(caixa.saldoInicial);

    const totais = calcularTotaisCaixa(caixa);
    document.getElementById('caixa-kpi-inicial').textContent = App.formatCurrency(caixa.saldoInicial);
    document.getElementById('caixa-kpi-entradas').textContent = App.formatCurrency(totais.entradas);
    const numVendas = (caixa.movimentacoes || []).filter(m => m.tipo === 'venda').length;
    document.getElementById('caixa-kpi-entradas-sub').textContent = `${numVendas} venda${numVendas !== 1 ? 's' : ''}`;
    document.getElementById('caixa-kpi-saidas').textContent = App.formatCurrency(totais.saidas);
    document.getElementById('caixa-kpi-saldo').textContent = App.formatCurrency(totais.saldoEsperado);

    renderMovimentacoesCaixa(caixa);
  }

  renderHistoricoCaixas();
}

function renderMovimentacoesCaixa(caixa) {
  const movs = [...(caixa.movimentacoes || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const tbody = document.getElementById('tbody-mov-caixa');

  const primeiraLinha = `<tr class="mov-row-entrada"><td>${App.formatDate(caixa.abertoEm)}</td><td><span class="badge badge-entrada">Abertura</span></td><td>Abertura do caixa</td><td class="text-right font-bold text-green">${App.formatCurrency(caixa.saldoInicial)}</td></tr>`;

  if (movs.length === 0) {
    tbody.innerHTML = primeiraLinha;
    return;
  }

  tbody.innerHTML = primeiraLinha + movs.map(m => {
    const isEntrada = m.tipo === 'venda' || m.tipo === 'suprimento';
    const tipoBadge = m.tipo === 'venda' ? '<span class="badge badge-venda">Venda</span>' : m.tipo === 'suprimento' ? '<span class="badge badge-entrada">Suprimento</span>' : '<span class="badge badge-saida">Sangria</span>';
    const cor = isEntrada ? 'var(--green)' : 'var(--red)';
    const sinal = isEntrada ? '+' : '−';
    return `
      <tr class="${isEntrada ? 'mov-row-entrada' : 'mov-row-saida'}">
        <td style="white-space:nowrap;">${App.formatDate(m.createdAt)}</td>
        <td>${tipoBadge}</td>
        <td>${m.descricao || '—'}</td>
        <td class="text-right font-bold" style="color:${cor};">${sinal} ${App.formatCurrency(m.valor)}</td>
      </tr>
    `;
  }).join('');
}

function renderHistoricoCaixas() {
  const caixas = DB.getCaixas().filter(c => c.status === 'fechado').sort((a, b) => new Date(b.abertoEm) - new Date(a.abertoEm));
  const tbody = document.getElementById('tbody-historico-caixas');

  if (caixas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted" style="padding:20px;">Nenhum caixa fechado anteriormente</td></tr>';
    return;
  }

  tbody.innerHTML = caixas.map(c => {
    const totais = calcularTotaisCaixa(c);
    const diff = (c.saldoFinal || 0) - totais.saldoEsperado;
    const diffCor = diff >= 0 ? 'var(--green)' : 'var(--red)';
    return `
      <tr>
        <td style="white-space:nowrap;">${App.formatDate(c.abertoEm)}</td>
        <td style="white-space:nowrap;">${c.fechadoEm ? App.formatDate(c.fechadoEm) : '—'}</td>
        <td>${c.operador || '—'}</td>
        <td class="text-right">${App.formatCurrency(c.saldoInicial)}</td>
        <td class="text-right text-green">${App.formatCurrency(totais.entradas)}</td>
        <td class="text-right text-red">${App.formatCurrency(totais.saidas)}</td>
        <td class="text-right font-bold">${App.formatCurrency(c.saldoFinal || 0)}</td>
        <td class="text-right font-bold" style="color:${diffCor};">${diff >= 0 ? '+' : ''}${App.formatCurrency(diff)}</td>
        <td><span class="badge badge-ok">Fechado</span></td>
      </tr>
    `;
  }).join('');
}

function abrirCaixa() {
  const saldo = parseFloat(document.getElementById('saldo-inicial').value) || 0;
  const user = DB.getUsuarioLogado();
  const operador = user ? user.nome : 'Operador';
  DB.abrirCaixa(saldo, operador);
  App.showToast('Caixa aberto com sucesso!', 'success');
  App.checkCaixaAberto();
  renderEstadoCaixa();
}

function setSangriaType(tipo, btn) {
  sangriaType = tipo;
  document.querySelectorAll('#modal-sangria .payment-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function abrirModalSangria() {
  document.getElementById('sangria-valor').value = '';
  document.getElementById('sangria-descricao').value = '';
  sangriaType = 'suprimento';
  document.getElementById('btn-suprimento').classList.add('active');
  document.getElementById('btn-sangria-btn').classList.remove('active');
  document.getElementById('modal-sangria').classList.add('show');
  setTimeout(() => document.getElementById('sangria-valor').focus(), 100);
}

function registrarSangria() {
  const caixa = DB.getCaixaAberto();
  if (!caixa) { App.showToast('Nenhum caixa aberto!', 'error'); return; }
  const valor = parseFloat(document.getElementById('sangria-valor').value);
  if (!valor || valor <= 0) { App.showToast('Informe um valor válido!', 'error'); return; }
  const descricao = document.getElementById('sangria-descricao').value.trim() || (sangriaType === 'suprimento' ? 'Suprimento de caixa' : 'Sangria de caixa');

  if (sangriaType === 'sangria') {
    const totais = calcularTotaisCaixa(caixa);
    if (valor > totais.saldoEsperado) { App.showToast('Saldo insuficiente para sangria!', 'error'); return; }
  }

  DB.addMovimentacaoCaixa(caixa.id, { tipo: sangriaType, descricao, valor });
  App.showToast(`${sangriaType === 'suprimento' ? 'Suprimento' : 'Sangria'} registrado(a) com sucesso!`, 'success');
  fecharModal('modal-sangria');
  renderEstadoCaixa();
}

function abrirModalFechar() {
  const caixa = DB.getCaixaAberto();
  if (!caixa) return;
  const totais = calcularTotaisCaixa(caixa);
  document.getElementById('fc-saldo-inicial').textContent = App.formatCurrency(caixa.saldoInicial);
  document.getElementById('fc-entradas').textContent = App.formatCurrency(totais.entradas);
  document.getElementById('fc-saidas').textContent = App.formatCurrency(totais.saidas);
  document.getElementById('fc-saldo-esperado').textContent = App.formatCurrency(totais.saldoEsperado);
  document.getElementById('saldo-final-input').value = '';
  document.getElementById('diferenca-wrapper').classList.add('hidden');
  document.getElementById('modal-fechar-caixa').classList.add('show');
}

function calcularDiferenca() {
  const caixa = DB.getCaixaAberto();
  if (!caixa) return;
  const totais = calcularTotaisCaixa(caixa);
  const saldoFinal = parseFloat(document.getElementById('saldo-final-input').value) || 0;
  const diff = saldoFinal - totais.saldoEsperado;
  const wrapper = document.getElementById('diferenca-wrapper');
  wrapper.classList.remove('hidden');
  wrapper.style.background = diff >= 0 ? 'rgba(67,160,71,0.1)' : 'rgba(229,57,53,0.1)';
  wrapper.style.border = `1px solid ${diff >= 0 ? 'rgba(67,160,71,0.3)' : 'rgba(229,57,53,0.3)'}`;
  const el = document.getElementById('diferenca-value');
  el.style.color = diff >= 0 ? 'var(--green)' : 'var(--red)';
  el.textContent = (diff >= 0 ? '+' : '') + App.formatCurrency(diff);
}

function confirmarFecharCaixa() {
  const caixa = DB.getCaixaAberto();
  if (!caixa) return;
  const saldoFinal = parseFloat(document.getElementById('saldo-final-input').value) || 0;
  const totais = calcularTotaisCaixa(caixa);
  DB.fecharCaixa(caixa.id, saldoFinal);
  fecharModal('modal-fechar-caixa');
  App.checkCaixaAberto();
  renderEstadoCaixa();
  mostrarResumoDiario(caixa, totais, saldoFinal);
}

function mostrarResumoDiario(caixa, totais, saldoFinal) {
  const movs = caixa.movimentacoes || [];
  const vendas = movs.filter(m => m.tipo === 'venda');
  const suprimentos = movs.filter(m => m.tipo === 'suprimento');
  const sangrias = movs.filter(m => m.tipo === 'sangria');
  const diff = saldoFinal - totais.saldoEsperado;
  const diffCor = diff >= 0 ? '#22c55e' : '#ef4444';
  const diffSinal = diff >= 0 ? '+' : '';

  // Vendas por forma de pagamento
  const vendasDB = DB.getVendas().filter(v => v.caixaId === caixa.id);
  const porPag = {};
  vendasDB.forEach(v => {
    const p = v.pagamentoNome || v.pagamento;
    if (!porPag[p]) porPag[p] = { qtd: 0, total: 0 };
    porPag[p].qtd++;
    porPag[p].total += v.total || 0;
  });

  const linhasPag = Object.entries(porPag).map(([pag, d]) =>
    `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;">
      <span style="color:#666;">${pag} (${d.qtd}x)</span>
      <span>${App.formatCurrency(d.total)}</span>
    </div>`
  ).join('') || '<div style="font-size:13px;color:#999;">Nenhuma venda</div>';

  const html = `
    <div id="resumo-diario-content">
      <div style="text-align:center;margin-bottom:16px;">
        <div style="font-size:18px;font-weight:700;">FECHAMENTO DE CAIXA</div>
        <div style="font-size:12px;color:#888;">${App.formatDate(caixa.abertoEm)} — ${App.formatDate(new Date().toISOString())}</div>
        <div style="font-size:12px;color:#888;">Operador: ${caixa.operador || '—'}</div>
      </div>

      <div style="border:1px solid #e5e7eb;border-radius:8px;padding:12px;margin-bottom:12px;">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#888;margin-bottom:8px;">Resumo do Caixa</div>
        <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;"><span style="color:#666;">Saldo Inicial</span><span>${App.formatCurrency(caixa.saldoInicial)}</span></div>
        <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;"><span style="color:#666;">Total Entradas</span><span style="color:#22c55e;">+ ${App.formatCurrency(totais.entradas)}</span></div>
        <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;"><span style="color:#666;">Total Saídas</span><span style="color:#ef4444;">− ${App.formatCurrency(totais.saidas)}</span></div>
        <div style="display:flex;justify-content:space-between;padding:6px 0 2px;font-size:14px;font-weight:700;border-top:1px solid #e5e7eb;margin-top:4px;"><span>Saldo Esperado</span><span>${App.formatCurrency(totais.saldoEsperado)}</span></div>
        <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:14px;font-weight:700;"><span>Saldo Contado</span><span>${App.formatCurrency(saldoFinal)}</span></div>
        <div style="display:flex;justify-content:space-between;padding:6px 0 2px;font-size:15px;font-weight:700;border-top:2px solid #e5e7eb;margin-top:4px;"><span>Diferença</span><span style="color:${diffCor};">${diffSinal}${App.formatCurrency(diff)}</span></div>
      </div>

      <div style="border:1px solid #e5e7eb;border-radius:8px;padding:12px;margin-bottom:12px;">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#888;margin-bottom:8px;">Vendas — ${vendas.length} transação(ões)</div>
        ${linhasPag}
        <div style="display:flex;justify-content:space-between;padding:6px 0 2px;font-size:14px;font-weight:700;border-top:1px solid #e5e7eb;margin-top:6px;"><span>Total em Vendas</span><span style="color:#22c55e;">${App.formatCurrency(vendasDB.reduce((s,v) => s + (v.total||0), 0))}</span></div>
      </div>

      ${suprimentos.length || sangrias.length ? `
      <div style="border:1px solid #e5e7eb;border-radius:8px;padding:12px;margin-bottom:12px;">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#888;margin-bottom:8px;">Suprimentos / Sangrias</div>
        ${suprimentos.map(m => `<div style="display:flex;justify-content:space-between;font-size:13px;padding:3px 0;"><span style="color:#666;">↓ ${m.descricao}</span><span style="color:#22c55e;">+ ${App.formatCurrency(m.valor)}</span></div>`).join('')}
        ${sangrias.map(m => `<div style="display:flex;justify-content:space-between;font-size:13px;padding:3px 0;"><span style="color:#666;">↑ ${m.descricao}</span><span style="color:#ef4444;">− ${App.formatCurrency(m.valor)}</span></div>`).join('')}
      </div>` : ''}

      <div style="text-align:center;font-size:11px;color:#aaa;margin-top:8px;">Suplementos Pro • ${new Date().toLocaleDateString('pt-BR')}</div>
    </div>
  `;

  document.getElementById('resumo-diario-body').innerHTML = html;
  document.getElementById('modal-resumo-diario').classList.add('show');
  if (window.lucide) lucide.createIcons();
}

function imprimirResumoDiario() {
  const content = document.getElementById('resumo-diario-content').innerHTML;
  const win = window.open('', '_blank', 'width=400,height=650');
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Fechamento de Caixa</title>
  <style>
    body { font-family: 'Segoe UI', sans-serif; padding: 20px; max-width: 360px; margin: 0 auto; color: #111; }
    * { box-sizing: border-box; }
    @media print { body { padding: 0; } }
  </style></head><body>${content}<script>window.onload=()=>{window.print();window.close();}<\/script></body></html>`);
  win.document.close();
}

function toggleHistorico() {
  const wrapper = document.getElementById('historico-caixas-wrapper');
  wrapper.classList.toggle('hidden');
}

function fecharModal(id) {
  document.getElementById(id).classList.remove('show');
}

document.querySelectorAll('.modal-overlay').forEach(m => {
  m.addEventListener('click', e => { if (e.target === m) m.classList.remove('show'); });
});


(async () => {
  await App.initPage('caixa');
  const user = DB.getUsuarioLogado();
  const el = document.getElementById('operador-display');
  if (el && user) el.textContent = user.nome;
  renderEstadoCaixa();
})();
