async function renderTemplate(template, context = {}) {
  const varPattern = /\{(\^?@?[^{}]+?)\}/g;
  const memoCache = {};

  // Helper: Capitalize each word
  function capitalizeWords(str) {
    return str.replace(/\b\w/g, c => c.toUpperCase());
  }

  // Main recursive resolver
  async function resolveString(str, tempCache = {}) {
    let result = str;
    let prev;
    let iterations = 0;

    do {
      prev = result;
      result = await replaceAsync(result, varPattern, async (keyRaw) => {
        // Parse flags
        const capitalize = keyRaw.startsWith('^');
        const memoized = keyRaw.includes('@');
        const key = keyRaw.replace(/^[\^@]+/, '');

        // Recursively resolve any placeholders in the key itself
        const resolvedKey = await resolveString(key, tempCache);

        // Memoization: Use memoCache if available
        if (memoized && memoCache.hasOwnProperty(resolvedKey) && memoCache[resolvedKey] != null) {
          let val = memoCache[resolvedKey];
          return capitalize ? capitalizeWords(val) : val;
        }

        // If memoized, reserve a spot in the cache to prevent duplicate work
        if (memoized && !memoCache.hasOwnProperty(resolvedKey)) {
          memoCache[resolvedKey] = null; // placeholder to prevent recursion
        }

        // Use context if available
        if (context.hasOwnProperty(resolvedKey)) {
          let val = context[resolvedKey];
          if (memoized) memoCache[resolvedKey] = val;
          return capitalize ? capitalizeWords(val) : val;
        }

        // Prevent infinite recursion in this run
        if (tempCache.hasOwnProperty(resolvedKey)) {
          let val = tempCache[resolvedKey];
          return capitalize ? capitalizeWords(val) : val;
        }

        // Otherwise, fetch table and roll
        const table = await getTable(resolvedKey);
        if (!table) return `[Missing table: ${resolvedKey}]`;
        let val = rollTableKey(table);

        // Store in tempCache for this run
        tempCache[resolvedKey] = val;
        // Store in memoCache if needed
        if (memoized) memoCache[resolvedKey] = val;

        return capitalize ? capitalizeWords(val) : val;
      });
      iterations++;
    } while (
      result.match(varPattern) &&
      result !== prev &&
      iterations < 10
    );

    return result;
  }

  // Async regex replace
  async function replaceAsync(str, regex, asyncFn) {
    const matches = [];
    str.replace(regex, (match, group, offset) => {
      matches.push({ match, group, offset });
    });
    const replacements = await Promise.all(
      matches.map(m => asyncFn(m.group))
    );
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

  // Start resolution
  return resolveString(template);
}