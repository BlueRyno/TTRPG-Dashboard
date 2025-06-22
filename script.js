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





async function renderTemplate(template) {
  // Tracks used values per table for `!`
  const usedValues = {};
  const cache = {};

  // Step 1: Parse the template into a tree of nodes:
  // Each node is:
  //   { type: 'text', value: 'some literal text' }
  // or { type: 'placeholder', content: innerString, children: [subnodes] }
  // or { type: 'dice', expression: innerString }
  function parseNodes(str) {
    const nodes = [];
    let i = 0;

    while (i < str.length) {
      // When we find a '{', we need to find the matching '}'
      // but there may be nested {}
      if (str[i] === '{') {
        let depth = 1;
        let j = i + 1;
        while (j < str.length && depth > 0) {
          if (str[j] === '{') depth++;
          else if (str[j] === '}') depth--;
          j++;
        }

        if (depth !== 0) {
          // If we didn’t find a closing '}', just treat it as a literal '{'
          nodes.push({ type: 'text', value: '{' });
          i++;
        } else {
          // We found a complete {...}, so extract the content inside
          const inner = str.slice(i + 1, j - 1);
          // Recursively parse any inner placeholders
          const children = parseNodes(inner);
          nodes.push({ type: 'placeholder', content: inner, children });
          // Move past the '}'
          i = j;
        }

      // Handle [] dice or range rolls
      } else if (str[i] === '[') {
        let j = i + 1;
        while (j < str.length && str[j] !== ']') j++;

        if (j === str.length) {
          // unmatched
          nodes.push({ type: 'text', value: '[' });
          i++;
        } else {
          const inner = str.slice(i + 1, j);
          nodes.push({ type: 'dice', expression: inner });
          i = j + 1;
        }

      // If it’s just normal text (not a '{'), gather it until the next '{'
      } else {
        let start = i;
        while (i < str.length && str[i] !== '{' && str[i] !== '[') i++;
        nodes.push({ type: 'text', value: str.slice(start, i) });
      }
    }

    //console.log(nodes);
    return nodes;
  }



  // STEP 2: Evaluate dice expressions or ranges
  function rollDiceExpression(expr) {
    // Remove whitespace
    const cleaned = expr.replace(/\s+/g, '');

    // Range format: e.g., 3-16
    if (!cleaned.includes('d')) {
      const [min, max] = cleaned.split('-').map(Number);
      if (!isNaN(min) && !isNaN(max) && min <= max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
      }
      return `[invalid range: ${expr}]`;
    }

    // Dice expression: tokenize numbers and operators
    const tokens = cleaned.match(/(\d*d\d+|\d+|[+-])/g);
    if (!tokens) return `[invalid roll: ${expr}]`;

    let total = 0;
    let currentOp = '+';

    for (const token of tokens) {
      if (token === '+' || token === '-') {
        currentOp = token;
      } else if (token.includes('d')) {
        const [countStr, sidesStr] = token.split('d');
        const count = parseInt(countStr) || 1;
        const sides = parseInt(sidesStr);
        if (isNaN(sides)) return `[invalid roll: ${expr}]`;

        let rollSum = 0;
        for (let i = 0; i < count; i++) {
          rollSum += Math.floor(Math.random() * sides) + 1;
        }

        total = currentOp === '+' ? total + rollSum : total - rollSum;

      } else {
        // Plain number
        const num = parseInt(token);
        if (isNaN(num)) return `[invalid number: ${token}]`;
        total = currentOp === '+' ? total + num : total - num;
      }
    }

    return total;
  }



  // STEP 3: Recursively resolve all nodes (text + placeholders)
  async function resolveNodes(nodes) {
    let result = '';

    for (const node of nodes) {
      // Just add plain text to the result
      if (node.type === 'text') {
        result += node.value;

      // Add the results of the die rolls placeholder.
      } else if (node.type === 'dice') {
        result += rollDiceExpression(node.expression);

      // Resolve all the placeholder's children (for nested placeholders)
      } else if (node.type === 'placeholder') {
        const innerResolved = await resolveNodes(node.children);

        // Handle prefix symbols
        let str = innerResolved;
        let useCache = false;
        let capitalize = false;
        let unique = false;

        // Look for leading @ or ^ symbols (can be in any order)
        let changed = true;
        while (changed && str.length > 0) {
          changed = false;
          if (str.startsWith('@')) {
            useCache = true;
            str = str.slice(1);
            changed = true;
          }
          
          if (str.startsWith('^')) {
            capitalize = true;
            str = str.slice(1);
            changed = true;
          }

          if (str.startsWith('!')) {
            unique = true;
            str = str.slice(1);
            changed = true;
          }
        }

        // This is the final key used to look up the table
        const tableKey = str;

        // Try to get a cached value (if @ was used)
        let picked;

        // Caching (only for non-unique entries)
        if (useCache && !unique && cache.hasOwnProperty(tableKey)) {
          picked = cache[tableKey];

        } else {
          // Otherwise, fetch the table and pick a result
          const table = await getTable(tableKey);

          // If unique is required '{!___}',
          // reroll until we get an unused value
          if (unique) {
            const used = usedValues[tableKey] || new Set();

            const maxAttempts = 50; // prevent infinite loops
            let attempts = 0;
            let result;

            do {
              result = rollTableKey(table);
              attempts++;
            } while (used.has(result) && attempts < maxAttempts);

            if (used.has(result)) {
              console.warn(`All values used for unique table: ${tableKey}`);
              // fallback to a random roll (even if repeated)
              result = rollTableKey(table);
            }

            used.add(result);
            usedValues[tableKey] = used;
            picked = result;

          } else {
            picked = rollTableKey(table);

            if (useCache) {
              // Store it for future reuse
              cache[tableKey] = picked;
            }
          }

          console.log(usedValues);
        }

        // Capitalize the first letter if ^ was used
        if (capitalize && picked.length > 0) {
          picked = picked.charAt(0).toUpperCase() + picked.slice(1);
        }

        result += picked;
      }
    }

    return result;
  }

  // STEP 3: Parse and resolve
  const nodes = parseNodes(template);
  const final = await resolveNodes(nodes);
  return final;
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

  //console.log(container);
  //console.log(layer);

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

