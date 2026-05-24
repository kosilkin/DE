'use strict';

const DOM = {
  el(tag, attrs, ...children) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (k === 'className') el.className = v;
        else if (k === 'textContent') el.textContent = v;
        else if (k === 'innerHTML') el.innerHTML = v;
        else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === 'dataset') Object.assign(el.dataset, v);
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else el.setAttribute(k, v);
      }
    }
    for (const child of children) {
      if (typeof child === 'string') el.appendChild(document.createTextNode(child));
      else if (child) el.appendChild(child);
    }
    return el;
  },

  clear(el) { el.innerHTML = ''; },

  show(el) { el.classList.remove('hidden'); },
  hide(el) { el.classList.add('hidden'); },

  $(sel, ctx) { return (ctx || document).querySelector(sel); },
  $$(sel, ctx) { return Array.from((ctx || document).querySelectorAll(sel)); },
};

window.DOM = DOM;
