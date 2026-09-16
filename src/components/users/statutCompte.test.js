// Tests des règles d'état d'un compte (#211). Exécution :
// `node --test src/components/users/statutCompte.test.js` (aucune dépendance).
// Hors du glob de `npm test` (src/utils/*.test.js), ce fichier vivant avec
// l'écran qu'il décrit.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  dateIso, estInactif, estEnAttenteDeMiseEnFonction, estActifAujourdhui,
  FILTRES_STATUT, FILTRES_DATES, filtrerParStatut,
} from './statutCompte.js';

const J = '2026-09-16';
const compte = (props) => ({ id: 'x', actif: true, date_finale: null, date_mise_en_fonction: null, ...props });
const valeurs = (utilisateur) => filtresRetenant(utilisateur).sort();
function filtresRetenant(u) {
  return [...FILTRES_STATUT, ...FILTRES_DATES].filter((f) => f.predicat(u, J)).map((f) => f.valeur);
}

describe('dateIso', () => {
  test('texte AAAA-MM-JJ inchangé, vide ou invalide à null', () => {
    assert.equal(dateIso('2026-09-30'), '2026-09-30');
    assert.equal(dateIso(null), null);
    assert.equal(dateIso(undefined), null);
    assert.equal(dateIso(''), null);
    assert.equal(dateIso('pas une date'), null);
  });
  test('objet Date ou horodatage ramené au jour local', () => {
    const d = new Date(2026, 8, 30, 12, 0, 0);
    assert.equal(dateIso(d), '2026-09-30');
    assert.equal(dateIso(d.toISOString()), '2026-09-30');
  });
});

describe('règle serveur reprise', () => {
  test('actif sans date : actif aujourd\'hui', () => {
    assert.equal(estActifAujourdhui(compte(), J), true);
    assert.equal(estInactif(compte(), J), false);
  });
  test('date finale incluse : actif le dernier jour, inactif le lendemain', () => {
    assert.equal(estActifAujourdhui(compte({ date_finale: J }), J), true);
    assert.equal(estInactif(compte({ date_finale: '2026-09-15' }), J), true);
  });
  test('mise en fonction incluse : actif le premier jour, en attente la veille', () => {
    assert.equal(estActifAujourdhui(compte({ date_mise_en_fonction: J }), J), true);
    assert.equal(estEnAttenteDeMiseEnFonction(compte({ date_mise_en_fonction: '2026-09-17' }), J), true);
    assert.equal(estActifAujourdhui(compte({ date_mise_en_fonction: '2026-09-17' }), J), false);
  });
  test('actif = false prime sur toute date', () => {
    assert.equal(estInactif(compte({ actif: false, date_finale: '2027-01-01' }), J), true);
    assert.equal(estActifAujourdhui(compte({ actif: false }), J), false);
  });
});

describe('filtres de la liste (#211)', () => {
  test('actif sans date limite', () => {
    assert.deepEqual(valeurs(compte()), ['actif_sans_limite', 'actifs', 'tous']);
  });
  test('actif avec date limite à venir, ou égale à aujourd\'hui', () => {
    assert.deepEqual(valeurs(compte({ date_finale: '2026-12-31' })), ['actif_avec_limite', 'actifs', 'tous']);
    assert.deepEqual(valeurs(compte({ date_finale: J })), ['actif_avec_limite', 'actifs', 'tous']);
  });
  test('échéance dépassée : inactif simple, hors des filtres par dates', () => {
    assert.deepEqual(valeurs(compte({ date_finale: '2026-09-01' })), ['inactifs', 'tous']);
  });
  test('désactivé sans date : inactif simple seulement', () => {
    assert.deepEqual(valeurs(compte({ actif: false })), ['inactifs', 'tous']);
    assert.deepEqual(valeurs(compte({ actif: false, date_finale: '2026-09-10' })), ['inactifs', 'tous']);
  });
  test('activation programmée (actif = true, date future) : filtre activation future, pas « actif sans limite »', () => {
    assert.deepEqual(valeurs(compte({ date_mise_en_fonction: '2026-10-01' })), ['actifs', 'inactif_activation_future', 'tous']);
    assert.deepEqual(
      valeurs(compte({ date_mise_en_fonction: '2026-10-01', date_finale: '2026-12-31' })),
      ['actifs', 'inactif_activation_future', 'tous'],
    );
  });
  test('désactivé avec date d\'activation future : inactif et activation future', () => {
    assert.deepEqual(valeurs(compte({ actif: false, date_mise_en_fonction: '2026-10-01' })), ['inactif_activation_future', 'inactifs', 'tous']);
  });
  test('date d\'activation passée : aucun effet', () => {
    assert.deepEqual(valeurs(compte({ date_mise_en_fonction: '2026-01-01' })), ['actif_sans_limite', 'actifs', 'tous']);
    assert.deepEqual(valeurs(compte({ actif: false, date_mise_en_fonction: '2026-01-01' })), ['inactifs', 'tous']);
  });
  test('les trois filtres par dates sont disjoints', () => {
    const cas = [
      compte(), compte({ date_finale: '2026-12-31' }), compte({ date_finale: '2026-09-01' }),
      compte({ actif: false }), compte({ date_mise_en_fonction: '2026-10-01' }),
      compte({ actif: false, date_mise_en_fonction: '2026-10-01' }),
      compte({ date_mise_en_fonction: '2026-10-01', date_finale: '2026-09-01' }),
    ];
    for (const c of cas) {
      const retenus = FILTRES_DATES.filter((f) => f.predicat(c, J));
      assert.ok(retenus.length <= 1, `${JSON.stringify(c)} retenu par ${retenus.map((f) => f.valeur)}`);
    }
  });
});

describe('filtrerParStatut', () => {
  const liste = [
    compte({ id: 'a' }),
    compte({ id: 'b', date_finale: '2026-12-31' }),
    compte({ id: 'c', actif: false }),
    compte({ id: 'd', date_mise_en_fonction: '2026-10-01' }),
  ];
  const ids = (valeur) => filtrerParStatut(liste, valeur, J).map((u) => u.id);
  test('chaque valeur', () => {
    assert.deepEqual(ids('actifs'), ['a', 'b', 'd']);
    assert.deepEqual(ids('inactifs'), ['c']);
    assert.deepEqual(ids('tous'), ['a', 'b', 'c', 'd']);
    assert.deepEqual(ids('actif_sans_limite'), ['a']);
    assert.deepEqual(ids('actif_avec_limite'), ['b']);
    assert.deepEqual(ids('inactif_activation_future'), ['d']);
  });
  test('valeur inconnue : liste entière', () => {
    assert.deepEqual(ids('Fin programmée'), ['a', 'b', 'c', 'd']);
    assert.deepEqual(ids(''), ['a', 'b', 'c', 'd']);
  });
});
