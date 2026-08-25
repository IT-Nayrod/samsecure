// BudgetKPIBar - Section Visualisation Budget - SamSecure v0.5
// Six cartes alimentees par les totaux de GET /budget/synthese : previsionnel
// et alloue restitues CAPEX et OPEX separement, engage issu des commandes,
// ecarts et taux d'engagement tels que calcules par l'API. L'engage n'etant
// pas ventile CAPEX / OPEX, les ecarts et le taux portent sur les totaux
// CAPEX + OPEX, ce que la barre annonce explicitement.
import { TrendingUp, TrendingDown } from 'lucide-react';
import Skeleton from '../ui/Skeleton';
import { formatEuros, formatPourcentage, classesRealisation } from './budgetCalculs';

function Carte({ label, sousTitre, compact, children }) {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col gap-1.5 ${compact ? 'p-3' : 'p-4'}`}>
      <span className={`font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide leading-tight ${compact ? 'text-[10px]' : 'text-[11px]'}`}>{label}</span>
      {children}
      {sousTitre && <span className="text-[11px] text-gray-400 dark:text-gray-500 leading-tight">{sousTitre}</span>}
    </div>
  );
}

function CarteDouble({ label, capex, opex, compact }) {
  const cls = compact ? 'text-sm' : 'text-base';
  return (
    <Carte label={label} compact={compact}>
      <div className="flex flex-col gap-0.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[11px] text-gray-500 dark:text-gray-400">CAPEX</span>
          <span className={`${cls} font-bold text-gray-900 dark:text-white`}>{formatEuros(capex)}</span>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[11px] text-gray-500 dark:text-gray-400">OPEX</span>
          <span className={`${cls} font-bold text-gray-900 dark:text-white`}>{formatEuros(opex)}</span>
        </div>
      </div>
    </Carte>
  );
}

function CarteMontant({ label, valeur, sousTitre, compact }) {
  return (
    <Carte label={label} sousTitre={sousTitre} compact={compact}>
      <span className={`font-bold text-gray-900 dark:text-white ${compact ? 'text-sm' : 'text-lg'}`}>{formatEuros(valeur)}</span>
    </Carte>
  );
}

function CarteEcart({ label, valeur, sousTitre, compact }) {
  const isPositif = (valeur ?? 0) >= 0;
  return (
    <Carte label={label} sousTitre={sousTitre} compact={compact}>
      <div className={`flex items-center gap-1.5 font-bold ${compact ? 'text-sm' : 'text-lg'} ${isPositif ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
        {isPositif ? <TrendingDown size={compact ? 13 : 16} /> : <TrendingUp size={compact ? 13 : 16} />}
        <span>{isPositif ? '+' : ''}{formatEuros(valeur)}</span>
      </div>
    </Carte>
  );
}

function CarteTaux({ taux, sousTitre, compact }) {
  const defini = taux !== null && taux !== undefined;
  const { textColor } = classesRealisation(defini ? Number(taux) : 0);
  return (
    <Carte label="Taux d'engagement" sousTitre={sousTitre} compact={compact}>
      <span className={`font-bold ${compact ? 'text-sm' : 'text-lg'} ${defini ? textColor : 'text-gray-400 dark:text-gray-500'}`}>
        {formatPourcentage(taux)}
      </span>
    </Carte>
  );
}

export default function BudgetKPIBar({ totaux, isLoading = false, erreur = null, compact = false }) {
  const grille = `grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 ${compact ? 'gap-2' : 'gap-3'}`;

  if (isLoading) {
    return (
      <div className={grille}>
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} height={compact ? 'h-16' : 'h-24'} />)}
      </div>
    );
  }

  if (erreur) {
    return (
      <p className="text-sm text-gray-500 bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
        Indicateurs indisponibles : {erreur}
      </p>
    );
  }

  const t = totaux ?? {};
  const nbCommandes = t.nb_commandes ?? 0;

  return (
    <div className="flex flex-col gap-1.5">
      <div className={grille}>
        <CarteDouble label="Prévisionnel" capex={t.previsionnel_capex} opex={t.previsionnel_opex} compact={compact} />
        <CarteDouble label="Alloué" capex={t.alloue_capex} opex={t.alloue_opex} compact={compact} />
        <CarteMontant
          label="Engagé (commandes)"
          valeur={t.engage}
          sousTitre={`${nbCommandes} commande${nbCommandes > 1 ? 's' : ''} sur la période`}
          compact={compact}
        />
        <CarteEcart label="Écart prévisionnel / alloué" valeur={t.ecart_previsionnel_alloue} sousTitre="alloué moins prévisionnel" compact={compact} />
        <CarteEcart label="Écart alloué / engagé" valeur={t.ecart_alloue_engage} sousTitre="alloué moins engagé" compact={compact} />
        <CarteTaux taux={t.taux_engagement} sousTitre={t.alloue > 0 ? 'engagé sur alloué' : 'aucun montant alloué'} compact={compact} />
      </div>
      <p className="text-[11px] text-gray-400 dark:text-gray-500">
        Engagé, écarts et taux portent sur les totaux CAPEX + OPEX : l&apos;engagé issu des commandes n&apos;est pas ventilé entre CAPEX et OPEX.
      </p>
    </div>
  );
}
