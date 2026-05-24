'use strict';

const { test, expect } = require('@playwright/test');

test.describe('UI Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Для UI тестов нужен запущенный Electron — тест проверяет HTML-структуру
    // В headless-режиме загружаем index.html напрямую
  });

  test('index.html содержит корректную структуру', async ({ page }) => {
    const fs = require('fs');
    const path = require('path');
    const htmlPath = path.join(__dirname, '..', 'public', 'index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');

    expect(html).toContain('id="app"');
    expect(html).toContain('id="app-header"');
    expect(html).toContain('id="sidebar"');
    expect(html).toContain('id="main-content"');
    expect(html).toContain('id="status-bar"');
    expect(html).toContain('Конструктор ИС');
    expect(html).toContain('lang="ru"');
  });

  test('CSS файлы существуют', async () => {
    const fs = require('fs');
    const path = require('path');
    const cssDir = path.join(__dirname, '..', 'public', 'assets', 'css');
    expect(fs.existsSync(path.join(cssDir, 'app.css'))).toBeTruthy();
    expect(fs.existsSync(path.join(cssDir, 'shell.css'))).toBeTruthy();
    expect(fs.existsSync(path.join(cssDir, 'designer.css'))).toBeTruthy();
    expect(fs.existsSync(path.join(cssDir, 'runtime.css'))).toBeTruthy();
    expect(fs.existsSync(path.join(cssDir, 'forms.css'))).toBeTruthy();
  });

  test('JS модули существуют', async () => {
    const fs = require('fs');
    const path = require('path');
    const jsDir = path.join(__dirname, '..', 'public', 'assets', 'js');

    const required = [
      'core/dom.js', 'core/actions.js', 'core/notifications.js', 'core/stateViews.js', 'core/apiClient.js',
      'shell/appShell.js', 'shell/startScreen.js', 'shell/designerShell.js', 'shell/runtimeShell.js',
      'designer/overviewScreen.js', 'designer/structureScreen.js', 'designer/accessScreen.js',
      'designer/dataScreen.js', 'designer/importScreen.js', 'designer/erScreen.js', 'designer/exportScreen.js',
      'runtime/runtimeList.js', 'runtime/runtimeForm.js', 'runtime/runtimeFilters.js',
    ];

    for (const f of required) {
      expect(fs.existsSync(path.join(jsDir, f))).toBeTruthy();
    }
  });

  test('HTML не содержит подозрительных enabled кнопок без action', async () => {
    const fs = require('fs');
    const path = require('path');
    const htmlPath = path.join(__dirname, '..', 'public', 'index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');
    // В начальном HTML нет кнопок — они создаются динамически
    // Проверяем что нет статических кнопок без data-action
    const btnMatches = html.match(/<button[^>]*>/g) || [];
    // Все кнопки в шаблоне должны быть динамически создаваемые
    // В index.html нет статических кнопок
    expect(btnMatches.length).toBe(0);
  });

  test('JS core содержит Actions.register', async () => {
    const fs = require('fs');
    const path = require('path');
    const actionsCode = fs.readFileSync(path.join(__dirname, '..', 'public', 'assets', 'js', 'core', 'actions.js'), 'utf8');
    expect(actionsCode).toContain('register(name, handler)');
    expect(actionsCode).toContain('checkSuspiciousButtons');
    expect(actionsCode).toContain('data-action');
  });

  test('preload.js не expose ipcRenderer напрямую', async () => {
    const fs = require('fs');
    const path = require('path');
    const preloadCode = fs.readFileSync(path.join(__dirname, '..', 'desktop', 'preload.js'), 'utf8');
    expect(preloadCode).toContain('contextBridge');
    expect(preloadCode).toContain('appApi');
    expect(preloadCode).not.toContain("exposeInMainWorld('ipcRenderer'");
    expect(preloadCode).not.toContain('require(\'fs\')');
  });

  test('main.js не поднимает Express', async () => {
    const fs = require('fs');
    const path = require('path');
    const mainCode = fs.readFileSync(path.join(__dirname, '..', 'desktop', 'main.js'), 'utf8');
    expect(mainCode).not.toContain('express()');
    expect(mainCode).not.toContain('app.listen');
    expect(mainCode).not.toContain('localhost');
    expect(mainCode).toContain('loadFile');
  });
});
