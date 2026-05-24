'use strict';

exports.up = function (db) {
  db.exec(`ALTER TABLE projects ADD COLUMN login_enabled INTEGER DEFAULT 1`);
};
