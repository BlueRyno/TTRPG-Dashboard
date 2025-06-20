async function renderTemplate(template, context = {}) {
  // Pattern matches placeholders in the form {key}, {^key}, {@key}, or {^@key}
  const varPattern = /\{(\^?@?[^{}]+?)\}/g;

  // Internal caches for this single render:
  // - tempCache: caches ANY placeholder resolved during this run,
  //   to prevent infinite recursion / redundant work within nested calls.
  // - memoCache: caches placeholders explicitly marked with @, for reuse later.
  const tempCache = {};
  const memoCache = {};

  // Resolves all placeholders in the input string recursively
  async function resolveString(str) {
    let result = str;
    let prev;
    let iterations = 0;

    // Repeat replacement until stable or max iterations
    do {
      prev = result;
      result = await replaceAsync(result, varPattern, resolvePlaceholder);
      iterations++;
    } while (
      result.includes('{') && 
      result !== prev && 
      iterations < 10
    );

    // After all inner placeholders resolved, apply capitalization tags
    // (Any placeholder that left a '^' marker will be processed here)
    // Note: Our resolvePlaceholder returns the raw value and we apply capitalization here.
    result = result.replace(/\{\^(.+?)\}/g, (_, val) => capitalizeWords(val));

    return result;
  }

  // Resolve a single placeholder (keyRaw is e.g. "^@foo", "@bar", "baz", etc.)
  async function resolvePlaceholder(keyRaw) {
    // Check for capitalization flag: leading '^'
    const capitalize = keyRaw.startsWith('^');

    // Check for memoization flag: contains '@'
    const memoized = keyRaw.includes('@');

    // Strip leading '^' and/or '@' in any order:
    // e.g. "^@key", "@^key", "@key", "^key" → "key"
    const key = keyRaw.replace(/^[\^@]+/, '');

    // First, resolve nested placeholders inside the key name itself
    const resolvedKey = await resolveString(key);

    // 1) If the caller provided a value in context, use it directly
    if (context.hasOwnProperty(resolvedKey)) {
      const base = context[resolvedKey];
      return capitalize ? `{^${base}}` : base;
    }

    // 2) If it was memoized earlier in this run, reuse it
    if (memoized && memoCache.hasOwnProperty(resolvedKey)) {
      const cached = memoCache[resolvedKey];
      return capitalize ? `{^${cached}}` : cached;
    }

    // 3) If it was already resolved in tempCache during nested resolution,
    //    reuse that to prevent infinite recursion or redundant re-roll.
    if (tempCache.hasOwnProperty(resolvedKey)) {
      const cached = tempCache[resolvedKey];
      return capitalize ? `{^${cached}}` : cached;
    }

    // 4) Otherwise, we need to fetch the table and roll a new value
    const table = await getTable(resolvedKey);
    if (!table) {
      // If missing, return a placeholder string
      return `[Missing table: ${resolvedKey}]`;
    }

    const value = rollTableKey(table);

    // Cache this in tempCache so that nested references don't loop endlessly
    tempCache[resolvedKey] = value;

    // If explicitly memoized, also store in memoCache for reuse later in this string
    if (memoized) {
      memoCache[resolvedKey] = value;
    }
    return capitalize ? `{^${value}}` : value;
  }

  // Performs asynchronous replacement of regex matches in str
  async function replaceAsync(str, regex, asyncFn) {
    const matches = [];
    // Collect matches: store match text, group, and offset
    str.replace(regex, (match, group, offset) => {
      matches.push({ match, group, offset });
    });

    // Resolve all placeholders in parallel
    const replacements = await Promise.all(
      matches.map(m => asyncFn(m.group))
    );

    // Reconstruct the string with the replacements
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

  // Kick off resolution
  return resolveString(template);
}