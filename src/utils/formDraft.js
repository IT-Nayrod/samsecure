// formDraft - persistance des brouillons de formulaire (panneaux lateraux) dans localStorage
// Permet de ne pas perdre une saisie en cours si le panneau se ferme ou si la page se recharge.
const PREFIX = 'ss_draft_';

export function loadDraft(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveDraft(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // stockage indisponible (navigation privee, quota) : la saisie reste fonctionnelle, simplement non persistee
  }
}

export function clearDraft(key) {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    // ignorer
  }
}
