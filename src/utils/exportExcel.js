// exportExcel.js - Generateur SpreadsheetML 2 feuilles : Constat + Donnees - SamSecure v0.5
// Format .xls (XML) : pas de librairie externe, supporte les feuilles multiples et les styles.

const fmtEur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const fmtNb  = new Intl.NumberFormat('fr-FR');

function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function mkCell(value, type, styleId) {
  const s = styleId ? ` ss:StyleID="${styleId}"` : '';
  if (value === null || value === undefined || value === '') {
    return `<Cell${s}><Data ss:Type="String"></Data></Cell>`;
  }
  const content = type === 'Number' ? String(value) : esc(String(value));
  return `<Cell${s}><Data ss:Type="${type}">${content}</Data></Cell>`;
}

function mkRow(...cells) {
  return `<Row>${cells.join('')}</Row>`;
}

function emptyRow() { return '<Row/>'; }

// --- Formatage texte (pour la feuille Constat) ---
function formatKpiTexte(val, format) {
  if (val == null) return '-';
  const n = Number(val);
  switch (format) {
    case 'montant':           return fmtEur.format(n);
    case 'nombre':            return fmtNb.format(n);
    case 'nombre_signe':      return `${n >= 0 ? '+' : ''}${fmtNb.format(n)}`;
    case 'pourcentage':       return `${n.toFixed(1)} %`;
    case 'pourcentage_signe': return `${n >= 0 ? '+' : ''}${n.toFixed(1)} %`;
    case 'texte':             return String(val);
    default:                  return String(val);
  }
}

// --- Formatage cellule donnees (pour la feuille Donnees) ---
function formatCellData(val, format) {
  if (val == null || val === '') return { v: '', t: 'String' };
  switch (format) {
    case 'montant':
    case 'nombre':
    case 'nombre_signe':
    case 'pourcentage':
    case 'pourcentage_signe': {
      const n = Number(val);
      return isNaN(n) ? { v: String(val), t: 'String' } : { v: n, t: 'Number' };
    }
    case 'taux_usage': {
      const n = Math.round(Number(val) * 100);
      return isNaN(n) ? { v: String(val), t: 'String' } : { v: n, t: 'Number' };
    }
    case 'date': {
      const d = new Date(val);
      if (isNaN(d.getTime())) return { v: String(val), t: 'String' };
      const j = String(d.getDate()).padStart(2,'0');
      const m = String(d.getMonth()+1).padStart(2,'0');
      return { v: `${j}/${m}/${d.getFullYear()}`, t: 'String' };
    }
    case 'badge_conformite': {
      const L = { conforme: 'Conforme', attention: 'Attention', non_conforme: 'Non conforme' };
      return { v: L[val] ?? String(val), t: 'String' };
    }
    case 'badge_revalidation': {
      const L = { a_jour: 'A jour', a_revalider: 'A revalider', depassee: 'Depassee' };
      return { v: L[val] ?? String(val), t: 'String' };
    }
    default: return { v: String(val), t: 'String' };
  }
}

// --- Feuille 1 : Constat ---
function buildConstatSheet({ titre, description, labelPer, dateGen, kpisDef, kpisData, note }) {
  const rows = [
    mkRow(mkCell(titre, 'String', 'Title')),
  ];

  if (description) {
    rows.push(mkRow(mkCell(description, 'String', 'Subtitle')));
  }

  rows.push(emptyRow());
  rows.push(mkRow(mkCell('Periode', 'String', 'Bold'), mkCell(''), mkCell(labelPer)));
  rows.push(mkRow(mkCell('Genere le', 'String', 'Bold'), mkCell(''), mkCell(dateGen)));

  if (kpisDef?.length > 0) {
    rows.push(emptyRow());
    rows.push(mkRow(mkCell('Indicateur', 'String', 'KpiHeader'), mkCell(''), mkCell('Valeur', 'String', 'KpiHeader')));
    kpisDef.forEach(kpi => {
      const val = kpisData?.[kpi.key];
      rows.push(mkRow(
        mkCell(kpi.label, 'String', 'KpiLabel'),
        mkCell(''),
        mkCell(formatKpiTexte(val, kpi.format), 'String', 'KpiValue'),
      ));
    });
  }

  if (note) {
    rows.push(emptyRow());
    rows.push(mkRow(mkCell('Note', 'String', 'Bold'), mkCell(''), mkCell(note)));
  }

  return `<Worksheet ss:Name="Constat">
<Table>
<Column ss:Width="220"/>
<Column ss:Width="20"/>
<Column ss:Width="240"/>
${rows.join('\n')}
</Table>
</Worksheet>`;
}

// --- Feuille 2 : Donnees ---
function buildTableauSection(colonnes, lignes, sectionTitre) {
  const rows = [];
  if (sectionTitre) {
    rows.push(mkRow(mkCell(sectionTitre, 'String', 'SectionTitle')));
  }
  rows.push(mkRow(...colonnes.map(c => mkCell(c.label, 'String', 'ColHeader'))));
  lignes.forEach(ligne => {
    rows.push(mkRow(...colonnes.map(col => {
      const { v, t } = formatCellData(ligne[col.key], col.format);
      return mkCell(v, t, null);
    })));
  });
  return rows;
}

function buildDonneesSheet({ titre, labelPer, colonnes, lignes, sections, resultSections }) {
  const rows = [
    mkRow(mkCell(`${titre} - Periode : ${labelPer}`, 'String', 'Bold')),
    emptyRow(),
  ];

  if (colonnes && lignes) {
    rows.push(...buildTableauSection(colonnes, lignes));
  } else if (sections && resultSections) {
    resultSections.forEach((section, idx) => {
      if (idx > 0) rows.push(emptyRow());
      rows.push(...buildTableauSection(sections[idx]?.colonnes ?? [], section.lignes ?? [], section.titre));
    });
  }

  return `<Worksheet ss:Name="Donnees">
<Table ss:DefaultColumnWidth="130">
${rows.join('\n')}
</Table>
</Worksheet>`;
}

// --- Styles ---
const STYLES = `<Styles>
<Style ss:ID="Default" ss:Name="Normal">
  <Font ss:FontName="Calibri" ss:Size="11"/>
</Style>
<Style ss:ID="Title">
  <Font ss:FontName="Calibri" ss:Bold="1" ss:Size="14"/>
</Style>
<Style ss:ID="Subtitle">
  <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#595959"/>
</Style>
<Style ss:ID="Bold">
  <Font ss:FontName="Calibri" ss:Bold="1" ss:Size="11"/>
</Style>
<Style ss:ID="KpiHeader">
  <Font ss:FontName="Calibri" ss:Bold="1" ss:Size="11" ss:Color="#FFFFFF"/>
  <Interior ss:Color="#2E4057" ss:Pattern="Solid"/>
</Style>
<Style ss:ID="KpiLabel">
  <Font ss:FontName="Calibri" ss:Size="11"/>
  <Interior ss:Color="#F2F2F2" ss:Pattern="Solid"/>
</Style>
<Style ss:ID="KpiValue">
  <Font ss:FontName="Calibri" ss:Bold="1" ss:Size="11"/>
  <Interior ss:Color="#EBF3FB" ss:Pattern="Solid"/>
</Style>
<Style ss:ID="ColHeader">
  <Font ss:FontName="Calibri" ss:Bold="1" ss:Size="11" ss:Color="#FFFFFF"/>
  <Interior ss:Color="#4472C4" ss:Pattern="Solid"/>
  <Alignment ss:Horizontal="Left"/>
</Style>
<Style ss:ID="SectionTitle">
  <Font ss:FontName="Calibri" ss:Bold="1" ss:Size="11"/>
  <Interior ss:Color="#D9E1F2" ss:Pattern="Solid"/>
</Style>
</Styles>`;

// --- Point d'entree ---
export function exporterExcel({
  titre, description, periode,
  kpisDef, kpisData,
  colonnes, lignes,
  sections, resultSections,
  note, filename,
}) {
  function padZ(n) { return String(n).padStart(2,'0'); }
  function fmtDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return `${padZ(d.getDate())}/${padZ(d.getMonth()+1)}/${d.getFullYear()}`;
  }

  const today = new Date();
  const dateGen = `${padZ(today.getDate())}/${padZ(today.getMonth()+1)}/${today.getFullYear()}`;
  const labelPer = periode
    ? `${fmtDate(periode.dateDebut)} - ${fmtDate(periode.dateFin)}`
    : 'Toutes periodes';

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:x="urn:schemas-microsoft-com:office:excel">
${STYLES}
${buildConstatSheet({ titre, description, labelPer, dateGen, kpisDef, kpisData, note })}
${buildDonneesSheet({ titre, labelPer, colonnes, lignes, sections, resultSections })}
</Workbook>`;

  const blob = new Blob(['﻿' + xml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.xls`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
