# Vérification visuelle

- Le tableau de bord authentifié affiche correctement les 54 dossiers importés, dont 6 régularisés et 48 à régulariser.
- La navigation latérale, les indicateurs, les contrôles qualité, les analyses client et les graphes sont visuellement cohérents avec la direction graphique retenue.
- La vérification des pages de liste, de contrôles et de fiche dossier reste à finaliser avant la livraison.
- Les pages authentifiées de liste, de contrôles et de fiche détaillée affichent les données et interactions attendues. Une collision de route a été détectée sur la création d’un dossier et corrigée : `/dossiers/nouveau` est maintenant traité explicitement comme un formulaire de création.
- La version mobile du tableau de bord et le formulaire de création ont été vérifiés : les indicateurs, le menu contextuel, les champs de saisie et le bouton d’enregistrement restent accessibles sans chevauchement visuel.
- Les captures authentifiées sur les routes `/`, `/dossiers`, `/controles`, `/dossiers/1` et `/dossiers/nouveau` confirment la présence des données importées, de la liste complète, des alertes actionnables, de la fiche détaillée et du formulaire de création. Les contrôles ont été réalisés aux formats 1280 × 720 et 375 × 812.
- La revue finale authentifiée affiche sans écran de connexion les 54 dossiers et les indicateurs calculés, la table des dossiers, l’espace de contrôles, la fiche `DOS-0001` et la création d’un dossier. La structure, les données et les actions principales sont donc accessibles dans la session applicative.
- Le logo IGS fourni est désormais visible dans la barre latérale sur ordinateur. Le rendu mobile conserve une navigation compacte sans dégradation de la lisibilité des écrans métier.
- Le logo IGS est désormais également intégré comme filigrane animé à faible contraste dans le fond du tableau de bord, du contenu applicatif et de l’écran d’accès. Les vérifications desktop et mobile confirment que l’effet reste discret et ne nuit ni aux textes, ni aux indicateurs, ni aux actions prioritaires.
- Revue explicite : sur ordinateur, le monogramme IGS apparaît en filigrane à droite de la zone « Pilotage des dossiers », sans masquer le bouton de création. Sur mobile, il reste contenu dans le bandeau et les indicateurs, graphiques et listes restent pleinement lisibles.
