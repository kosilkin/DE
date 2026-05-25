'use strict';

exports.up = function (db) {
  db.exec(`
    CREATE TABLE projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      template_code TEXT DEFAULT '',
      schema_version INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE entities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      kind TEXT DEFAULT 'user',
      is_system INTEGER DEFAULT 0,
      owner_field_id INTEGER,
      display_field_id INTEGER,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE fields (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      title TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'text',
      required INTEGER DEFAULT 0,
      unique_value INTEGER DEFAULT 0,
      default_value TEXT,
      options_json TEXT,
      validation_json TEXT,
      is_system INTEGER DEFAULT 0,
      is_readonly INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE
    );

    CREATE TABLE relations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_entity_id INTEGER NOT NULL,
      source_field_id INTEGER NOT NULL,
      target_entity_id INTEGER NOT NULL,
      target_display_field_id INTEGER,
      on_delete_policy TEXT DEFAULT 'restrict',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (source_entity_id) REFERENCES entities(id) ON DELETE CASCADE,
      FOREIGN KEY (source_field_id) REFERENCES fields(id) ON DELETE CASCADE,
      FOREIGN KEY (target_entity_id) REFERENCES entities(id) ON DELETE CASCADE
    );

    CREATE TABLE roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      code TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      is_system INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      login TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      email TEXT DEFAULT '',
      role_id INTEGER,
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (role_id) REFERENCES roles(id)
    );

    CREATE TABLE table_permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_id INTEGER NOT NULL,
      role_id INTEGER NOT NULL,
      can_create INTEGER DEFAULT 0,
      can_read INTEGER DEFAULT 0,
      can_update INTEGER DEFAULT 0,
      can_delete INTEGER DEFAULT 0,
      can_import INTEGER DEFAULT 0,
      can_export INTEGER DEFAULT 0,
      read_scope TEXT DEFAULT 'all',
      update_scope TEXT DEFAULT 'all',
      delete_scope TEXT DEFAULT 'all',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE,
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
    );

    CREATE TABLE field_permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      field_id INTEGER NOT NULL,
      role_id INTEGER NOT NULL,
      can_view INTEGER DEFAULT 1,
      can_create INTEGER DEFAULT 1,
      can_update INTEGER DEFAULT 1,
      show_in_list INTEGER DEFAULT 1,
      show_in_form INTEGER DEFAULT 1,
      mask_policy TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (field_id) REFERENCES fields(id) ON DELETE CASCADE,
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
    );

    CREATE TABLE rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      entity_id INTEGER,
      type TEXT NOT NULL,
      title TEXT DEFAULT '',
      config_json TEXT,
      error_message TEXT DEFAULT '',
      enabled INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE
    );

    CREATE TABLE import_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      target_entity_id INTEGER,
      title TEXT DEFAULT '',
      source_type TEXT DEFAULT 'excel',
      structure_json TEXT,
      mapping_json TEXT,
      options_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (target_entity_id) REFERENCES entities(id) ON DELETE CASCADE
    );

    CREATE UNIQUE INDEX idx_entities_project_name ON entities(project_id, name);
    CREATE UNIQUE INDEX idx_fields_entity_name ON fields(entity_id, name);
    CREATE UNIQUE INDEX idx_roles_project_code ON roles(project_id, code);
    CREATE UNIQUE INDEX idx_users_project_login ON users(project_id, login);
    CREATE UNIQUE INDEX idx_table_perm_entity_role ON table_permissions(entity_id, role_id);
    CREATE UNIQUE INDEX idx_field_perm_field_role ON field_permissions(field_id, role_id);
  `);
};
