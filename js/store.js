const SUPABASE_URL = 'https://kefhuzwqfzkjcpavcamq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtlZmh1endxZnpramNwYXZjYW1xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzODA4NDcsImV4cCI6MjEwMTk1Njg0N30.cRsgIVcLfgfaeJQseWMqwrEuIgF7SydSEMsaYjcJROY';
const WHATSAPP_NUMBER = '5511931437950';

let produtos = [];
let carrinho = [];
let catAtiva = '';
let entregaTipo = 'retirada';
let cupomAplicado = null;
let descontoCupom = 0;
let produtoModalId = null;

// ===== SUPABASE =====
async function fetchProdutos() {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/produtos?order=nome.asc`, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
  });
  if (!r.ok) throw new Error('Erro ao carregar produtos');
  const data = await r.json();
  return data
    .filter(p => p.ativo === true || p.ativo === 1 || p.ativo === 'true')
    .map(p => ({
      id: p.id, nome: p.nome, marca: p.marca, categoria: p.categoria,
      sabor: p.sabor, precoVenda: p.preco_venda, estoque: p.estoque,
      descricao: p.descricao, imagemUrl: p.imagem_url, emoji: p.emoji
    }));
}

// ===== ÍCONES SVG POR CATEGORIA =====
const SVG_ICONS = {
  dumbbell: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4v16"/><path d="M18 4v16"/><path d="M6 8H2"/><path d="M6 16H2"/><path d="M18 8h4"/><path d="M18 16h4"/><path d="M6 8h12"/><path d="M6 16h12"/></svg>`,
  zap:      `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
  flame:    `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>`,
  pill:     `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/></svg>`,
  dna:      `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 15c6.667-6 13.333 0 20-6"/><path d="M9 22c1.798-1.998 2.518-3.995 2.807-5.993"/><path d="M15 2c-1.798 1.998-2.518 3.995-2.807 5.993"/><path d="m17 6-2.5-2.5"/><path d="m14 8-1-1"/><path d="m7 18 2.5 2.5"/><path d="m10 16 1 1"/><path d="M2 9c6.667 6 13.333 0 20 6"/></svg>`,
  leaf:     `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>`,
  run:      `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13" cy="4" r="1"/><path d="M7 21l2-8 3 3 2-4"/><path d="M17 13l-3-3-3-1 3-3 4 1"/></svg>`,
  wheat:    `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 22 16 8"/><path d="M3.47 12.53 5 11l1.53 1.53a3.5 3.5 0 0 1 0 4.94L5 19l-1.53-1.53a3.5 3.5 0 0 1 0-4.94z"/><path d="M7.47 8.53 9 7l1.53 1.53a3.5 3.5 0 0 1 0 4.94L9 15l-1.53-1.53a3.5 3.5 0 0 1 0-4.94z"/><path d="M11.47 4.53 13 3l1.53 1.53a3.5 3.5 0 0 1 0 4.94L13 11l-1.53-1.53a3.5 3.5 0 0 1 0-4.94z"/><path d="M20 2h2v2a4 4 0 0 1-4 4h-2V6a4 4 0 0 1 4-4z"/><path d="M11.47 17.47 13 19l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L5 19l1.53-1.53a3.5 3.5 0 0 1 4.94 0z"/></svg>`,
  weight:   `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="3"/><path d="M6.5 8a2 2 0 0 0-1.905 1.46L2.1 18.5A2 2 0 0 0 4 21h16a2 2 0 0 0 1.925-2.54L19.4 9.5A2 2 0 0 0 17.48 8Z"/></svg>`,
  fish:     `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 12c.94-3.46 4.94-6 8.5-6 3.56 0 6.06 2.54 7 6-.94 3.47-3.44 6-7 6s-7.56-2.53-8.5-6Z"/><path d="M18 12v.5"/><path d="M16 17.93a9.77 9.77 0 0 1 0-11.86"/><path d="M7 10.67C7 8 5.58 5.97 2.73 5.5c-1 3.5-.5 6.5 1.27 8.5"/><path d="M10.46 7.26C10.2 5.88 9.17 4.24 8 3h5.8a2 2 0 0 1 1.98 1.67l.23 1.4"/></svg>`,
  star:     `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  droplets: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z"/><path d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97"/></svg>`,
  package:  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16.5 9.4 7.55 4.24"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.29 7 12 12 20.71 7"/><line x1="12" y1="22" x2="12" y2="12"/></svg>`
};

function iconCategoria(cat) {
  if (!cat) return SVG_ICONS.package;
  const c = cat.toLowerCase();
  if (c.includes('prote') || c.includes('whey')) return SVG_ICONS.dumbbell;
  if (c.includes('creat'))   return SVG_ICONS.zap;
  if (c.includes('pré') || c.includes('pre-') || c.includes('pre ')) return SVG_ICONS.flame;
  if (c.includes('vitamin')) return SVG_ICONS.pill;
  if (c.includes('amino'))   return SVG_ICONS.dna;
  if (c.includes('emagre'))  return SVG_ICONS.run;
  if (c.includes('carbo'))   return SVG_ICONS.wheat;
  if (c.includes('hiper') || c.includes('mass') || c.includes('gainer')) return SVG_ICONS.weight;
  if (c.includes('mega') || c.includes('ômega') || c.includes('omega')) return SVG_ICONS.fish;
  if (c.includes('colag'))   return SVG_ICONS.star;
  if (c.includes('hidrat'))  return SVG_ICONS.droplets;
  return SVG_ICONS.package;
}

function emojiCategoria(cat) {
  if (!cat) return '🥤';
  const c = cat.toLowerCase();
  if (c.includes('prote') || c.includes('whey')) return '🥛';
  if (c.includes('creat'))   return '⚡';
  if (c.includes('pré') || c.includes('pre'))    return '🔥';
  if (c.includes('vitamin')) return '💊';
  if (c.includes('amino'))   return '🔬';
  if (c.includes('emagre'))  return '🏃';
  if (c.includes('carbo'))   return '🌾';
  if (c.includes('hiper') || c.includes('mass')) return '💥';
  if (c.includes('omega') || c.includes('ômega')) return '🐟';
  if (c.includes('colag'))   return '✨';
  return '🥤';
}

// ===== CARD HTML =====
function cardHTML(p) {
  const semEstoque = p.estoque <= 0;
  const emoji = p.emoji || emojiCategoria(p.categoria);
  const preco = p.precoVenda || 0;
  const parcela = (preco / 5).toFixed(2).replace('.', ',');
  const imgContent = p.imagemUrl
    ? `<img src="${p.imagemUrl}" alt="${p.nome}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
       <span class="card-emoji-fallback" style="display:none;">${emoji}</span>`
    : `<span class="card-emoji-fallback">${emoji}</span>`;

  return `
    <div class="produto-card-store ${semEstoque ? 'produto-sem-estoque' : ''}" onclick="abrirProduto('${p.id}')" style="cursor:pointer;">
      <div class="produto-img">
        ${imgContent}
        ${semEstoque ? '<div class="sem-estoque-overlay">SEM ESTOQUE</div>' : ''}
        <button class="btn-favorito" onclick="event.stopPropagation()" title="Favoritar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        </button>
      </div>
      <div class="produto-info">
        ${p.marca ? `<div class="produto-marca-store">${p.marca}</div>` : ''}
        <div class="produto-nome-store">${p.nome}${p.sabor ? ` <span class="produto-sabor-inline">${p.sabor}</span>` : ''}</div>
        <div class="produto-stars">
          <span class="stars">★★★★★</span>
        </div>
        <div class="produto-preco-store">
          R$ <strong>${preco.toFixed(2).replace('.', ',')}</strong>
        </div>
        <div class="produto-parcelas">R$ ${parcela} até <strong>5x</strong> sem juros</div>
        <button class="btn-adicionar ${semEstoque ? 'btn-sem-estoque' : ''}" onclick="event.stopPropagation();${semEstoque ? '' : `adicionarCarrinho('${p.id}')`}" ${semEstoque ? 'disabled' : ''}>
          ${semEstoque ? 'Sem Estoque' : 'COMPRAR'}
        </button>
      </div>
    </div>
  `;
}

// ===== RENDER PRODUTOS =====
function renderProdutos(busca = '') {
  const grade = document.getElementById('grade-produtos-store');
  let lista = produtos;

  if (catAtiva) lista = lista.filter(p => p.categoria === catAtiva);
  if (busca) {
    const b = busca.toLowerCase();
    lista = lista.filter(p =>
      p.nome.toLowerCase().includes(b) ||
      (p.marca || '').toLowerCase().includes(b) ||
      (p.categoria || '').toLowerCase().includes(b) ||
      (p.sabor || '').toLowerCase().includes(b) ||
      (p.descricao || '').toLowerCase().includes(b)
    );
  }

  if (!lista.length) {
    grade.innerHTML = '<div class="store-empty"><div class="store-empty-icon">🔍</div><div>Nenhum produto encontrado</div></div>';
    return;
  }

  // Busca ativa ou categoria única: grade simples
  if (busca || catAtiva) {
    grade.innerHTML = `
      <div class="store-section-title">
        <span>${catAtiva || 'Resultado da busca'}</span>
        <span id="produtos-subtitulo">${lista.length} produto${lista.length !== 1 ? 's' : ''}</span>
      </div>
      <div class="produtos-grid-store">${lista.map(cardHTML).join('')}</div>
    `;
    return;
  }

  // Sem filtro: separado por categoria
  const cats = [...new Set(lista.map(p => p.categoria).filter(Boolean))].sort();
  const semCat = lista.filter(p => !p.categoria);

  let html = '';

  cats.forEach(cat => {
    const prods = lista.filter(p => p.categoria === cat);
    const icon = iconCategoria(cat);
    html += `
      <section class="cat-section">
        <div class="cat-section-header">
          <div class="cat-section-title">
            <span class="cat-icon">${icon}</span> ${cat}
            <span style="font-size:13px;color:var(--text-muted);font-weight:400;margin-left:6px;">${prods.length} produto${prods.length !== 1 ? 's' : ''}</span>
          </div>
          <button class="btn-ver-todos" onclick="filtrarCatBtn('${cat}')">Ver todos</button>
        </div>
        <div class="produtos-grid-store">
          ${prods.map(cardHTML).join('')}
        </div>
      </section>
    `;
  });

  if (semCat.length) {
    html += `
      <section class="cat-section">
        <div class="cat-section-header">
          <div class="cat-section-title"><span class="cat-emoji">🥤</span> Outros</div>
        </div>
        <div class="produtos-grid-store">${semCat.map(cardHTML).join('')}</div>
      </section>
    `;
  }

  grade.innerHTML = html;
}

// ===== CATEGORIAS NAV =====
function renderCategorias() {
  const cats = [...new Set(produtos.map(p => p.categoria).filter(Boolean))].sort();
  const container = document.getElementById('store-cats');
  container.innerHTML =
    `<button class="cat-nav-btn active" onclick="filtrarCat('', this)">Todos</button>` +
    cats.map(c => `<button class="cat-nav-btn" onclick="filtrarCat('${c}', this)">${iconCategoria(c)} ${c}</button>`).join('');
}

function filtrarCat(cat, btn) {
  catAtiva = cat;
  document.querySelectorAll('.cat-nav-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderProdutos(document.getElementById('store-busca').value);
  document.getElementById('store-main').scrollIntoView({ behavior: 'smooth' });
}

function filtrarCatBtn(cat) {
  catAtiva = cat;
  document.querySelectorAll('.cat-nav-btn').forEach(b => {
    b.classList.toggle('active', b.textContent.includes(cat));
  });
  renderProdutos('');
  document.getElementById('store-main').scrollIntoView({ behavior: 'smooth' });
}

// ===== MODAL PRODUTO =====
function abrirProduto(id) {
  const p = produtos.find(x => x.id === id);
  if (!p) return;
  produtoModalId = id;
  const semEstoque = p.estoque <= 0;
  const preco = p.precoVenda || 0;
  const parcela = (preco / 5).toFixed(2).replace('.', ',');
  const emoji = p.emoji || emojiCategoria(p.categoria);

  const imgWrap = document.getElementById('mp-img-wrap');
  imgWrap.innerHTML = p.imagemUrl
    ? `<img src="${p.imagemUrl}" alt="${p.nome}" style="width:100%;height:100%;object-fit:cover;" onerror="this.parentElement.innerHTML='<span style=font-size:60px>${emoji}</span>'">`
    : `<span style="font-size:60px;">${emoji}</span>`;

  document.getElementById('mp-marca').textContent = p.marca || '';
  document.getElementById('mp-nome').textContent = p.nome;
  document.getElementById('mp-sabor').textContent = p.sabor ? `Sabor: ${p.sabor}` : '';
  document.getElementById('mp-desc').textContent = p.descricao || 'Sem descrição disponível.';
  document.getElementById('mp-preco').textContent = `R$ ${preco.toFixed(2).replace('.', ',')}`;
  document.getElementById('mp-parcelas').textContent = `ou R$ ${parcela} em até 5x sem juros`;
  document.getElementById('mp-estoque-info').innerHTML = semEstoque
    ? '<span style="color:#e53935;font-weight:700;">Sem estoque</span>'
    : `<span style="color:#16a34a;font-weight:700;">${p.estoque} em estoque</span>`;

  const btn = document.getElementById('mp-btn');
  btn.textContent = semEstoque ? 'SEM ESTOQUE' : 'COMPRAR';
  btn.disabled = semEstoque;
  btn.style.opacity = semEstoque ? '0.5' : '1';
  btn.style.cursor = semEstoque ? 'not-allowed' : 'pointer';

  document.getElementById('modal-produto-store').style.display = 'block';
  document.body.style.overflow = 'hidden';
}

function fecharProduto() {
  document.getElementById('modal-produto-store').style.display = 'none';
  document.body.style.overflow = '';
  produtoModalId = null;
}

function adicionarDoProduto() {
  if (produtoModalId) {
    adicionarCarrinho(produtoModalId);
    fecharProduto();
  }
}

// ===== CUPOM =====
async function aplicarCupom() {
  const codigo = document.getElementById('checkout-cupom').value.trim().toUpperCase();
  const msgEl = document.getElementById('cupom-msg');
  if (!codigo) return;

  msgEl.style.display = 'block';
  msgEl.style.color = '#888';
  msgEl.textContent = 'Verificando...';

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/cupons?codigo=eq.${encodeURIComponent(codigo)}&ativo=eq.true&select=*&limit=1`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
    );
    const lista = await res.json();
    if (!Array.isArray(lista) || lista.length === 0) {
      msgEl.style.color = '#e53935';
      msgEl.textContent = 'Cupom inválido ou expirado.';
      return;
    }
    const cupom = lista[0];
    const pct = parseFloat(cupom.desconto_pct || cupom.descontoPct || 0);
    if (pct <= 0) {
      msgEl.style.color = '#e53935';
      msgEl.textContent = 'Este cupom não possui desconto para compras online.';
      return;
    }
    cupomAplicado = cupom;
    const total = totalCarrinho();
    descontoCupom = Math.min(total * (pct / 100), total);

    document.getElementById('cupom-desconto-line').style.display = 'flex';
    document.getElementById('cupom-desconto-valor').textContent = `-R$ ${descontoCupom.toFixed(2).replace('.', ',')}`;
    document.getElementById('pedido-resumo-total').textContent = `R$ ${(total - descontoCupom).toFixed(2).replace('.', ',')}`;
    msgEl.style.color = '#16a34a';
    msgEl.textContent = `Cupom "${cupom.codigo}" aplicado! ${pct}% de desconto.`;
  } catch(e) {
    msgEl.style.color = '#e53935';
    msgEl.textContent = 'Erro ao verificar cupom.';
  }
}

// ===== CARRINHO =====
function adicionarCarrinho(id) {
  const p = produtos.find(x => x.id === id);
  if (!p || p.estoque <= 0) return;
  const exist = carrinho.find(i => i.id === id);
  if (exist) {
    if (exist.qty >= p.estoque) { showToast('Quantidade máxima atingida!'); return; }
    exist.qty++;
  } else {
    carrinho.push({ id: p.id, nome: p.nome, marca: p.marca, preco: p.precoVenda, qty: 1, estoque: p.estoque, categoria: p.categoria, imagemUrl: p.imagemUrl, emoji: p.emoji });
  }
  atualizarCarrinho();
  showToast(`${p.nome.substring(0,28)}... adicionado!`);
  abrirCarrinho();
}

function alterarQty(id, delta) {
  const item = carrinho.find(i => i.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) carrinho = carrinho.filter(i => i.id !== id);
  else if (item.qty > item.estoque) item.qty = item.estoque;
  atualizarCarrinho();
}

function limparCarrinho() { carrinho = []; atualizarCarrinho(); }
function totalCarrinho() { return carrinho.reduce((s, i) => s + i.preco * i.qty, 0); }
function qtdCarrinho() { return carrinho.reduce((s, i) => s + i.qty, 0); }

function atualizarCarrinho() {
  const qtd = qtdCarrinho();
  const total = totalCarrinho();

  document.getElementById('cart-count').textContent = qtd;
  document.getElementById('cart-count').style.display = qtd > 0 ? 'flex' : 'none';

  const items = document.getElementById('cart-items');
  const footer = document.getElementById('cart-footer');

  if (!carrinho.length) {
    items.innerHTML = '<div class="cart-empty-msg">🛒<br><br>Seu carrinho está vazio</div>';
    footer.style.display = 'none';
    return;
  }

  footer.style.display = 'block';
  items.innerHTML = carrinho.map(item => {
    const thumb = item.imagemUrl
      ? `<img src="${item.imagemUrl}" alt="${item.nome}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;" onerror="this.parentElement.innerHTML='${emojiCategoria(item.categoria)}'">`
      : emojiCategoria(item.categoria);
    return `
    <div class="cart-item-store">
      <div class="cart-item-emoji">${thumb}</div>
      <div class="cart-item-data">
        <div class="cart-item-nome">${item.nome}</div>
        <div class="cart-item-preco">R$ ${item.preco.toFixed(2).replace('.', ',')}</div>
        <div class="cart-item-controls">
          <button class="qty-btn" onclick="alterarQty('${item.id}', -1)">−</button>
          <span class="qty-val">${item.qty}</span>
          <button class="qty-btn" onclick="alterarQty('${item.id}', 1)">+</button>
        </div>
      </div>
      <div class="cart-item-subtotal">R$ ${(item.preco * item.qty).toFixed(2).replace('.', ',')}</div>
    </div>
  `;}).join('');

  document.getElementById('cart-subtotal').textContent = `R$ ${total.toFixed(2).replace('.', ',')}`;
  document.getElementById('cart-total').textContent = `R$ ${total.toFixed(2).replace('.', ',')}`;
}

function abrirCarrinho() {
  document.getElementById('cart-drawer').classList.add('open');
  document.getElementById('cart-overlay').classList.add('open');
}
function fecharCarrinho() {
  document.getElementById('cart-drawer').classList.remove('open');
  document.getElementById('cart-overlay').classList.remove('open');
}

// ===== CEP =====
function mascaraCep(input) {
  let v = input.value.replace(/\D/g, '').slice(0, 8);
  if (v.length > 5) v = v.slice(0,5) + '-' + v.slice(5);
  input.value = v;
  if (v.replace('-','').length === 8) buscarCep(v.replace('-',''));
  else {
    document.getElementById('cep-ok').style.display = 'none';
    document.getElementById('cep-erro').style.display = 'none';
  }
}

async function buscarCep(cep) {
  const spinner = document.getElementById('cep-spinner');
  const ok = document.getElementById('cep-ok');
  const erro = document.getElementById('cep-erro');
  spinner.style.display = 'block'; ok.style.display = 'none'; erro.style.display = 'none';
  try {
    const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const d = await r.json();
    spinner.style.display = 'none';
    if (d.erro) { erro.style.display = 'block'; return; }
    document.getElementById('checkout-rua').value = d.logradouro || '';
    document.getElementById('checkout-bairro').value = d.bairro || '';
    document.getElementById('checkout-cidade').value = `${d.localidade} - ${d.uf}`;
    ok.style.display = 'block';
    document.getElementById('checkout-numero').focus();
  } catch {
    spinner.style.display = 'none'; erro.style.display = 'block';
  }
}

// ===== CHECKOUT =====
function setEntrega(tipo, btn) {
  entregaTipo = tipo;
  document.querySelectorAll('.entrega-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('endereco-group').style.display = tipo === 'entrega' ? 'block' : 'none';
}

function abrirCheckout() {
  if (!carrinho.length) return;
  const total = totalCarrinho();
  const resumo = carrinho.map(i => `<div class="pedido-resumo-item"><span>${i.qty}x ${i.nome}</span><span>R$ ${(i.preco * i.qty).toFixed(2).replace('.', ',')}</span></div>`).join('');
  document.getElementById('pedido-resumo-itens').innerHTML = resumo;
  document.getElementById('pedido-resumo-total').textContent = `R$ ${total.toFixed(2).replace('.', ',')}`;
  fecharCarrinho();
  cupomAplicado = null; descontoCupom = 0;
  document.getElementById('checkout-cupom').value = '';
  document.getElementById('cupom-msg').style.display = 'none';
  document.getElementById('cupom-desconto-line').style.display = 'none';
  document.getElementById('checkout-cep').value = '';
  document.getElementById('checkout-rua').value = '';
  document.getElementById('checkout-numero').value = '';
  document.getElementById('checkout-complemento').value = '';
  document.getElementById('checkout-bairro').value = '';
  document.getElementById('checkout-cidade').value = '';
  document.getElementById('cep-ok').style.display = 'none';
  document.getElementById('cep-erro').style.display = 'none';
  document.getElementById('modal-checkout').classList.add('open');
}

function fecharCheckout() {
  document.getElementById('modal-checkout').classList.remove('open');
}

function enviarWhatsApp() {
  const nome = document.getElementById('checkout-nome').value.trim();
  const tel = document.getElementById('checkout-tel').value.trim();
  if (!nome) { document.getElementById('checkout-nome').focus(); showToast('Informe seu nome!'); return; }
  if (!tel) { document.getElementById('checkout-tel').focus(); showToast('Informe seu telefone!'); return; }

  let endereco = '';
  if (entregaTipo === 'entrega') {
    const cep = document.getElementById('checkout-cep').value.trim();
    const rua = document.getElementById('checkout-rua').value.trim();
    const numero = document.getElementById('checkout-numero').value.trim();
    const complemento = document.getElementById('checkout-complemento').value.trim();
    const bairro = document.getElementById('checkout-bairro').value.trim();
    const cidade = document.getElementById('checkout-cidade').value.trim();
    if (!cep || !numero) { showToast('Informe o CEP e o número!'); return; }
    endereco = `${rua}, ${numero}${complemento ? ', ' + complemento : ''} — ${bairro}, ${cidade} — CEP: ${cep}`;
  }

  const totalBruto = totalCarrinho();
  const total = Math.max(0, totalBruto - descontoCupom);
  const itens = carrinho.map(i => `• ${i.qty}x ${i.nome} — R$ ${(i.preco * i.qty).toFixed(2).replace('.', ',')}`).join('\n');

  const ic = {
    pedido:  '\uD83D\uDED2', // 🛒
    nome:    '\uD83D\uDC64', // 👤
    tel:     '\uD83D\uDCDE', // 📞
    entrega: '\uD83D\uDCE6', // 📦
    total:   '\uD83D\uDCB0', // 💰
    ok:      '\u2705'        // ✅
  };

  const linhas = [
    `${ic.pedido} *NOVO PEDIDO - Alpha Max Suplementos*`,
    ``,
    `${ic.nome} *Nome:* ${nome}`,
    `${ic.tel} *Telefone:* ${tel}`,
    `${ic.entrega} *Entrega:* ${entregaTipo === 'retirada' ? 'Retirar na loja' : `Entrega \u2014 ${endereco}`}`,
    ``,
    `*Itens:*`,
    itens,
    ``
  ];
  if (cupomAplicado) {
    linhas.push(`\uD83C\uDFF7 *Cupom:* ${cupomAplicado.codigo} (-R$ ${descontoCupom.toFixed(2).replace('.',',')})`);
    linhas.push(``);
  }
  linhas.push(`${ic.total} *TOTAL: R$ ${total.toFixed(2).replace('.', ',')}*`);
  linhas.push(``);
  linhas.push(`Aguardo confirmacao e dados para pagamento via PIX! ${ic.ok}`);
  const msg = linhas.join('\n');

  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank');

  const enderecoFinal = entregaTipo === 'entrega' ? endereco : '';
  const itensTxt = carrinho.map(i => `• ${i.qty}x ${i.nome} — R$ ${(i.preco * i.qty).toFixed(2).replace('.', ',')}`).join('\n');

  // Registra cliente automaticamente
  registrarCliente({
    nome,
    telefone: tel,
    endereco: enderecoFinal,
    itens: itensTxt,
    total: total.toFixed(2).replace('.', ',')
  });

  // Registra pedido na tabela pedidos_online
  registrarPedidoOnline({
    nome,
    telefone: tel,
    endereco: enderecoFinal,
    itens_texto: itensTxt,
    total
  });

  fecharCheckout();
  carrinho = [];
  atualizarCarrinho();
  showToast('Pedido enviado via WhatsApp! ✅');
}

// ===== REGISTRAR PEDIDO ONLINE =====
async function registrarPedidoOnline({ nome, telefone, endereco, itens_texto, total }) {
  try {
    await fetch(
      `${SUPABASE_URL}/rest/v1/pedidos_online`,
      {
        method: 'POST',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify({
          nome,
          telefone,
          endereco,
          itens_texto,
          total: parseFloat(total),
          status: 'aguardando',
          created_at: new Date().toISOString()
        })
      }
    );
  } catch(e) {
    console.warn('Erro ao registrar pedido:', e);
  }
}

// ===== REGISTRAR CLIENTE NO SUPABASE =====
async function registrarCliente({ nome, telefone, endereco, itens, total }) {
  try {
    const tel = telefone.replace(/\D/g, '').replace(/^0/, '').replace(/^55/, '');

    // Verifica se já existe pelo telefone (normalizado, só dígitos)
    const check = await fetch(
      `${SUPABASE_URL}/rest/v1/clientes?telefone=ilike.*${tel}*&select=id,nome,observacoes,telefone`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
    );
    const existentes = await check.json();

    const dataHora = new Date().toLocaleString('pt-BR');
    const resumoPedido = `[${dataHora}] Pedido via loja online — Total: R$ ${total}\n${itens}${endereco ? '\nEndereço: ' + endereco : ''}`;

    // Filtra localmente para garantir match exato nos dígitos
    const match = (existentes || []).find(c => c.telefone && c.telefone.replace(/\D/g, '').replace(/^0/, '').replace(/^55/, '').includes(tel));

    if (match) {
      // Atualiza observações com novo pedido
      const cli = match;
      const obsAtualizada = (cli.observacoes ? cli.observacoes + '\n\n' : '') + resumoPedido;
      await fetch(
        `${SUPABASE_URL}/rest/v1/clientes?id=eq.${cli.id}`,
        {
          method: 'PATCH',
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
          body: JSON.stringify({ observacoes: obsAtualizada, origem: 'online', updated_at: new Date().toISOString() })
        }
      );
    } else {
      // Cria novo cliente
      const novoId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36);
      await fetch(
        `${SUPABASE_URL}/rest/v1/clientes`,
        {
          method: 'POST',
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
          body: JSON.stringify({
            id: novoId,
            nome,
            telefone,
            email: '',
            origem: 'online',
            observacoes: resumoPedido,
            created_at: new Date().toISOString()
          })
        }
      );
    }
  } catch(e) {
    console.warn('Erro ao registrar cliente:', e);
  }
}

// ===== TOAST =====
function showToast(msg) {
  const t = document.getElementById('store-toast');
  t.textContent = msg;
  t.style.opacity = '1'; t.style.transform = 'translateX(-50%) translateY(0)';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(-50%) translateY(20px)'; }, 2500);
}

// ===== INIT =====
(async () => {
  try {
    produtos = await fetchProdutos();
  } catch(e) {
    document.getElementById('grade-produtos-store').innerHTML =
      '<div class="store-empty"><div class="store-empty-icon">⚠️</div><div>Erro ao carregar produtos. Tente novamente.</div></div>';
    return;
  }
  renderCategorias();
  renderProdutos();
  atualizarCarrinho();

  const cats = [...new Set(produtos.map(p => p.categoria).filter(Boolean))];
  const statP = document.getElementById('stat-produtos');
  const statC = document.getElementById('stat-cats');
  if (statP) statP.textContent = produtos.length + '+';
  if (statC) statC.textContent = cats.length;

  document.getElementById('store-busca').addEventListener('input', function() {
    if (this.value) {
      catAtiva = '';
      document.querySelectorAll('.cat-nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelector('.cat-nav-btn').classList.add('active');
    }
    renderProdutos(this.value);
  });
})();
