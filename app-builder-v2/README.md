# app-builder-v2

Конструктор учебных информационных систем — полноценное desktop-приложение на Electron.

## Что это

Desktop-приложение для создания и управления учебными информационными системами. Позволяет:

- Создавать проекты (пустые или по шаблону)
- Проектировать структуру данных (таблицы, поля, связи)
- Настраивать роли и права доступа
- Работать с данными в пользовательском режиме (CRUD, поиск, фильтры, сортировка)
- Импортировать данные из Excel
- Экспортировать проект, SQL-схему и ER-диаграмму

## Технологии

- **Electron** — desktop оболочка
- **SQLite** (better-sqlite3) — локальная база данных
- **HTML/CSS/JS** — frontend без фреймворков
- **IPC** — общение между процессами (без Express, без localhost)

## Запуск

```bash
cd app-builder-v2
npm install
npm start
```

`npm start` запускает Electron-приложение. Не поднимает HTTP-сервер.

## Сборка Windows

```bash
npm run build:win
```

## Где хранятся данные

В папке `userData` Electron (обычно `%APPDATA%/app-builder-v2/` на Windows).  
Файл БД: `appbuilder.db`

## Тесты

```bash
npm run test:smoke    # Backend/service smoke tests
npm run test:desktop  # Проверка архитектуры Electron
npm run test:ui       # UI-тесты (Playwright)
```

## Архитектура

- **Electron main process**: `desktop/main.js` — создаёт окно, запускает миграции, регистрирует IPC
- **Preload**: `desktop/preload.js` — безопасный `window.appApi` через contextBridge
- **IPC handlers**: `desktop/ipc/*.ipc.js` — namespace:method формат
- **Services**: `src/services/*.service.js` — бизнес-логика (без зависимости от Electron)
- **Repositories**: `src/repositories/*.repo.js` — доступ к БД
- **Frontend**: `public/` — модульный HTML/CSS/JS

Подробнее: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## Функции MVP

| Функция | Статус |
|---------|--------|
| Проекты (CRUD) | Готово |
| Шаблоны проектов | Готово |
| Таблицы/сущности | Готово |
| Поля (все типы) | Готово |
| Связи (relations) | Готово |
| Роли | Готово |
| Пользователи/авторизация | Готово |
| Права на таблицы | Готово |
| Права на поля | Готово |
| Owner field | Готово |
| Runtime CRUD | Готово |
| Поиск / фильтры / сортировка | Готово |
| Пагинация | Готово |
| Excel import | Готово |
| ER-диаграмма | Готово |
| SQL export | Готово |
| Project export | Готово |
| Action registry | Готово |
| Smoke tests | Готово |

## Не входит в MVP

- Экспорт в 1С
- Экспорт решения для ДЭ
- Импорт ролей/пользователей
- Import profiles
- Image fields
- Business rules UI
- Audit log
- Cloud mode
- Multi-user network mode
- Visual scripting
- .dt / .cf форматы

## Учётные данные по умолчанию

При создании проекта автоматически создаётся:
- **Логин**: `Admin`
- **Пароль**: `KorokNET`

## Ограничения

- Удаление полей — логическое (через delete из метаданных, физический столбец остаётся в SQLite)
- Изменение типа поля не поддерживается в MVP
- SHA-256 для хэширования паролей (для учебных целей)
- Нет RBAC кеширования — права проверяются при каждом запросе
