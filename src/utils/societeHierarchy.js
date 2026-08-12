// societeHierarchy - réplique fidèle de sortSocietesByHierarchy /
// formatSocieteLabel (sandbox, index.html) : tri par hiérarchie parent/enfant,
// alphabétique au sein de chaque fratrie, profondeur pour l'indentation.
// Les organisations dont le parent est absent de la liste sont rattachées à
// la racine plutôt que perdues.
export function sortByHierarchy(organisations) {
  const byParent = new Map();
  byParent.set(null, []);
  for (const o of organisations) {
    const pid = o.id_societe_parent || null;
    if (!byParent.has(pid)) byParent.set(pid, []);
    byParent.get(pid).push(o);
  }
  for (const [, arr] of byParent) {
    arr.sort((a, b) => (a.raison_sociale || '').localeCompare(b.raison_sociale || '', 'fr'));
  }
  const result = [];
  const visited = new Set();
  function walk(pid, depth) {
    for (const child of byParent.get(pid) || []) {
      if (visited.has(child.id)) continue;
      visited.add(child.id);
      result.push({ ...child, depth });
      walk(child.id, depth + 1);
    }
  }
  walk(null, 0);
  for (const o of organisations) {
    if (!visited.has(o.id)) result.push({ ...o, depth: 0 });
  }
  return result;
}
