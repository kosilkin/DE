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
    return 'npx electron';
  }

  _createWindowsLauncher(outputDir, title, appDir, electronPath, envVars) {
    // Create a VBScript wrapper that launches Electron without showing a console window
    const envLines = Object.entries(envVars)
      .map(([k, v]) => `WshShell.Environment("Process").Item("${k}") = "${v}"`)
      .join('\r\n');

    const vbsContent = `Set WshShell = CreateObject("WScript.Shell")\r\n${envLines}\r\nWshShell.CurrentDirectory = "${appDir.replace(/\\/g, '\\\\')}"\r\nWshShell.Run """${electronPath.replace(/\\/g, '\\\\')}"" .", 0, False\r\n`;
    const vbsPath = path.join(outputDir, `${title}.vbs`);
    fs.writeFileSync(vbsPath, vbsContent);

    // Create .lnk shortcut via PowerShell script
    const ps1Content = `$WshShell = New-Object -ComObject WScript.Shell\r\n$Shortcut = $WshShell.CreateShortcut("${path.join(outputDir, title + '.lnk').replace(/\\/g, '\\\\')}")\r\n$Shortcut.TargetPath = "wscript.exe"\r\n$Shortcut.Arguments = """${vbsPath.replace(/\\/g, '\\\\')}"""\r\n$Shortcut.WorkingDirectory = "${appDir.replace(/\\/g, '\\\\')}"\r\n$Shortcut.Description = "${title}"\r\n$Shortcut.Save()\r\n`;
    const ps1Path = path.join(outputDir, '_create_shortcut.ps1');
    fs.writeFileSync(ps1Path, ps1Content);

    // Also create a simple .bat as fallback
    const batEnv = Object.entries(envVars).map(([k, v]) => `set ${k}=${v}`).join('\r\n');
    const batContent = `@echo off\r\ntitle ${title}\r\ncd /d "${appDir}"\r\n${batEnv}\r\n"${electronPath}" .\r\n`;
    fs.writeFileSync(path.join(outputDir, `${title}.bat`), batContent);

    return path.join(outputDir, `${title}.bat`);
  }
}

module.exports = ExportService;
