// Politique de mot de passe et génération, v0.5.
//
// Les valeurs sont en dur, comme acté pour cette version : 12 caractères, une
// majuscule, une minuscule, un chiffre, un caractère spécial. Elles vivent ici
// et nulle part ailleurs, pour qu'un durcissement ultérieur se fasse en un
// seul endroit et vaille pour la définition comme pour la génération.
//
// Ce module ne journalise rien et ne renvoie jamais la valeur qu'il reçoit :
// un mot de passe ne doit exister qu'en mémoire, le temps de son hachage.
import crypto from "node:crypto";

export const POLITIQUE = {
  longueurMin: 12,
  longueurGeneree: 16,
};

const MAJUSCULES = "ABCDEFGHJKLMNPQRSTUVWXYZ";   // I et O écartés
const MINUSCULES = "abcdefghijkmnopqrstuvwxyz";  // l écarté
const CHIFFRES   = "23456789";                   // 0 et 1 écartés
const SPECIAUX   = "!@#$%^&*()-_=+[]{}?";

// Vérifie la politique et renvoie la liste des exigences non satisfaites.
// Renvoyer la liste plutôt qu'un booléen permet un message qui dit ce qui
// manque, au lieu de laisser l'utilisateur deviner.
export function verifierPolitique(valeur) {
  const manques = [];
  const v = typeof valeur === "string" ? valeur : "";
  if (v.length < POLITIQUE.longueurMin) manques.push(`${POLITIQUE.longueurMin} caractères minimum`);
  if (!/[A-Z]/.test(v)) manques.push("une majuscule");
  if (!/[a-z]/.test(v)) manques.push("une minuscule");
  if (!/[0-9]/.test(v)) manques.push("un chiffre");
  // Tout ce qui n'est ni lettre ni chiffre ni espace compte comme spécial :
  // restreindre à une liste fermée refuserait des mots de passe légitimes.
  if (!/[^A-Za-z0-9\s]/.test(v)) manques.push("un caractère spécial");
  return manques;
}

// Tirage uniforme sans biais : randomInt est cryptographique, contrairement à
// Math.random qui ne doit jamais servir à produire un secret.
function tirer(alphabet) {
  return alphabet[crypto.randomInt(0, alphabet.length)];
}

// Génère un mot de passe conforme par construction : un caractère de chaque
// classe est placé d'abord, le reste est tiré dans l'alphabet complet, puis
// l'ensemble est mélangé pour que les premières positions ne soient pas
// prévisibles.
export function genererMotDePasse() {
  const alphabet = MAJUSCULES + MINUSCULES + CHIFFRES + SPECIAUX;
  const caracteres = [tirer(MAJUSCULES), tirer(MINUSCULES), tirer(CHIFFRES), tirer(SPECIAUX)];
  while (caracteres.length < POLITIQUE.longueurGeneree) caracteres.push(tirer(alphabet));

  // Mélange de Fisher-Yates, avec la même source d'aléa que le tirage.
  for (let i = caracteres.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [caracteres[i], caracteres[j]] = [caracteres[j], caracteres[i]];
  }
  const valeur = caracteres.join("");

  // Garde-fou : la génération doit satisfaire la politique qu'elle est censée
  // respecter. Si ce n'est pas le cas, c'est un défaut de ce module, pas une
  // saisie utilisateur, et il doit se voir immédiatement.
  const manques = verifierPolitique(valeur);
  if (manques.length) throw new Error(`Generation non conforme : ${manques.join(", ")}`);
  return valeur;
}