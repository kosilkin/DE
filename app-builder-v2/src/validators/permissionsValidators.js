'use strict';

const SCOPES = ['all', 'own', 'none'];

function validateTablePermission(perm) {
  const errors = [];
  if (!perm.entity_id) errors.push('entity_id обязателен');
  if (!perm.role_id) errors.push('role_id обязателен');
  if (perm.read_scope && !SCOPES.includes(perm.read_scope))
    errors.push(`read_scope: допустимые значения: ${SCOPES.join(', ')}`);
  if (perm.update_scope && !SCOPES.includes(perm.update_scope))
    errors.push(`update_scope: допустимые значения: ${SCOPES.join(', ')}`);
  if (perm.delete_scope && !SCOPES.includes(perm.delete_scope))
    errors.push(`delete_scope: допустимые значения: ${SCOPES.join(', ')}`);
  return errors;
}

function validateFieldPermission(perm) {
  const errors = [];
  if (!perm.field_id) errors.push('field_id обязателен');
  if (!perm.role_id) errors.push('role_id обязателен');
  return errors;
}

module.exports = { validateTablePermission, validateFieldPermission, SCOPES };
