# Claude Journal

Application web locale pour parcourir et revoir l'historique de vos conversations Claude Code. Lit directement les fichiers JSONL depuis `~/.claude/projects/` — aucune configuration requise.

**Langue :** [简体中文](README.zh-CN.md) | [English](README.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | Français | [Deutsch](README.de.md) | [Português](README.pt.md) | [Русский](README.ru.md) | [العربية](README.ar.md) | [हिन्दी](README.hi.md)

![Interface principale](public/screenshot-main.png)

## Fonctionnalités

- **Explorateur de projets et sessions** — Tous les projets regroupés par répertoire de travail, avec l'historique complet dans la barre latérale
- **Filtre de la barre latérale** — Saisissez un mot-clé pour filtrer instantanément projets et sessions ; le nombre de correspondances se met à jour en temps réel
- **Rendu des conversations** — Markdown complet, blocs de code avec coloration syntaxique (Shiki), tableaux GFM et listes de tâches
- **Visualisation des appels d'outils** — Affiche chaque appel d'outil effectué par Claude (Bash, lecture/écriture de fichiers, etc.) et son résultat
- **Blocs de réflexion** — Affichage repliable du processus de raisonnement de Claude
- **Statistiques de tokens** — Nombre de tokens en entrée / sortie / cache et coût estimé par session
- **Recherche plein texte** — `⌘K` pour rechercher dans toutes les sessions instantanément
- **Exporter en Markdown / Image** — Copiez n'importe quel message en Markdown ou en capture d'écran en un clic
- **Sélecteur de thème** — Thème clair, sombre ou système avec préférence persistante
- **Interface en 11 langues** — Détecte automatiquement la langue du navigateur ; changement à tout moment via le sélecteur
- **Images en ligne** — Les images intégrées dans les messages (base64 ou URL) s'affichent directement ; cliquez pour agrandir
- **Visionneuse d'images** — Superposition plein écran avec flou d'arrière-plan ; fermeture par `Esc` ou clic à l'extérieur
- **Affichage des commandes slash** — Les messages `/commande` s'affichent sous forme de chips stylisés plutôt qu'en XML brut
- **Sortie des commandes locales** — Les blocs de sortie shell s'affichent en style terminal ; les avertissements détaillés sont réductibles
- **Barre de filtres persistante** — Les paramètres de filtre (pensée, outils, messages utilisateur/Claude) persistent lors des changements de session
- **Mémoire de session** — La dernière session consultée est restaurée au rechargement via les paramètres URL
- **URLs partageables** — Copiez l'URL pour partager ou mémoriser la session et la position de défilement exactes (`?p=&s=&scroll=`)
- **Retour en haut** — Un bouton flottant apparaît en bas de page ; un clic remonte en haut
- **PWA** — Installez sur votre bureau ou écran d'accueil ; mises à jour silencieuses automatiques lors d'un nouveau déploiement

![Interface de recherche](public/screenshot-search.png)

## Démarrage rapide

**Prérequis :** [Claude Code](https://claude.ai/code) doit être installé et avoir été utilisé au moins une fois pour que `~/.claude/projects/` existe localement.

```bash
# Cloner le dépôt
git clone https://github.com/yuxianwen/claude-journal.git
cd claude-journal

# Installer les dépendances
pnpm install

# Démarrer le serveur de développement
pnpm dev
```

Ouvrez [http://localhost:3000](http://localhost:3000) pour parcourir toutes vos sessions Claude Code.

## Stack technique

| Technologie | Version | Rôle |
|-------------|---------|------|
| Next.js | 16 | Framework & API Routes |
| React | 19 | Interface utilisateur |
| Tailwind CSS | v4 | Styles |
| Shiki | v4 | Coloration syntaxique |
| react-markdown | v10 | Rendu Markdown |
| remark-gfm | v4 | Syntaxe GFM étendue |

## Source des données

L'application ne lit que des fichiers locaux — aucune requête réseau, aucune donnée envoyée. Chemin des données de session :

```
~/.claude/projects/
  └── <project-id>/
        ├── <session-id>.jsonl
        └── ...
```

Chaque fichier `.jsonl` correspond à une session Claude Code et contient l'historique complet des messages ainsi que l'utilisation des tokens.

## Raccourcis clavier

| Raccourci | Action |
|-----------|--------|
| `⌘K` | Ouvrir la recherche plein texte |
| `⌘\` | Afficher / masquer la barre latérale |
| `Esc` | Fermer la recherche / le lightbox |
