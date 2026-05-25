'use strict';

function ok(data) {
  return { ok: true, data };
}

function fail(code, message, details) {
  return { ok: false, error: { code, message, details } };
}

module.exports = { ok, fail };
