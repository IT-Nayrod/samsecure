// Politique de mot de passe et generation, v0.5.
//
// Les valeurs sont en dur, comme acte pour cette version : 12 caracteres, une
// majuscule, une minuscule, un chiffre, un caractere special. Elles vivent ici
// et nulle part ailleurs, pour qu'un durcissement ulterieur se fasse en un
// seul endroit et vaille pour la definition comme pour la generation.
//
// Ce module ne journalise rien et ne renvoie jamais la valeur qu'il recoit :
// un mot de passe ne doit exister qu'en memoire, le temps de son hachage.
import crypto from "node:crypto";

export const POLITIQUE = {
  longueurMin: 12,
  longueurGeneree: 16,
};

const MAJUSCULES = "ABCDEFGHJKLMNPQRSTUVWXYZ";   // I et O ecartes
const MINUSCULES = "abcdefghijkmnopqrstuvwxyz";  // l ecarte
const CHIFFRES   = "23456789";                   // 0 et 1 ecartes
const SPECIAUX   = "!@#$%^&*()-_=+[]{}?";

// Verifie la politique et renvoie la liste des exigences non satisfaites.
// Renvoyer la liste plutot qu'un booleen permet un message qui dit ce qui
// manque, au lieu de laisser l'utilisateur deviner.
export function verifierPolitique(valeur) {
  const manques = [];
  const v = typeof valeur === "string" ? valeur : "";
  if (v.length < POLITIQUE.longueurMin) manques.push(`${POLITIQUE.longueurMin} caractères minimum`);
  if (!/[A-Z]/.test(v)) manques.push("une majuscule");
  if (!/[a-z]/.test(v)) manques.push("une minuscule");
  if (!/[0-9]/.test(v)) manques.push("un chiffre");
  // Tout ce qui n'est ni lettre ni chiffre ni espace compte comme special :
  // restreindre a une liste fermee refuserait des mots de passe legitimes.
  if (!/[^A-Za-z0-9\s]/.test(v)) manques.push("un caractère spécial");
  return manques;
}

// Tirage uniforme sans biais : randomInt est cryptographique, contrairement a
// Math.random qui ne doit jamais servir a produire un secret.
function tirer(alphabet) {
  return alphabet[crypto.randomInt(0, alphabet.length)];
}

// Genere un mot de passe conforme par construction : un caractere de chaque
// classe est place d'abord, le reste est tire dans l'alphabet complet, puis
// l'ensemble est melange pour que les premieres positions ne soient pas
// previsibles.
export function genererMotDePasse() {
  const alphabet = MAJUSCULES + MINUSCULES + CHIFFRES + SPECIAUX;
  const caracteres = [tirer(MAJUSCULES), tirer(MINUSCULES), tirer(CHIFFRES), tirer(SPECIAUX)];
  while (caracteres.length < POLITIQUE.longueurGeneree) caracteres.push(tirer(alphabet));

  // Melange de Fisher-Yates, avec la meme source d'alea que le tirage.
  for (let i = caracteres.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [caracteres[i], caracteres[j]] = [caracteres[j], caracteres[i]];
  }
  const valeur = caracteres.join("");

  // Garde-fou : la generation doit satisfaire la politique qu'elle est censee
  // respecter. Si ce n'est pas le cas, c'est un defaut de ce module, pas une
  // saisie utilisateur, et il doit se voir immediatement.
  const manques = verifierPolitique(valeur);
  if (manques.length) throw new Error(`Generation non conforme : ${manques.join(", ")}`);
  return valeur;
}