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
  const particleContainer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  particleContainer.setAttribute('class', 'particles');
  particleContainer.style.position = 'absolute';
  particleContainer.style.pointerEvents = 'none';
  particleContainer.style.width = `${button.offsetWidth + 20}px`;
  particleContainer.style.height = `${button.offsetHeight + 20}px`;
  particleContainer.style.left = `${button.getBoundingClientRect().left + window.scrollX - 10}px`;
  particleContainer.style.top = `${button.getBoundingClientRect().top + window.scrollY - 10}px`;
  particleContainer.style.zIndex = 0;
  particleContainer.style.opacity = 0.33;

  document.body.appendChild(particleContainer);

  const particles = [];
  const w = particleContainer.clientWidth;
  const h = particleContainer.clientHeight;

  for (let i = 0; i < 14; i++) {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    const x = Math.random() * w;
    const y = Math.random() * h;
    circle.setAttribute('cx', x);
    circle.setAttribute('cy', y);
    circle.setAttribute('r', 1.5 + Math.random() * 1.5);
    circle.setAttribute('fill', '#ccee50');
    particleContainer.appendChild(circle);

    particles.push({
      el: circle,
      x,
      y,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      life: 0
    });
  }


  let frameId;
  function animate() {
    for (const p of particles) {
      p.x += p.vx * 0.25;
      p.y += p.vy * 0.25;

      // Keep within bounds
      if (p.x < 0 || p.x > w) p.vx *= -1;
      if (p.y < 0 || p.y > h) p.vy *= -1;

      // Randomly change direction over time
      if (Math.random() < 0.02) {
        p.vx += (Math.random() - 0.5) * 0.3;
        p.vy += (Math.random() - 0.5) * 0.3;
        // Clamp velocity
        p.vx = Math.max(-0.7, Math.min(0.7, p.vx));
        p.vy = Math.max(-0.7, Math.min(0.7, p.vy));
      }

      p.el.setAttribute('cx', p.x);
      p.el.setAttribute('cy', p.y);
    }
    frameId = requestAnimationFrame(animate);
  }

  animate();

  return () => {
    cancelAnimationFrame(frameId);
    particleContainer.remove();
  };
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
