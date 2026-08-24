const SUPABASE_URL_STORE = 'https://kefhuzwqfzkjcpavcamq.supabase.co';
const SUPABASE_KEY_STORE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtlZmh1endxZnpramNwYXZjYW1xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzODA4NDcsImV4cCI6MjEwMTk1Njg0N30.cRsgIVcLfgfaeJQseWMqwrEuIgF7SydSEMsaYjcJROY';
const STORAGE_BUCKET = 'produtos';

let produtoParaExcluir = null;

function carregarCategorias() {
  const produtos = DB.getProdutos();
  const cats = [...new Set(produtos.map(p => p.categoria).filter(Boolean))];
  const sel = document.getElementById('filtro-cat');
  sel.innerHTML = '<option value="">Todas as categorias</option>' + cats.map(c => `<option value="${c}">${c}</option>`).join('');
}

function renderProdutos() {
  const busca = document.getElementById('busca-produtos').value.toLowerCase();
  const cat = document.getElementById('filtro-cat').value;
  let produtos = DB.getProdutos();

  if (busca) produtos = produtos.filter(p => p.nome.toLowerCase().includes(busca) || (p.marca && p.marca.toLowerCase().includes(busca)) || (p.codigoBarras && p.codigoBarras.includes(busca)));
  if (cat) produtos = produtos.filter(p => p.categoria === cat);

  document.getElementById('total-produtos-label').textContent = `${produtos.length} produto${produtos.length !== 1 ? 's' : ''} encontrado${produtos.length !== 1 ? 's' : ''}`;

  const tbody = document.getElementById('tbody-produtos');
  if (produtos.length === 0) {
    tbody.innerHTML = '<tr><td colspan="11"><div class="empty-state"><div class="empty-state-icon"><i data-lucide="package"></i></div><div class="empty-state-text">Nenhum produto encontrado</div></div></td></tr>';
    if (window.lucide) lucide.createIcons();
    return;
  }

  const rows = produtos.map(p => {
    const margem = p.precoCusto > 0 ? (((p.precoVenda - p.precoCusto) / p.precoCusto) * 100).toFixed(1) + '%' : '—';
    const foto = p.imagemUrl
      ? `<img src="${p.imagemUrl}" style="width:36px;height:36px;object-fit:cover;border-radius:6px;" onerror="this.style.display='none'">`
      : `<span style="font-size:22px;">${p.emoji || '📦'}</span>`;
    const ativoTag = p.ativo === false || p.ativo === 0 || p.ativo === '0'
      ? '<span class="badge badge-red">Inativo</span>'
      : '<span class="badge badge-green">Ativo</span>';
    return `
      <tr>
        <td style="text-align:center;">${foto}</td>
        <td style="font-weight:600;max-width:200px;">${p.nome}${p.sabor ? `<div style="font-size:11px;color:var(--text-muted);">${p.sabor}</div>` : ''}</td>
        <td>${p.marca || '—'}</td>
        <td>${p.categoria || '—'}</td>
        <td style="font-family:monospace;font-size:12px;">${p.codigoBarras || '—'}</td>
        <td class="text-right">${p.precoCusto > 0 ? App.formatCurrency(p.precoCusto) : '—'}</td>
        <td class="text-right font-bold text-red">${App.formatCurrency(p.precoVenda)}</td>
        <td class="text-right text-green">${margem}</td>
        <td class="text-right font-bold">${p.estoque}</td>
        <td>${ativoTag}</td>
        <td>
          <div class="td-actions">
            <button class="btn btn-sm btn-secondary" onclick="editarProduto('${p.id}')"><i data-lucide="pencil"></i></button>
            <button class="btn btn-sm btn-danger" onclick="confirmarExcluir('${p.id}', '${p.nome.replace(/'/g, "\\'")}')"><i data-lucide="trash-2"></i></button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
  tbody.innerHTML = rows;
  if (window.lucide) lucide.createIcons();
}

function _resetFotoPreview(emoji) {
  document.getElementById('produto-foto-emoji').textContent = emoji || '📦';
  document.getElementById('produto-foto-emoji').style.display = '';
  const img = document.getElementById('produto-foto-img');
  img.src = ''; img.style.display = 'none';
}

function previewUrlImagem(url) {
  if (!url) { _resetFotoPreview(); return; }
  const img = document.getElementById('produto-foto-img');
  img.src = url;
  img.style.display = 'block';
  document.getElementById('produto-foto-emoji').style.display = 'none';
  img.onerror = () => { img.style.display = 'none'; document.getElementById('produto-foto-emoji').style.display = ''; };
}

function _setFotoPreviewUrl(url) {
  document.getElementById('produto-imagem-url').value = url;
  previewUrlImagem(url);
}

async function uploadFotoProduto(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) { App.showToast('Imagem muito grande! Máx 2MB.', 'error'); return; }

  const ext = file.name.split('.').pop().toLowerCase();
  const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const progress = document.getElementById('upload-progress');
  progress.style.display = 'block';

  try {
    const r = await fetch(`${SUPABASE_URL_STORE}/storage/v1/object/${STORAGE_BUCKET}/${path}`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY_STORE,
        'Authorization': `Bearer ${SUPABASE_KEY_STORE}`,
        'Content-Type': file.type,
        'x-upsert': 'true'
      },
      body: file
    });
    if (!r.ok) {
      const err = await r.text();
      throw new Error(err);
    }
    const publicUrl = `${SUPABASE_URL_STORE}/storage/v1/object/public/${STORAGE_BUCKET}/${path}`;
    _setFotoPreviewUrl(publicUrl);
    App.showToast('Foto enviada!', 'success');
  } catch(e) {
    console.error(e);
    App.showToast('Erro ao enviar foto. Verifique o bucket no Supabase.', 'error');
  } finally {
    progress.style.display = 'none';
    input.value = '';
  }
}

function abrirModalProduto() {
  document.getElementById('produto-id').value = '';
  document.getElementById('produto-nome').value = '';
  document.getElementById('produto-marca').value = '';
  document.getElementById('produto-categoria').value = '';
  document.getElementById('produto-barcode').value = '';
  document.getElementById('produto-emoji').value = '📦';
  document.getElementById('produto-sabor').value = '';
  document.getElementById('produto-descricao').value = '';
  document.getElementById('produto-imagem-url').value = '';
  document.getElementById('produto-custo').value = '';
  document.getElementById('produto-venda').value = '';
  document.getElementById('produto-estoque').value = '';
  document.getElementById('produto-estoque-min').value = '10';
  document.getElementById('produto-ativo').value = '1';
  document.getElementById('produto-margem').value = '';
  _resetFotoPreview('📦');
  document.getElementById('upload-progress').style.display = 'none';
  document.querySelectorAll('.form-error').forEach(e => e.classList.remove('show'));
  document.getElementById('modal-produto-titulo').textContent = 'Novo Produto';
  document.getElementById('modal-produto').classList.add('show');
  setTimeout(() => document.getElementById('produto-nome').focus(), 100);
}

function editarProduto(id) {
  const p = DB.getProdutoById(id);
  if (!p) return;
  document.getElementById('produto-id').value = p.id;
  document.getElementById('produto-nome').value = p.nome;
  document.getElementById('produto-marca').value = p.marca || '';
  document.getElementById('produto-categoria').value = p.categoria || '';
  document.getElementById('produto-barcode').value = p.codigoBarras || '';
  document.getElementById('produto-emoji').value = p.emoji || '📦';
  document.getElementById('produto-sabor').value = p.sabor || '';
  document.getElementById('produto-descricao').value = p.descricao || '';
  document.getElementById('produto-imagem-url').value = p.imagemUrl || '';
  document.getElementById('produto-custo').value = p.precoCusto || '';
  document.getElementById('produto-venda').value = p.precoVenda || '';
  document.getElementById('produto-estoque').value = p.estoque || 0;
  document.getElementById('produto-estoque-min').value = p.estoqueMin || 10;
  document.getElementById('produto-ativo').value = (p.ativo === false || p.ativo === 0) ? '0' : '1';
  document.getElementById('upload-progress').style.display = 'none';
  if (p.imagemUrl) {
    previewUrlImagem(p.imagemUrl);
  } else {
    _resetFotoPreview(p.emoji || '📦');
  }
  document.querySelectorAll('.form-error').forEach(e => e.classList.remove('show'));
  calcularMargem();
  document.getElementById('modal-produto-titulo').textContent = 'Editar Produto';
  document.getElementById('modal-produto').classList.add('show');
}

function calcularMargem() {
  const custo = parseFloat(document.getElementById('produto-custo').value) || 0;
  const venda = parseFloat(document.getElementById('produto-venda').value) || 0;
  const input = document.getElementById('produto-margem');
  if (custo > 0 && venda > 0) {
    const margem = ((venda - custo) / custo * 100).toFixed(1);
    input.value = margem + '%';
    input.style.color = margem >= 0 ? 'var(--green)' : 'var(--red)';
  } else { input.value = ''; }
}

function salvarProduto() {
  let valid = true;
  const nome = document.getElementById('produto-nome').value.trim();
  const venda = parseFloat(document.getElementById('produto-venda').value);
  const estoque = parseInt(document.getElementById('produto-estoque').value);
  const ativoVal = document.getElementById('produto-ativo').value;

  document.getElementById('err-nome').classList.toggle('show', !nome);
  if (!nome) valid = false;

  document.getElementById('err-venda').classList.toggle('show', !venda || venda <= 0);
  if (!venda || venda <= 0) valid = false;

  document.getElementById('err-estoque').classList.toggle('show', isNaN(estoque));
  if (isNaN(estoque)) valid = false;

  if (!valid) return;

  const id = document.getElementById('produto-id').value;
  const dados = {
    nome,
    marca: document.getElementById('produto-marca').value.trim(),
    categoria: document.getElementById('produto-categoria').value,
    codigoBarras: document.getElementById('produto-barcode').value.trim(),
    emoji: document.getElementById('produto-emoji').value,
    sabor: document.getElementById('produto-sabor').value.trim(),
    descricao: document.getElementById('produto-descricao').value.trim(),
    imagemUrl: document.getElementById('produto-imagem-url').value.trim(),
    precoCusto: parseFloat(document.getElementById('produto-custo').value) || 0,
    precoVenda: venda,
    estoque,
    estoqueMin: parseInt(document.getElementById('produto-estoque-min').value) || 10,
    ativo: ativoVal === '1'
  };

  if (id) {
    DB.updateProduto(id, dados);
    App.showToast('Produto atualizado com sucesso!', 'success');
  } else {
    DB.addProduto(dados);
    App.showToast('Produto cadastrado com sucesso!', 'success');
  }

  fecharModal('modal-produto');
  renderProdutos();
  carregarCategorias();
}

function confirmarExcluir(id, nome) {
  produtoParaExcluir = id;
  document.getElementById('nome-excluir').textContent = nome;
  document.getElementById('modal-excluir').classList.add('show');
}

document.getElementById('btn-confirmar-excluir').addEventListener('click', () => {
  if (!produtoParaExcluir) return;
  DB.deleteProduto(produtoParaExcluir);
  App.showToast('Produto excluído!', 'success');
  fecharModal('modal-excluir');
  renderProdutos();
  produtoParaExcluir = null;
});

function fecharModal(id) {
  document.getElementById(id).classList.remove('show');
}

document.getElementById('busca-produtos').addEventListener('input', () => {
  if (document.getElementById('busca-produtos').value.trim()) {
    document.getElementById('filtro-cat').value = '';
  }
  renderProdutos();
});
document.getElementById('filtro-cat').addEventListener('change', renderProdutos);

document.querySelectorAll('.modal-overlay').forEach(m => {
  m.addEventListener('click', e => { if (e.target === m) m.classList.remove('show'); });
});

(async () => {
  await App.initPage('produtos');
  carregarCategorias();
  renderProdutos();
})();
