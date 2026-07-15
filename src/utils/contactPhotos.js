// contactPhotos - stockage v0.5 des photos contact (data URL en localStorage, par id contact)
// Isole derriere ces fonctions : en v1+ ce sera un appel API vers photo_url, seul ce fichier changera.
const STORAGE_KEY = 'samsecure_photos_contacts';

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeAll(map) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch { /* ignore */ }
}

export function getContactPhoto(idContact) {
  return readAll()[idContact] ?? null;
}

export function setContactPhoto(idContact, dataUrl) {
  const map = readAll();
  map[idContact] = dataUrl;
  writeAll(map);
}

export function removeContactPhoto(idContact) {
  const map = readAll();
  delete map[idContact];
  writeAll(map);
}
