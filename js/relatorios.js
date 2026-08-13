let periodoAtual = 'hoje';
let dataInicioCustom = null;
let dataFimCustom = null;

function getVendasPeriodo() {
  const vendas = DB.getVendas();
  const hoje = new Date();

  if (periodoAtual === 'hoje') {
    return vendas.filter(v => App.isToday(v.createdAt));
  } else if (periodoAtual === 'semana') {
    return vendas.filter(v => App.isThisWeek(v.createdAt));
  } else if (periodoAtual === 'mes') {
    return vendas.filter(v => App.isThisMonth(v.createdAt));
  } else if (periodoAtual === 'personalizado' && dataInicioCustom && dataFimCustom) {
    const ini = new Date(dataInicioCustom + 'T00:00:00');
    const fim = new Date(dataFimCustom + 'T23:59:59');
    return vendas.filter(v => { const d = new Date(v.createdAt); return d >= ini && d <= fim; });
  }
  return vendas;
}

function renderRelatorio() {
  const vendas = getVendasPeriodo();
  const faturamento = vendas.reduce((s, v) => s + v.total, 0);
  const custo = vendas.reduce((s, v) => s + v.itens.reduce((si, i) => si + (i.precoCusto || 0) * i.quantidade, 0), 0);
  const lucro = faturamento - custo;
  const margem = faturamento > 0 ? ((lucro / faturamento) * 100).toFixed(1) : 0;
  const ticket = vendas.length > 0 ? faturamento / vendas.length : 0;

  document.getElementById('rel-faturamento').textContent = App.formatCurrency(faturamento);
  document.getElementById('rel-lucro').textContent = App.formatCurrency(lucro);
  document.getElementById('rel-margem-label').textContent = `margem: ${margem}%`;
  document.getElementById('rel-ticket').textContent = App.formatCurrency(ticket);
  document.getElementById('rel-qtd').textContent = vendas.length;

  renderGrafico(vendas);
  renderMaisVendidos(vendas);
  renderPagamentos(vendas);
  renderTabelaVendas(vendas);
}

function renderGrafico(vendas) {
  const hoje = new Date();
  let dias = [];
  let numDias = 7;

  if (periodoAtual === 'mes') numDias = 30;
  else if (periodoAtual === 'personalizado' && dataInicioCustom && dataFimCustom) {
    const ini = new Date(dataInicioCustom);
    const fim = new Date(dataFimCustom);
    numDias = Math.min(30, Math.ceil((fim - ini) / 86400000) + 1);
  }

  for (let i = numDias - 1; i >= 0; i--) {
    const d = new Date(hoje);
    d.setDate(d.getDate() - i);
    dias.push(d);
  }

  const labels = dias.map(d => periodoAtual === 'mes' || numDias > 7
    ? d.getDate().toString()
    : d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''));

  const valores = dias.map(d => {
    return vendas.filter(v => {
      const vd = new Date(v.createdAt);
      return vd.getDate() === d.getDate() && vd.getMonth() === d.getMonth() && vd.getFullYear() === d.getFullYear();
    }).reduce((s, v) => s + v.total, 0);
  });

  const canvas = document.getElementById('grafico-relatorio');
  canvas.width = canvas.parentElement.clientWidth - 40;
  App.drawBarChart('grafico-relatorio', labels, valores);
}

function renderMaisVendidos(vendas) {
  const map = {};
  vendas.forEach(v => {
    v.itens.forEach(i => {
      if (!map[i.produtoId]) map[i.produtoId] = { nome: i.nome, qtd: 0, fat: 0 };
      map[i.produtoId].qtd += i.quantidade;
      map[i.produtoId].fat += i.subtotal;
    });
  });

  const ranking = Object.values(map).sort((a, b) => b.qtd - a.qtd).slice(0, 10);
  const tbody = document.getElementById('tbody-mais-vendidos');

  if (ranking.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted" style="padding:20px;">Sem dados no período</td></tr>';
    return;
  }

  tbody.innerHTML = ranking.map((r, idx) => `
    <tr>
      <td><span style="font-size:16px;font-weight:700;color:${idx === 0 ? '#FFD700' : idx === 1 ? '#C0C0C0' : idx === 2 ? '#CD7F32' : 'var(--text-muted)'};">${idx + 1}°</span></td>
      <td style="font-size:13px;">${r.nome}</td>
      <td class="text-right font-bold">${r.qtd}</td>
      <td class="text-right text-red font-bold">${App.formatCurrency(r.fat)}</td>
    </tr>
  `).join('');
}

function renderPagamentos(vendas) {
  const nomes = { dinheiro: 'Dinheiro', pix: 'PIX', credito: 'Crédito', debito: 'Débito' };
  const map = {};
  vendas.forEach(v => {
    if (!map[v.pagamento]) map[v.pagamento] = { qtd: 0, total: 0 };
    map[v.pagamento].qtd++;
    map[v.pagamento].total += v.total;
  });
  const totalGeral = vendas.reduce((s, v) => s + v.total, 0);
  const tbody = document.getElementById('tbody-pagamentos');

  if (Object.keys(map).length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted" style="padding:20px;">Sem dados no período</td></tr>';
    return;
  }

  tbody.innerHTML = Object.entries(map).sort((a, b) => b[1].total - a[1].total).map(([pag, d]) => `
    <tr>
      <td>${nomes[pag] || pag}</td>
      <td class="text-right">${d.qtd}</td>
      <td class="text-right font-bold text-red">${App.formatCurrency(d.total)}</td>
      <td class="text-right text-muted">${totalGeral > 0 ? ((d.total / totalGeral) * 100).toFixed(1) : 0}%</td>
    </tr>
  `).join('');
}

function renderTabelaVendas(vendas) {
  const sorted = [...vendas].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  document.getElementById('vendas-periodo-count').textContent = `${sorted.length} venda${sorted.length !== 1 ? 's' : ''}`;
  const tbody = document.getElementById('tbody-vendas-relatorio');

  if (sorted.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted" style="padding:24px;">Nenhuma venda no período selecionado</td></tr>';
    return;
  }

  tbody.innerHTML = sorted.map(v => `
    <tr>
      <td style="white-space:nowrap;">${App.formatDate(v.createdAt)}</td>
      <td>${v.clienteNome || 'Consumidor Final'}</td>
      <td style="font-size:12px;color:var(--text-muted);">${v.itens.map(i => `${i.quantidade}x ${i.nome.substring(0, 20)}`).join(', ')}</td>
      <td>${App.getPagamentoBadge(v.pagamento)}</td>
      <td class="text-right">${App.formatCurrency(v.subtotal)}</td>
      <td class="text-right text-green">${v.desconto > 0 ? '- ' + App.formatCurrency(v.desconto) : '—'}</td>
      <td class="text-right font-bold text-red">${App.formatCurrency(v.total)}</td>
    </tr>
  `).join('');
}

function setPeriodo(periodo, btn) {
  periodoAtual = periodo;
  document.querySelectorAll('.filter-pills .pill').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const custom = document.getElementById('periodo-personalizado');
  if (periodo === 'personalizado') {
    custom.classList.remove('hidden');
    custom.style.display = 'flex';
  } else {
    custom.classList.add('hidden');
    custom.style.display = 'none';
    renderRelatorio();
  }
}

function aplicarFiltro() {
  dataInicioCustom = document.getElementById('data-inicio').value;
  dataFimCustom = document.getElementById('data-fim').value;
  if (!dataInicioCustom || !dataFimCustom) { App.showToast('Selecione as datas de início e fim!', 'warning'); return; }
  renderRelatorio();
}

function exportar() {
  App.showToast('Exportação em desenvolvimento. Em breve disponível em PDF e Excel!', 'info');
}

const hoje = new Date();
const inicioData = new Date(hoje);
inicioData.setDate(hoje.getDate() - 6);
document.getElementById('data-inicio').value = inicioData.toISOString().split('T')[0];
document.getElementById('data-fim').value = hoje.toISOString().split('T')[0];


(async () => {
  await App.initPage('relatorios');
  renderRelatorio();
})();
