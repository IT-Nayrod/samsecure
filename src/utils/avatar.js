// avatar - couleur et initiales deterministes partagees entre LogoEditeur et AvatarContact
const PALETTE = ['#7C6FCD', '#3FC8B8', '#52C97A', '#E07B39', '#1F4E79', '#C74634', '#0070F2', '#1F70C1', '#FF7A59', '#5294CF'];

export function colorForName(name) {
  const seed = name.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
  return PALETTE[seed % PALETTE.length];
}

export function initialsForName(name) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

// Premiere lettre du prenom + premiere lettre du nom, dans cet ordre
export function initialsFromParts(prenom, nom) {
  const p = (prenom ?? '').trim()[0] ?? '';
  const n = (nom ?? '').trim()[0] ?? '';
  return (p + n).toUpperCase() || '?';
}
