// BuilderLayout - Mise en page 2 colonnes du builder de rapport - SamSecure v0.5
// Colonne gauche : config (400px). Colonne droite : preview.
export default function BuilderLayout({ config, preview }) {
  return (
    <div className="flex h-full min-h-screen">
      {/* Config */}
      <aside className="w-[420px] flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-y-auto">
        {config}
      </aside>
      {/* Preview */}
      <main className="flex-1 bg-gray-50 dark:bg-gray-900 overflow-y-auto">
        {preview}
      </main>
    </div>
  );
}
