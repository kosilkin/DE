'use strict';

const { now } = require('../utils/dates');
const { ValidationError, PermissionError } = require('../utils/errors');
const { validateFieldValue } = require('../validators/fieldValidators');

class ImportService {
  constructor(db, repos, permissionsService) {
    this.db = db;
    this.entities = repos.entities;
    this.fields = repos.fields;
    this.permissions = repos.permissions;
    this.runtime = repos.runtime;
    this.permSvc = permissionsService;
  }

  previewExcel(filePath, opts = {}) {
    const XLSX = require('xlsx');
    const workbook = XLSX.readFile(filePath);
    const sheetNames = workbook.SheetNames;
    const sheetName = opts.sheet || sheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) throw new ValidationError(`Лист "${sheetName}" не найден`);

    const headerRow = opts.headerRow || 1;
    const dataStartRow = opts.dataStartRow || 2;
    const hasHeaders = opts.hasHeaders !== false;

    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    const headers = hasHeaders ? (data[headerRow - 1] || []).map(h => String(h).trim()) : [];
    const previewRows = data.slice(dataStartRow - 1, dataStartRow - 1 + 20);

    return { sheetNames, sheetName, headers, previewRows, totalRows: data.length - (dataStartRow - 1) };
  }

  checkEntityImport(entityId, mapping, previewData) {
    const fields = this.fields.listByEntity(entityId);
    const fieldMap = {};
    for (const f of fields) fieldMap[f.name] = f;

    const report = { valid: 0, errors: [] };

    for (let i = 0; i < previewData.length; i++) {
      const row = previewData[i];
      const rowErrors = [];
      for (const [fieldName, colIndex] of Object.entries(mapping)) {
        const field = fieldMap[fieldName];
        if (!field) continue;
        const val = row[colIndex] !== undefined ? row[colIndex] : '';
        const errs = validateFieldValue(val, field);
        rowErrors.push(...errs.map(e => `Строка ${i + 1}: ${e}`));
      }
      if (rowErrors.length) {
        report.errors.push(...rowErrors);
      } else {
        report.valid++;
      }
    }

    return report;
  }

  runEntityImport(ctx, entityId, filePath, opts) {
    const entity = this.entities.getById(entityId);
    if (!entity) throw new ValidationError('Таблица не найдена');

    if (ctx.user && ctx.user.role_id) {
      const perm = this.permissions.getTablePermission(entityId, ctx.user.role_id);
      if (!perm || !perm.can_import) throw new PermissionError('Нет прав на импорт');
    }

    const XLSX = require('xlsx');
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[opts.sheet || workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    const dataStartRow = opts.dataStartRow || 2;
    const mapping = opts.mapping || {};
    const trimSpaces = opts.trimSpaces !== false;
    const dryRun = opts.dryRun === true;

    const fields = this.fields.listByEntity(entityId);
    const fieldMap = {};
    for (const f of fields) fieldMap[f.name] = f;

    if (!mapping || Object.keys(mapping).length === 0) {
      throw new ValidationError('Не указано соответствие полей (маппинг пуст)');
    }

    const results = { imported: 0, skipped: 0, errors: [] };
    const rows = data.slice(dataStartRow - 1);

    const ownerField = entity.owner_field_id ? this.fields.getById(entity.owner_field_id) : null;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      // Skip completely empty rows
      const isEmptyRow = !row || row.every(cell => cell === '' || cell === null || cell === undefined);
      if (isEmptyRow) {
        results.skipped++;
        continue;
      }

      const record = {};
      const rowErrors = [];
      let hasAnyValue = false;

      for (const [fieldName, colIndex] of Object.entries(mapping)) {
        const field = fieldMap[fieldName];
        if (!field) continue;
        let val = row[colIndex] !== undefined ? row[colIndex] : '';
        if (trimSpaces && typeof val === 'string') val = val.trim();

        const errs = validateFieldValue(val, field);
        if (errs.length) {
          rowErrors.push(...errs.map(e => `Строка ${i + 1}: ${e}`));
          continue;
        }

        if (val !== '' && val !== null && val !== undefined) {
          if (field.type === 'boolean') val = val ? 1 : 0;
          record[fieldName] = val;
          hasAnyValue = true;
        }
      }

      // Skip rows where all mapped values are empty
      if (!hasAnyValue && rowErrors.length === 0) {
        results.skipped++;
        continue;
      }

      if (ownerField && ctx.user) {
        record[ownerField.name] = ctx.user.id;
      }

      if (rowErrors.length) {
        results.errors.push(...rowErrors);
        results.skipped++;
        continue;
      }

      if (!dryRun) {
        const ts = now();
        record.created_at = ts;
        record.updated_at = ts;
        try {
          this.runtime.insertRecord(entity.project_id, entity.name, record);
          results.imported++;
        } catch (err) {
          results.errors.push(`Строка ${i + 1}: ${err.message}`);
          results.skipped++;
        }
      } else {
        results.imported++;
      }
    }

    return results;
  }

  autoMapping(headers, entityId) {
    const fields = this.fields.listByEntity(entityId);
    const mapping = {};
    for (const field of fields) {
      const idx = headers.findIndex(h =>
        h.toLowerCase() === field.name.toLowerCase() ||
        h.toLowerCase() === field.title.toLowerCase()
      );
      if (idx !== -1) mapping[field.name] = idx;
    }
    return mapping;
  }
}

module.exports = ImportService;
