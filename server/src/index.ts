import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { onError, notFound } from './http.ts';
import { day } from './routes/day.ts';
import { tasks } from './routes/tasks.ts';
import { sessions } from './routes/sessions.ts';
import { week } from './routes/week.ts';
import { reviews } from './routes/reviews.ts';
import { goals } from './routes/goals.ts';
import { categories } from './routes/categories.ts';
import { history } from './routes/history.ts';
import { template } from './routes/template.ts';
import { planner } from './routes/planner.ts';

const app = new Hono();

app.onError(onError);

// --- API ---
const api = new Hono();
api.route('/day', day);
api.route('/tasks', tasks);
api.route('/sessions', sessions);
api.route('/week', week);
api.route('/reviews', reviews);
api.route('/goals', goals);
api.route('/categories', categories);
api.route('/history', history);
api.route('/template', template);
api.route('/planner', planner);

// 404 JSON stable pour toute route /api inconnue.
api.all('/*', () => {
  throw notFound('Endpoint API inconnu');
});

app.route('/api', api);

// --- Front buildé (client/dist), servi depuis la racine ---
// WorkingDirectory = racine du repo (voir console.service).
const CLIENT_DIR = './client/dist';
app.use('/*', serveStatic({ root: CLIENT_DIR }));
// Fallback SPA : toute route non-API renvoie index.html.
app.get('/*', serveStatic({ path: `${CLIENT_DIR}/index.html` }));

const port = Number(process.env.PORT ?? 3001);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[server] console de pilotage en écoute sur http://localhost:${info.port}`);
});
