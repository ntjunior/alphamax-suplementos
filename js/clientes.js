const SB_URL_CLI = 'https://kefhuzwqfzkjcpavcamq.supabase.co';
const SB_KEY_CLI = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtlZmh1endxZnpramNwYXZjYW1xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzODA4NDcsImV4cCI6MjEwMTk1Njg0N30.cRsgIVcLfgfaeJQseWMqwrEuIgF7SydSEMsaYjcJROY';

let clienteParaExcluir = null;

function getEstatisticasCliente(clienteId) {
  const vendas = DB.getVendas().filter(v => v.clienteId === clienteId);
  const totalGasto = vendas.reduce((s, v) => s + v.total, 0);
  const ultima = vendas.length > 0 ? vendas.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] : null;
  return { qtd: vendas.length, totalGasto, ultima, vendas: vendas.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) };
}

function renderClientes() {
  const busca = document.getElementById('busca-clientes').value.toLowerCase();
  let clientes = DB.getClientes();
  if (busca) clientes = clientes.filter(c => c.nome.toLowerCase().includes(busca) || (c.telefone && c.telefone.includes(busca)) || (c.email && c.email.toLowerCase().includes(busca)));

  document.getElementById('clientes-count-label').textContent = `${clientes.length} cliente${clientes.length !== 1 ? 's' : ''} cadastrado${clientes.length !== 1 ? 's' : ''}`;

  const tbody = document.getElementById('tbody-clientes');
  if (clientes.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8"><div class="empty-state"><div class="empty-state-icon"><i data-lucide="users"></i></div><div class="empty-state-text">Nenhum cliente encontrado</div></div></td></tr>';
    return;
  }

  const clienteRows = clientes.map(c => {
    const stats = getEstatisticasCliente(c.id);
    const iniciais = c.nome.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
    return `
      <tr style="cursor:pointer;" onclick="verHistorico('${c.id}')">
        <td><div class="cliente-avatar" style="width:36px;height:36px;font-size:14px;">${iniciais}</div></td>
        <td style="font-weight:600;">${c.nome}</td>
        <td>${c.telefone || '—'}</td>
        <td style="font-size:12px;">${c.email || '—'}</td>
        <td class="text-right">${stats.qtd}</td>
        <td class="text-right font-bold text-red">${App.formatCurrency(stats.totalGasto)}</td>
        <td style="font-size:12px;">${stats.ultima ? App.formatDateShort(stats.ultima.createdAt) : '—'}</td>
        <td>${c.origem === 'online'
          ? '<span class="badge" style="background:rgba(99,102,241,0.12);color:#6366f1;font-size:10px;padding:3px 8px;border-radius:20px;font-weight:700;"><i data-lucide="globe" style="width:10px;height:10px;"></i> Online</span>'
          : '<span class="badge" style="background:rgba(34,197,94,0.12);color:#16a34a;font-size:10px;padding:3px 8px;border-radius:20px;font-weight:700;"><i data-lucide="store" style="width:10px;height:10px;"></i> Físico</span>'
        }</td>
        <td onclick="event.stopPropagation()">
          <div class="td-actions">
            <button class="btn btn-sm btn-secondary" onclick="editarCliente('${c.id}')"><i data-lucide="pencil"></i></button>
            <button class="btn btn-sm btn-danger" onclick="confirmarExcluirCliente('${c.id}', '${c.nome.replace(/'/g, "\\'")}')"><i data-lucide="trash-2"></i></button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
  tbody.innerHTML = clienteRows;
  if (window.lucide) lucide.createIcons();
}

async function verHistorico(clienteId) {
  const cliente = DB.getClienteById(clienteId);
  if (!cliente) return;

  const stats = getEstatisticasCliente(clienteId);
  const iniciais = cliente.nome.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

  document.getElementById('historico-empty').classList.add('hidden');
  document.getElementById('historico-content').classList.remove('hidden');
  document.getElementById('hist-avatar').textContent = iniciais;
  document.getElementById('hist-nome').textContent = cliente.nome;
  document.getElementById('hist-tel').textContent = cliente.telefone || 'Sem telefone';
  document.getElementById('hist-email').textContent = cliente.email || 'Sem email';
  document.getElementById('hist-lista').innerHTML = '<div style="text-align:center;color:var(--text-muted);font-size:13px;padding:16px;">Carregando...</div>';

  // Busca pedidos online enviados pelo telefone do cliente
  let pedidosOnline = [];
  if (cliente.telefone) {
    try {
      const tel = cliente.telefone.replace(/\D/g, '').replace(/^0/, '').replace(/^55/, '');
      const res = await fetch(
        `${SB_URL_CLI}/rest/v1/pedidos_online?status=eq.enviado&telefone=ilike.*${tel}*&select=*&order=created_at.desc`,
        { headers: { 'apikey': SB_KEY_CLI, 'Authorization': `Bearer ${SB_KEY_CLI}` } }
      );
      const data = await res.json();
      if (Array.isArray(data)) pedidosOnline = data;
    } catch(e) { /* silencioso */ }
  }

  // Monta lista unificada: vendas PDV + pedidos online enviados
  const vendasPdv = stats.vendas.map(v => ({
    tipo: 'pdv',
    data: v.createdAt,
    total: v.total,
    resumo: v.itens.map(i => `${i.quantidade}x ${i.nome.substring(0, 22)}`).join(', '),
    pagamento: v.pagamento
  }));

  const vendasOnline = pedidosOnline.map(p => ({
    tipo: 'online',
    data: p.created_at,
    total: Number(p.total || 0),
    resumo: (p.itens_texto || '').split('\n').filter(Boolean).map(l => l.replace(/^•\s*/, '')).join(', ')
  }));

  const tudo = [...vendasPdv, ...vendasOnline].sort((a, b) => new Date(b.data) - new Date(a.data));

  const totalGeral = tudo.reduce((s, v) => s + v.total, 0);
  document.getElementById('hist-qtd-compras').textContent = tudo.length;
  document.getElementById('hist-total-gasto').textContent = App.formatCurrency(totalGeral);

  const lista = document.getElementById('hist-lista');
  if (tudo.length === 0) {
    lista.innerHTML = '<div style="text-align:center;color:var(--text-muted);font-size:13px;padding:16px;">Sem compras registradas</div>';
    return;
  }

  lista.innerHTML = tudo.map(v => `
    <div style="background:var(--bg-input);border-radius:var(--radius);padding:12px;border:1px solid var(--border);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
        <div style="display:flex;align-items:center;gap:6px;">
          <span style="font-size:12px;color:var(--text-muted);">${App.formatDate(v.data)}</span>
          ${v.tipo === 'online'
            ? '<span style="background:rgba(99,102,241,0.12);color:#6366f1;font-size:10px;padding:2px 6px;border-radius:10px;font-weight:700;">Online</span>'
            : '<span style="background:rgba(34,197,94,0.12);color:#16a34a;font-size:10px;padding:2px 6px;border-radius:10px;font-weight:700;">PDV</span>'}
        </div>
        <span style="font-size:14px;font-weight:700;color:var(--red);">${App.formatCurrency(v.total)}</span>
      </div>
      <div style="font-size:12px;color:var(--text-dim);">${v.resumo}</div>
      ${v.pagamento ? `<div style="margin-top:4px;">${App.getPagamentoBadge(v.pagamento)}</div>` : ''}
    </div>
  `).join('');
}

function abrirModalCliente() {
  document.getElementById('cliente-id').value = '';
  document.getElementById('cliente-nome').value = '';
  document.getElementById('cliente-tel').value = '';
  document.getElementById('cliente-email').value = '';
  document.getElementById('cliente-obs').value = '';
  document.querySelectorAll('.form-error').forEach(e => e.classList.remove('show'));
  document.getElementById('modal-cliente-titulo').textContent = 'Novo Cliente';
  document.getElementById('modal-cliente').classList.add('show');
  setTimeout(() => document.getElementById('cliente-nome').focus(), 100);
}

function editarCliente(id) {
  const c = DB.getClienteById(id);
  if (!c) return;
  document.getElementById('cliente-id').value = c.id;
  document.getElementById('cliente-nome').value = c.nome;
  document.getElementById('cliente-tel').value = c.telefone || '';
  document.getElementById('cliente-email').value = c.email || '';
  document.getElementById('cliente-obs').value = c.observacoes || '';
  document.querySelectorAll('.form-error').forEach(e => e.classList.remove('show'));
  document.getElementById('modal-cliente-titulo').textContent = 'Editar Cliente';
  document.getElementById('modal-cliente').classList.add('show');
}

function salvarCliente() {
  const nome = document.getElementById('cliente-nome').value.trim();
  document.getElementById('err-cliente-nome').classList.toggle('show', !nome);
  if (!nome) return;

  const id = document.getElementById('cliente-id').value;
  const dados = {
    nome,
    telefone: document.getElementById('cliente-tel').value.trim(),
    email: document.getElementById('cliente-email').value.trim(),
    observacoes: document.getElementById('cliente-obs').value.trim()
  };

  if (id) {
    DB.updateCliente(id, dados);
    App.showToast('Cliente atualizado!', 'success');
  } else {
    DB.addCliente(dados);
    App.showToast('Cliente cadastrado!', 'success');
  }

  fecharModal('modal-cliente');
  renderClientes();
}

function confirmarExcluirCliente(id, nome) {
  clienteParaExcluir = id;
  document.getElementById('nome-excluir-cliente').textContent = nome;
  document.getElementById('modal-excluir-cliente').classList.add('show');
}

document.getElementById('btn-confirmar-excluir-cliente').addEventListener('click', () => {
  if (!clienteParaExcluir) return;
  DB.deleteCliente(clienteParaExcluir);
  App.showToast('Cliente excluído!', 'success');
  fecharModal('modal-excluir-cliente');
  renderClientes();
  document.getElementById('historico-empty').classList.remove('hidden');
  document.getElementById('historico-content').classList.add('hidden');
  clienteParaExcluir = null;
});

function fecharModal(id) {
  document.getElementById(id).classList.remove('show');
}

document.getElementById('busca-clientes').addEventListener('input', renderClientes);

document.querySelectorAll('.modal-overlay').forEach(m => {
  m.addEventListener('click', e => { if (e.target === m) m.classList.remove('show'); });
});


(async () => {
  await App.initPage('clientes');
  renderClientes();
})();
