# Архитектура app-builder-v2

## Принципы

- **Electron-first**: это desktop-приложение, не сайт и не обёртка над localhost
- **IPC-first**: всё общение между renderer и main process идёт через Electron IPC
- **Без Express**: npm start запускает Electron, не поднимает HTTP-сервер
- **SQLite**: все данные хранятся локально
- **Модульный frontend**: HTML/CSS/JS без React/Vue, но с чётким разделением на модули

## Структура

```
app-builder-v2/
├── desktop/              # Electron main process
│   ├── main.js           # Точка входа: BrowserWindow, миграции, IPC
│   ├── preload.js        # contextBridge → window.appApi
│   ├── protocols.js      # app:// протокол
│   └── ipc/              # IPC handlers по namespace
│       ├── projects.ipc.js
│       ├── entities.ipc.js
│       ├── fields.ipc.js
│       ├── roles.ipc.js
│       ├── auth.ipc.js
│       ├── permissions.ipc.js
│       ├── runtime.ipc.js
│       ├── import.ipc.js
│       ├── export.ipc.js
│       └── maintenance.ipc.js
├── src/                  # Backend logic (без зависимости от Electron)
│   ├── db/               # SQLite connection, migrations
│   ├── repositories/     # Доступ к данным
│   ├── services/         # Бизнес-логика
│   ├── validators/       # Валидация
│   └── utils/            # Утилиты
├── public/               # Frontend (renderer process)
│   ├── index.html
│   └── assets/
│       ├── css/
│       └── js/
│           ├── core/     # Ядро: DOM, actions, notifications, state views
│           ├── shell/    # App shell, start screen, designer/runtime shells
│           ├── designer/ # Экраны конструктора
│           └── runtime/  # Экраны пользовательского режима
├── scripts/              # Тесты
└── docs/
```

## База данных

### Системные таблицы
- `schema_migrations` — трекинг миграций
- `projects` — проекты
- `entities` — таблицы (сущности)
- `fields` — поля таблиц
- `relations` — связи между таблицами
- `roles` — роли
- `users` — пользователи
- `table_permissions` — права на таблицы
- `field_permissions` — права на поля
- `rules` — правила (создано, но UI не в MVP)
- `import_profiles` — профили импорта (создано, но UI не в MVP)

### Физические таблицы данных
Формат имени: `p{projectId}_{entityName}`  
Обязательные колонки: `id`, `created_at`, `updated_at`

## IPC API

Каждый namespace имеет свой IPC handler.  
Формат канала: `namespace:method`  
Пример: `projects:list`, `runtime:createRecord`

Ответ всегда:
```json
{ "ok": true, "data": ... }
// или
{ "ok": false, "error": { "code": "...", "message": "...", "details": ... } }
```

## Сервисы

Сервисы не зависят от Electron. Принимают context:
```json
{ "user": {...}, "projectId": 1, "mode": "desktop" }
```

Типизированные ошибки: `ValidationError`, `PermissionError`, `NotFoundError`, `ConflictError`.

## Frontend

Модульная архитектура на vanilla JS:
- `Actions` — реестр действий, привязка через `data-action`
- `StateViews` — loading / empty / error / no-access состояния
- `Notifications` — всплывающие уведомления
- `DOM` — утилиты для работы с DOM

## Безопасность

- `contextIsolation: true`
- `nodeIntegration: false`
- Renderer не имеет доступа к `fs`
- `ipcRenderer` не expose напрямую
- Пароли хранятся как SHA-256 hash
- Права проверяются на backend (в services)

## Планы на будущие этапы

### Этап 2
- Field permissions UI
- Audit log
- Расширенная валидация
- Import profiles

### Этап 3
- Экспорт решения для ДЭ
- Экспорт в 1С
- Cloud mode
- Multi-user mode

## Тестирование

- `npm run test:smoke` — backend/service smoke tests
- `npm run test:ui` — проверка структуры UI (Playwright)
- `npm run test:desktop` — проверка Electron-архитектуры
