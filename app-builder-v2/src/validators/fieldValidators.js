'use strict';

function validateFieldValue(value, field) {
  const errors = [];
  if (field.required && (value === null || value === undefined || value === '')) {
    errors.push(`Поле "${field.title}" обязательно для заполнения`);
    return errors;
  }
  if (value === null || value === undefined || value === '') return errors;

  const vj = field.validation_json ? (typeof field.validation_json === 'string' ? JSON.parse(field.validation_json) : field.validation_json) : {};

  switch (field.type) {
    case 'text': {
      const s = String(value);
      if (vj.minLength && s.length < vj.minLength)
        errors.push(`"${field.title}": минимум ${vj.minLength} символов`);
      if (vj.maxLength && s.length > vj.maxLength)
        errors.push(`"${field.title}": максимум ${vj.maxLength} символов`);
      if (vj.regex && !new RegExp(vj.regex).test(s))
        errors.push(`"${field.title}": не соответствует формату`);
      break;
    }
    case 'number': {
      const n = Number(value);
      if (isNaN(n)) { errors.push(`"${field.title}": ожидается число`); break; }
      if (vj.min !== undefined && n < vj.min)
        errors.push(`"${field.title}": минимум ${vj.min}`);
      if (vj.max !== undefined && n > vj.max)
        errors.push(`"${field.title}": максимум ${vj.max}`);
      break;
    }
    case 'date':
    case 'datetime': {
      const d = new Date(value);
      if (isNaN(d.getTime())) { errors.push(`"${field.title}": некорректная дата`); break; }
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (vj.noPast && d < today)
        errors.push(`"${field.title}": дата не может быть в прошлом`);
      if (vj.noFuture && d > today)
        errors.push(`"${field.title}": дата не может быть в будущем`);
      break;
    }
    case 'select': {
      const opts = field.options_json ? (typeof field.options_json === 'string' ? JSON.parse(field.options_json) : field.options_json) : [];
      if (Array.isArray(opts) && opts.length && !opts.includes(value))
        errors.push(`"${field.title}": недопустимое значение "${value}"`);
      break;
    }
    case 'boolean': {
      if (![0, 1, true, false, '0', '1'].includes(value))
        errors.push(`"${field.title}": ожидается логическое значение`);
      break;
    }
  }
  return errors;
}

module.exports = { validateFieldValue };
