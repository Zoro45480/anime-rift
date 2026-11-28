// Langues : français (version d'origine), anglais, allemand.
// Le jeu est écrit en français ; les autres langues remplacent à l'écran les textes connus du dictionnaire
// (menus, onglets, boutons, titres). Ce qui n'y est pas encore reste en français.
export type Lang = 'fr' | 'en' | 'de'
const KEY = 'anime-rift-lang'
export const LANGS: [Lang, string][] = [['fr', 'Français'], ['en', 'English'], ['de', 'Deutsch']]

export const getLang = (): Lang => {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'fr' || v === 'en' || v === 'de') return v
    const nav = (navigator.language || 'fr').slice(0, 2) // premier passage : la langue du navigateur
    const first: Lang = nav === 'de' ? 'de' : nav === 'en' ? 'en' : 'fr'
    localStorage.setItem(KEY, first)
    return first
  } catch { return 'fr' }
}
export const setLang = (l: Lang) => { try { localStorage.setItem(KEY, l) } catch { /* rien */ } location.reload() }

// [français, anglais, allemand]
const WORDS: [string, string, string][] = [
  ['Accueil', 'Home', 'Startseite'], ['Portails', 'Portals', 'Portale'], ['Jouer', 'Play', 'Spielen'], ['Collection', 'Collection', 'Sammlung'],
  ['Marché', 'Market', 'Markt'], ['Missions', 'Missions', 'Missionen'], ['Communauté', 'Community', 'Community'], ['Social', 'Social', 'Sozial'],
  ['Guilde', 'Guild', 'Gilde'], ['Panthéon', 'Pantheon', 'Pantheon'], ['Lien de Faille', 'Rift Link', 'Riss-Link'], ['Profil', 'Profile', 'Profil'],
  ['Récompense du jour', 'Daily reward', 'Tagesbelohnung'], ['Pass de combat', 'Battle pass', 'Battle Pass'], ['Parcours', 'Journey', 'Werdegang'],
  ['Cartes', 'Cards', 'Karten'], ['Inventaire', 'Inventory', 'Inventar'], ['Ascension', 'Ascension', 'Aufstieg'],
  ['Acheter', 'Buy', 'Kaufen'], ['Marchands', 'Merchants', 'Händler'], ['Vendre aux marchands', 'Sell to merchants', 'An Händler verkaufen'], ['Échanger', 'Trade', 'Tauschen'],
  ['Mon Marché', 'My Market', 'Mein Markt'], ['Le Marché', 'The Market', 'Der Markt'], ['Entre collectionneurs', 'Between collectors', 'Unter Sammlern'],
  ['Se connecter', 'Sign in', 'Anmelden'], ['Se déconnecter', 'Sign out', 'Abmelden'], ['Paramètres', 'Settings', 'Einstellungen'], ['Réglages', 'Settings', 'Einstellungen'],
  ['Fermer', 'Close', 'Schließen'], ['Annuler', 'Cancel', 'Abbrechen'], ['Valider', 'Confirm', 'Bestätigen'], ['Enregistrer', 'Save', 'Speichern'], ['Retour', 'Back', 'Zurück'], ['← Retour', '← Back', '← Zurück'],
  ['Passer', 'Skip', 'Überspringen'], ['Suivant', 'Next', 'Weiter'], ['Continuer', 'Continue', 'Weiter'], ['Récupérer', 'Claim', 'Abholen'], ['Récupéré', 'Claimed', 'Abgeholt'],
  ['Prêt', 'Ready', 'Bereit'], ['En cours', 'In progress', 'Läuft'], ['Verrouillé', 'Locked', 'Gesperrt'], ['Bientôt', 'Soon', 'Bald'],
  ['Victoire', 'Victory', 'Sieg'], ['Défaite', 'Defeat', 'Niederlage'], ['Combattre', 'Fight', 'Kämpfen'], ['Rejouer', 'Replay', 'Nochmal'],
  ['Amis', 'Friends', 'Freunde'], ['Messages', 'Messages', 'Nachrichten'], ['Échanges', 'Trades', 'Tausch'], ['Mes amis', 'My friends', 'Meine Freunde'],
  ['Ajouter un ami', 'Add a friend', 'Freund hinzufügen'], ['Code ami', 'Friend code', 'Freundescode'], ['Copier le code', 'Copy code', 'Code kopieren'], ['Ajouter', 'Add', 'Hinzufügen'],
  ['Ajouter en ami', 'Add friend', 'Als Freund hinzufügen'], ['Accepter', 'Accept', 'Annehmen'], ['Refuser', 'Decline', 'Ablehnen'], ['Retirer', 'Remove', 'Entfernen'],
  ['Membres', 'Members', 'Mitglieder'], ['Classement', 'Ranking', 'Rangliste'], ['Insignes', 'Badges', 'Abzeichen'], ['Rivalité', 'Rivalry', 'Rivalität'],
  ['Boss de la semaine', 'Boss of the week', 'Boss der Woche'], ['Boss mondial', 'World boss', 'Weltboss'], ['Raids', 'Raids', 'Raids'], ['Les Raids', 'Raids', 'Raids'],
  ['Global', 'Global', 'Global'], ['Guildes', 'Orders', 'Orden'], ['Tour de l’Infini', 'Tower of Infinity', 'Turm der Unendlichkeit'],
  ['Aperçu', 'Overview', 'Übersicht'], ['Statistiques', 'Stats', 'Statistiken'], ['Techniques', 'Skills', 'Techniken'], ['Collectifs', 'Synergies', 'Synergien'],
  ['Amélioration', 'Upgrade', 'Verbesserung'], ['Historique', 'History', 'Verlauf'], ['Cote', 'Market value', 'Marktwert'], ['Cote de la carte', 'Card market value', 'Marktwert der Karte'],
  ['Où l\'obtenir', 'Where to get it', 'Wo erhältlich'], ['Informations', 'Information', 'Informationen'], ['Titres', 'Titles', 'Titel'],
  ['Modifier le profil', 'Edit profile', 'Profil bearbeiten'], ['✎ Modifier le profil', '✎ Edit profile', '✎ Profil bearbeiten'], ['Apparence', 'Appearance', 'Aussehen'], ['✦ Apparence', '✦ Appearance', '✦ Aussehen'],
  ['Badges épinglés', 'Pinned badges', 'Angeheftete Abzeichen'], ['Distinctions', 'Distinctions', 'Auszeichnungen'], ['Cartes favorites', 'Favourite cards', 'Lieblingskarten'],
  ['Choisir', 'Choose', 'Auswählen'], ['En bref', 'At a glance', 'Auf einen Blick'], ['Son', 'Sound', 'Ton'], ['Graphismes', 'Graphics', 'Grafik'], ['Doublons', 'Duplicates', 'Duplikate'],
  ['Didacticiel', 'Tutorial', 'Tutorial'], ['Langue', 'Language', 'Sprache'], ['Installer l\'appli', 'Install the app', 'App installieren'], ['Installer l’appli', 'Install the app', 'App installieren'],
  ['Compte en ligne', 'Online account', 'Online-Konto'], ['Mes données (RGPD)', 'My data (GDPR)', 'Meine Daten (DSGVO)'], ['Supprimer mon compte', 'Delete my account', 'Mein Konto löschen'],
  ['Invoquer', 'Summon', 'Beschwören'], ['À l\'affiche', 'Featured', 'Im Fokus'], ['Portail limité', 'Limited portal', 'Limitiertes Portal'], ['Index du Portail', 'Portal index', 'Portal-Index'],
  ['Voir le Portail ↗', 'View portal ↗', 'Portal ansehen ↗'], ['Têtes d\'affiche', 'Headliners', 'Stars'], ['Moyen d\'invocation', 'Summon currency', 'Beschwörungswährung'],
  ['L’Aventure', 'Adventure', 'Abenteuer'], ['Les Colosses', 'Colossi', 'Kolosse'], ['La Tour de l’Infini', 'Tower of Infinity', 'Turm der Unendlichkeit'], ['L’Arène', 'Arena', 'Arena'],
  ['Mon équipe', 'My team', 'Mein Team'], ['Mes envies', 'My wishlist', 'Wunschliste'], ['Recherche', 'Search', 'Suche'], ['Rareté', 'Rarity', 'Seltenheit'], ['Univers', 'Universe', 'Universum'],
  ['Rôle', 'Role', 'Rolle'], ['Filtres', 'Filters', 'Filter'], ['Trier par', 'Sort by', 'Sortieren nach'], ['Toutes', 'All', 'Alle'], ['Tous', 'All', 'Alle'],
  ['Enchères', 'Auctions', 'Auktionen'], ['Mettre en vente', 'List for sale', 'Zum Verkauf anbieten'], ['Prix fixe', 'Fixed price', 'Festpreis'], ['Enchère', 'Auction', 'Auktion'], ['Enchérir', 'Bid', 'Bieten'],
  ['Débloque le Marché entre joueurs', 'Unlock the player Market', 'Spieler-Markt freischalten'], ['Ancienneté du compte', 'Account age', 'Kontoalter'], ['Jours de connexion', 'Login days', 'Login-Tage'], ['Victoires en Aventure', 'Adventure wins', 'Abenteuer-Siege'],
  ['Replier', 'Collapse', 'Einklappen'], ['Afficher', 'Show', 'Anzeigen'], ['Tu donnes', 'You give', 'Du gibst'], ['Tu demandes', 'You ask for', 'Du verlangst'],
  ['Envoyer la proposition →', 'Send offer →', 'Angebot senden →'], ['Il te manque', 'Missing', 'Fehlt dir'], ['Quotidiennes', 'Daily', 'Täglich'], ['Hebdomadaires', 'Weekly', 'Wöchentlich'],
  ['Histoire', 'Story', 'Geschichte'], ['Événement', 'Event', 'Event'], ['PvP', 'PvP', 'PvP'], ['Gratuit', 'Free', 'Gratis'], ['Premium', 'Premium', 'Premium'],
  ['Créer un groupe', 'Create a group', 'Gruppe erstellen'], ['Rejoindre →', 'Join →', 'Beitreten →'], ['Mes raids', 'My raids', 'Meine Raids'], ['Meilleurs frappeurs', 'Top hitters', 'Beste Angreifer'],
  ['Attaquer', 'Attack', 'Angreifen'], ['Frapper le boss →', 'Hit the boss →', 'Boss angreifen →'], ['Défier', 'Challenge', 'Herausfordern'], ['Palmarès', 'Record', 'Erfolge'],
  ['Opérations', 'Operations', 'Operationen'], ['Quartier général', 'Headquarters', 'Hauptquartier'], ['Contribuer', 'Contribute', 'Beitragen'],
  ['Joueurs', 'Players', 'Spieler'], ['Ta place', 'Your rank', 'Dein Rang'], ['Ton score', 'Your score', 'Dein Score'], ['Toi', 'You', 'Du'],
  ['Notifications', 'Notifications', 'Benachrichtigungen'], ['Chat', 'Chat', 'Chat'], ['Général', 'General', 'Allgemein'], ['Entraide', 'Help', 'Hilfe'], ['Arène', 'Arena', 'Arena'],
]
const IDX: Record<Lang, number> = { fr: 0, en: 1, de: 2 }
const table = (lang: Lang) => new Map(WORDS.map((w) => [w[0], w[IDX[lang]]]))

// Traduit à l'écran les textes connus (et les libellés d'accessibilité), puis suit les changements de la page.
export const startI18n = () => {
  const lang = getLang()
  document.documentElement.lang = lang
  if (lang === 'fr') return
  const map = table(lang)
  const fix = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const raw = node.nodeValue ?? ''
      const t = raw.trim()
      if (t && map.has(t) && map.get(t) !== t) node.nodeValue = raw.replace(t, map.get(t)!)
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return
    const el = node as Element
    if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') { if (el.tagName === 'INPUT') { const p = el.getAttribute('placeholder'); if (p && map.has(p) && map.get(p) !== p) el.setAttribute('placeholder', map.get(p)!) } return }
    for (const a of ['aria-label', 'title']) { const v = el.getAttribute(a); if (v && map.has(v) && map.get(v) !== v) el.setAttribute(a, map.get(v)!) }
    for (const c of Array.from(el.childNodes)) fix(c)
  }
  fix(document.body)
  new MutationObserver((list) => {
    for (const m of list) {
      if (m.type === 'characterData') fix(m.target)
      else m.addedNodes.forEach(fix)
    }
  }).observe(document.body, { childList: true, subtree: true, characterData: true })
}
