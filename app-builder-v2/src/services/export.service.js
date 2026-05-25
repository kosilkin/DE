'use strict';

const { physicalTableName, sqlTypeFor } = require('../db/schema');
const fs = require('fs');
const path = require('path');

class ExportService {
  constructor(db, repos) {
    this.db = db;
    this.entities = repos.entities;
    this.fields = repos.fields;
    this.runtime = repos.runtime;
    this.projects = repos.projects;
    this.roles = repos.roles;
    this.users = repos.users;
  }

  generateSql(projectId) {
    const entities = this.entities.listByProject(projectId);
    const lines = [];

    for (const entity of entities) {
      const fields = this.fields.listByEntity(entity.id);
      const tbl = physicalTableName(projectId, entity.name);
      lines.push(`-- ${entity.title}`);
      lines.push(`CREATE TABLE ${tbl} (`);
      lines.push('  id INTEGER PRIMARY KEY AUTOINCREMENT,');

      const colDefs = [];
      for (const field of fields) {
        let def = `  ${field.name} ${sqlTypeFor(field.type)}`;
        if (field.required) def += ' NOT NULL';
        if (field.unique_value) def += ' UNIQUE';
        if (field.default_value !== null && field.default_value !== undefined && field.default_value !== '') {
          def += ` DEFAULT '${field.default_value}'`;
        }
        colDefs.push(def);
      }
      colDefs.push('  created_at TEXT NOT NULL');
      colDefs.push('  updated_at TEXT NOT NULL');
      lines.push(colDefs.join(',\n'));
      lines.push(');');
      lines.push('');

      const relations = this.db.prepare(
        'SELECT r.*, f.name as field_name FROM relations r JOIN fields f ON r.source_field_id = f.id WHERE r.source_entity_id = ?'
      ).all(entity.id);

      for (const rel of relations) {
        const targetEntity = this.entities.getById(rel.target_entity_id);
        if (targetEntity) {
          const targetTbl = physicalTableName(projectId, targetEntity.name);
          lines.push(`-- FK: ${tbl}.${rel.field_name} -> ${targetTbl}.id`);
        }
      }

      for (const field of fields) {
        if (field.unique_value) {
          lines.push(`CREATE UNIQUE INDEX idx_${tbl}_${field.name} ON ${tbl}(${field.name});`);
        }
        if (field.type === 'relation') {
          lines.push(`CREATE INDEX idx_${tbl}_${field.name} ON ${tbl}(${field.name});`);
        }
      }

      lines.push('');
    }

    return lines.join('\n');
  }

  generateErSvg(projectId) {
    const entities = this.entities.listByProject(projectId);
    const relations = this.db.prepare(
      `SELECT r.*, se.name as src_name, se.title as src_title, sf.name as field_name,
              te.name as tgt_name, te.title as tgt_title
       FROM relations r
       JOIN entities se ON r.source_entity_id = se.id
       JOIN fields sf ON r.source_field_id = sf.id
       JOIN entities te ON r.target_entity_id = te.id
       WHERE se.project_id = ?`
    ).all(projectId);

    const boxW = 200;
    const boxH = 40;
    const fieldH = 22;
    const gapX = 280;
    const gapY = 40;
    const cols = Math.max(1, Math.ceil(Math.sqrt(entities.length)));

    const entityPositions = {};
    const entityBoxes = [];

    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      const fields = this.fields.listByEntity(entity.id);
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = 30 + col * gapX;
      const y = 30 + row * (boxH + 10 * fieldH + gapY);
      const h = boxH + fields.length * fieldH + 10;
      entityPositions[entity.id] = { x, y, w: boxW, h };
      entityBoxes.push({ entity, fields, x, y, w: boxW, h });
    }

    const svgW = 30 + cols * gapX + 50;
    const maxRow = Math.ceil(entities.length / cols);
    const svgH = 30 + maxRow * (boxH + 10 * fieldH + gapY) + 50;

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" style="background:#fff;font-family:sans-serif;font-size:12px">\n`;

    for (const rel of relations) {
      const src = entityPositions[rel.source_entity_id];
      const tgt = entityPositions[rel.target_entity_id];
      if (!src || !tgt) continue;
      const x1 = src.x + src.w;
      const y1 = src.y + src.h / 2;
      const x2 = tgt.x;
      const y2 = tgt.y + tgt.h / 2;
      svg += `  <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#666" stroke-width="1" marker-end="url(#arrow)"/>\n`;
    }

    svg += `  <defs><marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#666"/></marker></defs>\n`;

    for (const box of entityBoxes) {
      const { entity, fields, x, y, w, h } = box;
      svg += `  <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#f8f9fa" stroke="#333" rx="4"/>\n`;
      svg += `  <rect x="${x}" y="${y}" width="${w}" height="${boxH}" fill="#4a90d9" stroke="#333" rx="4"/>\n`;
      svg += `  <text x="${x + w / 2}" y="${y + 25}" text-anchor="middle" fill="#fff" font-weight="bold">${entity.title}</text>\n`;

      svg += `  <text x="${x + 8}" y="${y + boxH + 16}" fill="#888" font-size="10">id INTEGER PK</text>\n`;
      for (let fi = 0; fi < fields.length; fi++) {
        const f = fields[fi];
        const fy = y + boxH + 16 + (fi + 1) * fieldH;
        let label = `${f.name} ${f.type}`;
        if (f.required) label += ' *';
        if (f.unique_value) label += ' U';
        svg += `  <text x="${x + 8}" y="${fy}" fill="#333">${label}</text>\n`;
      }
    }

    svg += '</svg>';
    return svg;
  }

  async exportProject(projectId, outputDir) {
    const project = this.projects.getById(projectId);
    if (!project) throw new Error('Проект не найден');

    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    const dataDir = path.join(outputDir, 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

    const entities = this.entities.listByProject(projectId);
    const entitiesWithFields = entities.map(e => ({
      ...e,
      fields: this.fields.listByEntity(e.id)
    }));

    const config = {
      project: { title: project.title, description: project.description, template_code: project.template_code },
      entities: entitiesWithFields,
      roles: this.roles.listByProject(projectId),
      relations: this.db.prepare(
        `SELECT r.* FROM relations r JOIN entities e ON r.source_entity_id = e.id WHERE e.project_id = ?`
      ).all(projectId),
    };

    fs.writeFileSync(path.join(outputDir, 'project.config.json'), JSON.stringify(config, null, 2));

    const sql = this.generateSql(projectId);
    fs.writeFileSync(path.join(outputDir, 'schema.sql'), sql);

    const er = this.generateErSvg(projectId);
    fs.writeFileSync(path.join(outputDir, 'ER.svg'), er);

    for (const entity of entities) {
      if (this.runtime.tableExists(projectId, entity.name)) {
        const records = this.runtime.listRecords(projectId, entity.name, {
          orderBy: 'id ASC', limit: 100000, offset: 0
        });
        fs.writeFileSync(path.join(dataDir, `${entity.name}.json`), JSON.stringify(records, null, 2));
      }
    }

    const readme = `# ${project.title}\n\n${project.description || ''}\n\nЭкспортировано: ${new Date().toISOString()}\n`;
    fs.writeFileSync(path.join(outputDir, 'README.md'), readme);

    // Create launch shortcut
    this._createShortcut(outputDir, project);

    return outputDir;
  }

  exportProjectDev(projectId, filePath) {
    const project = this.projects.getById(projectId);
    if (!project) throw new Error('Проект не найден');

    const entities = this.entities.listByProject(projectId);
    const entitiesData = entities.map(e => ({
      ...e,
      fields: this.fields.listByEntity(e.id)
    }));

    const relations = this.db.prepare(
      `SELECT r.* FROM relations r JOIN entities e ON r.source_entity_id = e.id WHERE e.project_id = ?`
    ).all(projectId);

    const roles = this.roles.listByProject(projectId);
    const users = this.users.listByProject(projectId);

    const tablePermissions = [];
    const fieldPermissions = [];
    for (const entity of entities) {
      for (const role of roles) {
        const tp = this.db.prepare('SELECT * FROM table_permissions WHERE entity_id = ? AND role_id = ?').get(entity.id, role.id);
        if (tp) tablePermissions.push(tp);
        const fps = this.db.prepare(
          'SELECT fp.* FROM field_permissions fp JOIN fields f ON fp.field_id = f.id WHERE f.entity_id = ? AND fp.role_id = ?'
        ).all(entity.id, role.id);
        fieldPermissions.push(...fps);
      }
    }

    const data = {};
    for (const entity of entities) {
      if (this.runtime.tableExists(projectId, entity.name)) {
        data[entity.name] = this.runtime.listRecords(projectId, entity.name, {
          orderBy: 'id ASC', limit: 100000, offset: 0
        });
      }
    }

    const exportData = {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      project: { title: project.title, description: project.description, template_code: project.template_code, login_enabled: project.login_enabled },
      entities: entitiesData,
      relations,
      roles,
      users,
      tablePermissions,
      fieldPermissions,
      data,
    };

    fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2));
    return filePath;
  }

  importProjectDev(filePath, projectsService) {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const imp = JSON.parse(raw);
    if (!imp.project || !imp.entities) throw new Error('Неверный формат файла экспорта');

    const { now } = require('../utils/dates');
    const ts = now();

    // Create project
    const project = projectsService.create({
      title: imp.project.title + ' (импорт)',
      description: imp.project.description || '',
      template_code: '',
    });

    // Update login_enabled if present
    if (imp.project.login_enabled !== undefined) {
      this.projects.update(project.id, { login_enabled: imp.project.login_enabled, updated_at: ts });
    }

    // ID mapping: old -> new
    const entityMap = {};
    const fieldMap = {};
    const roleMap = {};

    // Map existing roles
    const existingRoles = this.roles.listByProject(project.id);
    for (const er of existingRoles) {
      const matching = (imp.roles || []).find(r => r.code === er.code);
      if (matching) roleMap[matching.id] = er.id;
    }

    // Create additional roles
    for (const role of (imp.roles || [])) {
      if (roleMap[role.id]) continue;
      try {
        const newRole = this.roles.create({
          project_id: project.id, code: role.code, title: role.title,
          description: role.description || '', is_system: role.is_system ? 1 : 0,
          sort_order: role.sort_order || 0, created_at: ts, updated_at: ts
        });
        roleMap[role.id] = newRole.id;
      } catch { /* duplicate code, skip */ }
    }

    // Delete template entities (created by projectsService.create)
    const templateEntities = this.entities.listByProject(project.id);
    for (const te of templateEntities) {
      try {
        this.runtime.dropPhysicalTable(project.id, te.name);
        this.entities.delete(te.id);
      } catch {}
    }

    // Create entities and fields
    const { sqlTypeFor } = require('../db/schema');
    for (const entityData of (imp.entities || [])) {
      const entity = this.entities.create({
        project_id: project.id, name: entityData.name, title: entityData.title,
        description: entityData.description || '', kind: entityData.kind || 'user',
        sort_order: entityData.sort_order || 0, created_at: ts, updated_at: ts
      });
      entityMap[entityData.id] = entity.id;

      this.runtime.createPhysicalTable(project.id, entityData.name, []);

      for (const fieldData of (entityData.fields || [])) {
        const field = this.fields.create({
          entity_id: entity.id, name: fieldData.name, title: fieldData.title,
          type: fieldData.type, required: fieldData.required ? 1 : 0,
          unique_value: fieldData.unique_value ? 1 : 0,
          default_value: fieldData.default_value || null,
          options_json: fieldData.options_json || null,
          validation_json: fieldData.validation_json || null,
          is_system: fieldData.is_system ? 1 : 0,
          sort_order: fieldData.sort_order || 0, created_at: ts, updated_at: ts
        });
        fieldMap[fieldData.id] = field.id;

        this.runtime.addColumn(project.id, entityData.name, {
          name: fieldData.name, sqlType: sqlTypeFor(fieldData.type),
          defaultValue: fieldData.type === 'boolean' ? '0' : undefined
        });

        if (fieldData.unique_value) {
          this.runtime.createIndex(project.id, entityData.name, fieldData.name, true);
        }
        if (fieldData.type === 'relation') {
          this.runtime.createIndex(project.id, entityData.name, fieldData.name, false);
        }
      }

      // Set display/owner fields
      if (entityData.display_field_id && fieldMap[entityData.display_field_id]) {
        this.entities.update(entity.id, { display_field_id: fieldMap[entityData.display_field_id], updated_at: ts });
      }
      if (entityData.owner_field_id && fieldMap[entityData.owner_field_id]) {
        this.entities.update(entity.id, { owner_field_id: fieldMap[entityData.owner_field_id], updated_at: ts });
      }
    }

    // Create relations
    for (const rel of (imp.relations || [])) {
      const srcEntity = entityMap[rel.source_entity_id];
      const srcField = fieldMap[rel.source_field_id];
      const tgtEntity = entityMap[rel.target_entity_id];
      const tgtDisplay = rel.target_display_field_id ? fieldMap[rel.target_display_field_id] : null;
      if (srcEntity && srcField && tgtEntity) {
        this.db.prepare(
          `INSERT INTO relations (source_entity_id, source_field_id, target_entity_id, target_display_field_id, on_delete_policy, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run(srcEntity, srcField, tgtEntity, tgtDisplay, rel.on_delete_policy || 'restrict', ts, ts);
      }
    }

    // Import table permissions
    for (const tp of (imp.tablePermissions || [])) {
      const entityId = entityMap[tp.entity_id];
      const roleId = roleMap[tp.role_id];
      if (entityId && roleId) {
        try {
          this.db.prepare('SELECT * FROM table_permissions WHERE entity_id = ? AND role_id = ?').get(entityId, roleId);
          this.db.prepare(
            `INSERT OR REPLACE INTO table_permissions (entity_id, role_id, can_create, can_read, can_update, can_delete, can_import, can_export, read_scope, update_scope, delete_scope, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).run(entityId, roleId, tp.can_create, tp.can_read, tp.can_update, tp.can_delete, tp.can_import, tp.can_export, tp.read_scope, tp.update_scope, tp.delete_scope, ts, ts);
        } catch {}
      }
    }

    // Import field permissions
    for (const fp of (imp.fieldPermissions || [])) {
      const fieldId = fieldMap[fp.field_id];
      const roleId = roleMap[fp.role_id];
      if (fieldId && roleId) {
        try {
          this.db.prepare(
            `INSERT OR REPLACE INTO field_permissions (field_id, role_id, can_view, can_create, can_update, show_in_list, show_in_form, mask_policy, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).run(fieldId, roleId, fp.can_view, fp.can_create, fp.can_update, fp.show_in_list, fp.show_in_form, fp.mask_policy || '', ts, ts);
        } catch {}
      }
    }

    // Import users (delete existing template users first, then recreate from export)
    const existingUsers = this.users.listByProject(project.id);
    for (const eu of existingUsers) {
      try { this.users.delete(eu.id); } catch {}
    }
    for (const user of (imp.users || [])) {
      const roleId = roleMap[user.role_id] || null;
      try {
        this.users.create({
          project_id: project.id,
          login: user.login,
          password_hash: user.password_hash,
          full_name: user.full_name || '',
          phone: user.phone || '',
          email: user.email || '',
          role_id: roleId,
          is_active: user.is_active !== undefined ? (user.is_active ? 1 : 0) : 1,
          created_at: ts,
          updated_at: ts,
        });
      } catch {}
    }

    // Build relation field map: entityName -> [{fieldName, targetEntityName}]
    const relationFieldsMap = {};
    for (const rel of (imp.relations || [])) {
      const srcEntityData = (imp.entities || []).find(e => e.id === rel.source_entity_id);
      const tgtEntityData = (imp.entities || []).find(e => e.id === rel.target_entity_id);
      const srcFieldData = srcEntityData ? (srcEntityData.fields || []).find(f => f.id === rel.source_field_id) : null;
      if (srcEntityData && tgtEntityData && srcFieldData) {
        if (!relationFieldsMap[srcEntityData.name]) relationFieldsMap[srcEntityData.name] = [];
        relationFieldsMap[srcEntityData.name].push({ fieldName: srcFieldData.name, targetEntityName: tgtEntityData.name });
      }
    }

    // Import data — two passes: insert records (build old→new ID maps), then remap FK values
    const recordIdMap = {}; // entityName -> {oldId -> newId}
    for (const entityData of (imp.entities || [])) {
      const records = (imp.data || {})[entityData.name];
      if (!records || !records.length) continue;
      recordIdMap[entityData.name] = {};
      for (const rec of records) {
        const oldId = rec.id;
        const cleanRec = {};
        for (const [k, v] of Object.entries(rec)) {
          if (k === 'id') continue;
          cleanRec[k] = v;
        }
        if (!cleanRec.created_at) cleanRec.created_at = ts;
        if (!cleanRec.updated_at) cleanRec.updated_at = ts;
        try {
          const inserted = this.runtime.insertRecord(project.id, entityData.name, cleanRec);
          if (oldId && inserted && inserted.id) {
            recordIdMap[entityData.name][oldId] = inserted.id;
          }
        } catch {}
      }
    }

    // Remap FK values in relation fields
    for (const entityData of (imp.entities || [])) {
      const relFields = relationFieldsMap[entityData.name];
      if (!relFields || !relFields.length) continue;
      const idMap = recordIdMap[entityData.name];
      if (!idMap) continue;
      for (const [oldId, newId] of Object.entries(idMap)) {
        for (const rf of relFields) {
          const targetMap = recordIdMap[rf.targetEntityName];
          if (!targetMap) continue;
          const rec = this.runtime.getRecord(project.id, entityData.name, newId);
          if (!rec || !rec[rf.fieldName]) continue;
          const oldFk = rec[rf.fieldName];
          const newFk = targetMap[oldFk];
          if (newFk && newFk !== oldFk) {
            this.runtime.updateRecord(project.id, entityData.name, newId, { [rf.fieldName]: newFk });
          }
        }
      }
    }

    return project;
  }

  _createShortcut(outputDir, project) {
    const appDir = path.resolve(path.join(__dirname, '..', '..'));
    const electronPath = this._findElectronExe(appDir);
    const isWin = process.platform === 'win32';

    if (isWin) {
      this._createWindowsLauncher(outputDir, project.title, appDir, electronPath, {
        APP_PROJECT_ID: String(project.id),
        APP_RUNTIME_MODE: '1'
      });
    } else {
      const shContent = `#!/bin/bash\ncd "${appDir}"\nAPP_PROJECT_ID=${project.id} APP_RUNTIME_MODE=1 npx electron .\n`;
      const shPath = path.join(outputDir, `${project.title}.sh`);
      fs.writeFileSync(shPath, shContent);
      try { fs.chmodSync(shPath, '755'); } catch {}

      const desktopContent = `[Desktop Entry]\nType=Application\nName=${project.title}\nExec=bash "${shPath}"\nTerminal=false\nCategories=Education;\n`;
      fs.writeFileSync(path.join(outputDir, `${project.title}.desktop`), desktopContent);
      try { fs.chmodSync(path.join(outputDir, `${project.title}.desktop`), '755'); } catch {}
    }
  }

  createAppShortcut(desktopPath) {
    const appDir = path.resolve(path.join(__dirname, '..', '..'));
    const electronPath = this._findElectronExe(appDir);
    const isWin = process.platform === 'win32';

    if (isWin) {
      return this._createWindowsLauncher(desktopPath, 'Конструктор ИС', appDir, electronPath, {});
    } else {
      const shPath = path.join(desktopPath, 'app-builder-v2.sh');
      const shContent = `#!/bin/bash\ncd "${appDir}"\nnpx electron .\n`;
      fs.writeFileSync(shPath, shContent);
      try { fs.chmodSync(shPath, '755'); } catch {}

      const desktopFilePath = path.join(desktopPath, 'Конструктор ИС.desktop');
      const desktopContent = `[Desktop Entry]\nType=Application\nName=Конструктор ИС\nExec=bash "${shPath}"\nTerminal=false\nCategories=Education;\n`;
      fs.writeFileSync(desktopFilePath, desktopContent);
      try { fs.chmodSync(desktopFilePath, '755'); } catch {}
      return desktopFilePath;
    }
  }

  _findElectronExe(appDir) {
    const electronBin = path.join(appDir, 'node_modules', '.bin', 'electron');
    const electronExe = path.join(appDir, 'node_modules', 'electron', 'dist', 'electron.exe');
    if (process.platform === 'win32' && fs.existsSync(electronExe)) return electronExe;
    if (fs.existsSync(electronBin)) return electronBin;
    const npxBin = path.join(appDir, 'node_modules', '.bin', 'npx');
    if (fs.existsSync(npxBin)) return npxBin;
    return null;
  }

  _createWindowsLauncher(outputDir, title, appDir, electronPath, envVars) {
    // Create a VBScript wrapper that launches Electron without showing a console window
    const envLines = Object.entries(envVars)
      .map(([k, v]) => `WshShell.Environment("Process").Item("${k}") = "${v}"`)
      .join('\r\n');

    if (!electronPath) {
      const batEnv = Object.entries(envVars).map(([k, v]) => `set ${k}=${v}`).join('\r\n');
      const batContent = `@echo off\r\ntitle ${title}\r\ncd /d "${appDir}"\r\n${batEnv}\r\nnpx electron .\r\n`;
      fs.writeFileSync(path.join(outputDir, `${title}.bat`), batContent);
      return path.join(outputDir, `${title}.bat`);
    }
    const isNpx = !electronPath.includes('electron.exe') && !electronPath.endsWith('electron');
    const runCmd = isNpx
      ? `"""${electronPath.replace(/\\/g, '\\\\')}"" electron ."`
      : `"""${electronPath.replace(/\\/g, '\\\\')}"" ."`;
    const vbsContent = `Set WshShell = CreateObject("WScript.Shell")\r\n${envLines}\r\nWshShell.CurrentDirectory = "${appDir.replace(/\\/g, '\\\\')}"\r\nWshShell.Run ${runCmd}, 0, False\r\n`;
    const vbsPath = path.join(outputDir, `${title}.vbs`);
    fs.writeFileSync(vbsPath, vbsContent);

    // Create .lnk shortcut via PowerShell script
    const ps1Content = `$WshShell = New-Object -ComObject WScript.Shell\r\n$Shortcut = $WshShell.CreateShortcut("${path.join(outputDir, title + '.lnk').replace(/\\/g, '\\\\')}")\r\n$Shortcut.TargetPath = "wscript.exe"\r\n$Shortcut.Arguments = """${vbsPath.replace(/\\/g, '\\\\')}"""\r\n$Shortcut.WorkingDirectory = "${appDir.replace(/\\/g, '\\\\')}"\r\n$Shortcut.Description = "${title}"\r\n$Shortcut.Save()\r\n`;
    const ps1Path = path.join(outputDir, '_create_shortcut.ps1');
    fs.writeFileSync(ps1Path, ps1Content);

    // Also create a simple .bat as fallback
    const batEnv = Object.entries(envVars).map(([k, v]) => `set ${k}=${v}`).join('\r\n');
    const batCmd = isNpx ? `"${electronPath}" electron .` : `"${electronPath}" .`;
    const batContent = `@echo off\r\ntitle ${title}\r\ncd /d "${appDir}"\r\n${batEnv}\r\n${batCmd}\r\n`;
    fs.writeFileSync(path.join(outputDir, `${title}.bat`), batContent);

    return path.join(outputDir, `${title}.bat`);
  }
}

module.exports = ExportService;
