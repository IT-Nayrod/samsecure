// FormField - Section 8 Specs UX v0.5
export default function FormField({ label, required, error, hint, children, className = '' }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      {children}
      {error
        ? <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        : hint
        ? <p className="text-xs text-gray-500 dark:text-gray-400">{hint}</p>
        : null}
    </div>
  );
}
