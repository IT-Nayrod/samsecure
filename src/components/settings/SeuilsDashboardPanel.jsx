// SeuilsDashboardPanel - édition des seuils de dashboard par l'administrateur
// du tenant (chantier seuils). Remplace le placeholder « gérés par l'équipe
// SamSecure » de l'onglet Configuration.
//
// Données servies par GET /api/dashboards/seuils : lignes du tenant avec le
// défaut Commune en regard. Deux familles :
//   - colorimétrie des widgets : 4 échelles (1 vert, 2 jaune, 3 orange,
//     4 rouge), la cohérence entre échelles est vérifiée par le serveur et
//     son message d'erreur est affiché tel quel ;
//   - seuils d'alerte métier à échelle unique (conformité, budget).
// Permission : gerer_utilisateurs (la route refuse sinon, les champs sont
// désactivés à l'écran).
import { useState, useEffect, useCallback } from 'react';
import { Loader2, RotateCcw } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import useRbac from '../../hooks/useRbac';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Modal from '../ui/Modal';
import { dashboardService } from '../../services/dashboardService';
import { TITRES_WIDGETS } from '../Dashboard/composition';
import { COULEUR_NIVEAU } from '../Dashboard/couleurs';

// Libellés des seuils métier à échelle unique, absents de TITRES_WIDGETS
// (ils ne sont pas des widgets mais des seuils d'alerte des modules).
const LIBELLES_METIER = {
  conformite_taux: 'Taux de conformité (alerte)',
  conformite_ecart_valorise: 'Écart de conformité valorisé (alerte)',
  budget_taux_engagement: "Taux d'engagement budgétaire (alerte)",
};

const LIBELLES_UNITES = {
  pct: '%', pourcent: '%', euros: '€', mois: 'mois', jours: 'jours',
  nombre: 'nombre', points: 'points',
};

function libelleSeuil(widgetCode) {
  return TITRES_WIDGETS[widgetCode] ?? LIBELLES_METIER[widgetCode] ?? widgetCode;
}

export default function SeuilsDashboardPanel() {
  const { addToast } = useToast();
  const { canWrite } = useRbac({ write: 'gerer_utilisateurs' });
  const [seuils, setSeuils] = useState([]);
  const [saisies, setSaisies] = useState({});       // "widget:echelle" -> texte saisi
  const [etat, setEtat] = useState('chargement');   // chargement | pret | erreur
  const [erreur, setErreur] = useState(null);
  const [enCours, setEnCours] = useState(null);     // widget_code en cours d'écriture
  const [confirmerTout, setConfirmerTout] = useState(false);

  const charger = useCallback(async () => {
    setEtat('chargement');
    setErreur(null);
    try {
      const r = await dashboardService.seuils();
      setSeuils(r?.seuils ?? []);
      setSaisies({});
      setEtat('pret');
    } catch (e) {
      setErreur(e?.message || "Les seuils n'ont pas pu être chargés.");
      setEtat('erreur');
    }
  }, []);

  useEffect(() => { charger(); }, [charger]);

  // Regroupement par widget, colorimétrie (plusieurs échelles) puis métier.
  const parWidget = new Map();
  for (const s of seuils) {
    if (!parWidget.has(s.widget_code)) parWidget.set(s.widget_code, []);
    parWidget.get(s.widget_code).push(s);
  }
  const groupes = [...parWidget.entries()].map(([code, lignes]) => ({
    code,
    lignes: [...lignes].sort((a, b) => a.echelle - b.echelle),
    titre: libelleSeuil(code),
    personnalise: lignes.some((l) => l.personnalise),
  })).sort((a, b) => a.titre.localeCompare(b.titre, 'fr'));
  const colorimetrie = groupes.filter((g) => g.lignes.length > 1);
  const metier = groupes.filter((g) => g.lignes.length === 1);

  function cle(s) { return `${s.widget_code}:${s.echelle}`; }

  function valeurSaisie(s) {
    return saisies[cle(s)] !== undefined ? saisies[cle(s)] : String(s.valeur);
  }

  function modifiees(groupe) {
    return groupe.lignes.filter((s) => {
      const brut = saisies[cle(s)];
      if (brut === undefined || brut === '') return false;
      const nombre = Number(brut);
      return Number.isFinite(nombre) && nombre !== s.valeur;
    });
  }

  async function enregistrer(groupe) {
    const lignes = modifiees(groupe);
    if (!lignes.length) return;
    setEnCours(groupe.code);
    try {
      // Écritures séquentielles : la première incohérence arrête et son
      // message serveur est affiché tel quel.
      for (const s of lignes) {
        await dashboardService.enregistrerSeuil(s.widget_code, s.echelle, Number(saisies[cle(s)]));
      }
      addToast({ type: 'success', message: `Seuils « ${groupe.titre} » enregistrés.` });
      await charger();
    } catch (e) {
      addToast({ type: 'error', message: e?.message || "Le seuil n'a pas pu être enregistré." });
    } finally {
      setEnCours(null);
    }
  }

  async function retablir(portee, libelle) {
    setEnCours(portee.widget_code ?? '*');
    try {
      const r = await dashboardService.retablirSeuils(portee);
      setSeuils(r?.seuils ?? []);
      setSaisies({});
      addToast({ type: 'success', message: `Valeurs par défaut rétablies (${libelle}).` });
    } catch (e) {
      addToast({ type: 'error', message: e?.message || "Les seuils n'ont pas pu être rétablis." });
    } finally {
      setEnCours(null);
      setConfirmerTout(false);
    }
  }

  if (etat === 'chargement') {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
        <Loader2 size={16} className="animate-spin" /> Chargement des seuils…
      </div>
    );
  }
  if (etat === 'erreur') {
    return (
      <div className="flex flex-col gap-3 py-2">
        <p className="text-sm text-red-600 dark:text-red-400">{erreur}</p>
        <div><Button variant="secondary" size="sm" onClick={charger}>Réessayer</Button></div>
      </div>
    );
  }

  function carteGroupe(groupe, estColorimetrie) {
    const enEcriture = enCours === groupe.code;
    const aModifs = modifiees(groupe).length > 0;
    const unite = LIBELLES_UNITES[groupe.lignes[0]?.unite] ?? groupe.lignes[0]?.unite ?? '';
    return (
      <div key={groupe.code} className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{groupe.titre}</p>
            <span className="text-xs text-gray-400 whitespace-nowrap">({unite})</span>
            {groupe.personnalise && <Badge variant="warning" label="Personnalisé" />}
          </div>
          {canWrite && (
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" disabled={enEcriture || !groupe.personnalise}
                onClick={() => retablir({ widget_code: groupe.code }, groupe.titre)}>
                <RotateCcw size={14} /> Rétablir le défaut
              </Button>
              <Button variant="primary" size="sm" disabled={enEcriture || !aModifs}
                onClick={() => enregistrer(groupe)}>
                {enEcriture ? <Loader2 size={14} className="animate-spin" /> : null} Enregistrer
              </Button>
            </div>
          )}
        </div>
        <div className={`grid gap-3 ${estColorimetrie ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-4'}`}>
          {groupe.lignes.map((s) => (
            <div key={cle(s)} className="flex flex-col gap-1">
              <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                {estColorimetrie && (
                  <span className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: COULEUR_NIVEAU[s.echelle] }} />
                )}
                {estColorimetrie ? `Niveau ${s.echelle}` : 'Seuil'}
              </label>
              <input
                type="number"
                step="any"
                min="0"
                disabled={!canWrite || enEcriture}
                value={valeurSaisie(s)}
                onChange={(e) => setSaisies((prev) => ({ ...prev, [cle(s)]: e.target.value }))}
                className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:disabled:bg-gray-800"
              />
              <p className="text-[11px] text-gray-400">
                {s.defaut ? `Défaut : ${s.defaut.valeur}` : 'Sans défaut SamSecure'}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Les seuils règlent la colorimétrie des widgets des dashboards et les
          alertes des modules. Le défaut SamSecure est rappelé sous chaque champ.
        </p>
        {canWrite && (
          <Button variant="secondary" size="sm" disabled={enCours !== null}
            onClick={() => setConfirmerTout(true)}>
            <RotateCcw size={14} /> Tout rétablir
          </Button>
        )}
      </div>

      {metier.length > 0 && (
        <div className="flex flex-col gap-3">
          <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Seuils d'alerte métier</h5>
          {metier.map((g) => carteGroupe(g, false))}
        </div>
      )}
      {colorimetrie.length > 0 && (
        <div className="flex flex-col gap-3">
          <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Colorimétrie des widgets</h5>
          {colorimetrie.map((g) => carteGroupe(g, true))}
        </div>
      )}
      {!groupes.length && (
        <p className="text-sm text-gray-500">Aucun seuil configuré.</p>
      )}

      <Modal isOpen={confirmerTout} onClose={() => setConfirmerTout(false)}
        title="Rétablir tous les seuils" size="sm"
        footer={(
          <>
            <Button variant="secondary" onClick={() => setConfirmerTout(false)}>Annuler</Button>
            <Button variant="primary" disabled={enCours !== null}
              onClick={() => retablir({}, 'tous les seuils')}>
              Tout rétablir
            </Button>
          </>
        )}
      >
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Tous les seuils vont être rétablis aux valeurs par défaut SamSecure,
          y compris ceux personnalisés. Confirmer ?
        </p>
      </Modal>
    </div>
  );
}
