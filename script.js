// script.js
const templateSelect = document.getElementById('templateSelect');
const templateEditor = document.getElementById('templateEditor');
const sentenceOutput = document.getElementById('sentenceOutput');
const sentenceCount = document.getElementById('sentenceCount');
const tableOutput = document.getElementById('tableOutput');
const tableCountInput = document.getElementById('tableCount');
const tableNameSelect = document.getElementById('tableNames');
const generateBtn = document.getElementById('generateBtn');
const rollBtn = document.getElementById('rollBtn');



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



// Add SVG particle effect on hover
function createFloatingParticles(button) {
  for (let i = 0; i < 12; i++) {
    const particle = document.createElement("div");
    particle.className = "particle";

    // Random angle and distance
    const angle = Math.random() * 2 * Math.PI;
    const distance = 40 + Math.random() * 40;
    const x = Math.cos(angle) * distance + "px";
    const y = Math.sin(angle) * distance + "px";

    particle.style.setProperty("--x", x);
    particle.style.setProperty("--y", y);
    particle.style.left = `${button.offsetWidth / 2}px`;
    particle.style.top = `${button.offsetHeight / 2}px`;
    particle.style.animationDelay = `${Math.random() * 0.5}s`;
    particle.style.width = `${4 + Math.random() * 6}px`;
    particle.style.height = particle.style.width;

    // Optional: varied soft colors
    const colors = ["#fff5", "#c0f0ff88", "#ddaaff88", "#ffffff99"];
    particle.style.background = `radial-gradient(circle, ${colors[Math.floor(Math.random() * colors.length)]} 0%, transparent 70%)`;

    button.appendChild(particle);

    // Clean up after animation
    setTimeout(() => {
      particle.remove();
    }, 3000);
  }
}


function addHoverParticles(button) {
  let cleanup;
  button.addEventListener('mouseenter', () => {
    cleanup = createFloatingParticles(button);
  });
  button.addEventListener('mouseleave', () => {
    if (cleanup) cleanup();
  });
}




//when a sentence template is changed,
//overwrite the contents of the textarea.
templateSelect.addEventListener('change', () => {
  templateEditor.value = templateSelect.value;
});

document.querySelectorAll('button').forEach(addHoverParticles);

generateBtn.addEventListener('click', generateSentences);
rollBtn.addEventListener('click', rollTable);



//functions to run on load
loadTables();
loadTemplates();
