'use strict';

const DesignerShell = {
  render(contentEl, sidebarEl, params) {
    const tabs = [
      { id: 'overview', label: 'Обзор' },
      { id: 'structure', label: 'Структура' },
      { id: 'access', label: 'Доступ' },
      { id: 'data', label: 'Данные' },
      { id: 'import', label: 'Импорт' },
      { id: 'er', label: 'ER / SQL' },
      { id: 'export', label: 'Экспорт' },
    ];

    sidebarEl.innerHTML = `
      <div class="sidebar-section">
        <div class="sidebar-title">Конструктор</div>
        ${tabs.map(t => `<div class="sidebar-item ${AppState.designerTab === t.id ? 'active' : ''}" data-action="designerTab" data-params='{"tab":"${t.id}"}'>${t.label}</div>`).join('')}
      </div>
    `;
    Actions.scan(sidebarEl);

    this.renderTab(contentEl, AppState.designerTab);
  },

  renderTab(contentEl, tab) {
    AppState.designerTab = tab;
    const sidebarItems = DOM.$$('.sidebar-item', DOM.$('#sidebar'));
    sidebarItems.forEach(el => {
      try {
        const p = JSON.parse(el.dataset.params || '{}');
        el.classList.toggle('active', p.tab === tab);
      } catch {}
    });

    switch (tab) {
      case 'overview': OverviewScreen.render(contentEl); break;
      case 'structure': StructureScreen.render(contentEl); break;
      case 'access': AccessScreen.render(contentEl); break;
      case 'data': DataScreen.render(contentEl); break;
      case 'import': ImportScreen.render(contentEl); break;
      case 'er': ErScreen.render(contentEl); break;
      case 'export': ExportScreen.render(contentEl); break;
      default: contentEl.innerHTML = '<p>Раздел в разработке</p>';
    }
  },
};

Actions.register('designerTab', (params) => {
  DesignerShell.renderTab(DOM.$('#main-content'), params.tab);
});

window.DesignerShell = DesignerShell;
