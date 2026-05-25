'use strict';

const api = window.appApi;

async function callApi(fn) {
  const result = await fn();
  if (!result.ok) {
    console.error('API error:', result.error);
    throw new Error(result.error.message || 'Неизвестная ошибка');
  }
  return result.data;
}

window.callApi = callApi;
window.api = api;
