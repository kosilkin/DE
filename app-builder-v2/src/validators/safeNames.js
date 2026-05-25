'use strict';

const RESERVED = new Set([
  'id', 'created_at', 'updated_at', 'select', 'from', 'where',
  'insert', 'update', 'delete', 'table', 'index', 'create', 'drop',
  'alter', 'group', 'order', 'by', 'join', 'on', 'and', 'or', 'not',
  'null', 'true', 'false', 'primary', 'key', 'foreign', 'references',
  'default', 'check', 'unique', 'constraint', 'values', 'into', 'set',
]);

const NAME_RE = /^[a-z][a-z0-9_]{0,62}$/;

function isValidName(name) {
  return NAME_RE.test(name) && !RESERVED.has(name);
}

function validateName(name, label) {
  if (!name || typeof name !== 'string') {
    return `${label}: имя обязательно`;
  }
  if (!NAME_RE.test(name)) {
    return `${label}: допустимы только латинские буквы, цифры и _, начинается с буквы`;
  }
  if (RESERVED.has(name)) {
    return `${label}: "${name}" — зарезервированное слово`;
  }
  return null;
}

module.exports = { isValidName, validateName, RESERVED };
