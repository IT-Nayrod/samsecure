// Composition des dashboards (#192) : ordre de maquette par profil, titres
// lisibles des widgets, et resolution de la liste effective a afficher a
// partir de la configuration API (default_profil_widget surcharge par le
// tenant) et des preferences individuelles (preference_dashboard).
export const ORDRES = {
  manager_dsi: [
    'alertes', 'indice-confiance', 'validations-attente', 'qualite-saisies',
    'revalidations', 'ecart-usage-droits', 'indice-conformite',
    'echeances-contrats', 'echeances-commandes', 'prevision-budgetaire',
    'montants-totaux',
  ],
  financier: [
    'alertes', 'periode-budgetaire', 'conformite-reel-previ',
    'echeances-contrats-kpi', 'montants-engages-payes', 'echeances-tresorerie',
    'valorisation-licences', 'cout-licences-manquantes', 'cout-par-logiciel',
  ],
  it_ops: [
    'alertes', 'balance-usages-droits', 'revalidations', 'qualite-saisies',
    'ecart-usage-droits', 'usage-12-mois', 'echeances-contrats',
    'echeances-commandes', 'collecteurs', 'ecarts-inventaire',
    'dernieres-saisies',
  ],
};

export const TITRES_WIDGETS = {
  'alertes': 'Alertes',
  'indice-confiance': 'Indice de confiance données',
  'validations-attente': 'Validations en attente',
  'qualite-saisies': 'Qualité des saisies',
  'revalidations': 'Revalidations',
  'ecart-usage-droits': 'Écart usage vs droits',
  'indice-conformite': 'Indice de conformité global',
  'echeances-contrats': 'Échéances contrats',
  'echeances-commandes': 'Échéances commandes',
  'prevision-budgetaire': 'Prévision budgétaire N+1',
  'montants-totaux': 'Montants totaux',
  'periode-budgetaire': 'Période budgétaire',
  'conformite-reel-previ': 'Conformité réel vs prévisionnel',
  'echeances-contrats-kpi': 'Échéances des contrats',
  'montants-engages-payes': 'Montants engagés vs payés',
  'echeances-tresorerie': 'Échéances de trésorerie',
  'valorisation-licences': 'Valorisation licences non utilisées',
  'cout-licences-manquantes': 'Coût des licences manquantes',
  'cout-par-logiciel': 'Coût par logiciel',
  'balance-usages-droits': 'Balance usages vs droits',
  'usage-12-mois': 'Usage 12 mois glissants',
  'collecteurs': 'Collecteurs',
  'ecarts-inventaire': "Écarts d'inventaire",
  'dernieres-saisies': 'Dernières saisies',
};

// Liste effective d'un dashboard : widgets de la configuration du profil
// (acces_autorise vrai), ordonnee par la maquette puis par les positions des
// preferences ; la visibilite suit la preference, sinon visible_defaut.
// Tant que la configuration n'est pas seedee (migration 050 non jouee), la
// composition de la maquette sert de defaut : c'est de la presentation, pas
// une donnee.
export function composerListe(widgetsProfil, preferences, ordreDefaut) {
  const configures = new Map(
    (widgetsProfil ?? []).map((w) => [w.widget_code, w])
  );
  const prefs = new Map(
    (preferences ?? []).map((p) => [p.widget_code, p])
  );

  const codes = configures.size
    ? ordreDefaut.filter((code) => {
        const c = configures.get(code);
        return c ? c.acces_autorise !== false : false;
      })
    : [...ordreDefaut];

  const liste = codes.map((code, i) => {
    const config = configures.get(code);
    const pref = prefs.get(code);
    return {
      widget_code: code,
      visible: pref?.visible ?? config?.visible_defaut ?? true,
      position: pref?.position ?? i * 10,
    };
  });
  liste.sort((a, b) => a.position - b.position);
  return liste;
}
