const App = {
  formatCurrency(v) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
  },

  formatDate(d) {
    if (!d) return '-';
    const dt = new Date(d);
    return dt.toLocaleDateString('pt-BR') + ' ' + dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  },

  formatDateShort(d) {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('pt-BR');
  },

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  },

  showToast(msg, type = 'success') {
    const icons = { success: '<i data-lucide="check-circle"></i>', error: '<i data-lucide="x-circle"></i>', warning: '<i data-lucide="alert-triangle"></i>', info: '<i data-lucide="info"></i>' };
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span class="toast-icon">${icons[type] || icons.success}</span><span class="toast-msg">${msg}</span>`;
    container.appendChild(toast);
    if (window.lucide) lucide.createIcons();
    setTimeout(() => {
      toast.classList.add('hide');
      setTimeout(() => toast.remove(), 350);
    }, 3200);
  },

  setNavActive(page) {
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.page === page);
    });
  },

  checkCaixaAberto() {
    const caixa = DB.getCaixaAberto();
    const badge = document.getElementById('caixa-badge');
    if (badge) {
      badge.textContent = caixa ? '● Caixa Aberto' : '● Caixa Fechado';
      badge.style.color = caixa ? 'var(--green)' : 'var(--red)';
    }
    return caixa;
  },

  async initPage(pageName) {
    this._showLoading();
    try {
      await DB.init();
    } catch(e) {
      this._showDbError();
      return;
    }
    if (!DB.getUsuarioLogado()) { window.location.href = 'login.html'; return; }
    this.setNavActive(pageName);
    this.checkCaixaAberto();
    this._initNavToggle();
    this._initTheme();
    this._initUserInfo();
    this._hideLoading();
    setTimeout(() => this.refreshIcons(), 0);
  },

  _showLoading() {
    if (document.getElementById('app-loading')) return;
    const el = document.createElement('div');
    el.id = 'app-loading';
    el.style.cssText = 'position:fixed;inset:0;z-index:99999;background:var(--bg-main);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;';
    el.innerHTML = '<div style="width:40px;height:40px;border:3px solid var(--border);border-top-color:var(--red);border-radius:50%;animation:_spin 0.8s linear infinite;"></div><div style="font-size:14px;color:var(--text-muted);">Conectando...</div><style>@keyframes _spin{to{transform:rotate(360deg)}}</style>';
    document.body.appendChild(el);
  },

  _hideLoading() {
    const el = document.getElementById('app-loading');
    if (el) el.remove();
  },

  _showDbError() {
    const el = document.getElementById('app-loading') || document.createElement('div');
    el.id = 'app-loading';
    el.style.cssText = 'position:fixed;inset:0;z-index:99999;background:var(--bg-main);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;';
    el.innerHTML = '<div style="color:var(--red);font-size:48px;line-height:1;">⚠</div><div style="font-size:18px;font-weight:700;">Erro de conexão</div><div style="font-size:13px;color:var(--text-muted);text-align:center;max-width:300px;">Não foi possível conectar ao banco de dados. Verifique sua internet.</div><button onclick="location.reload()" style="padding:10px 24px;background:var(--red);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;">Tentar novamente</button>';
    if (!el.parentNode) document.body.appendChild(el);
  },

  _initUserInfo() {
    const user = DB.getUsuarioLogado();
    if (!user) return;
    if (user.perfil !== 'admin') {
      document.querySelectorAll('.nav-item[data-page="usuarios"]').forEach(el => el.style.display = 'none');
      document.querySelectorAll('.nav-item[data-page="comissoes"]').forEach(el => el.style.display = 'none');
    }
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar || document.getElementById('sidebar-user-info')) return;
    const div = document.createElement('div');
    div.id = 'sidebar-user-info';
    div.innerHTML = `
      <div class="sidebar-user">
        <div class="sidebar-user-avatar"><i data-lucide="user-round"></i></div>
        <div class="sidebar-user-data">
          <div class="sidebar-user-nome">${user.nome}</div>
          <div class="sidebar-user-perfil">${user.perfil === 'admin' ? 'Administrador' : 'Vendedor'}</div>
        </div>
        <button class="btn-logout" title="Sair" onclick="App.logout()"><i data-lucide="log-out"></i></button>
      </div>
    `;
    const toggle = sidebar.querySelector('.sidebar-toggle');
    sidebar.insertBefore(div, toggle);
  },

  logout() {
    DB.logout();
    window.location.href = 'login.html';
  },

  _initTheme() {
    const saved = localStorage.getItem('pdv_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    this._injectThemeBtn(saved);
  },

  _injectThemeBtn(theme) {
    if (document.getElementById('theme-toggle')) return;
    const btn = document.createElement('button');
    btn.id = 'theme-toggle';
    btn.className = 'btn-theme';
    btn.title = theme === 'dark' ? 'Modo Claro' : 'Modo Escuro';
    btn.innerHTML = theme === 'dark' ? '<i data-lucide="sun"></i>' : '<i data-lucide="moon"></i>';
    btn.addEventListener('click', () => App.toggleTheme());
    const headerActions = document.querySelector('.header-actions');
    if (headerActions) {
      headerActions.insertBefore(btn, headerActions.firstChild);
    }
    if (window.lucide) lucide.createIcons();
  },

  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('pdv_theme', next);
    const btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.title = next === 'dark' ? 'Modo Claro' : 'Modo Escuro';
      btn.innerHTML = next === 'dark' ? '<i data-lucide="sun"></i>' : '<i data-lucide="moon"></i>';
      if (window.lucide) lucide.createIcons();
    }
  },

  _initNavToggle() {
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');
    const toggleBtn = document.getElementById('nav-toggle');

    if (!sidebar) return;

    const collapsed = localStorage.getItem('nav_collapsed') === '1';
    if (collapsed) {
      sidebar.classList.add('collapsed');
      mainContent && mainContent.classList.add('nav-collapsed');
      if (toggleBtn) toggleBtn.innerHTML = '<i data-lucide="chevron-right"></i>';
    }

    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        const isCollapsed = sidebar.classList.toggle('collapsed');
        mainContent && mainContent.classList.toggle('nav-collapsed', isCollapsed);
        toggleBtn.innerHTML = isCollapsed ? '<i data-lucide="chevron-right"></i>' : '<i data-lucide="chevron-left"></i>'; if (window.lucide) lucide.createIcons();
        localStorage.setItem('nav_collapsed', isCollapsed ? '1' : '0');
      });
    }
  },

  isToday(dateStr) {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const t = new Date();
    return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear();
  },

  isThisWeek(dateStr) {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    return d >= startOfWeek;
  },

  isThisMonth(dateStr) {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  },

  drawBarChart(canvasId, labels, values, color = '#e53935') {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const padding = { top: 20, right: 20, bottom: 40, left: 60 };
    const chartW = W - padding.left - padding.right;
    const chartH = H - padding.top - padding.bottom;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'transparent';

    const max = Math.max(...values, 1);
    const barW = chartW / labels.length * 0.6;
    const gap = chartW / labels.length;

    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 1;
    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
      const y = padding.top + chartH - (chartH / gridLines) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + chartW, y);
      ctx.stroke();

      ctx.fillStyle = '#666';
      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'right';
      const val = (max / gridLines) * i;
      ctx.fillText(val >= 1000 ? (val / 1000).toFixed(1) + 'k' : val.toFixed(0), padding.left - 6, y + 4);
    }

    values.forEach((v, i) => {
      const x = padding.left + gap * i + gap / 2 - barW / 2;
      const barH = (v / max) * chartH;
      const y = padding.top + chartH - barH;

      const grad = ctx.createLinearGradient(0, y, 0, y + barH);
      grad.addColorStop(0, color);
      grad.addColorStop(1, color + '66');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(x, y, barW, barH, [4, 4, 0, 0]);
      ctx.fill();

      ctx.fillStyle = '#aaa';
      ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(labels[i], padding.left + gap * i + gap / 2, padding.top + chartH + 20);
    });
  },

  getStockBadge(estoque, estoqueMin) {
    const min = estoqueMin || 10;
    if (estoque === 0) return '<span class="badge badge-zero">Zerado</span>';
    if (estoque < min) return '<span class="badge badge-low">Baixo</span>';
    return '<span class="badge badge-ok">OK</span>';
  },

  refreshIcons() {
    if (window.lucide) lucide.createIcons();
  },

  getPagamentoBadge(pag) {
    const map = {
      dinheiro: '<span class="badge badge-cash">Dinheiro</span>',
      pix: '<span class="badge badge-pix">PIX</span>',
      credito: '<span class="badge badge-card">Crédito</span>',
      debito: '<span class="badge badge-card">Débito</span>'
    };
    return map[pag] || `<span class="badge">${pag}</span>`;
  }
};
