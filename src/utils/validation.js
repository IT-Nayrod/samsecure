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

export function validateIban(iban) {
  if (!iban || !iban.trim()) return null;
  const clean = iban.replace(/\s/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(clean)) return 'IBAN invalide';
  const rearranged = clean.slice(4) + clean.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, c => c.charCodeAt(0) - 55);
  let remainder = 0;
  for (let i = 0; i < numeric.length; i += 7) {
    remainder = Number(String(remainder) + numeric.slice(i, i + 7)) % 97;
  }
  return remainder === 1 ? null : 'IBAN invalide';
}

export function validatePhoneFr(phone) {
  if (!phone || !phone.trim()) return null;
  const clean = phone.replace(/[\s.-]/g, '');
  return /^0[1-9]\d{8}$/.test(clean) ? null : 'Numéro de téléphone français invalide';
}

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const IMAGE_MAX_BYTES = 1024 * 1024;

export function validateImageFile(file) {
  if (!file) return null;
  if (!IMAGE_TYPES.includes(file.type)) return 'Format non supporté : utilisez PNG, JPG ou WEBP';
  if (file.size > IMAGE_MAX_BYTES) return 'Fichier trop volumineux : 1 Mo maximum';
  return null;
}
