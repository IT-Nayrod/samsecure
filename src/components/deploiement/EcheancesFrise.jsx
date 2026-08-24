// EcheancesFrise - frise des echeances de maintenance et de souscription du
// parc, sur une fenetre glissante de 3 mois en arriere et 18 mois en avant.
// Chaque licence porteuse d'une date (date_fin_maintenance, date_fin_souscription)
// est posee proportionnellement sur l'axe ; ce qui est deja echu se lit a
// gauche du repere "aujourd'hui". Les statuts viennent de l'API, la frise ne
// calcule que la position.
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';

const MOIS_AVANT = 3;
const MOIS_APRES = 18;

function ajouterMois(date, n) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

const COULEUR = {
  maintenance_echue: '#F59E0B',
  maintenance: '#7C6FCD',
  souscription_expiree: '#EF4444',
  souscription: '#1F4E79',
};

export default function EcheancesFrise({ licences }) {
  const navigate = useNavigate();

  const { debut, fin, points, aujourdhuiPct } = useMemo(() => {
    const aujourdhui = new Date(); aujourdhui.setHours(0, 0, 0, 0);
    const debut = ajouterMois(aujourdhui, -MOIS_AVANT);
    const fin = ajouterMois(aujourdhui, MOIS_APRES);
    const largeur = fin - debut;
    const pct = (d) => Math.min(100, Math.max(0, ((new Date(d) - debut) / largeur) * 100));

    const points = [];
    for (const l of licences) {
      const nom = l.label || l.produit_label || l.id;
      if (l.date_fin_maintenance && l.statut_maintenance !== 'arretee' && l.statut_maintenance !== 'aucune') {
        const d = new Date(l.date_fin_maintenance);
        if (d >= debut && d <= fin) points.push({
          id: `${l.id}-m`, licenceId: l.id, date: l.date_fin_maintenance, pct: pct(d), nom,
          type: l.statut_maintenance === 'echue' ? 'maintenance_echue' : 'maintenance',
          libelle: l.statut_maintenance === 'echue' ? 'Maintenance echue' : 'Fin de maintenance',
        });
      }
      if (l.type === 'souscription' && l.date_fin_souscription) {
        const d = new Date(l.date_fin_souscription);
        if (d >= debut && d <= fin) points.push({
          id: `${l.id}-s`, licenceId: l.id, date: l.date_fin_souscription, pct: pct(d), nom,
          type: l.statut_echeance === 'expire' ? 'souscription_expiree' : 'souscription',
          libelle: l.statut_echeance === 'expire' ? 'Souscription expiree' : 'Fin de souscription',
        });
      }
    }
    points.sort((a, b) => a.date.localeCompare(b.date));
    return { debut, fin, points, aujourdhuiPct: pct(aujourdhui) };
  }, [licences]);

  // Graduations mensuelles, libellees tous les 3 mois pour rester lisibles.
  const graduations = useMemo(() => {
    const out = [];
    const total = MOIS_AVANT + MOIS_APRES;
    for (let i = 0; i <= total; i++) {
      const d = ajouterMois(debut, i);
      out.push({ pct: (i / total) * 100, label: i % 3 === 0 ? d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }) : null });
    }
    return out;
  }, [debut]);

  if (points.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
        <CheckCircle2 size={16} className="text-green-500" /> Aucune echeance de maintenance ni de souscription entre {debut.toLocaleDateString('fr-FR')} et {fin.toLocaleDateString('fr-FR')}.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative h-16 mx-2">
        <div className="absolute left-0 right-0 top-6 h-1 bg-gray-200 dark:bg-gray-700 rounded-full" />
        {graduations.map((g, i) => (
          <div key={i} className="absolute top-5" style={{ left: `${g.pct}%` }}>
            <div className="w-px h-3 bg-gray-300 dark:bg-gray-600" />
            {g.label && <span className="absolute top-4 -translate-x-1/2 text-[10px] text-gray-400 whitespace-nowrap">{g.label}</span>}
          </div>
        ))}
        <div className="absolute top-2 h-9 w-0.5 bg-blue-700" style={{ left: `${aujourdhuiPct}%` }} title="Aujourd'hui">
          <span className="absolute -top-3 -translate-x-1/2 text-[10px] font-semibold text-blue-700 whitespace-nowrap">Aujourd&apos;hui</span>
        </div>
        {points.map((p, i) => (
          <button
            key={p.id}
            onClick={() => navigate(`/conformite/licences/${p.licenceId}`)}
            title={`${p.nom} - ${p.libelle} le ${p.date}`}
            aria-label={`${p.nom}, ${p.libelle} le ${p.date}`}
            className="absolute w-3 h-3 rounded-full ring-2 ring-white dark:ring-gray-800 hover:scale-125 transition-transform"
            style={{ left: `calc(${p.pct}% - 6px)`, top: `${22 + (i % 2) * 8}px`, backgroundColor: COULEUR[p.type] }}
          />
        ))}
      </div>
      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1">
        {points.map(p => (
          <li key={p.id} className="flex items-center gap-2 text-xs">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: COULEUR[p.type] }} />
            <button onClick={() => navigate(`/conformite/licences/${p.licenceId}`)} className="text-blue-800 hover:underline truncate">{p.nom}</button>
            <span className="text-gray-500 whitespace-nowrap">{p.libelle} le {p.date}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
