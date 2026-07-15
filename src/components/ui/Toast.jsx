// Toast - Section 8 Specs UX v0.5
import { useEffect } from 'react';
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

const configs = {
  success: { Icon: CheckCircle, bg: 'bg-green-50 border-green-200', text: 'text-green-800', iconCls: 'text-green-500' },
  error: { Icon: AlertCircle, bg: 'bg-red-50 border-red-200', text: 'text-red-800', iconCls: 'text-red-500' },
  warning: { Icon: AlertTriangle, bg: 'bg-orange-50 border-orange-200', text: 'text-orange-800', iconCls: 'text-orange-500' },
  info: { Icon: Info, bg: 'bg-blue-50 border-blue-200', text: 'text-blue-800', iconCls: 'text-blue-500' },
};

export default function Toast({ id, type = 'info', message, persistent = false, onRemove }) {
  const { Icon, bg, text, iconCls } = configs[type] ?? configs.info;

  useEffect(() => {
    if (persistent) return;
    const t = setTimeout(() => onRemove(id), 4000);
    return () => clearTimeout(t);
  }, [id, persistent, onRemove]);

  return (
    <div className={`flex items-start gap-3 p-4 rounded-lg border shadow-lg min-w-[300px] max-w-[420px] ${bg} animate-[slideInRight_0.3s_ease]`}>
      <Icon size={16} className={`flex-shrink-0 mt-0.5 ${iconCls}`} />
      <p className={`flex-1 text-sm font-medium ${text}`}>{message}</p>
      <button onClick={() => onRemove(id)} aria-label="Fermer" className={`flex-shrink-0 ${text} opacity-60 hover:opacity-100 transition-opacity`}>
        <X size={14} />
      </button>
    </div>
  );
}
