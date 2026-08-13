// Trace probante des actions d'administration.
//
// Distincte de journal_ecriture : audit_log porte l'acteur, l'adresse IP et
// les valeurs avant et apres, que le journal fonctionnel ne modelise pas. Les
// deux coexistent, le journal raconte, l'audit prouve.
//
// Contrairement a log(), cette fonction n'avale pas ses erreurs : une trace
// probante manquante doit faire echouer l'operation, pas passer inapercue.
// C'est la meme regle que dans preuves.js et factures.js, mutualisee ici parce
// que quatre routeurs vont desormais l'appliquer.

// Champs interdits dans valeur_avant et valeur_apres, en toutes circonstances.
// Le filtrage se fait A L'ECRITURE et non a la lecture : une trace ne doit
// jamais contenir de secret, meme haché, meme si personne ne la lit. Un hash
// bcrypt reste une donnee attaquable hors ligne, et un jeton reste rejouable.
const CHAMPS_SENSIBLES = [
  "mot_de_passe_hash", "mot_de_passe", "password", "motdepasse",
  "access_token", "refresh_token", "token", "jeton",
  "secret", "totp", "code_2fa", "two_factor_secret", "hash",
];

// Le filtre porte sur le nom du champ, insensible a la casse, et retire la
// cle entierement plutot que de la masquer : une cle presente avec une valeur
// caviardee revelerait deja qu'un mot de passe a change, et l'action suffit a
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

// Diff minimal entre deux etats : seuls les champs reellement modifies sont
// traces. Ecrire l'objet entier noierait le changement dans le reste et
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

// entiteType par defaut 'utilisateur' : cette tache ne trace que
// l'administration des comptes. Les autres modules passent leur propre type.
export async function auditer(client, req, { action, entiteId, avant = null, apres = null, entiteType = "utilisateur" }) {
  await client.query(
    `INSERT INTO audit_log (id_utilisateur, action, entite_type, entite_id,
                            valeur_avant, valeur_apres, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      // Acteur de la session. Nullable en base : une execution sans acteur
      // humain reste tracable sans inventer d'utilisateur systeme.
      req?.user?.id || null,
      action,
      entiteType,
      entiteId,      (() => { const f = filtrerSensibles(avant); return f ? JSON.stringify(f) : null; })(),
      (() => { const f = filtrerSensibles(apres); return f ? JSON.stringify(f) : null; })(),
      (req?.ip || "").slice(0, 45),
    ]
  );
}
