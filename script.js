// script.js
const templateSelect = document.getElementById('templateSelect');
const templateEditor = document.getElementById('templateEditor');
const sentenceOutput = document.getElementById('sentenceOutput');
const sentenceCount = document.getElementById('sentenceCount');
const tableOutput = document.getElementById('tableOutput');
const tableCountInput = document.getElementById('tableCount');
const tableNameSelect = document.getElementById('tableNames');



let tableCache = {};
let tableNames = [];



//Load in the index of tables and create a list of options to select
async function loadTables() {
  const res = await fetch('./tables/index.json');
  const tableNames = await res.json();

  tableNames.forEach(name => {
    let option = document.createElement('option');
    option.textContent = name;
    option.value = name;
    tableNameSelect.appendChild(option);
  });
}



//Get the list of templates from the json file and
//populate the template options with the entries.
async function loadTemplates() {
  const res = await fetch('./templates.json');
  const templates = await res.json();

  templates.forEach(template => {
    let option = document.createElement('option');
    option.textContent = template;
    option.value = template;
    templateSelect.appendChild(option);
  });
  if (templates.length) templateEditor.value = templates[0];
}



//using the table names collected from the index json file,
//gather all the other correlating tables and
//store them in an object.
//If a file doesn't exist, throw an error but
//keep iterating to gather the rest of the tables.
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



//pick a random value from the table given
function rollTableKey(table) {
  const keys = Object.keys(table);
  const index = Math.floor(Math.random() * keys.length);
  return keys[index];
}



//Find all the variables in the string (marked by curly braces)
//then loop through them and pick a random result for each.
//Store the results in an object with each property correlating the
//table name from the string with the random result.
//Update the string by replacing the table names and their surrounding
//braces with the random results.
async function renderTemplate(template) {
  const vars = template.match(/\{(.*?)\}/g) || [];
  const rolls = {};

  for (let v of vars) {
    const tableName = v.slice(1, -1);
    const table = await getTable(tableName);
    const result = table[rollTableKey(table)] || `[Missing entry for ${tableName}]`;
    rolls[tableName] = result;
  }
  
  let rendered = template;
  
  for (let [key, val] of Object.entries(rolls)) {
    rendered = rendered.replaceAll(`{${key}}`, val);
  }
  
  return rendered;
}



//Generate the full sentence(s) from the template in the textarea.
async function generateSentences() {
  const template = templateEditor.value;
  const count = parseInt(sentenceCount.value) || 1;
  const results = [];
  for (let i = 0; i < count; i++) {
    results.push(await renderTemplate(template));
  }
  sentenceOutput.textContent = results.join('\n\n');
}



//Generate one or more random results from the specific table selected.
async function rollTable() {
  const tableName = tableNameSelect.value.trim();
  const count = parseInt(tableCountInput.value) || 1;
  const table = await getTable(tableName);
  const results = [];
  for (let i = 0; i < count; i++) {
    results.push(table[rollTableKey(table)] || `[Missing entry for ${tableName}]`);
  }
  tableOutput.textContent = results.join('\n');
}



//when a sentence template is changed,
//overwrite the contents of the textarea.
templateSelect.addEventListener('change', () => {
  templateEditor.value = templateSelect.value;
});



// Autocomplete for template editor
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



document.getElementById('generateBtn')
        .addEventListener('click', generateSentences);

document.getElementById('rollBtn')
        .addEventListener('click', rollTable);
