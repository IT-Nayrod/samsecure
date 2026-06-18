// mockNotifications - Section 6 Specs UX v0.5
// Types : contract_expiry, validation_request, validation_done, budget_alert, renewal, compliance, system
const now = new Date('2026-06-05T12:00:00Z');
const ago = (mins) => new Date(now - mins * 60 * 1000).toISOString();

export const mockNotifications = [
  { id: 'n1', type: 'contract_expiry', message: 'Le contrat Microsoft EA expire dans 23 jours.', date: ago(5), read: false, archived: false, link: '/contrats' },
  { id: 'n2', type: 'validation_request', message: 'Saisie soumise par Jean Dupont sur Adobe CC — en attente de validation.', date: ago(18), read: false, archived: false, link: '/conformite' },
  { id: 'n3', type: 'compliance', message: '47 licences Oracle Database dépassent les droits acquis (+12 unités).', date: ago(45), read: false, archived: false, link: '/conformite/licences' },
  { id: 'n4', type: 'budget_alert', message: 'Budget logiciels 2026 atteint à 94 % — seuil d\'alerte dépassé.', date: ago(90), read: false, archived: false, link: '/rapports' },
  { id: 'n5', type: 'validation_done', message: 'Votre saisie SAP ERP Q2 a été validée par Sophie Durand.', date: ago(120), read: false, archived: false, link: '/conformite' },
  { id: 'n6', type: 'renewal', message: 'Renouvellement Intune – 1 200 licences à planifier avant le 30 juin 2026.', date: ago(240), read: true, archived: false, link: '/contrats' },
  { id: 'n7', type: 'contract_expiry', message: 'Le contrat Adobe Creative Cloud expire dans 45 jours.', date: ago(360), read: true, archived: false, link: '/contrats' },
  { id: 'n8', type: 'validation_request', message: 'Nouvelle saisie en attente de validation : Windows Server 2022 (Acme Lyon).', date: ago(480), read: true, archived: false, link: '/conformite' },
  { id: 'n9', type: 'system', message: 'Mise à jour SamSecure v0.5.2 disponible – consultez les notes de version.', date: ago(720), read: true, archived: false, link: null },
  { id: 'n10', type: 'compliance', message: 'Indice de conformité global passé en dessous de 80 % (77 %).', date: ago(1440), read: true, archived: false, link: '/rapports' },
  { id: 'n11', type: 'validation_done', message: 'Saisie Microsoft 365 refusée — commentaire : "Quantité incorrecte, revoir l\'inventaire."', date: ago(2880), read: true, archived: false, link: '/conformite' },
  { id: 'n12', type: 'renewal', message: 'Contrat SAP ERP Maintenance à renouveler dans 60 jours.', date: ago(4320), read: true, archived: false, link: '/contrats' },
  { id: 'n13', type: 'contract_expiry', message: 'Le contrat Oracle Database Enterprise est échu depuis le 1er juin 2026.', date: ago(5760), read: true, archived: false, link: '/contrats' },
  { id: 'n14', type: 'system', message: 'Export rapport mensuel disponible – mai 2026.', date: ago(7200), read: true, archived: false, link: '/rapports' },
  { id: 'n15', type: 'budget_alert', message: 'Dépassement budgétaire détecté sur le périmètre Acme Lyon SARL (+8 200 €).', date: ago(8640), read: true, archived: false, link: '/rapports' },
  { id: 'n16', type: 'compliance', message: '15 licences Citrix non affectées depuis plus de 90 jours — sous-utilisation détectée.', date: ago(10080), read: true, archived: true, link: '/conformite/licences' },
  { id: 'n17', type: 'validation_request', message: '3 saisies IBM en attente de validation depuis plus de 7 jours.', date: ago(11520), read: true, archived: true, link: '/conformite' },
  { id: 'n18', type: 'renewal', message: 'Commande Lansweeper à renouveler – échéance dans 15 jours.', date: ago(14400), read: true, archived: true, link: '/contrats' },
  { id: 'n19', type: 'system', message: 'Connecteur Active Directory : dernière synchronisation il y a 48h. Vérifier la connexion.', date: ago(17280), read: true, archived: true, link: null },
  { id: 'n20', type: 'validation_done', message: 'Saisie Acrobat Pro DC (25 licences) validée et intégrée au référentiel.', date: ago(20160), read: true, archived: true, link: '/conformite' },
  { id: 'n21', type: 'contract_expiry', message: 'Contrat GLPI Support Premium : renouvellement à traiter avant le 15 juillet 2026.', date: ago(21600), read: true, archived: true, link: '/contrats' },
  { id: 'n22', type: 'budget_alert', message: 'Prévision N+1 Microsoft 365 : hausse estimée à +18 % par rapport à l\'exercice en cours.', date: ago(25920), read: true, archived: true, link: '/rapports' },
];
