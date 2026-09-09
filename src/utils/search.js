// search - moteur de recherche transverse : normalisation accents/casse, filtrage par registre, surlignage

const ACCENT_CLASSES = {
  a: 'aàáâãäå', e: 'eèéêë', i: 'iìíîï', o: 'oòóôõö', u: 'uùúûü', c: 'cç', n: 'nñ', y: 'yýÿ',
};

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Construit une regex qui matche `query` indépendamment des accents et de la casse,
// pour pouvoir à la fois tester une correspondance et surligner la portion trouvée
// dans la chaîne d'origine (pas de décalage d'index comme avec une normalisation NFD).
export function buildSearchRegex(query) {
  const pattern = escapeRegExp(query).replace(/[a-z]/gi, ch => {
    const lower = ch.toLowerCase();
    const variants = ACCENT_CLASSES[lower];
    return variants ? `[${variants}${variants.toUpperCase()}]` : ch;
  });
  return new RegExp(pattern, 'i');
}

export function matches(regex, value) {
  if (value == null) return false;
  return regex.test(String(value));
}

// Interroge l'ensemble du registre pour une requête donnée, filtre par les
// permissions réelles de l'utilisateur (une entrée sans `permission` est
// visible par tous).
// Retourne un tableau de groupes { entry, items, total } (total >= items.length si limite atteinte).
export function runSearch(registry, query, hasPermission, limit = 5) {
  if (!query || query.trim().length < 2) return [];
  const regex = buildSearchRegex(query.trim());

  return registry
    .filter(entry => !entry.permission || hasPermission(entry.permission))
    .map(entry => {
      const data = entry.getData();
      const found = data.filter(item => entry.fields(item).some(value => matches(regex, value)));
      return { entry, items: found.slice(0, limit), total: found.length };
    })
    .filter(group => group.total > 0);
}
