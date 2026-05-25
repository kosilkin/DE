'use strict';

const FIELD_TYPE_MAP = {
  text: 'TEXT',
  number: 'REAL',
  date: 'TEXT',
  datetime: 'TEXT',
  boolean: 'INTEGER',
  select: 'TEXT',
  relation: 'INTEGER',
};

function physicalTableName(projectId, entityName) {
  return `p${projectId}_${entityName}`;
}

function sqlTypeFor(fieldType) {
  return FIELD_TYPE_MAP[fieldType] || 'TEXT';
}

module.exports = { FIELD_TYPE_MAP, physicalTableName, sqlTypeFor };
