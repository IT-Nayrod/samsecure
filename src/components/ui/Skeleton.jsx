// Skeleton - Section 8 Specs UX v0.5
export default function Skeleton({ lines = 1, height = 'h-4', width = 'w-full' }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded ${height} ${i === lines - 1 && lines > 1 ? 'w-3/4' : width}`}
        />
      ))}
    </div>
  );
}
