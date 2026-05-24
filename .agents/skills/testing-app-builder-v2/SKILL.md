---
name: testing-app-builder-v2
description: How to set up, run, and E2E test the app-builder-v2 Electron desktop application.
---

# Testing app-builder-v2

## Setup

```bash
cd app-builder-v2
npm install
npx electron-rebuild   # REQUIRED: rebuilds better-sqlite3 for Electron's Node.js version
```

## Running the app

```bash
DISPLAY=:0 npx electron .   # launch Electron with GUI
```

The app window title is "Конструктор ИС — app-builder v2". Use `wmctrl` to manage the window:
```bash
wmctrl -r "Конструктор ИС" -b add,maximized_vert,maximized_horz
wmctrl -a "Конструктор ИС"
```

## Automated tests

```bash
npm run test:smoke    # 53 backend/service tests
npm run test:desktop  # 85 Electron architecture tests
npm run test:ui       # 7 UI structure tests (Playwright)
```

## Test credentials

- **Admin login:** `Admin`
- **Admin password:** `KorokNET`
- These are local development credentials created automatically when a project is created.

## E2E test flow (GUI)

1. **Start screen:** Shows project list. Click "Создать проект" to create.
2. **Create project:** Enter title, select template ("Курсы и заявки" creates 3 entities). Click "Создать".
3. **Designer:** Click "Конструктор" on project card. Sidebar tabs: Обзор, Структура, Доступ, Данные, Импорт, ER/SQL, Экспорт.
4. **Runtime:** Click "Режим пользователя" → login form (Admin pre-filled) → enter password → see entity list + CRUD table.
5. **CRUD:** Click "Создать запись" → fill form → verify in table. Search, filter, delete.

## Cyrillic text input

The `type` action in computer tool may not work for Cyrillic. Use clipboard instead:
```bash
DISPLAY=:0 echo -n "Текст" | xclip -selection clipboard
```
Then use `ctrl+v` to paste in the GUI.

## Known issues

- `better-sqlite3` must be rebuilt with `npx electron-rebuild` after `npm install` — otherwise Electron crashes with NODE_MODULE_VERSION mismatch.
- D-Bus errors in logs ("Failed to connect to the bus") are harmless and can be ignored.
- GPU errors ("Exiting GPU process") are normal in headless/VM environments.
