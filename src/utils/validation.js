export function validateEmail(email) {
  if (!email || !email.trim()) return 'Email requis';
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? null : 'Email invalide';
}

export function validatePassword(password) {
  if (!password || password.length < 8) return 'Minimum 8 caractères requis';
  if (!/[A-Z]/.test(password)) return 'Au moins une majuscule requise';
  if (!/[0-9]/.test(password)) return 'Au moins un chiffre requis';
  return null;
}

export function validateSiret(siret) {
  if (!siret) return 'SIRET requis';
  if (!/^\d{14}$/.test(siret.replace(/\s/g, ''))) return 'Le SIRET doit contenir 14 chiffres';
  return null;
}

export function validateRequired(value, label = 'Ce champ') {
  if (!value || (typeof value === 'string' && !value.trim())) return `${label} est requis`;
  return null;
}
