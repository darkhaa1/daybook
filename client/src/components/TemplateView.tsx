import { useEffect, useState } from 'react';
import type { TemplateItem } from '../types.ts';
import { api, ApiError } from '../lib/api.ts';
import { useCategories } from '../context/CategoriesContext.tsx';
import { CategorySelect } from './CategorySelect.tsx';
import { CategoryDot } from './CategoryDot.tsx';
import { DayOfWeekSelect } from './DayOfWeekSelect.tsx';
import { todayISO, WEEKDAY_LABELS } from '../lib/date.ts';

// Ordre d'affichage des sections : "Tous les jours" puis lundi..dimanche.
const GROUP_ORDER: (number | null)[] = [null, 0, 1, 2, 3, 4, 5, 6];

export function TemplateView() {
  const { active } = useCategories();
  const [items, setItems] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applyMsg, setApplyMsg] = useState<string | null>(null);

  // Formulaire nouveau bloc.
  const [text, setText] = useState('');
  const [category, setCategory] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState<number | null>(null);

  useEffect(() => {
    if (!category && active.length > 0) {
      const first = active[0];
      if (first) setCategory(first.key);
    }
  }, [active, category]);

  // Items triés par sort_order, puis regroupés par jour (null = tous les jours).
  const sortedAll = [...items].sort((a, b) => a.sort_order - b.sort_order);
  const groups = GROUP_ORDER.map((key) => ({
    key,
    label: key === null ? 'Tous les jours' : WEEKDAY_LABELS[key],
    items: sortedAll.filter((it) => it.day_of_week === key),
  })).filter((g) => g.items.length > 0);

  async function load() {
    setLoading(true);
    try {
      const rows = await api.getTemplate(true);
      setItems(rows);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function addItem() {
    const trimmed = text.trim();
    if (!trimmed || !category) return;
    try {
      await api.createTemplateItem({
        text: trimmed,
        category,
        start_time: startTime || null,
        end_time: endTime || null,
        day_of_week: dayOfWeek,
      });
      setText('');
      setStartTime('');
      setEndTime('');
      setError(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Ajout impossible');
    }
  }

  async function patch(
    item: TemplateItem,
    data: Partial<{
      text: string;
      category: string;
      start_time: string | null;
      end_time: string | null;
      day_of_week: number | null;
      is_active: boolean;
      sort_order: number;
    }>,
  ) {
    try {
      await api.updateTemplateItem(item.id, data);
      setError(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Mise à jour impossible');
    }
  }

  async function remove(item: TemplateItem) {
    try {
      await api.deleteTemplateItem(item.id);
      setError(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Suppression impossible');
    }
  }

  // Réordonne à l'intérieur d'un même groupe (jour) en échangeant les sort_order
  // de deux blocs adjacents.
  async function move(groupItems: TemplateItem[], index: number, direction: -1 | 1) {
    const j = index + direction;
    if (j < 0 || j >= groupItems.length) return;
    const a = groupItems[index];
    const b = groupItems[j];
    if (!a || !b) return;
    try {
      await Promise.all([
        api.updateTemplateItem(a.id, { sort_order: b.sort_order }),
        api.updateTemplateItem(b.id, { sort_order: a.sort_order }),
      ]);
      setError(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Réordonnancement impossible');
    }
  }

  async function reapply() {
    try {
      const res = await api.applyTemplate(todayISO());
      setApplyMsg(`${res.applied} bloc(s) ajouté(s) au jour courant.`);
      setError(null);
      window.setTimeout(() => setApplyMsg(null), 3000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Réapplication impossible');
    }
  }

  return (
    <>
      {error && <div className="error-banner" role="alert">{error}</div>}

      <section className="panel">
        <p className="panel-title">Nouveau bloc</p>
        <div className="template-form">
          <input
            type="time"
            value={startTime}
            aria-label="Heure de début"
            onChange={(e) => setStartTime(e.target.value)}
          />
          <input
            type="time"
            value={endTime}
            aria-label="Heure de fin"
            onChange={(e) => setEndTime(e.target.value)}
          />
          <input
            type="text"
            value={text}
            placeholder="Intitulé du bloc…"
            aria-label="Intitulé du bloc"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addItem();
            }}
          />
          <CategorySelect value={category} onChange={setCategory} ariaLabel="Catégorie" />
          <DayOfWeekSelect value={dayOfWeek} onChange={setDayOfWeek} ariaLabel="Jour d'application" />
          <button type="button" className="btn primary" onClick={addItem} disabled={!category}>
            + Ajouter
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="template-header-row">
          <p className="panel-title">Planning type ({sortedAll.length})</p>
          <button type="button" className="btn primary" onClick={reapply}>
            Réappliquer au jour courant
          </button>
        </div>
        <p className="chart-caption">
          Un bloc «&nbsp;Tous les jours&nbsp;» apparaît chaque jour ; un bloc daté n'apparaît qu'à
          l'ouverture du jour correspondant. Modifier le planning type n'affecte pas les jours déjà
          ouverts — utilisez «&nbsp;Réappliquer&nbsp;» pour pousser les changements sur aujourd'hui.
        </p>
        {applyMsg && <p className="muted-note">{applyMsg}</p>}

        {loading && <p className="muted-note">Chargement…</p>}
        {!loading && sortedAll.length === 0 && (
          <p className="muted-note">Aucun bloc — ajoutez-en un ci-dessus.</p>
        )}

        {groups.map((group) => (
          <div key={group.key === null ? 'all' : group.key} className="template-group">
            <p className="template-group-title">
              {group.label} <span className="muted-count">· {group.items.length}</span>
            </p>
            <ul className="template-list">
              {group.items.map((item, i) => (
                <li key={item.id} className={item.is_active ? '' : 'inactive'}>
                  <input
                    type="checkbox"
                    checked={item.is_active}
                    aria-label={`${item.is_active ? 'Désactiver' : 'Activer'} « ${item.text} »`}
                    onChange={() => patch(item, { is_active: !item.is_active })}
                  />
                  <input
                    type="time"
                    className="task-time-input"
                    defaultValue={item.start_time ?? ''}
                    aria-label={`Heure de début de « ${item.text} »`}
                    onChange={(e) => patch(item, { start_time: e.target.value || null })}
                  />
                  <input
                    type="time"
                    className="task-time-input"
                    defaultValue={item.end_time ?? ''}
                    aria-label={`Heure de fin de « ${item.text} »`}
                    onChange={(e) => patch(item, { end_time: e.target.value || null })}
                  />
                  <input
                    type="text"
                    className="template-text-input"
                    defaultValue={item.text}
                    aria-label={`Intitulé de « ${item.text} »`}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== item.text) patch(item, { text: v });
                      else e.target.value = item.text;
                    }}
                  />
                  <CategoryDot categoryKey={item.category} />
                  <CategorySelect
                    value={item.category}
                    onChange={(v) => patch(item, { category: v })}
                    ariaLabel={`Catégorie de « ${item.text} »`}
                  />
                  <DayOfWeekSelect
                    value={item.day_of_week}
                    onChange={(v) => patch(item, { day_of_week: v })}
                    ariaLabel={`Jour d'application de « ${item.text} »`}
                  />
                  <span className="reorder-btns">
                    <button
                      type="button"
                      className="btn"
                      disabled={i === 0}
                      onClick={() => move(group.items, i, -1)}
                      aria-label={`Monter ${item.text}`}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="btn"
                      disabled={i === group.items.length - 1}
                      onClick={() => move(group.items, i, 1)}
                      aria-label={`Descendre ${item.text}`}
                    >
                      ↓
                    </button>
                  </span>
                  <button type="button" className="btn del-danger" onClick={() => remove(item)}>
                    Supprimer
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </>
  );
}
