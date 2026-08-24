// RapprochementModal - rapprochement manuel d'un releve constate (#111).
// Trois decisions humaines : associer a une affectation existante (candidates
// de meme reference en tete, puis toute affectation par recherche), marquer en
// ecart assume, rejeter avec motif. Aucune creation d'affectation ici : c'est
// la doctrine actee, l'outil constate et alerte.
import { useState, useEffect, useMemo } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import FormField from '../ui/FormField';
import { inventaireService } from '../../services/inventaireService';

const inputCls = 'w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500';

const MODES = {
  rapprocher: 'Associer a une affectation',
  'ecart-assume': 'Marquer en ecart assume',
  rejeter: 'Rejeter le releve',
};

export default function RapprochementModal({ isOpen, onClose, releve, onDone }) {
  const [mode, setMode] = useState('rapprocher');
  const [affectations, setAffectations] = useState([]);
  const [recherche, setRecherche] = useState('');
  const [idAffectation, setIdAffectation] = useState('');
  const [motif, setMotif] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen || !releve) return;
    setMode(releve.statut_rapprochement === 'rapproche' ? 'ecart-assume' : 'rapprocher');
    setRecherche(''); setMotif(''); setError(null);
    setIdAffectation(releve.candidates?.[0]?.id ?? '');
    inventaireService.listAffectations().then(setAffectations).catch(err => setError(err.message));
  }, [isOpen, releve]);

  const candidates = useMemo(() => releve?.candidates ?? [], [releve]);
  const autres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return affectations
      .filter(a => !candidates.some(c => c.id === a.id))
      .filter(a => !q || [a.label, a.reference_client, a.produit_label, a.licence_label, a.societe_label]
        .some(v => (v ?? '').toLowerCase().includes(q)));
  }, [affectations, candidates, recherche]);

  const libelle = a => [a.reference_client, a.label, a.produit_label ?? a.licence_label, a.societe_label, a.quantite != null ? `x${a.quantite}` : null]
    .filter(Boolean).join(' - ');

  async function submit(e) {
    e?.preventDefault();
    if (!releve) return;
    setIsSubmitting(true);
    setError(null);
    try {
      let data;
      if (mode === 'rapprocher') data = await inventaireService.rapprocher(releve.id, idAffectation);
      else if (mode === 'ecart-assume') data = await inventaireService.ecartAssume(releve.id, motif || undefined);
      else data = await inventaireService.rejeter(releve.id, motif);
      onDone?.(data, mode);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!releve) return null;
  const modesPermis = releve.statut_rapprochement === 'rapproche'
    ? ['ecart-assume']
    : ['rapprocher', 'ecart-assume', 'rejeter'];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Rapprocher : ${releve.produit_label ?? '?'} - ${releve.reference ?? '?'}`} size="md"
      footer={<>
        <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>Annuler</Button>
        <Button onClick={submit} isLoading={isSubmitting}
          disabled={(mode === 'rapprocher' && !idAffectation) || (mode === 'rejeter' && !motif.trim())}>
          {MODES[mode]}
        </Button>
      </>}
    >
      <form id="rapprochement-form" onSubmit={submit} className="flex flex-col gap-4">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Quantite constatee : <span className="font-medium">{releve.quantite ?? '?'}</span>
          {releve.societe_label ? <> - {releve.societe_label}</> : null}
        </p>
        <div className="flex gap-2 flex-wrap">
          {modesPermis.map(m => (
            <button key={m} type="button" onClick={() => setMode(m)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${mode === m ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-blue-300'}`}>
              {MODES[m]}
            </button>
          ))}
        </div>

        {mode === 'rapprocher' && (
          <>
            {candidates.length > 0 && (
              <FormField label={`Affectation(s) de meme reference (${candidates.length})`}>
                <div className="flex flex-col gap-1.5">
                  {candidates.map(a => (
                    <label key={a.id} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                      <input type="radio" name="aff" value={a.id} checked={idAffectation === a.id} onChange={() => setIdAffectation(a.id)} className="mt-1" />
                      <span>{libelle(a)}</span>
                    </label>
                  ))}
                </div>
              </FormField>
            )}
            <FormField label="Autre affectation" hint="Recherche par reference, libelle, produit ou societe.">
              <input value={recherche} onChange={e => setRecherche(e.target.value)} placeholder="Rechercher" className={`${inputCls} mb-2`} />
              <select value={candidates.some(c => c.id === idAffectation) ? '' : idAffectation} onChange={e => setIdAffectation(e.target.value)} className={inputCls} size={Math.min(6, Math.max(2, autres.length + 1))}>
                <option value="">Choisir une affectation ({autres.length})</option>
                {autres.map(a => <option key={a.id} value={a.id}>{libelle(a)}</option>)}
              </select>
            </FormField>
            {affectations.length === 0 && <p className="text-xs text-gray-500">Aucune affectation declaree : ce releve ne peut etre que marque en ecart ou rejete.</p>}
          </>
        )}

        {mode !== 'rapprocher' && (
          <FormField label={mode === 'rejeter' ? 'Motif du rejet' : 'Commentaire'} required={mode === 'rejeter'}>
            <textarea value={motif} onChange={e => setMotif(e.target.value)} rows={3} className={inputCls}
              placeholder={mode === 'rejeter' ? 'Obligatoire : pourquoi ce releve est ecarte' : 'Optionnel : pourquoi cet ecart est assume'} />
          </FormField>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
    </Modal>
  );
}
