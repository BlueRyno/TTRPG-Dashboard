// script.js
const templateSelect = document.getElementById('templateSelect');
const templateEditor = document.getElementById('templateEditor');
const sentenceOutput = document.getElementById('sentenceOutput');
const sentenceCount = document.getElementById('sentenceCount');
const tableOutput = document.getElementById('tableOutput');
const tableNameInput = document.getElementById('tableName');
const tableCountInput = document.getElementById('tableCount');
const tableNameList = document.getElementById('tableNames');

let tableCache = {};
let tableNames = [];

async function loadTables() {
  const res = await fetch('./tables/index.json');
  const tableNames = await res.json();

  console.log(tableNames);

  for (let name of tableNames) {
    let option = document.createElement('option');
    option.value = name;
    tableNameList.appendChild(option);
  }
}

async function loadTemplates() {
  const res = await fetch('./templates.json');
  const templates = await res.json();
  templates.forEach(t => {
    let opt = document.createElement('option');
    opt.textContent = t;
    opt.value = t;
    templateSelect.appendChild(opt);
  });
  if (templates.length) templateEditor.value = templates[0];
}

async function getTable(tableName) {
  if (!tableCache[tableName]) {
    try {
      const res = await fetch(`./tables/${tableName}.json`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      tableCache[tableName] = data;
    } catch {
      console.warn(`Missing table: ${tableName}`);
      tableCache[tableName] = { 1: `Missing table: ${tableName}` };
    }
  }
  return tableCache[tableName];
}

function rollD100() {
  return Math.floor(Math.random() * 100) + 1;
}

async function renderTemplate(template) {
  const vars = template.match(/\{(.*?)\}/g) || [];
  const rolls = {};
  for (let v of vars) {
    const tableName = v.slice(1, -1);
    const table = await getTable(tableName);
    const result = table[rollD100()] || `[Missing entry for ${tableName}]`;
    rolls[tableName] = result;
  }
  let rendered = template;
  for (let [key, val] of Object.entries(rolls)) {
    rendered = rendered.replaceAll(`{${key}}`, val);
  }
  return rendered;
}

async function generateSentences() {
  const template = templateEditor.value;
  const count = parseInt(sentenceCount.value) || 1;
  const results = [];
  for (let i = 0; i < count; i++) {
    results.push(await renderTemplate(template));
  }
  sentenceOutput.textContent = results.join('\n\n');
}

async function rollTable() {
  const tableName = tableNameInput.value.trim();
  const count = parseInt(tableCountInput.value) || 1;
  const table = await getTable(tableName);
  const results = [];
  for (let i = 0; i < count; i++) {
    results.push(table[rollD100()] || `[Missing entry for ${tableName}]`);
  }
  tableOutput.textContent = results.join('\n');
}

// Autocomplete for template editor
let cursorPos = 0;
templateEditor.addEventListener('input', () => {
  const pos = templateEditor.selectionStart;
  const text = templateEditor.value;
  const match = /\{([a-zA-Z0-9_]*)$/.exec(text.slice(0, pos));
  if (match) {
    const partial = match[1];
    const suggestions = tableNames.filter(t => t.startsWith(partial));
    if (suggestions.length) {
      const suggestion = suggestions[0];
      const before = text.slice(0, pos - partial.length);
      const after = text.slice(pos);
      templateEditor.value = before + suggestion + after;
      templateEditor.selectionStart = templateEditor.selectionEnd = before.length + suggestion.length;
    }
  }
});

loadTables();
loadTemplates();