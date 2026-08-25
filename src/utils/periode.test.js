// Tests du module de période partagé (US #164). Exécution : `npm test` (node --test, aucune dépendance).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  normaliserDebutExercice, dateAnniversaire, anneeCalendaire, trimestreCivil,
  exerciceFiscal, exerciceFiscalParCle, resoudrePeriode, dateDansPeriode,
  intervalleChevauchePeriode, toIsoDate, fromIsoDate, estBissextile,
} from './periode.js';

const D = (iso) => fromIsoDate(iso);
const bornes = (p) => [p.dateDebut ?? toIsoDate(p.debut), p.dateFin ?? toIsoDate(p.fin)];

describe('normaliserDebutExercice', () => {
  test('défaut 1er janvier si absent ou invalide', () => {
    assert.deepEqual(normaliserDebutExercice(null), { jour: 1, mois: 1 });
    assert.deepEqual(normaliserDebutExercice(undefined), { jour: 1, mois: 1 });
    assert.deepEqual(normaliserDebutExercice(''), { jour: 1, mois: 1 });
    assert.deepEqual(normaliserDebutExercice('n importe quoi'), { jour: 1, mois: 1 });
    assert.deepEqual(normaliserDebutExercice({ jour: 0, mois: 13 }), { jour: 1, mois: 1 });
  });
  test('objet { jour, mois } des mocks', () => {
    assert.deepEqual(normaliserDebutExercice({ jour: 1, mois: 4 }), { jour: 1, mois: 4 });
  });
  test("DATE::text de l'API (année arbitraire ignorée) et forme MM-DD", () => {
    assert.deepEqual(normaliserDebutExercice('2000-04-01'), { jour: 1, mois: 4 });
    assert.deepEqual(normaliserDebutExercice('2000-04-01T00:00:00.000Z'), { jour: 1, mois: 4 });
    assert.deepEqual(normaliserDebutExercice('07-01'), { jour: 1, mois: 7 });
  });
  test('objet société portant debut_exercice_fiscal, y compris null', () => {
    assert.deepEqual(normaliserDebutExercice({ id: '2', debut_exercice_fiscal: { jour: 1, mois: 4 } }), { jour: 1, mois: 4 });
    assert.deepEqual(normaliserDebutExercice({ id: '9', debut_exercice_fiscal: null }), { jour: 1, mois: 1 });
  });
  test('jour borné au maximum du mois', () => {
    assert.deepEqual(normaliserDebutExercice({ jour: 31, mois: 4 }), { jour: 30, mois: 4 });
    assert.deepEqual(normaliserDebutExercice({ jour: 30, mois: 2 }), { jour: 29, mois: 2 });
  });
});

describe('bissextiles', () => {
  test('estBissextile', () => {
    assert.equal(estBissextile(2024), true);
    assert.equal(estBissextile(2025), false);
    assert.equal(estBissextile(2100), false);
    assert.equal(estBissextile(2000), true);
  });
  test('ancrage au 29 février : 28 février les années non bissextiles, jamais le 1er mars', () => {
    assert.equal(toIsoDate(dateAnniversaire(2024, { jour: 29, mois: 2 })), '2024-02-29');
    assert.equal(toIsoDate(dateAnniversaire(2025, { jour: 29, mois: 2 })), '2025-02-28');
  });
  test('exercice ancré au 1er mars 2027 se termine le 29 février 2028 (bissextile)', () => {
    const p = exerciceFiscal(D('2027-06-15'), { jour: 1, mois: 3 });
    assert.deepEqual(bornes(p), ['2027-03-01', '2028-02-29']);
  });
  test('T1 2024 court du 01/01 au 31/03 et contient le 29 février', () => {
    const t1 = trimestreCivil(D('2024-02-29'), 0);
    assert.deepEqual(bornes(t1), ['2024-01-01', '2024-03-31']);
    assert.equal(dateDansPeriode('2024-02-29', t1), true);
  });
  test('année calendaire bissextile 2024 contient le 29/02', () => {
    assert.equal(dateDansPeriode('2024-02-29', anneeCalendaire(D('2024-07-01'))), true);
  });
});

describe('année calendaire', () => {
  test('courant, précédent, suivant', () => {
    const ref = D('2026-08-25');
    assert.deepEqual(bornes(resoudrePeriode({ type: 'calendaire', fenetre: 'courant', reference: ref })), ['2026-01-01', '2026-12-31']);
    assert.deepEqual(bornes(resoudrePeriode({ type: 'calendaire', fenetre: 'precedent', reference: ref })), ['2025-01-01', '2025-12-31']);
    assert.deepEqual(bornes(resoudrePeriode({ type: 'calendaire', fenetre: 'suivant', reference: ref })), ['2027-01-01', '2027-12-31']);
  });
  test('label et clé', () => {
    const p = resoudrePeriode({ type: 'calendaire', reference: D('2026-08-25') });
    assert.equal(p.label, 'Année 2026');
    assert.equal(p.cle, '2026');
  });
});

describe('trimestre civil', () => {
  test('T3 2026 en cours au 25/08/2026', () => {
    const p = resoudrePeriode({ type: 'trimestre', fenetre: 'courant', reference: D('2026-08-25') });
    assert.deepEqual(bornes(p), ['2026-07-01', '2026-09-30']);
    assert.equal(p.label, 'T3 2026');
    assert.equal(p.cle, '2026-T3');
  });
  test('précédent en janvier bascule sur T4 de l année d avant', () => {
    const p = resoudrePeriode({ type: 'trimestre', fenetre: 'precedent', reference: D('2026-01-15') });
    assert.deepEqual(bornes(p), ['2025-10-01', '2025-12-31']);
    assert.equal(p.label, 'T4 2025');
  });
  test('suivant en décembre bascule sur T1 de l année d après', () => {
    const p = resoudrePeriode({ type: 'trimestre', fenetre: 'suivant', reference: D('2026-12-31') });
    assert.deepEqual(bornes(p), ['2027-01-01', '2027-03-31']);
    assert.equal(p.label, 'T1 2027');
  });
  test('T2 finit le 30 juin, T4 le 31 décembre', () => {
    assert.deepEqual(bornes(trimestreCivil(D('2026-05-01'))), ['2026-04-01', '2026-06-30']);
    assert.deepEqual(bornes(trimestreCivil(D('2026-11-01'))), ['2026-10-01', '2026-12-31']);
  });
});

describe('exercice fiscal décalé (clôture au 31 mars)', () => {
  const de = { jour: 1, mois: 4 };
  test('au 25/08/2026 : exercice 2026 du 01/04/2026 au 31/03/2027', () => {
    const p = resoudrePeriode({ type: 'fiscale', fenetre: 'courant', debutExercice: de, reference: D('2026-08-25') });
    assert.deepEqual(bornes(p), ['2026-04-01', '2027-03-31']);
    assert.equal(p.cle, '2026');
    assert.equal(p.label, 'Exercice 2026-2027 (01/04/2026 au 31/03/2027)');
  });
  test('au 15/02/2026 (avant l anniversaire) : exercice 2025 du 01/04/2025 au 31/03/2026', () => {
    const p = resoudrePeriode({ type: 'fiscale', debutExercice: de, reference: D('2026-02-15') });
    assert.deepEqual(bornes(p), ['2025-04-01', '2026-03-31']);
  });
  test('le jour anniversaire appartient au nouvel exercice, la veille à l ancien', () => {
    assert.equal(exerciceFiscal(D('2026-04-01'), de).cle, '2026');
    assert.equal(exerciceFiscal(D('2026-03-31'), de).cle, '2025');
  });
  test('précédent et suivant', () => {
    const ref = D('2026-08-25');
    assert.deepEqual(bornes(resoudrePeriode({ type: 'fiscale', fenetre: 'precedent', debutExercice: de, reference: ref })), ['2025-04-01', '2026-03-31']);
    assert.deepEqual(bornes(resoudrePeriode({ type: 'fiscale', fenetre: 'suivant', debutExercice: de, reference: ref })), ['2027-04-01', '2028-03-31']);
  });
  test('formats API et société acceptés', () => {
    const ref = D('2026-08-25');
    assert.deepEqual(bornes(resoudrePeriode({ type: 'fiscale', debutExercice: '2000-04-01', reference: ref })), ['2026-04-01', '2027-03-31']);
    assert.deepEqual(bornes(resoudrePeriode({ type: 'fiscale', debutExercice: { raison_sociale: 'Acme Lyon', debut_exercice_fiscal: '2000-04-01' }, reference: ref })), ['2026-04-01', '2027-03-31']);
  });
  test('sans debut_exercice_fiscal : exercice calqué sur l année civile, label court', () => {
    const p = resoudrePeriode({ type: 'fiscale', reference: D('2026-08-25') });
    assert.deepEqual(bornes(p), ['2026-01-01', '2026-12-31']);
    assert.equal(p.label, 'Exercice 2026');
  });
  test('exercice au 1er juillet (Acme Bordeaux)', () => {
    const p = resoudrePeriode({ type: 'fiscale', debutExercice: { jour: 1, mois: 7 }, reference: D('2026-06-30') });
    assert.deepEqual(bornes(p), ['2025-07-01', '2026-06-30']);
  });
  test('exerciceFiscalParCle', () => {
    assert.deepEqual(bornes(exerciceFiscalParCle('2024', de)), ['2024-04-01', '2025-03-31']);
    assert.deepEqual(bornes(exerciceFiscalParCle(2023, '2000-01-01')), ['2023-01-01', '2023-12-31']);
    assert.equal(exerciceFiscalParCle('abc', de), null);
  });
  test('exercice ancré au 29/02 : bornes cohérentes sur bissextile et non bissextile', () => {
    const de29 = { jour: 29, mois: 2 };
    assert.deepEqual(bornes(exerciceFiscal(D('2024-06-01'), de29)), ['2024-02-29', '2025-02-27']);
    assert.deepEqual(bornes(exerciceFiscal(D('2025-06-01'), de29)), ['2025-02-28', '2026-02-27']);
    assert.deepEqual(bornes(exerciceFiscal(D('2027-06-01'), de29)), ['2027-02-28', '2028-02-28']);
  });
});

describe('resoudrePeriode, robustesse', () => {
  test('type ou fenêtre inconnus : repli calendaire courant', () => {
    const p = resoudrePeriode({ type: 'lunaire', fenetre: 'jamais', reference: D('2026-08-25') });
    assert.equal(p.type, 'calendaire');
    assert.equal(p.fenetre, 'courant');
    assert.deepEqual(bornes(p), ['2026-01-01', '2026-12-31']);
  });
  test('référence acceptée en ISO', () => {
    assert.deepEqual(bornes(resoudrePeriode({ type: 'trimestre', reference: '2026-08-25' })), ['2026-07-01', '2026-09-30']);
  });
  test('sans référence : aujourd hui', () => {
    const p = resoudrePeriode({ type: 'calendaire' });
    assert.equal(p.cle, String(new Date().getFullYear()));
  });
  test('Date locales à minuit, ISO sans dérive UTC', () => {
    const p = resoudrePeriode({ type: 'calendaire', reference: D('2026-08-25') });
    assert.equal(p.debut.getHours(), 0);
    assert.equal(toIsoDate(p.debut), '2026-01-01');
    assert.equal(toIsoDate(p.fin), '2026-12-31');
  });
});

describe('appartenance et chevauchement', () => {
  const p = resoudrePeriode({ type: 'fiscale', debutExercice: { jour: 1, mois: 4 }, reference: D('2026-08-25') });
  test('dateDansPeriode bornes incluses', () => {
    assert.equal(dateDansPeriode('2026-04-01', p), true);
    assert.equal(dateDansPeriode('2027-03-31', p), true);
    assert.equal(dateDansPeriode('2026-03-31', p), false);
    assert.equal(dateDansPeriode('2027-04-01', p), false);
    assert.equal(dateDansPeriode(D('2026-10-10'), p), true);
    assert.equal(dateDansPeriode(null, p), false);
    assert.equal(dateDansPeriode('2026-10-10', null), true);
  });
  test('intervalleChevauchePeriode', () => {
    assert.equal(intervalleChevauchePeriode('2026-01-01', '2026-04-01', p), true);
    assert.equal(intervalleChevauchePeriode('2026-01-01', '2026-03-31', p), false);
    assert.equal(intervalleChevauchePeriode('2027-03-31', '2027-12-31', p), true);
    assert.equal(intervalleChevauchePeriode('2025-01-01', '2028-12-31', p), true);
    assert.equal(intervalleChevauchePeriode(null, '2028-12-31', p), false);
  });
});
