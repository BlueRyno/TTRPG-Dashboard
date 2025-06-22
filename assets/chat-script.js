async function renderTemplate(template) {
  const cache = {};
  const usedValues = {}; // NEW: Tracks used values per table for `!`

  // STEP 1: Parse the template into structured nodes
  function parseNodes(str) {
    const nodes = [];
    let i = 0;

    while (i < str.length) {
      if (str[i] === '{') {
        let depth = 1;
        let j = i + 1;
        while (j < str.length && depth > 0) {
          if (str[j] === '{') depth++;
          else if (str[j] === '}') depth--;
          j++;
        }

        if (depth !== 0) {
          nodes.push({ type: 'text', value: '{' });
          i++;
        } else {
          const inner = str.slice(i + 1, j - 1);
          const children = parseNodes(inner);
          nodes.push({ type: 'placeholder', content: inner, children });
          i = j;
        }

      } else if (str[i] === '[') {
        let j = i + 1;
        while (j < str.length && str[j] !== ']') j++;

        if (j === str.length) {
          nodes.push({ type: 'text', value: '[' });
          i++;
        } else {
          const inner = str.slice(i + 1, j);
          nodes.push({ type: 'dice', expression: inner });
          i = j + 1;
        }

      } else {
        let start = i;
        while (i < str.length && str[i] !== '{' && str[i] !== '[') i++;
        nodes.push({ type: 'text', value: str.slice(start, i) });
      }
    }

    return nodes;
  }

  // STEP 2: Dice/Roll Handling
  function rollDiceExpression(expr) {
    const cleaned = expr.replace(/\s+/g, '');

    if (!cleaned.includes('d')) {
      const [min, max] = cleaned.split('-').map(Number);
      if (!isNaN(min) && !isNaN(max) && min <= max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
      }
      return `[invalid range: ${expr}]`;
    }

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
        const num = parseInt(token);
        if (isNaN(num)) return `[invalid number: ${token}]`;
        total = currentOp === '+' ? total + num : total - num;
      }
    }

    return total;
  }

  // STEP 3: Resolve recursively
  async function resolveNodes(nodes) {
    let result = '';

    for (const node of nodes) {
      if (node.type === 'text') {
        result += node.value;

      } else if (node.type === 'dice') {
        result += rollDiceExpression(node.expression);

      } else if (node.type === 'placeholder') {
        const innerResolved = await resolveNodes(node.children);

        // MODIFIER FLAGS
        let str = innerResolved;
        let useCache = false;
        let capitalize = false;
        let unique = false;

        // Strip prefix characters
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

        const tableKey = str;
        let picked;

        // Caching (only for non-unique entries)
        if (useCache && !unique && cache.hasOwnProperty(tableKey)) {
          picked = cache[tableKey];
        } else {
          const table = await getTable(tableKey);

          // If unique is required, reroll until we get an unused value
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
            if (useCache) cache[tableKey] = picked;
          }
        }

        if (capitalize && picked.length > 0) {
          picked = picked.charAt(0).toUpperCase() + picked.slice(1);
        }

        result += picked;
      }
    }

    return result;
  }

  // STEP 4: Final run
  const nodes = parseNodes(template);
  const final = await resolveNodes(nodes);
  return final;
}


/*
async function renderTemplate(template) {
  //fetch table and roll
  const table = await getTable();
  let val = rollTableKey(table);


  // Start resolution
  return resolvedStr;
}
*/


/*
For example, this:
"Legends say {town_name} was founded by a lone {@race_singular} warrior named {^human_{gender}_name} in the heart of the {^place_adjective} {^biome}. {^@race_singular}"

Should return this:
"Legends say Winterrun was founded by a lone Half-Orc warrior named Harlon in the heart of the Bramble Reach. Half-Orc"


Legends say {town_name} was founded by a lone {@gender} {@race_singular} warrior named {^human_{@gender}_name} in the heart of the {^place_adjective} {^biome}. {^gender}


The village of {town_name} is populated by [2d100] {^!race_plural}, [1d100] {!^race_plural}, and [1d20+5] {^!race_plural}.
*/
