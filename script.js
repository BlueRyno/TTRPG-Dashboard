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



function capitalizeWords(str) {
  console.log(str);
  return str.replace(/\b\w+/g, word => word[0].toUpperCase() + word.slice(1));
}



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
    option.textContent = template["title"];
    option.value = template["template"];
    templateSelect.appendChild(option);
  });
  if (templates.length) templateEditor.value = templates[0]["template"];
}





//using the table names collected from the index json file,
//gather all the other correlating tables and
//store them in an object.
//If a file doesn't exist, throw an error but
//keep iterating to gather the rest of the tables.
async function getTable(tableName) {
  if (!tableCache[tableName]) {
    console.log(tableCache[tableName], tableName);
    
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
  const rangeEntries = [];

  let maxRoll = 0;
  let isRange = false;

  for (const key of keys) {
    const parts = key.split('-').map(n => parseInt(n.trim(), 10));

    if (parts.length === 2) {
      const [min, max] = parts;
      rangeEntries.push({ min, max, value: table[key] });
      maxRoll = Math.max(maxRoll, max);
      isRange = true;
    } else if (parts.length === 1 && !isNaN(parts[0])) {
      const num = parts[0];
      rangeEntries.push({ min: num, max: num, value: table[key] });
      maxRoll = Math.max(maxRoll, num);
    } else {
      console.warn(`Invalid key in table: "${key}"`);
    }
  }

  if (!isRange && keys.length > 0 && rangeEntries.length === 0) {
    // Fallback to random key (unordered) if table is just plain strings
    const randomKey = keys[Math.floor(Math.random() * keys.length)];
    return table[randomKey];
  }

  const roll = Math.floor(Math.random() * maxRoll) + 1;

  for (const entry of rangeEntries) {
    if (roll >= entry.min && roll <= entry.max) {
      return entry.value;
    }
  }

  return `[No result for roll ${roll}]`;
}



async function renderTemplate(template, context = {}) {
  const varPattern = /\{(\^?[^{}]+?)\}/g;

  async function resolvePlaceholder(keyRaw) {
    const capitalize = keyRaw.startsWith('^');
    const key = capitalize ? keyRaw.slice(1) : keyRaw;

    // Resolve nested placeholders in the key itself
    const resolvedKey = await resolveString(key, context);

    // If already in context, use it
    if (context[resolvedKey]) {
      return capitalize ? capitalizeWords(context[resolvedKey]) : context[resolvedKey];
    }

    const table = await getTable(resolvedKey);
    if (!table) return `[Missing table: ${resolvedKey}]`;

    const value = rollTableKey(table);
    context[resolvedKey] = value;
    return capitalize ? capitalizeWords(value) : value;
  }

  async function resolveString(str, context) {
    let result = str;
    let prev;
    let iterations = 0;

    // Keep replacing until stable or max depth
    do {
      prev = result;
      result = await replaceAsync(result, varPattern, resolvePlaceholder);
      iterations++;
    } while (result.includes('{') && result !== prev && iterations < 10);

    return result;
  }

  async function replaceAsync(str, regex, asyncFn) {
    const matches = [];
    str.replace(regex, (match, group, offset) => {
      matches.push({ match, group, offset });
    });

    const replacements = await Promise.all(matches.map(m => asyncFn(m.group)));

    let result = '';
    let lastIndex = 0;
    for (let i = 0; i < matches.length; i++) {
      const { offset, match } = matches[i];
      result += str.slice(lastIndex, offset) + replacements[i];
      lastIndex = offset + match.length;
    }
    result += str.slice(lastIndex);
    return result;
  }

  return resolveString(template, context);
}




//Generate the full sentence(s) from the template in the textarea.
async function generateSentences() {
  const template = templateEditor.value;
  const count = parseInt(sentenceCount.value) || 1;
  const results = [];
  for (let i = 0; i < count; i++) {
    results.push(await renderTemplate(template));
  }
  
  const outputText = results.join('\n\n');

  // Animate output to container
  animatedTyping(outputText, "sentenceOutput");
}



//Generate one or more random results from the specific table selected.
async function rollTable() {
  const tableName = tableNameSelect.value.trim();
  const count = parseInt(tableCountInput.value) || 1;
  const table = await getTable(tableName);
  const results = [];
  for (let i = 0; i < count; i++) {
    results.push(rollTableKey(table) || `Missing entry for ${tableName}`);
  }
  
  const outputText = results.join('\n\n');

  // Animate output to container
  animatedTyping(outputText, "tableOutput");
}



//
function animatedTyping(text, containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  container.setAttribute('aria-label', text);
  container.setAttribute('role', 'text');
  container.setAttribute('aria-live', 'polite');

  container.innerHTML = ''; // Clear the container

  const results = text.split('\n\n');

  results.forEach((result, rIndex) => {
    const paragraph = document.createElement('p');
    paragraph.className = 'animated-paragraph';
    
    const words = result.split(' ');

    words.forEach((word, wIndex) => {
      const wordSpan = document.createElement('span');
      wordSpan.className = 'word';
      wordSpan.style.textWrap = 'nowrap';

      for (let char of word) {
        const charSpan = document.createElement('span');
        charSpan.className = 'letter';
        charSpan.textContent = char;
        charSpan.style.display = 'inline-block';
        wordSpan.appendChild(charSpan);
      }

      paragraph.appendChild(wordSpan);

      // Add a space after each word except the last
      if (wIndex < words.length - 1) {
        paragraph.appendChild(document.createTextNode(' '));
      }
    });

    container.appendChild(paragraph);
  });

  const letters = container.querySelectorAll('.letter')

  // Animate each span in from a random offset
  letters.forEach(letter => {
    gsap.set(letter, {
      x: gsap.utils.random(-75, 75),
      y: gsap.utils.random(-75, 75),
      rotation: gsap.utils.random(-45, 45),
      scale: 0,
      opacity: 0
    });

    gsap.to(letter, {
      delay: gsap.utils.random(0, 0.5),
      x: 0,
      y: 0,
      rotation: 0,
      scale: 1,
      opacity: 1,
      duration: gsap.utils.random(0.25, 0.5),
      ease: "power2.out"
    });
  });
}





//This function wraps many functions that control the
//fireflies in the buttons.
//Hover and Click events for the animations are
//included as well.
function initFireflies(container, count = 15) {
  const layer = container.querySelector(':scope > .firefly-box');
  const width = container.offsetWidth;
  const height = container.offsetHeight;
  const fireflies = [];

  console.log(container);
  console.log(layer);

  layer.innerHTML = "";

  for (let i = 0; i < count; i++) {
    const f = document.createElement("div");
    f.classList.add("firefly");

    const baseX = Math.random() * (width - 10);
    const baseY = Math.random() * (height - 10);
    f.style.left = `${baseX}px`;
    f.style.top = `${baseY}px`;

    layer.appendChild(f);

    const firefly = {
      el: f,
      baseX,
      baseY,
      speedMultiplier: 1.25
    };

    // Fade in and start drifting
    gsap.to(f, {
      opacity: 0.6 + Math.random() * 0.3,
      duration: 2,
      delay: Math.random() * 2,
      onComplete: () => drift(firefly)
    });

    fireflies.push(firefly);
  }

  /**
   * Animates individual firefly with organic drifting, constrained to button bounds
   */
  function drift(firefly) {
    const { el, baseX, baseY } = firefly;

    const range = 30;
    const offsetX = (Math.random() - 0.5) * range;
    const offsetY = (Math.random() - 0.5) * range;

    // Clamp movement to stay within container
    const newX = Math.min(width - 5, Math.max(5, baseX + offsetX));
    const newY = Math.min(height - 5, Math.max(5, baseY + offsetY));

    const duration = (2 + Math.random() * 2) / firefly.speedMultiplier;

    gsap.to(el, {
      x: newX - baseX,
      y: newY - baseY,
      duration,
      delay: Math.random() * (1 / firefly.speedMultiplier),
      ease: "sine.inOut",
      onComplete: () => drift(firefly)
    });
  }

  //On hover, make all fireflies move faster and glow brighter
  container.addEventListener("mouseenter", () => {
    fireflies.forEach(firefly => {
      firefly.speedMultiplier = 3;

      gsap.to(firefly.el, {
        opacity: 1,
        duration: 0.4,
        ease: "power1.out"
      });
    });
  });

  container.addEventListener("mouseleave", () => {
    fireflies.forEach(firefly => {
      firefly.speedMultiplier = 1.25;

      gsap.to(firefly.el, {
        opacity: 0.6 + Math.random() * 0.3,
        duration: 0.4,
        ease: "power1.inOut"
      });
    });
  });



  container.addEventListener('click', () => {
    const firefliesArr = container.querySelectorAll(":scope .firefly");

    gsap.to(firefliesArr, {
      duration: 0.5,
      opacity: 1,
      scale: 3,
      filter: "brightness(2.5)",
      ease: "bounce",
      onComplete: () => {
        gsap.to(firefliesArr, {
          duration: 0.25,
          opacity: 0.6 + Math.random() * 0.3,
          scale: 1,
          filter: "brightness(1)",
          transformOrigin: "center",
          ease: "elastic.in",
          onComplete: () => {
            //Once the animation is over, generate the results requested.
            if (container.id === "genContainer") {
              generateSentences();
            } else {
              rollTable();
            }
          }
        });
      }
    });

    gsap.to(container, {
      duration: 0.5,
      boxShadow: "0px 0px 20px rgb(195, 251, 232)",
      ease: "bounce",
      onComplete: () => {
        gsap.to(container, {
          duration: 0.25,
          boxShadow: "none",
          ease: "elastic.in"
        })
      }
    })
  });
}





//when a sentence template is changed,
//overwrite the contents of the textarea.
templateSelect.addEventListener('change', () => {
  templateEditor.value = templateSelect.value;
});



//Tab switcher
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;

    // Update tab button states
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // Show/hide content areas
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });
    document.getElementById(`tab-${tab}`).classList.add('active');
  });
});



document.querySelector('[data-tab="roller"]').addEventListener('click', () => {
  initFireflies(document.getElementById("rollContainer"), 15);
})



//functions to run on load
loadTables();
loadTemplates();
initFireflies(document.getElementById("genContainer"), 25);

