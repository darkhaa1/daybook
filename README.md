# Console de pilotage

Outil de pilotage quotidien **mono-utilisateur, privé** : suivi des priorités du jour,
timer focus (pomodoro), bilan du soir, répartition hebdomadaire du temps réel par
catégorie, et suivi de buts.

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

L'enum de catégories est une **source unique** (`server/src/shared.ts`), importée par le
front via l'alias Vite `@shared`.

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

1. Copier le dépôt sur le serveur (ex. `/opt/console-pilotage`).
2. `pnpm install`
3. `pnpm build` (génère `client/dist` et `server/dist`).
4. Lancer le service : `node server/dist/index.js` (voir `console.service` pour systemd).
5. Placer le tout derrière le reverse-proxy + forward-auth.

### systemd

Un exemple d'unité est fourni : [`console.service`](./console.service).

```bash
sudo cp console.service /etc/systemd/system/console.service
# adapter WorkingDirectory, User/Group, PORT, DB_PATH
sudo systemctl daemon-reload
sudo systemctl enable --now console.service
sudo systemctl status console.service
```

## Base de données & backups

- Fichier SQLite : **`./data/console.db`** par défaut (ou la valeur de `DB_PATH`).
- Le schéma est créé/migré automatiquement au démarrage (idempotent).
- Mode WAL activé : des fichiers `console.db-wal` / `console.db-shm` peuvent coexister.
- **⚠️ À inclure dans les backups** : sauvegarder le dossier `data/` (le `.db` et, si
  présents, les fichiers `-wal`/`-shm`). C'est la seule source de vérité — le dossier
  `data/` est volontairement exclu de git.

## API (préfixe `/api`, JSON, erreurs `{ code, message }`)

| Méthode | Route | Rôle |
| --- | --- | --- |
| `GET` | `/api/day/:date` | `{ tasks, sessions, review }` du jour. |
| `POST` | `/api/tasks` | Crée une tâche `{ text, category, day }`. |
| `PATCH` | `/api/tasks/:id` | Maj `{ done?, text? }`. |
| `DELETE` | `/api/tasks/:id` | Supprime une tâche. |
| `POST` | `/api/sessions` | Enregistre une session focus `{ category, duration_sec, day }`. |
| `GET` | `/api/week/:startDate` | Agrégation heures/catégorie (lundi → dimanche). |
| `PUT` | `/api/reviews/:date` | Upsert bilan `{ advanced, dragged }`. |
| `GET` / `POST` | `/api/goals` | Liste / crée un but. |
| `PATCH` / `DELETE` | `/api/goals/:id` | Maj / supprime un but. |

Catégories (enum en dur, partagé front/back) : `FORM`, `LAB`, `CAND`, `PROJ`, `TRAD`, `CHIEN`, `PERSO`.
