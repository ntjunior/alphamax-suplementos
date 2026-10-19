const ML = (() => {
  const CFG_KEY = 'ml_config';
  // Usa proxy Netlify para evitar CORS; em dev local aponta direto
  const API = location.hostname === 'localhost' || location.hostname === '127.0.0.1'
    ? 'https://api.mercadolibre.com'
    : '/ml-api';

  function getCfg() {
    try { return JSON.parse(localStorage.getItem(CFG_KEY)) || {}; } catch { return {}; }
  }

  function saveCfg(cfg) {
    localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
  }

  function isOk() {
    const c = getCfg();
    return !!(c.sellerId && c.accessToken);
  }

  async function _get(path) {
    const cfg = getCfg();
    const res = await fetch(`${API}${path}`, {
      headers: { 'Authorization': `Bearer ${cfg.accessToken}` }
    });
    if (res.status === 401) throw new Error('Token ML expirado. Atualize nas configurações.');
    if (!res.ok) throw new Error(`Erro ML ${res.status}`);
    return res.json();
  }

  async function buscarPedidosHoje() {
    const cfg = getCfg();
    if (!isOk()) return null;

    const hoje = new Date();
    const ini = new Date(hoje); ini.setHours(0, 0, 0, 0);
    const fim = new Date(hoje); fim.setHours(23, 59, 59, 999);

    return _get(
      `/orders/search?seller=${cfg.sellerId}` +
      `&order.date_created.from=${ini.toISOString()}` +
      `&order.date_created.to=${fim.toISOString()}` +
      `&sort=date_desc&limit=50`
    );
  }

  function _matchProduto(nomeML) {
    const produtos = DB.getProdutos();
    const palavrasML = nomeML.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2);
    let melhor = null, melhorScore = 0;
    for (const p of produtos) {
      const nome = p.nome.toLowerCase().replace(/[^a-z0-9\s]/g, '');
      const score = palavrasML.filter(w => nome.includes(w)).length;
      if (score > melhorScore && score >= 2) { melhorScore = score; melhor = p; }
    }
    return melhor;
  }

  async function sincronizar(onLog) {
    if (!isOk()) throw new Error('Configure o Mercado Livre primeiro.');
    const log = onLog || (() => {});

    log('Buscando pedidos de hoje...');
    const data = await buscarPedidosHoje();
    const pedidos = (data?.results || []).filter(p => p.status !== 'cancelled');

    if (pedidos.length === 0) { log('Nenhum pedido encontrado hoje.'); return { sincronizados: 0, pulados: 0 }; }
    log(`${pedidos.length} pedido(s) encontrado(s).`);

    let sincronizados = 0, pulados = 0;

    for (const ped of pedidos) {
      const jaExiste = DB.getVendas().find(v => v.mlOrderId === String(ped.id));
      if (jaExiste) { pulados++; continue; }

      const itens = (ped.order_items || []).map(oi => {
        const prod = _matchProduto(oi.item?.title || '');
        return {
          id: oi.item?.id || '',
          nome: oi.item?.title || 'Produto ML',
          quantidade: oi.quantity,
          precoUnitario: oi.unit_price,
          subtotal: oi.quantity * oi.unit_price,
          produtoId: prod?.id || null,
          mlItemId: oi.item?.id
        };
      });

      DB.addVenda({
        itens,
        total: ped.total_amount || itens.reduce((s, i) => s + i.subtotal, 0),
        subtotal: ped.total_amount || itens.reduce((s, i) => s + i.subtotal, 0),
        desconto: 0,
        pagamento: 'mercadolivre',
        clienteNome: ped.buyer?.nickname || 'Comprador ML',
        mlOrderId: String(ped.id),
        mlStatus: ped.status,
        origem: 'mercadolivre',
        createdAt: ped.date_created
      });

      for (const item of itens) {
        if (item.produtoId) {
          const prod = DB.getProdutos().find(p => p.id === item.produtoId);
          if (prod) {
            DB.updateProduto(item.produtoId, { estoque: Math.max(0, (prod.estoque || 0) - item.quantidade) });
            log(`Estoque baixado: ${prod.nome} -${item.quantidade}`);
          }
        }
      }

      sincronizados++;
      log(`Pedido #${ped.id} importado.`);
    }

    log(`Concluído: ${sincronizados} importado(s), ${pulados} já existia(m).`);
    return { sincronizados, pulados };
  }

  async function carregarKpis() {
    if (!isOk()) {
      _setKpi('—', '—', '—', false);
      return;
    }
    try {
      const data = await buscarPedidosHoje();
      const pedidos = data?.results || [];
      const ativos = pedidos.filter(p => p.status !== 'cancelled');
      const pendentes = ativos.filter(p => p.status === 'payment_required' || p.status === 'confirmed');
      const total = ativos.reduce((s, p) => s + (p.total_amount || 0), 0);
      _setKpi(ativos.length, App.formatCurrency(total), pendentes.length, true);
    } catch (e) {
      _setKpi('Erro', '—', '—', false);
      console.warn('ML KPI error:', e.message);
    }
  }

  function _setKpi(pedidos, valor, pendentes, online) {
    const s = id => document.getElementById(id);
    if (s('ml-pedidos-hoje')) s('ml-pedidos-hoje').textContent = pedidos;
    if (s('ml-valor-hoje')) s('ml-valor-hoje').textContent = valor;
    if (s('ml-pendentes')) s('ml-pendentes').textContent = pendentes;
    const badge = s('ml-status-badge');
    if (badge) {
      const conectado = isOk() && online;
      badge.className = 'ml-status ' + (conectado ? 'online' : 'offline');
      badge.innerHTML = `<span class="ml-status-dot"></span><span>${isOk() ? (online ? 'Conectado' : 'Token inválido') : 'Não configurado'}</span>`;
    }
  }

  function abrirConfig() {
    const cfg = getCfg();
    const el = id => document.getElementById(id);
    if (el('ml-cfg-seller')) el('ml-cfg-seller').value = cfg.sellerId || '';
    if (el('ml-cfg-token')) el('ml-cfg-token').value = cfg.accessToken || '';
    el('modal-ml-config')?.classList.add('show');
  }

  function salvarConfig() {
    const sellerId = document.getElementById('ml-cfg-seller')?.value?.trim();
    const accessToken = document.getElementById('ml-cfg-token')?.value?.trim();
    if (!sellerId || !accessToken) { App.showToast('Preencha Seller ID e Token.', 'warning'); return; }
    saveCfg({ sellerId, accessToken });
    document.getElementById('modal-ml-config')?.classList.remove('show');
    App.showToast('Mercado Livre configurado!', 'success');
    carregarKpis();
  }

  return { isOk, getCfg, saveCfg, sincronizar, buscarPedidosHoje, carregarKpis, abrirConfig, salvarConfig };
})();
