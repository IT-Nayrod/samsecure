// Highlight - surligne la premiere portion d'un texte correspondant a une regex de recherche
export default function Highlight({ text, regex }) {
  if (!text) return null;
  const str = String(text);
  const match = regex.exec(str);
  if (!match) return <>{str}</>;
  const start = match.index;
  const end = start + match[0].length;
  return (
    <>
      {str.slice(0, start)}
      <mark className="bg-yellow-200 dark:bg-yellow-700/50 text-inherit rounded-sm px-0.5">{str.slice(start, end)}</mark>
      {str.slice(end)}
    </>
  );
}
