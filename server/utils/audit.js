// Trace probante des actions d'administration.
//
// Distincte de journal_ecriture : audit_log porte l'acteur, l'adresse IP et
// les valeurs avant et après, que le journal fonctionnel ne modélise pas. Les
// deux coexistent, le journal raconte, l'audit prouve.
//
// Contrairement à log(), cette fonction n'avale pas ses erreurs : une trace
// probante manquante doit faire échouer l'opération, pas passer inaperçue.
// C'est la même règle que dans preuves.js et factures.js, mutualisée ici parce
// que plusieurs routeurs l'appliquent.

// Champs interdits dans valeur_avant et valeur_apres, en toutes circonstances.
// Le filtrage se fait A L'ECRITURE et non à la lecture : une trace ne doit
// jamais contenir de secret, même haché, même si personne ne la lit. Un hash
// bcrypt reste une donnée attaquable hors ligne, et un jeton reste rejouable.
const CHAMPS_SENSIBLES = [
  "mot_de_passe_hash", "mot_de_passe", "password", "motdepasse",
  "access_token", "refresh_token", "token", "jeton",
  "secret", "totp", "code_2fa", "two_factor_secret", "hash",
];

// Le filtre porte sur le nom du champ, insensible à la casse, et retire la
// clé entièrement plutôt que de la masquer : une clé présenté avec une valeur
// caviardée révélerait déjà qu'un mot de passe a changé, et l'action suffit à
// le dire.
export function filtrerSensibles(objet) {
  if (!objet || typeof objet !== "object") return objet;
  const sortie = {};
  for (const [cle, valeur] of Object.entries(objet)) {
    if (CHAMPS_SENSIBLES.some((s) => cle.toLowerCase().includes(s))) continue;
    sortie[cle] = valeur;
  }
  return Object.keys(sortie).length ? sortie : null;
}

// Diff minimal entre deux états : seuls les champs réellement modifiés sont
// tracés. Écrire l'objet entier noierait le changement dans le reste et
// gonflerait la table sans rien apporter.
export function diff(avant, apres) {
  const a = {}, b = {};
  for (const cle of Object.keys(apres || {})) {
    if (avant?.[cle] === apres[cle]) continue;
    a[cle] = avant?.[cle] ?? null;
    b[cle] = apres[cle];
  }
  return { avant: Object.keys(a).length ? a : null, apres: Object.keys(b).length ? b : null };
}

// entiteType par défaut 'utilisateur' : cette tâche ne trace que
// l'administration des comptes. Les autres modules passent leur propre type.
export async function auditer(client, req, { action, entiteId, avant = null, apres = null, entiteType = "utilisateur", acteurId }) {
  await client.query(
    `INSERT INTO audit_log (id_utilisateur, action, entite_type, entite_id,
                            valeur_avant, valeur_apres, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      // Acteur de la session par défaut. acteurId le force pour les routes
      // publiques, ou l'utilisateur agit sans session ouverte : c'est le cas
      // de la réinitialisation par lien, dont l'acteur est le titulaire.
      acteurId ?? req?.user?.id ?? null,
      action,
      entiteType,
      entiteId,      (() => { const f = filtrerSensibles(avant); return f ? JSON.stringify(f) : null; })(),
      (() => { const f = filtrerSensibles(apres); return f ? JSON.stringify(f) : null; })(),
      (req?.ip || "").slice(0, 45),
    ]
  );
}
