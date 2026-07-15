// ConformiteGaugeBar - barre droits acquis vs usage, signature visuelle de la page Licences
import { THRESHOLD_GREEN, THRESHOLD_YELLOW, THRESHOLD_ORANGE, THRESHOLD_RED } from '../../data/dashboardMockData';

const NIVEAU_COLOR = {
  conforme: THRESHOLD_GREEN,
  attention: THRESHOLD_YELLOW,
  depassement: THRESHOLD_RED,
};

const NIVEAU_LABEL = {
  conforme: 'Conforme',
  attention: 'Attention',
  depassement: 'Depassement',
};

export default function ConformiteGaugeBar({ droits, usage, niveau, unite = '', label }) {
  const ratio = droits > 0 ? usage / droits : 0;
  const fillPct = Math.min(ratio, 1) * 100;
  const color = NIVEAU_COLOR[niveau] ?? THRESHOLD_ORANGE;

  return (
    <div className="flex flex-col gap-1 w-full">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-500">{label ?? 'Droits vs usage'}</span>
        <span className="font-medium" style={{ color }}>
          {usage} / {droits} {unite} - {NIVEAU_LABEL[niveau] ?? niveau}
        </span>
      </div>
      <div className="relative w-full h-2.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${fillPct}%`, backgroundColor: color }} />
        {ratio > 1 && (
          <div className="absolute inset-y-0 right-0 w-1.5 bg-red-700" title={`Depassement de ${Math.round((ratio - 1) * 100)} %`} />
        )}
      </div>
    </div>
  );
}
