const SUPABASE_URL_P = 'https://kefhuzwqfzkjcpavcamq.supabase.co';
const SUPABASE_KEY_P = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtlZmh1endxZnpramNwYXZjYW1xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzODA4NDcsImV4cCI6MjEwMTk1Njg0N30.cRsgIVcLfgfaeJQseWMqwrEuIgF7SydSEMsaYjcJROY';

const MULTIZAP_URL    = 'https://multizape.com.br';
const MULTIZAP_EMP    = 'alphamax';
const MULTIZAP_SECRET = '6p5ipc07fkc4dbhc';

let todosPedidos = [];
let pedidoSelecionado = null;
let filtroStatus = '';

const STATUS_LABELS = {
  aguardando: 'Aguardando',
  confirmado:  'Confirmado',
  enviado:     'Enviado',
  cancelado:   'Cancelado'
};

const STATUS_CLASSES = {
  aguardando: 's-aguardando',
  confirmado:  's-confirmado',
  enviado:     's-enviado',
  cancelado:   's-cancelado'
};

function statusBadge(status) {
  const s = status || 'aguardando';
  return `<span class="status-badge ${STATUS_CLASSES[s]}">${STATUS_LABELS[s] || s}</span>`;
}

function _pagamentoBadge(pagamento, endereco) {
  if (!pagamento) pagamento = endereco ? 'pix' : 'retirada';
  const map = {
    pix:         { label: 'PIX',           color: '#16a34a', bg: 'rgba(34,197,94,0.12)' },
    retirada:    { label: 'Retirada',      color: '#ca8a04', bg: 'rgba(234,179,8,0.12)' },
    mercadopago: { label: 'Cartão/MP',     color: '#2563eb', bg: 'rgba(59,130,246,0.12)' },
  };
  const cfg = map[pagamento] || { label: pagamento, color: 'var(--text-muted)', bg: 'transparent' };
  return `<span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;background:${cfg.bg};color:${cfg.color}">${cfg.label}</span>`;
}

async function carregarPedidos() {
  document.getElementById('pedidos-count-label').textContent = 'Carregando...';
  try {
    const res = await fetch(
      `${SUPABASE_URL_P}/rest/v1/pedidos_online?select=*&order=created_at.desc`,
      { headers: { 'apikey': SUPABASE_KEY_P, 'Authorization': `Bearer ${SUPABASE_KEY_P}` } }
    );
    todosPedidos = await res.json();
    if (!Array.isArray(todosPedidos)) todosPedidos = [];
    renderPedidos();
  } catch(e) {
    console.error('Erro ao carregar pedidos:', e);
    document.getElementById('pedidos-count-label').textContent = 'Erro ao carregar';
  }
}

function renderPedidos() {
  const filtroData = document.getElementById('filtro-data').value;

  let lista = todosPedidos;
  if (filtroStatus) lista = lista.filter(p => (p.status || 'aguardando') === filtroStatus);
  if (filtroData)   lista = lista.filter(p => p.created_at && p.created_at.startsWith(filtroData));

  document.getElementById('pedidos-count-label').textContent =
    `${lista.length} pedido${lista.length !== 1 ? 's' : ''}${filtroStatus ? ' — ' + STATUS_LABELS[filtroStatus] : ''}`;

  const tbody = document.getElementById('tbody-pedidos');
  if (lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="empty-state-icon"><i data-lucide="clipboard-list"></i></div><div class="empty-state-text">Nenhum pedido encontrado</div></div></td></tr>`;
    if (window.lucide) lucide.createIcons();
    return;
  }

  tbody.innerHTML = lista.map(p => {
    const data = p.created_at ? new Date(p.created_at).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' }) : '—';
    const itensResumo = (p.itens_texto || '').split('\n').slice(0,2).join(', ').replace(/•\s*/g,'').trim() || '—';
    const entrega = p.endereco ? 'Entrega' : 'Retirada';
    const pagBadge = _pagamentoBadge(p.pagamento, p.endereco);
    const selected = pedidoSelecionado && pedidoSelecionado.id === p.id ? 'selected' : '';
    return `
      <tr class="pedido-row ${selected}" onclick="verDetalhe('${p.id}')">
        <td style="font-size:12px;white-space:nowrap;">${data}</td>
        <td style="font-weight:600;">${p.nome || '—'}</td>
        <td style="font-size:12px;">${p.telefone || '—'}</td>
        <td style="font-size:12px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${itensResumo}</td>
        <td class="text-right font-bold text-red" style="white-space:nowrap;">R$ ${Number(p.total || 0).toFixed(2).replace('.', ',')}</td>
        <td style="font-size:12px;">${entrega}</td>
        <td>${pagBadge}</td>
        <td>${statusBadge(p.status)}</td>
      </tr>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

function verDetalhe(id) {
  const p = todosPedidos.find(x => x.id === id);
  if (!p) return;
  pedidoSelecionado = p;

  document.querySelectorAll('.pedido-row').forEach(r => r.classList.remove('selected'));
  const rows = document.querySelectorAll('.pedido-row');
  rows.forEach(r => { if (r.onclick && r.getAttribute('onclick') && r.getAttribute('onclick').includes(id)) r.classList.add('selected'); });

  document.getElementById('detalhe-empty').classList.add('hidden');
  document.getElementById('detalhe-content').classList.remove('hidden');

  const data = p.created_at ? new Date(p.created_at).toLocaleString('pt-BR') : '—';
  document.getElementById('det-nome').textContent = p.nome || '—';
  document.getElementById('det-tel').textContent = p.telefone || 'Sem telefone';
  document.getElementById('det-data').textContent = data;
  document.getElementById('det-status-badge').innerHTML = statusBadge(p.status);
  document.getElementById('det-endereco').innerHTML = (p.endereco || 'Retirada na loja') + '&nbsp;&nbsp;' + _pagamentoBadge(p.pagamento, p.endereco);
  document.getElementById('det-total').textContent = `R$ ${Number(p.total || 0).toFixed(2).replace('.', ',')}`;

  const itensEl = document.getElementById('det-itens');
  const linhas = (p.itens_texto || '').split('\n').filter(Boolean);
  if (linhas.length > 0) {
    itensEl.innerHTML = linhas.map(l => `
      <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border);">
        <span style="font-size:13px;color:var(--text-dim);">${l.replace(/^•\s*/, '')}</span>
      </div>
    `).join('');
  } else {
    itensEl.innerHTML = '<span style="color:var(--text-muted);font-size:13px;">—</span>';
  }

  const statusAtual = p.status || 'aguardando';
  const btnsEl = document.getElementById('det-btns-status');
  btnsEl.innerHTML = Object.keys(STATUS_LABELS).map(s => `
    <button class="btn-status ${s === statusAtual ? 'active-s' : ''}" onclick="atualizarStatus('${p.id}','${s}')">${STATUS_LABELS[s]}</button>
  `).join('');

  renderFollowUp(p.id);
}

async function atualizarStatus(id, novoStatus) {
  const pedido = todosPedidos.find(p => p.id === id);
  const statusAnterior = pedido ? (pedido.status || 'aguardando') : '';
  try {
    await fetch(
      `${SUPABASE_URL_P}/rest/v1/pedidos_online?id=eq.${id}`,
      {
        method: 'PATCH',
        headers: { 'apikey': SUPABASE_KEY_P, 'Authorization': `Bearer ${SUPABASE_KEY_P}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify({ status: novoStatus, updated_at: new Date().toISOString() })
      }
    );
    const idx = todosPedidos.findIndex(p => p.id === id);
    if (idx !== -1) todosPedidos[idx].status = novoStatus;
    if (pedidoSelecionado && pedidoSelecionado.id === id) {
      pedidoSelecionado.status = novoStatus;
      document.getElementById('det-status-badge').innerHTML = statusBadge(novoStatus);
      const btnsEl = document.getElementById('det-btns-status');
      btnsEl.querySelectorAll('.btn-status').forEach(b => {
        b.classList.toggle('active-s', b.getAttribute('onclick').includes(`'${novoStatus}'`));
      });
    }
    renderPedidos();
    App.showToast('Status atualizado!', 'success');

    if (novoStatus === 'confirmado' && statusAnterior !== 'confirmado' && pedido) {
      await baixarEstoquePedido(pedido.itens_texto);
      registrarVendaOnline(pedido);
    }
    if (pedido && novoStatus !== statusAnterior) {
      enviarWhatsAppStatus(pedido, novoStatus);
    }
  } catch(e) {
    App.showToast('Erro ao atualizar status', 'error');
  }
}

async function registrarVendaOnline(pedido) {
  try {
    const total = parseFloat(pedido.total) || 0;
    const itens = (pedido.itens_texto || '').split('\n').filter(Boolean).map(linha => {
      const m = linha.match(/[•\-]?\s*(\d+)x\s+(.+?)\s+—\s+R\$\s*([\d,.]+)/);
      if (!m) return null;
      const preco = parseFloat(m[3].replace('.','').replace(',','.'));
      return { nome: m[2].trim(), qty: parseInt(m[1]), preco, total: preco };
    }).filter(Boolean);

    const venda = {
      id: 'online_' + pedido.id,
      created_at: pedido.created_at || new Date().toISOString(),
      itens,
      subtotal: total,
      desconto: 0,
      total,
      pagamento: 'online',
      pagamento_nome: 'Pedido Online',
      cliente_nome: pedido.nome || '',
      status: 'pago',
      caixa_id: null,
      origem: 'loja_online'
    };

    await fetch(`${SUPABASE_URL_P}/rest/v1/vendas`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY_P,
        'Authorization': `Bearer ${SUPABASE_KEY_P}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=ignore-duplicates,return=minimal'
      },
      body: JSON.stringify(venda)
    });
  } catch(e) {
    console.warn('Erro ao registrar venda online:', e);
  }
}

async function baixarEstoquePedido(itensTxt) {
  const linhas = (itensTxt || '').split('\n').filter(Boolean);
  for (const linha of linhas) {
    const m = linha.match(/(\d+)x\s+(.+?)\s+—/);
    if (!m) continue;
    const qty = parseInt(m[1]);
    const nomeBusca = m[2].trim().substring(0, 20);
    try {
      const res = await fetch(
        `${SUPABASE_URL_P}/rest/v1/produtos?nome=ilike.*${encodeURIComponent(nomeBusca)}*&select=id,estoque&limit=1`,
        { headers: { 'apikey': SUPABASE_KEY_P, 'Authorization': `Bearer ${SUPABASE_KEY_P}` } }
      );
      const prods = await res.json();
      if (prods && prods[0]) {
        const novoEstoque = Math.max(0, (prods[0].estoque || 0) - qty);
        await fetch(`${SUPABASE_URL_P}/rest/v1/produtos?id=eq.${prods[0].id}`, {
          method: 'PATCH',
          headers: { 'apikey': SUPABASE_KEY_P, 'Authorization': `Bearer ${SUPABASE_KEY_P}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
          body: JSON.stringify({ estoque: novoEstoque })
        });
      }
    } catch(e) { console.warn('Erro ao baixar estoque:', e); }
  }
}

const MSG_DEFAULTS_P = {
  confirmado: '✅ *Alpha Max Suplementos*\n\nOlá [Nome]! Seu pedido foi *confirmado*!\n\nEm breve será separado. Entraremos em contato com os dados para pagamento via PIX.',
  enviado:    '🚀 *Alpha Max Suplementos*\n\nOlá [Nome]! Seu pedido foi *enviado*! 📦\n\nEm breve chegará até você. Obrigado pela preferência! 💪',
  enviado_retirada: '🏪 *Alpha Max Suplementos*\n\nOlá [Nome]! Sua encomenda está *pronta para retirar*! ✅\n\nPode vir até nossa loja buscar. Te esperamos! 💪',
  cancelado:  '❌ *Alpha Max Suplementos*\n\nOlá [Nome]. Seu pedido foi *cancelado*.\n\nEntre em contato pelo WhatsApp para mais informações.'
};

function getMsgTemplate(status, nome, pedido) {
  const salvas = JSON.parse(localStorage.getItem('msg_templates_alphamax') || '{}');
  let key = status;
  if (status === 'enviado' && pedido && !pedido.endereco) key = 'enviado_retirada';
  const template = salvas[key] || salvas[status] || MSG_DEFAULTS_P[key] || MSG_DEFAULTS_P[status] || '';
  return template.replace(/\[Nome\]/g, nome || 'Cliente');
}

async function enviarWhatsAppStatus(pedido, status) {
  if (!pedido.telefone) return;
  const tel = pedido.telefone.replace(/\D/g,'').replace(/^0/,'').replace(/^55/,'');
  const nome = pedido.nome || 'Cliente';
  const msg = getMsgTemplate(status, nome, pedido);
  if (!msg) return;

  const enviado = await enviarViaWebhook(pedido, msg, status);
  if (!enviado) {
    const url = `https://wa.me/55${tel}?text=${encodeURIComponent(msg)}`;
    await registrarFollowUp(pedido.id, status, false, url);
    atualizarFollowUpUI(pedido.id, status);
  }
}

async function enviarViaWebhook(pedido, mensagem, tipo) {
  try {
    const tel = (pedido.telefone || '').replace(/\D/g,'').replace(/^0/,'').replace(/^55/,'');
    if (!tel) return false;
    const r = await fetch(`${MULTIZAP_URL}/webhook/loja/${MULTIZAP_EMP}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: MULTIZAP_SECRET, numero: tel, mensagem, pedidoId: pedido.id, tipo })
    });
    const d = await r.json();
    if (d.ok) {
      await registrarFollowUp(pedido.id, tipo, true);
      atualizarFollowUpUI(pedido.id, tipo);
      return true;
    }
  } catch(e) { console.warn('Webhook Multi Zap:', e.message); }
  return false;
}

async function registrarFollowUp(pedidoId, tipo, ok, waUrl) {
  try {
    const followUps = JSON.parse(localStorage.getItem('followups_pedidos') || '{}');
    if (!followUps[pedidoId]) followUps[pedidoId] = [];
    const entry = { tipo, ok, ts: new Date().toISOString() };
    if (waUrl) entry.waUrl = waUrl;
    followUps[pedidoId].push(entry);
    localStorage.setItem('followups_pedidos', JSON.stringify(followUps));
  } catch(e) {}
}

function getFollowUps(pedidoId) {
  try {
    const followUps = JSON.parse(localStorage.getItem('followups_pedidos') || '{}');
    const limite = Date.now() - 2 * 60 * 60 * 1000; // 2 horas
    const todos = followUps[pedidoId] || [];
    const recentes = todos.filter(f => new Date(f.ts).getTime() > limite);
    if (recentes.length !== todos.length) {
      followUps[pedidoId] = recentes;
      localStorage.setItem('followups_pedidos', JSON.stringify(followUps));
    }
    return recentes;
  } catch { return []; }
}

function atualizarFollowUpUI(pedidoId, tipo) {
  const el = document.getElementById('det-followup');
  if (!el || !pedidoSelecionado || pedidoSelecionado.id !== pedidoId) return;
  renderFollowUp(pedidoId);
}

function limparFollowUp(pedidoId) {
  try {
    const followUps = JSON.parse(localStorage.getItem('followups_pedidos') || '{}');
    delete followUps[pedidoId];
    localStorage.setItem('followups_pedidos', JSON.stringify(followUps));
  } catch(e) {}
  renderFollowUp(pedidoId);
}

function renderFollowUp(pedidoId) {
  const el = document.getElementById('det-followup');
  if (!el) return;
  const logs = getFollowUps(pedidoId);
  if (logs.length === 0) {
    el.innerHTML = '<span style="color:var(--text-muted);font-size:12px;">Nenhuma mensagem enviada</span>';
    return;
  }
  const tipoLabel = { confirmado: 'Confirmado', enviado: 'Enviado', cancelado: 'Cancelado', novo_pedido: 'Novo pedido', reenvio: 'Reenvio' };
  el.innerHTML = `<div style="text-align:right;margin-bottom:4px;"><button onclick="limparFollowUp('${pedidoId}')" style="font-size:11px;color:var(--text-muted);background:none;border:none;cursor:pointer;text-decoration:underline;">Limpar histórico</button></div>` + logs.map(f => {
    const ts = new Date(f.ts).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
    const icon = f.ok ? '\u2705' : '\u274C';
    const waBtn = (!f.ok && f.waUrl)
      ? `<a href="${f.waUrl}" target="_blank" rel="noopener" style="display:inline-block;margin-top:4px;padding:3px 10px;background:var(--red);color:#fff;border-radius:20px;font-size:11px;font-weight:700;text-decoration:none;">Abrir WhatsApp →</a>`
      : '';
    return `<div style="font-size:12px;padding:6px 0;border-bottom:1px solid var(--border);">${icon} <b>${tipoLabel[f.tipo] || f.tipo}</b> — ${ts}${waBtn ? '<br>' + waBtn : ''}</div>`;
  }).join('');
}

async function reenviarMensagem() {
  if (!pedidoSelecionado) return;
  const p = pedidoSelecionado;
  const status = p.status || 'aguardando';
  if (!['confirmado','enviado','cancelado'].includes(status)) {
    App.showToast('Reenvio disponível para: Confirmado, Enviado ou Cancelado', 'error');
    return;
  }
  const nome = p.nome || 'Cliente';
  const tel = (p.telefone || '').replace(/\D/g,'').replace(/^0/,'').replace(/^55/,'');
  const msg = getMsgTemplate(status, nome, p);
  const enviado = await enviarViaWebhook(p, msg, 'reenvio');
  if (enviado) {
    App.showToast('Mensagem reenviada via WhatsApp!', 'success');
  } else {
    const url = `https://wa.me/55${tel}?text=${encodeURIComponent(msg)}`;
    await registrarFollowUp(p.id, 'reenvio', false, url);
    atualizarFollowUpUI(p.id, 'reenvio');
  }
}

async function lancarNoCaixa() {
  const p = pedidoSelecionado;
  if (!p) return;

  const total = parseFloat(p.total) || 0;
  if (total <= 0) { App.showToast('Pedido sem valor para lançar', 'warning'); return; }

  const btn = document.getElementById('btn-lancar-caixa');
  const vendaId = 'online_' + p.id;

  // Verifica duplicata real no Supabase (qualquer caixa)
  const dupCheck = await fetch(
    `${SUPABASE_URL_P}/rest/v1/vendas?id=eq.${encodeURIComponent(vendaId)}&select=id`,
    { headers: { 'apikey': SUPABASE_KEY_P, 'Authorization': `Bearer ${SUPABASE_KEY_P}` } }
  );
  const dupRows = await dupCheck.json();
  if (Array.isArray(dupRows) && dupRows.length > 0) {
    App.showToast('Este pedido já foi lançado!', 'warning');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i data-lucide="check"></i> Já Lançado'; App.refreshIcons?.(); }
    return;
  }

  // Busca caixa aberto
  const res = await fetch(`${SUPABASE_URL_P}/rest/v1/caixas?status=eq.aberto&order=aberto_em.desc&limit=1`, {
    headers: { 'apikey': SUPABASE_KEY_P, 'Authorization': `Bearer ${SUPABASE_KEY_P}` }
  });
  const caixas = await res.json();
  if (!caixas.length) {
    App.showToast('Nenhum caixa aberto. Abra o caixa primeiro.', 'error');
    return;
  }
  const caixa = caixas[0];

  const mov = {
    id: vendaId,
    tipo: 'venda',
    valor: total,
    descricao: `Pedido Online — ${p.nome}`,
    pagamento: p.pagamento || 'online',
    createdAt: new Date().toISOString(),
    pedidoOnlineId: p.id
  };

  const novasMov = [...(caixa.movimentacoes || []), mov];
  const novoSaldo = (parseFloat(caixa.saldo_inicial) || 0) +
    novasMov.reduce((s, m) => s + (m.tipo === 'venda' || m.tipo === 'entrada' ? m.valor : -m.valor), 0);

  await fetch(`${SUPABASE_URL_P}/rest/v1/caixas?id=eq.${caixa.id}`, {
    method: 'PATCH',
    headers: { 'apikey': SUPABASE_KEY_P, 'Authorization': `Bearer ${SUPABASE_KEY_P}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
    body: JSON.stringify({ movimentacoes: novasMov, saldo_final: novoSaldo })
  });

  // Insere venda com ID estável para dashboard e relatórios
  const pagNomes = { pix: 'PIX', retirada: 'Retirada', mercadopago: 'Cartão/MP' };
  const vendaRes = await fetch(`${SUPABASE_URL_P}/rest/v1/vendas`, {
    method: 'POST',
    headers: { 'apikey': SUPABASE_KEY_P, 'Authorization': `Bearer ${SUPABASE_KEY_P}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
    body: JSON.stringify({
      id: vendaId,
      itens: [],
      subtotal: total,
      desconto: 0,
      total: total,
      pagamento: p.pagamento || 'pix',
      pagamento_nome: pagNomes[p.pagamento] || 'PIX',
      cliente_nome: p.nome || 'Cliente Online',
      status: 'pago',
      caixa_id: caixa.id,
      created_at: p.created_at || new Date().toISOString()
    })
  });

  if (!vendaRes.ok) {
    console.warn('Erro ao inserir venda:', await vendaRes.text());
    App.showToast('Lançado no caixa, mas houve erro ao registrar venda.', 'warning');
  } else {
    App.showToast(`R$ ${total.toFixed(2).replace('.', ',')} lançado no caixa!`, 'success');
  }

  if (btn) { btn.disabled = true; btn.innerHTML = '<i data-lucide="check"></i> Lançado no Caixa'; App.refreshIcons?.(); }
}

function imprimirPedido() {
  if (!pedidoSelecionado) return;
  const p = pedidoSelecionado;
  const data = p.created_at ? new Date(p.created_at).toLocaleString('pt-BR') : '—';
  const status = STATUS_LABELS[p.status || 'aguardando'] || p.status;
  const itensHtml = (p.itens_texto || '').split('\n').filter(Boolean)
    .map(l => `<tr><td style="padding:6px 0;border-bottom:1px solid #eee;">${l.replace(/^•\s*/, '')}</td></tr>`).join('');

  const html = `
    <!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>Pedido — ${p.nome}</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 13px; color: #111; max-width: 400px; margin: 0 auto; padding: 20px; }
      h2 { font-size: 16px; margin: 0 0 4px; }
      .sub { color: #666; font-size: 12px; margin-bottom: 16px; }
      .section-label { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #999; margin: 14px 0 4px; letter-spacing: 0.5px; }
      table { width: 100%; border-collapse: collapse; }
      .total-row { display: flex; justify-content: space-between; margin-top: 14px; padding-top: 10px; border-top: 2px solid #111; font-weight: 700; font-size: 15px; }
      .badge { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 11px; font-weight: 700; background: #fef9c3; color: #854d0e; }
      @media print { body { padding: 0; } }
    </style></head><body>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;">
      <div>
        <h2>${p.nome}</h2>
        <div class="sub">${p.telefone || ''} &nbsp;|&nbsp; ${data}</div>
      </div>
      <span class="badge">${status}</span>
    </div>
    <hr style="border:none;border-top:1px solid #ddd;">
    <div class="section-label">Entrega</div>
    <div>${p.endereco || 'Retirada na loja'}</div>
    <div class="section-label">Itens</div>
    <table>${itensHtml}</table>
    <div class="total-row"><span>TOTAL</span><span>R$ ${Number(p.total || 0).toFixed(2).replace('.', ',')}</span></div>
    <script>window.onload=()=>{window.print();}<\/script>
    </body></html>`;

  const win = window.open('', '_blank', 'width=480,height=600');
  win.document.write(html);
  win.document.close();
}

// Filtros
document.getElementById('filtros-status').addEventListener('click', e => {
  const btn = e.target.closest('.btn-filtro');
  if (!btn) return;
  document.querySelectorAll('.btn-filtro').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  filtroStatus = btn.dataset.status;
  renderPedidos();
});

document.getElementById('filtro-data').addEventListener('change', renderPedidos);

(async () => {
  await App.initPage('pedidos');
  await carregarPedidos();
})();
