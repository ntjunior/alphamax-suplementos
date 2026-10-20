const ML = (() => {
  const CFG_KEY = 'ml_config';
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

  function _tokenExpirado() {
    const c = getCfg();
    if (!c.expiresAt) return false;
    return Date.now() >= c.expiresAt - 10 * 60 * 1000; // 10 min antes
  }

  async function _refreshToken() {
    const cfg = getCfg();
    if (!cfg.clientId || !cfg.clientSecret || !cfg.refreshToken) {
      throw new Error('Configure Client ID, Client Secret e Refresh Token para renovação automática.');
    }

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      refresh_token: cfg.refreshToken
    });

    const res = await fetch(`${API}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
      body
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Falha ao renovar token ML: ${err.message || res.status}`);
    }

    const data = await res.json();
    saveCfg({
      ...cfg,
      accessToken: data.access_token,
      refreshToken: data.refresh_token || cfg.refreshToken,
      expiresAt: Date.now() + (data.expires_in || 21600) * 1000
    });

    console.log('[ML] Token renovado com sucesso.');
    return data.access_token;
  }

  async function _ensureToken() {
    if (_tokenExpirado()) {
      try { await _refreshToken(); } catch (e) { console.warn('[ML] Renovação automática falhou:', e.message); }
    }
  }

  async function _get(path) {
    await _ensureToken();
    const cfg = getCfg();
    let res = await fetch(`${API}${path}`, {
      headers: { 'Authorization': `Bearer ${cfg.accessToken}` }
    });

    if (res.status === 401) {
      // Tenta renovar uma vez e repetir
      try {
        await _refreshToken();
        const newCfg = getCfg();
        res = await fetch(`${API}${path}`, {
          headers: { 'Authorization': `Bearer ${newCfg.accessToken}` }
        });
      } catch (e) {
        throw new Error('Token ML expirado. Atualize nas configurações.');
      }
    }

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

    const base = `/orders/search?seller=${cfg.sellerId}` +
      `&order.date_created.from=${ini.toISOString()}` +
      `&order.date_created.to=${fim.toISOString()}` +
      `&sort=date_desc&limit=50`;

    const [ativos, cancelados] = await Promise.all([
      _get(base),
      _get(base + '&order.status=cancelled').catch(() => ({ results: [] }))
    ]);

    const todos = [...(ativos?.results || []), ...(cancelados?.results || [])];
    // deduplica por id
    const map = {};
    todos.forEach(p => { map[p.id] = p; });

    return { results: Object.values(map) };
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

  let _syncLock = false;

  async function sincronizar(onLog) {
    if (!isOk()) throw new Error('Configure o Mercado Livre primeiro.');
    if (_syncLock) return { sincronizados: 0, pulados: 0, cancelados: 0 };
    _syncLock = true;
    const log = onLog || (() => {});
    try { return await _sincronizarInterno(log); } finally { _syncLock = false; }
  }

  async function _sincronizarInterno(log) {

    log('Buscando pedidos de hoje...');
    const data = await buscarPedidosHoje();
    const pedidos = (data?.results || []).filter(p => p.status !== 'cancelled');

    if (pedidos.length === 0) { log('Nenhum pedido encontrado hoje.'); return { sincronizados: 0, pulados: 0 }; }
    // Inclui cancelados para atualizar status no banco
    const todosPedidos = data?.results || [];
    log(`${pedidos.length} pedido(s) encontrado(s).`);

    // Atualiza status de pedidos já salvos que foram cancelados
    let cancelados = 0;
    for (const ped of todosPedidos) {
      if (ped.status === 'cancelled') {
        const existente = DB.getVendas().find(v => v.mlOrderId === String(ped.id));
        if (existente && existente.mlStatus !== 'cancelled') {
          await DB._update('vendas', existente.id, { mlStatus: 'cancelled' });
          const idx = DB._cache.vendas.findIndex(v => v.id === existente.id);
          if (idx >= 0) DB._cache.vendas[idx].mlStatus = 'cancelled';
          // Devolve estoque
          for (const item of existente.itens || []) {
            if (item.produtoId) {
              const prod = DB.getProdutos().find(p => p.id === item.produtoId);
              if (prod) {
                DB.updateProduto(item.produtoId, { estoque: (prod.estoque || 0) + item.quantidade });
                log(`Estoque devolvido: ${prod.nome} +${item.quantidade}`);
              }
            }
          }
          cancelados++;
          log(`Pedido #${ped.id} marcado como cancelado.`);
        }
      }
    }

    let sincronizados = 0, pulados = 0;

    for (const ped of pedidos) {
      const jaExiste = DB.getVendas().find(v => v.mlOrderId === String(ped.id));
      if (jaExiste) {
        // Atualiza status se mudou
        if (jaExiste.mlStatus !== ped.status) {
          await DB._update('vendas', jaExiste.id, { mlStatus: ped.status });
          const idx = DB._cache.vendas.findIndex(v => v.id === jaExiste.id);
          if (idx >= 0) DB._cache.vendas[idx].mlStatus = ped.status;
          log(`Pedido #${ped.id} status atualizado: ${ped.status}`);
        }
        pulados++; continue;
      }

      const itens = (ped.order_items || []).map(oi => {
        const prod = _matchProduto(oi.item?.title || '');
        return {
          id: oi.item?.id || '',
          nome: oi.item?.title || 'Produto ML',
          quantidade: oi.quantity,
          precoUnitario: oi.unit_price,
          subtotal: oi.quantity * oi.unit_price,
          taxaML: oi.sale_fee || 0,
          produtoId: prod?.id || null,
          mlItemId: oi.item?.id
        };
      });

      const total = ped.total_amount || itens.reduce((s, i) => s + i.subtotal, 0);
      const taxaML = itens.reduce((s, i) => s + (i.taxaML || 0), 0);

      DB.addVenda({
        itens,
        total,
        subtotal: total,
        desconto: 0,
        taxaML,
        valorLiquido: total - taxaML,
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

    log(`Concluído: ${sincronizados} importado(s), ${pulados} já existia(m), ${cancelados} cancelado(s).`);

    // Aguarda inserts chegarem ao Supabase antes de liberar o lock
    if (sincronizados > 0 || cancelados > 0) await new Promise(r => setTimeout(r, 1500));

    return { sincronizados, pulados, cancelados };
  }

  async function carregarKpis() {
    if (!isOk()) {
      _setKpi('—', '—', '—', false);
      return;
    }
    try {
      // Valida conexão com a API
      await buscarPedidosHoje();

      // Conta do banco (consistente com tabela de vendas)
      const isML = v => v.origem === 'mercadolivre' || v.pagamento === 'mercadolivre';
      const vendasML = DB.getVendas().filter(v => isML(v) && App.isToday(v.createdAt));
      const total = vendasML.reduce((s, v) => s + (v.total || 0), 0);
      _setKpi(vendasML.length, App.formatCurrency(total), '—', true);
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
    if (el('ml-cfg-client-id')) el('ml-cfg-client-id').value = cfg.clientId || '';
    if (el('ml-cfg-client-secret')) el('ml-cfg-client-secret').value = cfg.clientSecret || '';
    if (el('ml-cfg-refresh-token')) el('ml-cfg-refresh-token').value = cfg.refreshToken || '';
    el('modal-ml-config')?.classList.add('show');
  }

  function salvarConfig() {
    const sellerId = document.getElementById('ml-cfg-seller')?.value?.trim();
    const accessToken = document.getElementById('ml-cfg-token')?.value?.trim();
    const clientId = document.getElementById('ml-cfg-client-id')?.value?.trim();
    const clientSecret = document.getElementById('ml-cfg-client-secret')?.value?.trim();
    const refreshToken = document.getElementById('ml-cfg-refresh-token')?.value?.trim();

    if (!sellerId || !accessToken) { App.showToast('Preencha Seller ID e Access Token.', 'warning'); return; }

    const cfg = getCfg();
    saveCfg({
      ...cfg,
      sellerId,
      accessToken,
      clientId: clientId || cfg.clientId || '',
      clientSecret: clientSecret || cfg.clientSecret || '',
      refreshToken: refreshToken || cfg.refreshToken || '',
      expiresAt: (clientId && refreshToken) ? (cfg.expiresAt || Date.now() + 6 * 3600 * 1000) : cfg.expiresAt
    });

    document.getElementById('modal-ml-config')?.classList.remove('show');
    App.showToast('Mercado Livre configurado!', 'success');
    carregarKpis();
  }

  return { isOk, getCfg, saveCfg, sincronizar, buscarPedidosHoje, carregarKpis, abrirConfig, salvarConfig };
})();
