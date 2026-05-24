'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');

// Override DB path for test
const testDir = path.join(os.tmpdir(), 'appbuilder-smoke-' + Date.now());
fs.mkdirSync(testDir, { recursive: true });
process.env.APP_DATA_PATH = testDir;

const { getDb, closeDb, resetDb } = require('../src/db/connection');
const { runMigrations } = require('../src/db/migrate');

const ProjectsRepo = require('../src/repositories/projects.repo');
const EntitiesRepo = require('../src/repositories/entities.repo');
const FieldsRepo = require('../src/repositories/fields.repo');
const RolesRepo = require('../src/repositories/roles.repo');
const UsersRepo = require('../src/repositories/users.repo');
const PermissionsRepo = require('../src/repositories/permissions.repo');
const RuntimeRepo = require('../src/repositories/runtime.repo');

const ProjectsService = require('../src/services/projects.service');
const SchemaService = require('../src/services/schema.service');
const AuthService = require('../src/services/auth.service');
const PermissionsService = require('../src/services/permissions.service');
const RuntimeService = require('../src/services/runtime.service');
const ImportService = require('../src/services/import.service');
const ExportService = require('../src/services/export.service');

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

try {
  const db = getDb();
  const migResult = runMigrations(db);

  section('Migrations');
  assert(migResult.ran > 0 || migResult.total > 0, 'Миграции выполнены');

  const repos = {
    projects: new ProjectsRepo(db),
    entities: new EntitiesRepo(db),
    fields: new FieldsRepo(db),
    roles: new RolesRepo(db),
    users: new UsersRepo(db),
    permissions: new PermissionsRepo(db),
    runtime: new RuntimeRepo(db),
  };

  const permSvc = new PermissionsService(db, repos);
  const projectsSvc = new ProjectsService(db, repos);
  const schemaSvc = new SchemaService(db, repos);
  const authSvc = new AuthService(db, repos);
  const runtimeSvc = new RuntimeService(db, repos, permSvc);
  const importSvc = new ImportService(db, repos, permSvc);
  const exportSvc = new ExportService(db, repos);

  section('Projects');
  const project = projectsSvc.create({ title: 'Тестовый проект', description: 'Описание', template_code: '' });
  assert(project && project.id, 'Создание проекта');
  assert(projectsSvc.list().length >= 1, 'Список проектов');
  const gotProject = projectsSvc.get(project.id);
  assert(gotProject.title === 'Тестовый проект', 'Получение проекта');

  section('Default roles and admin');
  const roles = repos.roles.listByProject(project.id);
  assert(roles.length >= 2, 'Роли admin/user созданы');
  const adminRole = roles.find(r => r.code === 'admin');
  const userRole = roles.find(r => r.code === 'user');
  assert(adminRole, 'Роль admin');
  assert(userRole, 'Роль user');

  section('Auth');
  const adminUser = authSvc.login(project.id, 'Admin', 'KorokNET');
  assert(adminUser && adminUser.id, 'Login Admin / KorokNET');
  assert(adminUser.role_code === 'admin', 'Admin role correct');
  const me = authSvc.me(adminUser.id);
  assert(me.login === 'Admin', 'me() works');

  section('Entities');
  const entity = schemaSvc.createEntity(project.id, { name: 'clients', title: 'Клиенты', description: 'Таблица клиентов' });
  assert(entity && entity.id, 'Создание таблицы');
  const entities = schemaSvc.listEntities(project.id);
  assert(entities.length >= 1, 'Список таблиц');

  section('Fields');
  const nameField = schemaSvc.createField(entity.id, { name: 'full_name', title: 'ФИО', type: 'text', required: true });
  assert(nameField && nameField.id, 'Создание text поля');
  const emailField = schemaSvc.createField(entity.id, { name: 'email', title: 'Email', type: 'text', unique_value: true });
  assert(emailField && emailField.id, 'Создание unique поля');
  const ageField = schemaSvc.createField(entity.id, { name: 'age', title: 'Возраст', type: 'number', validation_json: '{"min": 0, "max": 150}' });
  assert(ageField && ageField.id, 'Создание number поля');
  const activeField = schemaSvc.createField(entity.id, { name: 'is_active', title: 'Активен', type: 'boolean', default_value: '1' });
  assert(activeField && activeField.id, 'Создание boolean поля');
  const statusField = schemaSvc.createField(entity.id, { name: 'status', title: 'Статус', type: 'select', options_json: JSON.stringify(['Новый', 'Активный', 'Закрыт']) });
  assert(statusField && statusField.id, 'Создание select поля');

  const fields = schemaSvc.listFields(entity.id);
  assert(fields.length >= 5, 'Список полей');

  section('Relations');
  const ordersEntity = schemaSvc.createEntity(project.id, { name: 'orders', title: 'Заказы' });
  const orderClientField = schemaSvc.createField(ordersEntity.id, {
    name: 'client_id', title: 'Клиент', type: 'relation', target_entity_id: entity.id
  });
  assert(orderClientField && orderClientField.type === 'relation', 'Создание relation поля');
  const relations = schemaSvc.listRelations(project.id);
  assert(relations.length >= 1, 'Список связей');

  section('Permissions');
  const tablePerms = permSvc.getTablePermissions(entity.id);
  assert(tablePerms.length >= 1, 'Table permissions created');
  const adminPerm = tablePerms.find(p => p.role_id === adminRole.id);
  assert(adminPerm && adminPerm.can_create && adminPerm.can_read && adminPerm.can_update && adminPerm.can_delete, 'Admin full access');

  section('Runtime CRUD');
  const ctx = { user: adminUser, projectId: project.id, mode: 'desktop' };
  const record1 = runtimeSvc.createRecord(ctx, entity.id, {
    full_name: 'Иванов Иван', email: 'ivan@test.com', age: 30, is_active: 1, status: 'Новый'
  });
  assert(record1 && record1.id, 'Создание записи');

  const record2 = runtimeSvc.createRecord(ctx, entity.id, {
    full_name: 'Петрова Мария', email: 'maria@test.com', age: 25, is_active: 1, status: 'Активный'
  });
  assert(record2 && record2.id, 'Создание второй записи');

  const listResult = runtimeSvc.listRecords(ctx, entity.id, { page: 1, pageSize: 10 });
  assert(listResult.total === 2, 'Список записей (count)');
  assert(listResult.records.length === 2, 'Список записей (records)');

  const gotRecord = runtimeSvc.getRecord(ctx, entity.id, record1.id);
  assert(gotRecord.full_name === 'Иванов Иван', 'Получение записи');

  const updated = runtimeSvc.updateRecord(ctx, entity.id, record1.id, { full_name: 'Иванов Иван Петрович' });
  assert(updated.full_name === 'Иванов Иван Петрович', 'Обновление записи');

  runtimeSvc.deleteRecord(ctx, entity.id, record2.id);
  const afterDelete = runtimeSvc.listRecords(ctx, entity.id, {});
  assert(afterDelete.total === 1, 'Удаление записи');

  section('Search / Sort / Pagination');
  runtimeSvc.createRecord(ctx, entity.id, { full_name: 'Сидоров Сидор', email: 'sidor@test.com', age: 40, status: 'Закрыт' });
  runtimeSvc.createRecord(ctx, entity.id, { full_name: 'Козлова Анна', email: 'anna@test.com', age: 22, status: 'Новый' });

  const searchResult = runtimeSvc.listRecords(ctx, entity.id, { search: 'Сидоров' });
  assert(searchResult.records.some(r => r.full_name.includes('Сидоров')), 'Поиск по тексту');

  const sortedResult = runtimeSvc.listRecords(ctx, entity.id, { sortField: 'age', sortDir: 'asc' });
  assert(sortedResult.records[0].age <= sortedResult.records[sortedResult.records.length - 1].age, 'Сортировка');

  const pageResult = runtimeSvc.listRecords(ctx, entity.id, { page: 1, pageSize: 2 });
  assert(pageResult.records.length <= 2, 'Пагинация');
  assert(pageResult.totalPages >= 1, 'Пагинация totalPages');

  const filterResult = runtimeSvc.listRecords(ctx, entity.id, {
    filters: [{ field: 'status', op: 'eq', value: 'Новый' }]
  });
  assert(filterResult.records.every(r => r.status === 'Новый'), 'Фильтрация');

  section('Relation options');
  schemaSvc.updateEntity(entity.id, { display_field_id: nameField.id });
  const relOpts = runtimeSvc.relationOptions(ctx, entity.id);
  assert(relOpts.length >= 1, 'Relation options');
  assert(relOpts[0].display, 'Relation display value');

  section('Excel Import (dry-run)');
  // Create a test Excel file
  const XLSX = require('xlsx');
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ['ФИО', 'Email', 'Возраст', 'Статус'],
    ['Тестов Тест', 'test1@mail.com', 28, 'Новый'],
    ['Тестова Тестова', 'test2@mail.com', 35, 'Активный'],
  ]);
  XLSX.utils.book_append_sheet(wb, ws, 'Лист1');
  const testExcelPath = path.join(testDir, 'test.xlsx');
  XLSX.writeFile(wb, testExcelPath);

  const preview = importSvc.previewExcel(testExcelPath);
  assert(preview.headers.length === 4, 'Preview headers');
  assert(preview.previewRows.length === 2, 'Preview rows');

  const autoMap = importSvc.autoMapping(preview.headers, entity.id);
  // Manual mapping since auto may not work with Russian headers
  const mapping = { full_name: 0, email: 1, age: 2, status: 3 };

  const dryResult = importSvc.runEntityImport(ctx, entity.id, testExcelPath, {
    mapping, dryRun: true, dataStartRow: 2, trimSpaces: true,
  });
  assert(dryResult.imported === 2, 'Dry-run import count');

  const runResult = importSvc.runEntityImport(ctx, entity.id, testExcelPath, {
    mapping, dryRun: false, dataStartRow: 2, trimSpaces: true,
  });
  assert(runResult.imported === 2, 'Real import count');
  const afterImport = runtimeSvc.listRecords(ctx, entity.id, {});
  assert(afterImport.total >= 5, 'Records after import');

  section('ER / SQL Export');
  const sql = exportSvc.generateSql(project.id);
  assert(sql.includes('CREATE TABLE'), 'SQL export contains CREATE TABLE');
  assert(sql.includes('clients'), 'SQL export contains entity name');

  const erSvg = exportSvc.generateErSvg(project.id);
  assert(erSvg.includes('<svg'), 'ER SVG generated');
  assert(erSvg.includes('Клиенты'), 'ER SVG contains entity title');

  section('Project Export');
  const exportDir = path.join(testDir, 'export_test');
  exportSvc.exportProject(project.id, exportDir);
  assert(fs.existsSync(path.join(exportDir, 'project.config.json')), 'project.config.json exists');
  assert(fs.existsSync(path.join(exportDir, 'schema.sql')), 'schema.sql exists');
  assert(fs.existsSync(path.join(exportDir, 'ER.svg')), 'ER.svg exists');
  assert(fs.existsSync(path.join(exportDir, 'README.md')), 'README.md exists');

  section('Template project');
  const tplProject = projectsSvc.create({ title: 'Курсы', template_code: 'courses' });
  const tplEntities = schemaSvc.listEntities(tplProject.id);
  assert(tplEntities.some(e => e.name === 'courses'), 'Template: courses entity');
  assert(tplEntities.some(e => e.name === 'requests'), 'Template: requests entity');
  assert(tplEntities.some(e => e.name === 'reviews'), 'Template: reviews entity');

  section('Delete project');
  projectsSvc.delete(project.id);
  const afterDel = projectsSvc.list();
  assert(!afterDel.find(p => p.id === project.id), 'Проект удалён');

  closeDb();

  console.log(`\n=============================`);
  console.log(`Результат: ${passed} пройдено, ${failed} провалено`);
  console.log(`=============================`);

  // Cleanup
  try { fs.rmSync(testDir, { recursive: true }); } catch {}

  process.exit(failed > 0 ? 1 : 0);
} catch (e) {
  console.error('Fatal error:', e);
  closeDb();
  try { fs.rmSync(testDir, { recursive: true }); } catch {}
  process.exit(1);
}
