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

  async function buscarCanceladosRecentes(diasAtras = 7) {
    const cfg = getCfg();
    if (!isOk()) return [];
    const fim = new Date();
    const ini = new Date(fim); ini.setDate(ini.getDate() - diasAtras);
    const base = `/orders/search?seller=${cfg.sellerId}` +
      `&order.date_last_updated.from=${ini.toISOString()}` +
      `&order.date_last_updated.to=${fim.toISOString()}` +
      `&order.status=cancelled&sort=date_desc&limit=50`;
    try {
      const r = await _get(base);
      return r?.results || [];
    } catch (e) {
      console.warn('[ML] buscarCanceladosRecentes falhou:', e.message);
      return [];
    }
  }

  async function _buscarPedidoDetalhado(orderId) {
    try { return await _get(`/orders/${orderId}`); } catch(e) { return null; }
  }

  async function _buscarShipmentCost(shipmentId) {
    if (!shipmentId) return 0;
    try {
      const s = await _get(`/shipments/${shipmentId}`);
      // Ordem de prioridade: custo real pago pelo vendedor
      // (list_cost é o frete cheio exibido ao comprador — NÃO usar)
      return Number(s?.base_cost)
          || Number(s?.shipping_option?.cost)
          || Number(s?.cost)
          || 0;
    } catch(e) { return 0; }
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
  const _LOCK_KEY = 'ml_sync_lock';
  const _LOCK_TTL = 60000; // 60s

  function _acquireCrossTabLock() {
    try {
      const now = Date.now();
      const raw = localStorage.getItem(_LOCK_KEY);
      if (raw) {
        const ts = parseInt(raw, 10) || 0;
        if (now - ts < _LOCK_TTL) return false;
      }
      localStorage.setItem(_LOCK_KEY, String(now));
      return true;
    } catch { return true; }
  }
  function _releaseCrossTabLock() {
    try { localStorage.removeItem(_LOCK_KEY); } catch {}
  }

  // Extrai todas as deduções do pedido: tarifa ML, taxa parcelamento (MP), custo de envio pago pelo vendedor
  // SOMENTE 2 fontes aceitas para envio (ambas são o custo REAL do vendedor):
  //   1) derivação via net_received_amount (quando pagamento já liquidou)
  //   2) base_cost do shipment (sempre o custo que o ML cobra do vendedor)
  // ped.shipping.cost e payments[].shipping_cost retornam list_cost (frete cheio
  // exibido ao comprador) — NUNCA usar como custo do vendedor.
  async function _calcularTaxas(ped) {
    const payments = ped.payments || [];
    const marketplaceFee = payments.reduce((s, p) => s + (Number(p.marketplace_fee) || 0), 0);
    const financingFee = payments.reduce((s, p) => {
      const td = p.transaction_details || {};
      return s + (Number(td.financing_fee) || 0);
    }, 0);
    const netReceived = payments.reduce((s, p) => {
      const td = p.transaction_details || {};
      return s + (Number(td.net_received_amount) || 0);
    }, 0);
    const totalAmount = Number(ped.total_amount) || 0;

    let shippingCost = 0;
    let fonteEnvio = 'none';

    // Busca o shipment UMA vez (fonte canônica para base_cost)
    let shipment = null;
    if (ped.shipping?.id) {
      try { shipment = await _get(`/shipments/${ped.shipping.id}`); } catch(e) {}
    }
    const baseCost = Number(shipment?.base_cost) || Number(shipment?.shipping_option?.cost) || Number(shipment?.cost) || 0;

    // 1. Derivação via net_received: só confia se o resultado for coerente com base_cost
    if (netReceived > 0 && marketplaceFee > 0 && totalAmount > 0) {
      const calc = totalAmount - marketplaceFee - netReceived;
      if (calc > -0.01 && calc < totalAmount) {
        // Se temos base_cost, só aceita derivação se divergir pouco (<R$0,20)
        if (baseCost > 0 && Math.abs(calc - baseCost) > 0.2) {
          shippingCost = baseCost;
          fonteEnvio = 'base_cost';
        } else {
          shippingCost = Math.max(0, calc);
          fonteEnvio = 'net_received';
        }
      }
    }
    // 2. Fallback: base_cost do shipment (correto para free shipping)
    if (!shippingCost && baseCost > 0) {
      shippingCost = baseCost;
      fonteEnvio = 'base_cost';
    }

    return { marketplaceFee, financingFee, shippingCost, netReceived, total: marketplaceFee + financingFee + shippingCost, fonteEnvio };
  }

  async function _montarItens(ped) {
    // /orders/search traz dados resumidos — busca detalhes completos
    let pedCompleto = ped;
    const payments = ped.payments || [];
    const temDetalhes = payments.some(p => p.marketplace_fee || p.transaction_details?.net_received_amount);
    if (!temDetalhes) {
      const d = await _buscarPedidoDetalhado(ped.id);
      if (d) pedCompleto = d;
    }
    const taxas = await _calcularTaxas(pedCompleto);
    const subtotalItens = (pedCompleto.order_items || []).reduce((s, oi) => s + (oi.quantity * oi.unit_price), 0);
    // marketplace_fee JÁ é o total da tarifa ML (venda + cobrança MP + parcelamento)
    // financing_fee é só a parcela informativa — não somar separado
    return (pedCompleto.order_items || []).map(oi => {
      const sub = oi.quantity * oi.unit_price;
      const prop = subtotalItens > 0 ? sub / subtotalItens : 1;
      const prod = _matchProduto(oi.item?.title || '');
      const tarifaTotalML = taxas.marketplaceFee * prop;      // ex: R$7,01
      const envio = taxas.shippingCost * prop;                 // ex: R$14,45
      const parcelamento = taxas.financingFee * prop;          // ex: R$0,07 (já incluso em tarifaTotalML)
      const vendaML = Number(oi.sale_fee) > 0 ? Number(oi.sale_fee) : 0; // ex: R$5,33
      const cobrancaMP = Math.max(0, tarifaTotalML - vendaML - parcelamento); // ex: R$1,61
      return {
        id: oi.item?.id || '',
        nome: oi.item?.title || 'Produto ML',
        quantidade: oi.quantity,
        precoUnitario: oi.unit_price,
        subtotal: sub,
        // taxaML = somente deduções reais (tarifa total + envio) — SEM duplicar parcelamento
        taxaML: tarifaTotalML + envio,
        taxaMLDetalhes: {
          venda: vendaML,
          cobrancaMP,
          parcelamento,
          tarifaTotal: tarifaTotalML,
          envio
        },
        produtoId: prod?.id || null,
        mlItemId: oi.item?.id
      };
    });
  }

  // Recalcula TODOS os pedidos ML armazenados: busca /orders/{id} e compara
  // o resultado da nova lógica contra o salvo. Se divergir >R$0,10, atualiza.
  // Garante que pedidos salvos com dados errados sejam corrigidos retroativamente.
  async function _recalcularPedidosAntigos(log) {
    const isML = v => v.origem === 'mercadolivre' || v.pagamento === 'mercadolivre';
    const vendasML = DB.getVendas().filter(isML);
    let corrigidos = 0, erros = 0, verificados = 0;
    for (const v of vendasML) {
      if (!v.mlOrderId) continue;
      const itensAtuais = Array.isArray(v.itens) ? v.itens : [];
      if (itensAtuais.length === 0) continue;
      verificados++;
      try {
        const ped = await _buscarPedidoDetalhado(v.mlOrderId);
        if (!ped || !(ped.order_items || []).length) { erros++; continue; }
        const novosItens = await _montarItens(ped);
        for (let i = 0; i < novosItens.length; i++) {
          const antigo = itensAtuais[i];
          if (antigo?.produtoId && !novosItens[i].produtoId) novosItens[i].produtoId = antigo.produtoId;
        }
        const taxaAnt = itensAtuais.reduce((s, i) => s + (Number(i.taxaML) || 0), 0);
        const taxaNova = novosItens.reduce((s, i) => s + (Number(i.taxaML) || 0), 0);
        const envioAnt = itensAtuais.reduce((s, i) => s + (Number(i.taxaMLDetalhes?.envio) || 0), 0);
        const envioNovo = novosItens.reduce((s, i) => s + (Number(i.taxaMLDetalhes?.envio) || 0), 0);
        if (Math.abs(taxaAnt - taxaNova) < 0.02 && Math.abs(envioAnt - envioNovo) < 0.02) continue;
        await DB._update('vendas', v.id, { itens: novosItens });
        const idx = DB._cache.vendas.findIndex(x => x.id === v.id);
        if (idx >= 0) DB._cache.vendas[idx].itens = novosItens;
        corrigidos++;
        log(`#${v.mlOrderId} corrigido: taxa R$${taxaAnt.toFixed(2)}→R$${taxaNova.toFixed(2)} / envio R$${envioAnt.toFixed(2)}→R$${envioNovo.toFixed(2)}.`);
      } catch (e) {
        erros++;
        console.warn(`[ML] recalc #${v.mlOrderId} falhou:`, e.message);
      }
    }
    return { corrigidos, erros, verificados };
  }

  async function _limparDuplicatas(log) {
    try {
      const rows = await DB._select('vendas', 'origem=eq.mercadolivre&select=id,ml_order_id,created_at&order=created_at.asc');
      const grupos = {};
      for (const r of rows) {
        if (!r.ml_order_id) continue;
        (grupos[r.ml_order_id] = grupos[r.ml_order_id] || []).push(r);
      }
      let removidos = 0;
      for (const mlId in grupos) {
        const lista = grupos[mlId];
        if (lista.length > 1) {
          for (let i = 1; i < lista.length; i++) {
            await DB._delete('vendas', lista[i].id);
            DB._cache.vendas = DB._cache.vendas.filter(v => v.id !== lista[i].id);
            removidos++;
          }
          log(`Duplicata removida: pedido #${mlId} (${lista.length - 1} extra).`);
        }
      }
      return removidos;
    } catch (e) { console.warn('[ML] cleanup falhou:', e.message); return 0; }
  }

  async function sincronizar(onLog) {
    if (!isOk()) throw new Error('Configure o Mercado Livre primeiro.');
    if (_syncLock) return { sincronizados: 0, pulados: 0, cancelados: 0, duplicatasRemovidas: 0 };
    if (!_acquireCrossTabLock()) return { sincronizados: 0, pulados: 0, cancelados: 0, duplicatasRemovidas: 0 };
    _syncLock = true;
    const log = onLog || (() => {});
    try { return await _sincronizarInterno(log); } finally { _syncLock = false; _releaseCrossTabLock(); }
  }

  async function _sincronizarInterno(log) {

    log('Buscando pedidos de hoje...');
    const data = await buscarPedidosHoje();
    const pedidos = (data?.results || []).filter(p => p.status !== 'cancelled');

    // Inclui cancelados de hoje
    const todosPedidos = data?.results || [];

    // Também busca pedidos cancelados nos últimos 7 dias (pega cancelamentos de pedidos antigos)
    const canceladosRecentes = await buscarCanceladosRecentes(7);
    const idsExistentes = new Set(todosPedidos.map(p => String(p.id)));
    let canceladosExtras = 0;
    for (const c of canceladosRecentes) {
      if (!idsExistentes.has(String(c.id))) { todosPedidos.push(c); canceladosExtras++; }
    }
    if (canceladosExtras) log(`${canceladosExtras} cancelado(s) recente(s) de pedidos antigos detectado(s).`);

    log(`${pedidos.length} pedido(s) encontrado(s) hoje.`);
    if (pedidos.length === 0 && todosPedidos.length === 0) { log('Nenhum pedido para processar.'); return { sincronizados: 0, pulados: 0, cancelados: 0, duplicatasRemovidas: 0 }; }

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
    // Antes de importar, remove duplicatas remanescentes de syncs antigos
    const duplicatasRemovidas = await _limparDuplicatas(log);

    for (const ped of pedidos) {
      const mlId = String(ped.id);
      // Sempre consulta Supabase (fonte de verdade), não só o cache
      let jaExiste = null;
      try {
        const rows = await DB._select('vendas', `ml_order_id=eq.${mlId}&select=id,ml_order_id,ml_status`);
        if (rows && rows.length > 0) {
          jaExiste = DB._camel(rows[0]);
          if (!DB._cache.vendas.find(v => v.mlOrderId === mlId)) DB._cache.vendas.push(jaExiste);
        }
      } catch(e) {}
      if (!jaExiste) jaExiste = DB.getVendas().find(v => v.mlOrderId === mlId);
      if (jaExiste) {
        const updates = {};
        // Atualiza status se mudou
        if (jaExiste.mlStatus !== ped.status) {
          updates.mlStatus = ped.status;
          log(`Pedido #${ped.id} status atualizado: ${ped.status}`);
        }
        // Recalcula taxas em várias condições para garantir correção dos pedidos antigos
        try {
          const itensAtuais = Array.isArray(jaExiste.itens) ? jaExiste.itens : [];
          const semDetalhes = itensAtuais.length === 0 || !itensAtuais[0]?.taxaMLDetalhes;
          const taxaTotalAtual = itensAtuais.reduce((s, i) => s + (Number(i.taxaML) || 0), 0);
          const taxasZeradas = taxaTotalAtual === 0 && (ped.total_amount || 0) > 0;
          const formatoAntigo = !semDetalhes && itensAtuais[0]?.taxaMLDetalhes && itensAtuais[0].taxaMLDetalhes.tarifaTotal === undefined;
          const envioAtual = itensAtuais.reduce((s, i) => s + (Number(i.taxaMLDetalhes?.envio) || 0), 0);
          const envioZerado = envioAtual === 0 && ped.shipping;
          // Check de consistência interna: taxaML deve = tarifaTotal + envio
          const taxaMLInconsistente = !semDetalhes && itensAtuais.some(i => {
            const td = i.taxaMLDetalhes || {};
            const esperado = (Number(td.tarifaTotal) || 0) + (Number(td.envio) || 0);
            return esperado > 0 && Math.abs((Number(i.taxaML) || 0) - esperado) > 0.02;
          });
          if ((semDetalhes || taxasZeradas || formatoAntigo || envioZerado || taxaMLInconsistente) && (ped.order_items || []).length > 0) {
            const novosItens = await _montarItens(ped);
            // preserva produtoId existente quando possível
            for (let i = 0; i < novosItens.length; i++) {
              const antigo = itensAtuais[i];
              if (antigo?.produtoId && !novosItens[i].produtoId) novosItens[i].produtoId = antigo.produtoId;
            }
            updates.itens = novosItens;
            log(`Pedido #${ped.id} taxas recalculadas.`);
          }
        } catch(e) { console.warn('[ML] recalc falhou:', e.message); }
        if (Object.keys(updates).length > 0) {
          await DB._update('vendas', jaExiste.id, updates);
          const idx = DB._cache.vendas.findIndex(v => v.id === jaExiste.id);
          if (idx >= 0) Object.assign(DB._cache.vendas[idx], updates);
        }
        pulados++; continue;
      }

      const itens = await _montarItens(ped);

      const total = ped.total_amount || itens.reduce((s, i) => s + i.subtotal, 0);

      // Re-verifica logo antes do insert (fecha janela de corrida)
      try {
        const dup = await DB._select('vendas', `ml_order_id=eq.${mlId}&select=id`);
        if (dup && dup.length > 0) {
          log(`Pedido #${mlId} já existia (double-check). Pulado.`);
          pulados++; continue;
        }
      } catch(e) {}

      const vendaId = DB._id();
      try {
        await DB._insert('vendas', {
          id: vendaId,
          itens,
          total,
          subtotal: total,
          desconto: 0,
          pagamento: 'mercadolivre',
          clienteNome: ped.buyer?.nickname || 'Comprador ML',
          mlOrderId: String(ped.id),
          mlStatus: ped.status,
          origem: 'mercadolivre',
          createdAt: ped.date_created || new Date().toISOString()
        });
        DB._cache.vendas.push({
          id: vendaId, itens, total, subtotal: total, desconto: 0,
          pagamento: 'mercadolivre', clienteNome: ped.buyer?.nickname || 'Comprador ML',
          mlOrderId: String(ped.id), mlStatus: ped.status, origem: 'mercadolivre',
          createdAt: ped.date_created || new Date().toISOString()
        });
      } catch (e) {
        console.error('[ML] insert falhou:', e.message);
        log(`Falha ao inserir pedido #${mlId}: ${e.message}`);
        continue;
      }

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

    // Recálculo retroativo de pedidos antigos com dados inconsistentes
    log('Verificando pedidos antigos com taxas inconsistentes...');
    const { corrigidos: recalculados, erros: errosRecalc } = await _recalcularPedidosAntigos(log);
    if (recalculados > 0) log(`${recalculados} pedido(s) antigo(s) recalculado(s).`);
    if (errosRecalc > 0) log(`${errosRecalc} pedido(s) antigo(s) não puderam ser recalculados (verifique logs).`);

    log(`Concluído: ${sincronizados} importado(s), ${pulados} já existia(m), ${cancelados} cancelado(s)${duplicatasRemovidas ? `, ${duplicatasRemovidas} duplicata(s) removida(s)` : ''}${recalculados ? `, ${recalculados} retroativo(s)` : ''}.`);

    // Aguarda inserts chegarem ao Supabase antes de liberar o lock
    if (sincronizados > 0 || cancelados > 0 || recalculados > 0) await new Promise(r => setTimeout(r, 1500));

    return { sincronizados, pulados, cancelados, duplicatasRemovidas, recalculados };
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
      const vendasMLHoje = DB.getVendas().filter(v => isML(v) && App.isToday(v.createdAt));
      const ativosHoje = vendasMLHoje.filter(v => v.mlStatus !== 'cancelled');
      const total = ativosHoje.reduce((s, v) => s + (v.total || 0), 0);
      // Cancelados do mês atual
      const now = new Date();
      const ano = now.getFullYear(), mes = now.getMonth();
      const canceladosMes = DB.getVendas().filter(v => {
        if (!isML(v) || v.mlStatus !== 'cancelled') return false;
        const d = new Date(v.createdAt);
        return d.getFullYear() === ano && d.getMonth() === mes;
      }).length;
      _setKpi(ativosHoje.length, App.formatCurrency(total), canceladosMes, true);
    } catch (e) {
      _setKpi('Erro', '—', '—', false);
      console.warn('ML KPI error:', e.message);
    }
  }

  function _setKpi(pedidos, valor, cancelados, online) {
    const s = id => document.getElementById(id);
    if (s('ml-pedidos-hoje')) s('ml-pedidos-hoje').textContent = pedidos;
    if (s('ml-valor-hoje')) s('ml-valor-hoje').textContent = valor;
    if (s('ml-pendentes')) s('ml-pendentes').textContent = cancelados;
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
