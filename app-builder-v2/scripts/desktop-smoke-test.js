'use strict';

const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;

function assert(condition, name) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}`);
  }
}

function section(name) {
  console.log(`\n=== ${name} ===`);
}

section('Desktop Structure Check');

const root = path.join(__dirname, '..');

assert(fs.existsSync(path.join(root, 'desktop', 'main.js')), 'desktop/main.js exists');
assert(fs.existsSync(path.join(root, 'desktop', 'preload.js')), 'desktop/preload.js exists');
assert(fs.existsSync(path.join(root, 'desktop', 'protocols.js')), 'desktop/protocols.js exists');
assert(fs.existsSync(path.join(root, 'public', 'index.html')), 'public/index.html exists');
assert(fs.existsSync(path.join(root, 'package.json')), 'package.json exists');

section('main.js Analysis');
const mainCode = fs.readFileSync(path.join(root, 'desktop', 'main.js'), 'utf8');
assert(!mainCode.includes('express('), 'No Express in main.js');
assert(!mainCode.includes('app.listen('), 'No app.listen in main.js');
assert(!mainCode.includes('localhost'), 'No localhost in main.js');
assert(mainCode.includes('BrowserWindow'), 'BrowserWindow used');
assert(mainCode.includes('loadFile'), 'loadFile used (not loadURL)');
assert(mainCode.includes('runMigrations'), 'Migrations called');
assert(mainCode.includes('registerAllIpc'), 'IPC registration called');
assert(mainCode.includes('contextIsolation: true'), 'contextIsolation enabled');
assert(mainCode.includes('nodeIntegration: false'), 'nodeIntegration disabled');

section('preload.js Analysis');
const preloadCode = fs.readFileSync(path.join(root, 'desktop', 'preload.js'), 'utf8');
assert(preloadCode.includes('contextBridge'), 'contextBridge used');
assert(preloadCode.includes('appApi'), 'appApi exposed');
assert(!preloadCode.includes("exposeInMainWorld('ipcRenderer'"), 'ipcRenderer not exposed directly');
assert(!preloadCode.includes("require('fs')"), 'fs not exposed');

// Check all expected API namespaces
const expectedNs = ['projects', 'entities', 'fields', 'roles', 'auth', 'permissions', 'runtime', 'import', 'export', 'maintenance'];
for (const ns of expectedNs) {
  assert(preloadCode.includes(`${ns}:`), `appApi.${ns} namespace exists`);
}

section('IPC Handlers');
const ipcDir = path.join(root, 'desktop', 'ipc');
const expectedIpc = ['projects', 'entities', 'fields', 'roles', 'auth', 'permissions', 'runtime', 'import', 'export', 'maintenance'];
for (const ipc of expectedIpc) {
  assert(fs.existsSync(path.join(ipcDir, `${ipc}.ipc.js`)), `${ipc}.ipc.js exists`);
}

section('IPC Channel Naming');
// Check IPC handlers use namespace:method format, not HTTP-like URLs
for (const ipc of expectedIpc) {
  const code = fs.readFileSync(path.join(ipcDir, `${ipc}.ipc.js`), 'utf8');
  assert(!code.includes("'/api"), `${ipc}.ipc.js: no HTTP-like /api routes`);
  assert(code.includes(`'${ipc}:`), `${ipc}.ipc.js: uses namespace:method format`);
}

section('Service Independence from Electron');
const svcDir = path.join(root, 'src', 'services');
const svcFiles = fs.readdirSync(svcDir).filter(f => f.endsWith('.service.js'));
for (const sf of svcFiles) {
  const code = fs.readFileSync(path.join(svcDir, sf), 'utf8');
  assert(!code.includes("require('electron')"), `${sf}: no direct Electron dependency`);
}

section('No Express dependency check');
const pkgJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
assert(!pkgJson.dependencies || !pkgJson.dependencies.express, 'No express in dependencies');
assert(!pkgJson.devDependencies || !pkgJson.devDependencies.express, 'No express in devDependencies');
assert(pkgJson.scripts && pkgJson.scripts.start === 'electron .', 'npm start runs electron');
assert(!pkgJson.scripts || !pkgJson.scripts.server, 'No npm run server script');

section('Database');
const dbDir = path.join(root, 'src', 'db');
assert(fs.existsSync(path.join(dbDir, 'connection.js')), 'connection.js exists');
assert(fs.existsSync(path.join(dbDir, 'migrate.js')), 'migrate.js exists');
assert(fs.existsSync(path.join(dbDir, 'schema.js')), 'schema.js exists');
assert(fs.existsSync(path.join(dbDir, 'migrations', '001_initial.js')), '001_initial.js exists');

const migrationCode = fs.readFileSync(path.join(dbDir, 'migrations', '001_initial.js'), 'utf8');
assert(migrationCode.includes('schema_migrations') || fs.readFileSync(path.join(dbDir, 'migrate.js'), 'utf8').includes('schema_migrations'), 'schema_migrations table');
assert(migrationCode.includes('projects'), 'projects table in migration');
assert(migrationCode.includes('entities'), 'entities table in migration');
assert(migrationCode.includes('fields'), 'fields table in migration');
assert(migrationCode.includes('relations'), 'relations table in migration');
assert(migrationCode.includes('roles'), 'roles table in migration');
assert(migrationCode.includes('users'), 'users table in migration');
assert(migrationCode.includes('table_permissions'), 'table_permissions table in migration');
assert(migrationCode.includes('field_permissions'), 'field_permissions table in migration');
assert(migrationCode.includes('rules'), 'rules table in migration');
assert(migrationCode.includes('import_profiles'), 'import_profiles table in migration');

console.log(`\n=============================`);
console.log(`Результат: ${passed} пройдено, ${failed} провалено`);
console.log(`=============================`);

process.exit(failed > 0 ? 1 : 0);
