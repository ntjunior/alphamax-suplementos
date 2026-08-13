
let usuarioExcluirId = null;
let usuarioSenhaId = null;

function renderUsuarios() {
  const usuarios = DB.getUsuarios();
  const logado = DB.getUsuarioLogado();
  document.getElementById('usuarios-count-label').textContent = `${usuarios.length} usuário${usuarios.length !== 1 ? 's' : ''} cadastrado${usuarios.length !== 1 ? 's' : ''}`;

  const tbody = document.getElementById('tbody-usuarios');
  if (usuarios.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted" style="padding:32px;">Nenhum usuário cadastrado</td></tr>';
    return;
  }

  tbody.innerHTML = usuarios.map(u => {
    const isLogado = u.id === logado?.id;
    const perfilBadge = u.perfil === 'admin'
      ? '<span class="badge badge-pix">Admin</span>'
      : '<span class="badge badge-entrada">Vendedor</span>';
    const statusBadge = u.ativo
      ? '<span class="badge badge-ok">Ativo</span>'
      : '<span class="badge" style="background:rgba(100,100,100,0.2);color:#888;">Inativo</span>';
    const inicial = u.nome.charAt(0).toUpperCase();
    return `
      <tr>
        <td>
          <div style="width:36px;height:36px;background:rgba(229,57,53,0.15);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:var(--red);">
            ${inicial}
          </div>
        </td>
        <td>
          <div style="font-weight:600;">${u.nome}</div>
          ${isLogado ? '<div style="font-size:11px;color:var(--text-muted);">Você</div>' : ''}
        </td>
        <td><code style="font-size:13px;background:var(--bg-input);padding:2px 8px;border-radius:4px;">${u.login}</code></td>
        <td>${perfilBadge}</td>
        <td>${statusBadge}</td>
        <td style="font-size:12px;color:var(--text-muted);">${App.formatDateShort(u.createdAt)}</td>
        <td>
          <div class="td-actions">
            <button class="btn btn-ghost btn-sm" onclick="editarUsuario('${u.id}')" title="Editar"><i data-lucide="pencil"></i></button>
            <button class="btn btn-ghost btn-sm" onclick="abrirModalSenha('${u.id}')" title="Redefinir senha"><i data-lucide="key-round"></i></button>
            ${!isLogado ? `<button class="btn btn-ghost btn-sm" onclick="confirmarExcluir('${u.id}', '${u.nome.replace(/'/g, "\\'")}')" title="Excluir"><i data-lucide="trash-2"></i></button>` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

function abrirModalUsuario() {
  document.getElementById('usuario-id').value = '';
  document.getElementById('usuario-nome').value = '';
  document.getElementById('usuario-login').value = '';
  document.getElementById('usuario-senha').value = '';
  document.getElementById('usuario-perfil').value = 'vendedor';
  document.getElementById('usuario-ativo').value = '1';
  document.getElementById('usuario-comissao').value = '';
  document.getElementById('usuario-login').disabled = false;
  document.getElementById('modal-usuario-titulo').innerHTML = '<i data-lucide="user-plus"></i> Novo Usuário';
  document.getElementById('label-senha').innerHTML = 'Senha <span class="required">*</span>';
  document.getElementById('aviso-senha-edicao').classList.add('hidden');
  document.querySelectorAll('.form-error').forEach(e => e.style.display = 'none');
  document.getElementById('modal-usuario').classList.add('show');
  if (window.lucide) lucide.createIcons();
  setTimeout(() => document.getElementById('usuario-nome').focus(), 100);
}

function editarUsuario(id) {
  const u = DB.getUsuarios().find(x => x.id === id);
  if (!u) return;
  document.getElementById('usuario-id').value = u.id;
  document.getElementById('usuario-nome').value = u.nome;
  document.getElementById('usuario-login').value = u.login;
  document.getElementById('usuario-senha').value = '';
  document.getElementById('usuario-perfil').value = u.perfil;
  document.getElementById('usuario-ativo').value = u.ativo ? '1' : '0';
  document.getElementById('usuario-comissao').value = u.comissaoPct != null ? u.comissaoPct : '';
  document.getElementById('usuario-login').disabled = true;
  document.getElementById('modal-usuario-titulo').innerHTML = '<i data-lucide="pencil"></i> Editar Usuário';
  document.getElementById('label-senha').innerHTML = 'Nova Senha';
  document.getElementById('aviso-senha-edicao').classList.remove('hidden');
  document.querySelectorAll('.form-error').forEach(e => e.style.display = 'none');
  document.getElementById('modal-usuario').classList.add('show');
  if (window.lucide) lucide.createIcons();
}

function salvarUsuario() {
  const id = document.getElementById('usuario-id').value;
  const nome = document.getElementById('usuario-nome').value.trim();
  const login = document.getElementById('usuario-login').value.trim();
  const senha = document.getElementById('usuario-senha').value;
  const perfil = document.getElementById('usuario-perfil').value;
  const ativo = document.getElementById('usuario-ativo').value === '1';
  const comissaoPctRaw = document.getElementById('usuario-comissao').value;
  const comissaoPct = comissaoPctRaw !== '' ? parseFloat(comissaoPctRaw) : null;

  let ok = true;
  document.querySelectorAll('.form-error').forEach(e => e.style.display = 'none');

  if (!nome) { document.getElementById('err-usuario-nome').style.display = 'block'; ok = false; }
  if (!id && !login) { document.getElementById('err-usuario-login').style.display = 'block'; ok = false; }
  if (!id && senha.length < 4) { document.getElementById('err-usuario-senha').style.display = 'block'; ok = false; }
  if (!ok) return;

  if (id) {
    const data = { nome, perfil, ativo, comissaoPct };
    if (senha.length >= 4) data.senha = senha;
    DB.updateUsuario(id, data);
    App.showToast('Usuário atualizado com sucesso!', 'success');
  } else {
    const resultado = DB.addUsuario({ nome, login, senha, perfil, ativo, comissaoPct });
    if (!resultado) { App.showToast('Login já está em uso!', 'error'); return; }
    App.showToast('Usuário cadastrado com sucesso!', 'success');
  }

  fecharModal('modal-usuario');
  renderUsuarios();
}

function abrirModalSenha(id) {
  usuarioSenhaId = id;
  const u = DB.getUsuarios().find(x => x.id === id);
  document.getElementById('senha-usuario-nome').textContent = u?.nome || '';
  document.getElementById('nova-senha').value = '';
  document.getElementById('err-nova-senha').style.display = 'none';
  document.getElementById('modal-senha').classList.add('show');
  setTimeout(() => document.getElementById('nova-senha').focus(), 100);
}

function confirmarRedefinirSenha() {
  const senha = document.getElementById('nova-senha').value;
  if (senha.length < 4) { document.getElementById('err-nova-senha').style.display = 'block'; return; }
  DB.updateUsuario(usuarioSenhaId, { senha });
  App.showToast('Senha redefinida com sucesso!', 'success');
  fecharModal('modal-senha');
}

function confirmarExcluir(id, nome) {
  usuarioExcluirId = id;
  document.getElementById('nome-excluir-usuario').textContent = nome;
  document.getElementById('modal-excluir-usuario').classList.add('show');
  document.getElementById('btn-confirmar-excluir-usuario').onclick = () => {
    DB.deleteUsuario(usuarioExcluirId);
    App.showToast('Usuário excluído!', 'success');
    fecharModal('modal-excluir-usuario');
    renderUsuarios();
  };
}

function fecharModal(id) {
  document.getElementById(id).classList.remove('show');
}

function toggleSenhaModal() {
  const input = document.getElementById('usuario-senha');
  const icon = document.getElementById('icon-senha-modal');
  if (input.type === 'password') {
    input.type = 'text';
    icon.setAttribute('data-lucide', 'eye-off');
  } else {
    input.type = 'password';
    icon.setAttribute('data-lucide', 'eye');
  }
  if (window.lucide) lucide.createIcons();
}

document.querySelectorAll('.modal-overlay').forEach(m => {
  m.addEventListener('click', e => { if (e.target === m) m.classList.remove('show'); });
});


(async () => {
  await App.initPage('usuarios');
  const user = DB.getUsuarioLogado();
  if (user && user.perfil !== 'admin') {
    App.showToast('Acesso restrito a administradores!', 'error');
    setTimeout(() => { window.location.href = 'index.html'; }, 1500);
    return;
  }
  renderUsuarios();
})();
