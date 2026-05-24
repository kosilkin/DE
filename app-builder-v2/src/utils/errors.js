'use strict';

class AppError extends Error {
  constructor(code, message, details) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

class ValidationError extends AppError {
  constructor(message, details) {
    super('VALIDATION_ERROR', message, details);
  }
}

class PermissionError extends AppError {
  constructor(message, details) {
    super('PERMISSION_ERROR', message, details);
  }
}

class NotFoundError extends AppError {
  constructor(message, details) {
    super('NOT_FOUND', message, details);
  }
}

class ConflictError extends AppError {
  constructor(message, details) {
    super('CONFLICT', message, details);
  }
}

module.exports = { AppError, ValidationError, PermissionError, NotFoundError, ConflictError };
