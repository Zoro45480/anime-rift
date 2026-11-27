# ANIME RIFT — ce qu'il te reste à faire

Coche chaque ligne quand c'est fait.

## 1. Activer le serveur (Supabase) — le plus important

Dans Supabase : **SQL Editor → New query → coller tout le fichier → Run**, un fichier à la fois, dans cet ordre :

- [ ] `supabase/02_social_guildes_marche.sql` (amis, messages, échanges, marché, Ordres, chat, Lien de Faille)
- [ ] `supabase/03_bazar_echanges.sql` (règles des échanges, petit mot, durée des annonces, insignes d'ancienneté, suppression de compte)
- [ ] `supabase/04_boss_raids_rivalites.sql` (boss mondial, raids à 3, rivalités entre Ordres)

Les fichiers se trouvent dans le dépôt GitHub, dossier `supabase` (branche `test`).
Si un fichier affiche une erreur rouge, copie-moi le message.

## 2. Tester le site de test

Adresse : https://zoro45480.github.io/anime-rift/test/ (fais Ctrl + F5 pour avoir la dernière version)

- [ ] Te connecter avec Discord, puis avec Google
- [ ] Vérifier que tu es bien le joueur **#1** sur ton profil
- [ ] Ajouter un ami avec son **code ami** (Communauté → Social)
- [ ] Créer un **Ordre**, le faire rejoindre par 2 amis
- [ ] Faire un **raid** à 3 (Jouer → Raids → Créer un groupe → donner le code)
- [ ] Frapper le **boss mondial** (Jouer → Boss mondial)
- [ ] Déclarer une **rivalité** contre un autre Ordre (il faut 3 membres de chaque côté)
- [ ] Proposer un **échange** au Bazar (onglet Échanger) — le Bazar entre joueurs se débloque après 3 jours, 3 connexions et 10 victoires
- [ ] Installer l'**appli** (Réglages → Installer l'appli)
- [ ] Essayer la langue **English** / **Deutsch** (Réglages → Langue)

## 3. Me dire quand passer le test sur le vrai site

- [ ] Quand tout te plaît, écris-moi : « mets tout sur le vrai site »

## 4. Plus tard (si tu veux)

- [ ] **Paiements réels (Stripe)** : ouvrir un compte sur stripe.com. Ne m'envoie jamais tes clés secrètes : je te dirai où les coller.
- [ ] **Boutique** : tu m'avais demandé d'enlever le Comptoir du Rift ; dis-moi si tu veux une nouvelle boutique.
- [ ] **Pages légales** (mentions légales, CGU, CGV, confidentialité, cookies) : il faut ton nom ou celui de ta structure et une adresse de contact. Je peux écrire les textes quand tu me les donnes.
- [ ] **Lien Discord** : envoie-moi le lien d'invitation de ton serveur Discord pour le bouton « Rejoins notre Discord ».

## Ce qui n'est pas encore complet dans le jeu (à me redemander)

- Traduction anglaise et allemande : seuls les menus, onglets et boutons sont traduits.
- Escouades d'Ordre et Ligue des Ordres : pas encore construites (les Opérations, le QG et les rivalités, oui).
- Le serveur ne vérifie pas encore la rareté des cartes échangées ni le blocage de 24 h (le jeu, oui).
- Si un combat de boss (Ordre, mondial, raid) est refusé par le serveur, l'essai du jour est quand même compté.
