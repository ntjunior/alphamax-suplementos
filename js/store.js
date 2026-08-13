const SUPABASE_URL = 'https://kefhuzwqfzkjcpavcamq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtlZmh1endxZnpramNwYXZjYW1xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzODA4NDcsImV4cCI6MjEwMTk1Njg0N30.cRsgIVcLfgfaeJQseWMqwrEuIgF7SydSEMsaYjcJROY';
const WHATSAPP_NUMBER = '5511911176899';

let produtos = [];
let carrinho = [];
let catAtiva = '';
let entregaTipo = 'retirada';

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

// ===== EMOJIS POR CATEGORIA =====
function emojiCategoria(cat) {
  const mapa = {
    'Proteína': '💪', 'Whey': '💪', 'Creatina': '⚡', 'Pré-treino': '🔥',
    'Vitaminas': '🌿', 'Aminoácidos': '🧬', 'Emagrecimento': '🏃',
    'Carboidratos': '🍌', 'Hipercalórico': '🏋️', 'Barras': '🍫',
    'Colágeno': '✨', 'Ômega': '🐟'
  };
  if (!cat) return '🥤';
  for (const [k, v] of Object.entries(mapa)) {
    if (cat.toLowerCase().includes(k.toLowerCase())) return v;
  }
  return '🥤';
}

// ===== CARD HTML =====
function cardHTML(p) {
  const semEstoque = p.estoque <= 0;
  const emoji = p.emoji || emojiCategoria(p.categoria);
  const imgContent = p.imagemUrl
    ? `<img src="${p.imagemUrl}" alt="${p.nome}" style="width:100%;height:100%;object-fit:cover;" onerror="this.parentElement.innerHTML='<span>${emoji}</span>'">`
    : `<span>${emoji}</span>`;
  return `
    <div class="produto-card-store ${semEstoque ? 'produto-sem-estoque' : ''}" onclick="${semEstoque ? '' : `adicionarCarrinho('${p.id}')`}">
      <div class="produto-img">
        ${imgContent}
        ${p.categoria ? `<span class="produto-img-badge">${p.categoria}</span>` : ''}
      </div>
      <div class="produto-info">
        ${p.marca ? `<div class="produto-marca-store">${p.marca}</div>` : ''}
        <div class="produto-nome-store">${p.nome}</div>
        ${p.sabor ? `<div class="produto-sabor">${p.sabor}</div>` : ''}
        <div class="produto-preco-store">
          <small>R$</small> ${(p.precoVenda || 0).toFixed(2).replace('.', ',')}
        </div>
        <button class="btn-adicionar" onclick="event.stopPropagation();adicionarCarrinho('${p.id}')" ${semEstoque ? 'disabled' : ''}>
          ${semEstoque
            ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Sem Estoque'
            : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg> Adicionar'}
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
      (p.categoria || '').toLowerCase().includes(b)
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
    const emoji = emojiCategoria(cat);
    html += `
      <section class="cat-section">
        <div class="cat-section-header">
          <div class="cat-section-title">
            <span class="cat-emoji">${emoji}</span> ${cat}
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
    `<button class="cat-nav-btn active" onclick="filtrarCat('', this)">🛍️ Todos</button>` +
    cats.map(c => `<button class="cat-nav-btn" onclick="filtrarCat('${c}', this)">${emojiCategoria(c)} ${c}</button>`).join('');
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

// ===== CARRINHO =====
function adicionarCarrinho(id) {
  const p = produtos.find(x => x.id === id);
  if (!p || p.estoque <= 0) return;
  const exist = carrinho.find(i => i.id === id);
  if (exist) {
    if (exist.qty >= p.estoque) { showToast('Quantidade máxima atingida!'); return; }
    exist.qty++;
  } else {
    carrinho.push({ id: p.id, nome: p.nome, marca: p.marca, preco: p.precoVenda, qty: 1, estoque: p.estoque, categoria: p.categoria });
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
  items.innerHTML = carrinho.map(item => `
    <div class="cart-item-store">
      <div class="cart-item-emoji">${emojiCategoria(item.categoria)}</div>
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
  `).join('');

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

  const endereco = entregaTipo === 'entrega' ? document.getElementById('checkout-endereco').value.trim() : '';
  if (entregaTipo === 'entrega' && !endereco) { document.getElementById('checkout-endereco').focus(); showToast('Informe o endereço!'); return; }

  const total = totalCarrinho();
  const itens = carrinho.map(i => `• ${i.qty}x ${i.nome} — R$ ${(i.preco * i.qty).toFixed(2).replace('.', ',')}`).join('\n');

  const msg = [
    `🛒 *NOVO PEDIDO - Alpha Max Suplementos*`,
    ``,
    `👤 *Nome:* ${nome}`,
    `📞 *Telefone:* ${tel}`,
    `📦 *Entrega:* ${entregaTipo === 'retirada' ? 'Retirar na loja' : `Entrega — ${endereco}`}`,
    ``,
    `*Itens:*`,
    itens,
    ``,
    `💰 *TOTAL: R$ ${total.toFixed(2).replace('.', ',')}*`,
    ``,
    `Aguardo confirmação e dados para pagamento via PIX! ✅`
  ].join('\n');

  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank');
  fecharCheckout();
  carrinho = [];
  atualizarCarrinho();
  showToast('Pedido enviado via WhatsApp! ✅');
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

  document.getElementById('store-busca').addEventListener('input', function() {
    if (this.value) {
      catAtiva = '';
      document.querySelectorAll('.cat-nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelector('.cat-nav-btn').classList.add('active');
    }
    renderProdutos(this.value);
  });
})();
