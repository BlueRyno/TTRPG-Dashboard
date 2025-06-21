async function renderTemplate(template) {
  const cache = {};

  // 1. Parse the template into a tree of nodes:
  //    Each node is either:
  //      { type: 'text', value: 'some literal text' }
  //    or { type: 'placeholder', content: innerString, children: [subnodes] }
  function parseNodes(str) {
    const nodes = [];
    let i = 0;
    while (i < str.length) {
      if (str[i] === '{') {
        // find matching closing brace, accounting for nested braces
        let depth = 1;
        let j = i + 1;
        while (j < str.length && depth > 0) {
          if (str[j] === '{') depth++;
          else if (str[j] === '}') depth--;
          j++;
        }
        if (depth !== 0) {
          // no matching closing brace: treat '{' as literal
          nodes.push({ type: 'text', value: '{' });
          i++;
        } else {
          // substring inside braces: str.slice(i+1, j-1)
          const inner = str.slice(i + 1, j - 1);
          // recursively parse inner content
          const children = parseNodes(inner);
          nodes.push({ type: 'placeholder', content: inner, children });
          i = j;
        }
      } else {
        // accumulate literal text until next '{'
        let start = i;
        while (i < str.length && str[i] !== '{') i++;
        nodes.push({ type: 'text', value: str.slice(start, i) });
      }
    }
    return nodes;
  }

  // 2. Resolve a node tree to a string, handling prefixes and caching.
  //    getTable(name) and rollTableKey(table) are assumed available.
  async function resolveNodes(nodes) {
    let result = '';
    for (const node of nodes) {
      if (node.type === 'text') {
        result += node.value;
      } else if (node.type === 'placeholder') {
        // First, resolve all children to get the full inner string
        const innerResolved = await resolveNodes(node.children);

        // Then handle prefixes: @ (cache) and ^ (capitalize)
        let str = innerResolved;
        let useCache = false;
        let capitalize = false;
        // consume prefixes in order until none remain
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
        }
        const tableKey = str;

        // Lookup or cache
        let picked;
        if (useCache && cache.hasOwnProperty(tableKey)) {
          picked = cache[tableKey];
        } else {
          // fetch table and roll
          const table = await getTable(tableKey);
          picked = rollTableKey(table);
          if (useCache) {
            cache[tableKey] = picked;
          }
        }
        // Capitalize if needed
        if (capitalize && picked.length > 0) {
          picked = picked.charAt(0).toUpperCase() + picked.slice(1);
        }
        result += picked;
      }
    }
    return result;
  }

  // Parse + resolve
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
*/
