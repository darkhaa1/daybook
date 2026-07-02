# Console de pilotage

Outil de pilotage quotidien **mono-utilisateur, privé** : priorités du jour horodatées
(créneaux début/fin) matérialisées automatiquement depuis un planning type récurrent et
éditable, timer focus (pomodoro), bilan du soir, répartition hebdomadaire du temps réel
par catégorie, suivi de buts, gestion des catégories et historique (30 derniers jours).

Conçu pour tourner derrière un reverse-proxy avec **forward-auth (Authentik)** sur
`tasks.darkhaa.dev`. **L'application ne gère aucune authentification** : elle suppose un
utilisateur unique déjà authentifié en amont. Aucune notion de user/session dans le code.

## Stack

- **Front** : Vite + React + TypeScript, CSS vanilla (aucune lib UI, état via `useState`/`useReducer`).
- **Back** : [Hono](https://hono.dev) sur Node 22. Le même process sert le build statique du front **et** `/api/*`.
- **BDD** : SQLite via `better-sqlite3`, requêtes SQL directes, aucun ORM.
- **Monorepo pnpm** : `client/` (Vite React) et `server/` (Hono + accès DB + schéma).

### Dépendances (et justification)

| Paquet | Rôle |
| --- | --- |
| `hono` | Routeur HTTP minimal du serveur d'API. |
| `@hono/node-server` | Adaptateur Node pour Hono + service des fichiers statiques du front buildé. |
| `better-sqlite3` | Accès SQLite synchrone, requêtes SQL directes (pas d'ORM). |
| `react`, `react-dom` | Front. |
| `vite`, `@vitejs/plugin-react` | Build/dev du front. |
| `typescript`, `@types/*` | Types & build (dev uniquement). |

Les catégories sont **entièrement dynamiques** : table `categories` en base (label,
couleur, ordre, archivage), gérable depuis l'onglet Catégories. `tasks`/`focus_sessions`/
`goals` gardent leur colonne `category` TEXT existante, qui référence `categories.key` par
convention (pas de clé étrangère déclarée — aucune refonte du schéma). `categories.key`
est immuable après création ; seuls `label`/`color`/`sort_order`/`is_archived` changent.
Archiver une catégorie la retire des sélecteurs pour les nouvelles entrées, mais ses
données historiques restent agrégées (semaine/historique). La suppression définitive
n'est possible que si la catégorie n'est référencée par aucune donnée (tâches, sessions,
buts ou blocs de planning type).

Le **planning type** (`template_items`) est un planning récurrent éditable en base — jamais
codé en dur — depuis l'onglet Planning type. À chaque premier accès à un jour (`GET
/api/day/:date`), ses blocs actifs sont copiés en tâches de ce jour, puis le jour est marqué
dans `day_template_applied` : c'est un garde-fou anti-respawn, les modifications faites au
jour (suppression, édition) ne sont jamais écrasées au rechargement. Modifier le template
n'affecte donc jamais un jour déjà ouvert ; le bouton « Réappliquer au jour courant »
(`POST /api/day/:date/apply-template`) permet de pousser les changements explicitement (en
ajout simple, sans déduplication).

## Prérequis

- Node.js **>= 22**
- pnpm (`npm i -g pnpm`)

## Installation

```bash
pnpm install
```

## Développement

Deux process (proxy `/api` → serveur Hono déjà configuré côté Vite) :

```bash
pnpm dev
# ou séparément :
pnpm dev:server   # API Hono sur PORT (défaut 3001)
pnpm dev:client   # Vite (front) avec proxy vers l'API
```

Le front de dev est servi par Vite ; les appels `/api/*` sont proxifiés vers Hono.

## Build & lancement local (un seul process, un seul port)

```bash
pnpm build      # build le front (client/dist) puis compile le serveur (server/dist)
pnpm typecheck  # vérification TypeScript (zéro erreur, zéro any)
pnpm start      # node server/dist/index.js -> sert le front sur / et l'API sur /api
```

Ouvrir ensuite `http://localhost:3001`.

> **Note Node.js.** Le binding natif `better-sqlite3` doit correspondre à la version de
> Node qui **exécute** le serveur. La cible imposée est **Node 22** (des binaires
> précompilés existent → aucune compilation requise). Sous Node 24+, il n'existe pas
> encore de binaire précompilé : soit rester sur Node 22, soit disposer d'une chaîne de
> build C++ pour compiler depuis les sources. `pnpm build` / `pnpm typecheck` ne chargent
> pas le binding et fonctionnent sous n'importe quelle version récente ; seul l'exécution
> du serveur en dépend. Sur ce poste, Node 22 est épinglé pour le dépôt (`volta` →
> `package.json > volta`), donc `node server/dist/index.js` utilise bien Node 22.

## Configuration (variables d'environnement)

| Variable | Défaut | Rôle |
| --- | --- | --- |
| `PORT` | `3001` | Port HTTP du process. |
| `DB_PATH` | `./data/console.db` | Chemin du fichier SQLite. Le dossier parent est créé au démarrage s'il est absent. |

## Déploiement

Prérequis système (Debian/Ubuntu) pour compiler `better-sqlite3` si aucun binaire
précompilé ne correspond exactement à la version de Node installée :

```bash
sudo apt install -y build-essential python3
```

Étapes :

1. Copier le dépôt sur le serveur (ex. `/opt/console-pilotage`), avec Node **22** installé.
2. `pnpm install`
3. `pnpm build` (génère `client/dist` et `server/dist`).
4. Créer le dossier de données persistant et les permissions pour l'utilisateur dédié :
   ```bash
   sudo useradd --system --no-create-home console
   sudo mkdir -p /var/lib/console
   sudo chown console:console /var/lib/console
   ```
5. Installer et activer le service systemd (voir ci-dessous).
6. Placer le tout derrière le reverse-proxy (voir `deploy/Caddyfile.snippet`) + forward-auth.

### systemd

Un exemple d'unité est fourni : [`deploy/console.service`](./deploy/console.service). Il
tourne sous un utilisateur dédié (`console`), pointe `DB_PATH` vers un emplacement
persistant hors du dépôt (`/var/lib/console/console.db`), et redémarre automatiquement en
cas d'échec.

```bash
sudo cp deploy/console.service /etc/systemd/system/console.service
# adapter WorkingDirectory, PORT si besoin
sudo systemctl daemon-reload
sudo systemctl enable --now console.service
sudo systemctl status console.service
```

### Reverse-proxy (Caddy)

Un exemple de bloc est fourni : [`deploy/Caddyfile.snippet`](./deploy/Caddyfile.snippet).
Il contient un emplacement commenté pour un futur `forward_auth` Authentik (non
implémenté ici, à activer plus tard côté proxy uniquement).

## Base de données & backups

- Fichier SQLite : **`./data/console.db`** en local (valeur par défaut de `DB_PATH`), et
  **`/var/lib/console/console.db`** en production (voir `deploy/console.service`).
- Le schéma est créé/migré automatiquement au démarrage (idempotent), y compris la table
  `categories` et son seed initial (une seule fois, si elle est vide).
- Mode WAL activé : des fichiers `console.db-wal` / `console.db-shm` peuvent coexister.
- **⚠️ À inclure dans les backups** : sauvegarder tout le dossier contenant le `.db` (et,
  si présents, les fichiers `-wal`/`-shm`). C'est la seule source de vérité — ce dossier
  est volontairement exclu de git (`data/`, `*.db`).

## API (préfixe `/api`, JSON, erreurs `{ code, message }`)

| Méthode | Route | Rôle |
| --- | --- | --- |
| `GET` | `/api/day/:date` | `{ tasks, sessions, review }` du jour (matérialise le planning type au premier accès). |
| `POST` | `/api/day/:date/apply-template` | Réapplique le planning type au jour (ajout simple). |
| `POST` | `/api/tasks` | Crée une tâche `{ text, category, day, start_time?, end_time? }` (`HH:MM`). |
| `PATCH` | `/api/tasks/:id` | Maj `{ done?, text?, category?, start_time?, end_time? }`. |
| `DELETE` | `/api/tasks/:id` | Supprime une tâche. |
| `POST` | `/api/sessions` | Enregistre une session focus `{ category, duration_sec, day }`. |
| `GET` | `/api/week/:startDate` | Agrégation heures/catégorie (lundi → dimanche). |
| `PUT` | `/api/reviews/:date` | Upsert bilan `{ advanced, dragged }`. |
| `GET` / `POST` | `/api/goals` | Liste / crée un but. |
| `PATCH` / `DELETE` | `/api/goals/:id` | Maj / supprime un but. |
| `GET` | `/api/categories` | Catégories actives ; `?all=1` inclut les archivées. |
| `POST` | `/api/categories` | Crée `{ key, label, color }` (clé rejetée si dupliquée). |
| `PATCH` | `/api/categories/:id` | Maj `{ label?, color?, sort_order?, is_archived? }` (`key` immuable). |
| `DELETE` | `/api/categories/:id` | Archive par défaut ; supprime définitivement avec `?hard=1` si inutilisée. |
| `GET` | `/api/history?days=30` | Historique par jour + résumé de la période. |
| `GET` | `/api/template` | Blocs actifs triés par heure de début ; `?all=1` inclut les inactifs. |
| `POST` | `/api/template` | Crée un bloc `{ text, category, start_time?, end_time? }`. |
| `PATCH` | `/api/template/:id` | Maj `{ text?, category?, start_time?, end_time?, sort_order?, is_active? }`. |
| `DELETE` | `/api/template/:id` | Suppression définitive (pas d'historique à préserver). |

Catégories : entièrement dynamiques (table `categories`), aucune liste figée. Le seed
initial crée `FORM`, `LAB`, `CAND`, `PROJ`, `TRAD`, `CHIEN`, `PERSO` (une seule fois, à la
première initialisation de la base) ; gérables ensuite depuis l'onglet Catégories.

Planning type : le seed initial crée un exemple 08:00→18:00 (une seule fois, à la première
initialisation de la base) ; entièrement modifiable ensuite depuis l'onglet Planning type.
