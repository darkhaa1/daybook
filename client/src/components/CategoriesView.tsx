import { useState } from 'react';
import type { CategoryDef } from '../types.ts';
import { api, ApiError } from '../lib/api.ts';
import { useCategories } from '../context/CategoriesContext.tsx';
import { slugifyKey } from '../lib/slug.ts';
import { CategoryDot } from './CategoryDot.tsx';

export function CategoriesView() {
  const { all, active, loading, error: loadError, refresh } = useCategories();
  const [actionError, setActionError] = useState<string | null>(null);

  // Formulaire nouvelle catégorie.
  const [label, setLabel] = useState('');
  const [color, setColor] = useState('#82A0BA');
  const [customKey, setCustomKey] = useState(false);
  const [key, setKey] = useState('');

  const archived = all.filter((c) => c.is_archived);
  const effectiveKey = customKey ? key : slugifyKey(label);

  async function addCategory() {
    const trimmedLabel = label.trim();
    if (!trimmedLabel || !effectiveKey) return;
    try {
      await api.createCategory({ key: effectiveKey, label: trimmedLabel, color });
      setLabel('');
      setKey('');
      setActionError(null);
      await refresh();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Création impossible');
    }
  }

  async function rename(cat: CategoryDef, newLabel: string) {
    const trimmed = newLabel.trim();
    if (!trimmed || trimmed === cat.label) return;
    try {
      await api.updateCategory(cat.id, { label: trimmed });
      setActionError(null);
      await refresh();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Renommage impossible');
    }
  }

  async function recolor(cat: CategoryDef, newColor: string) {
    try {
      await api.updateCategory(cat.id, { color: newColor });
      setActionError(null);
      await refresh();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Changement de couleur impossible');
    }
  }

  async function move(index: number, direction: -1 | 1) {
    const j = index + direction;
    if (j < 0 || j >= active.length) return;
    const a = active[index];
    const b = active[j];
    if (!a || !b) return;
    try {
      await Promise.all([
        api.updateCategory(a.id, { sort_order: b.sort_order }),
        api.updateCategory(b.id, { sort_order: a.sort_order }),
      ]);
      setActionError(null);
      await refresh();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Réordonnancement impossible');
    }
  }

  async function setArchived(cat: CategoryDef, archive: boolean) {
    try {
      await api.updateCategory(cat.id, { is_archived: archive });
      setActionError(null);
      await refresh();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Opération impossible');
    }
  }

  async function hardDelete(cat: CategoryDef) {
    try {
      await api.deleteCategory(cat.id, true);
      setActionError(null);
      await refresh();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Suppression impossible');
    }
  }

  function CategoryRow({ cat, index }: { cat: CategoryDef; index: number | null }) {
    return (
      <li>
        <CategoryDot categoryKey={cat.key} />
        <span className="chip cat-key-chip">{cat.key}</span>
        <input
          type="text"
          defaultValue={cat.label}
          aria-label={`Libellé de ${cat.key}`}
          onBlur={(e) => rename(cat, e.target.value)}
          className="cat-label-input"
        />
        <input
          type="color"
          value={cat.color}
          aria-label={`Couleur de ${cat.key}`}
          onChange={(e) => recolor(cat, e.target.value)}
        />
        {index !== null && (
          <span className="reorder-btns">
            <button
              type="button"
              className="btn"
              disabled={index === 0}
              onClick={() => move(index, -1)}
              aria-label={`Monter ${cat.key}`}
            >
              ↑
            </button>
            <button
              type="button"
              className="btn"
              disabled={index === active.length - 1}
              onClick={() => move(index, 1)}
              aria-label={`Descendre ${cat.key}`}
            >
              ↓
            </button>
          </span>
        )}
        {!cat.is_archived && (
          <button type="button" className="btn" onClick={() => setArchived(cat, true)}>
            Archiver
          </button>
        )}
        {cat.is_archived && (
          <button type="button" className="btn primary" onClick={() => setArchived(cat, false)}>
            Réactiver
          </button>
        )}
        {!cat.in_use && (
          <button type="button" className="btn del-danger" onClick={() => hardDelete(cat)}>
            Supprimer
          </button>
        )}
      </li>
    );
  }

  return (
    <>
      {(loadError || actionError) && (
        <div className="error-banner" role="alert">
          {loadError ?? actionError}
        </div>
      )}

      <section className="panel">
        <p className="panel-title">Nouvelle catégorie</p>
        <div className="goal-form">
          <input
            type="text"
            value={label}
            placeholder="Libellé (ex. Musique)…"
            aria-label="Libellé de la catégorie"
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addCategory();
            }}
          />
          <input
            type="color"
            value={color}
            aria-label="Couleur de la catégorie"
            onChange={(e) => setColor(e.target.value)}
          />
          <button type="button" className="btn primary" onClick={addCategory}>
            + Ajouter
          </button>
        </div>
        <label className="cat-key-toggle">
          <input
            type="checkbox"
            checked={customKey}
            onChange={(e) => setCustomKey(e.target.checked)}
          />
          Clé personnalisée
        </label>
        {customKey ? (
          <input
            type="text"
            value={key}
            placeholder="CLE_INTERNE"
            aria-label="Clé personnalisée"
            onChange={(e) => setKey(e.target.value.toUpperCase())}
            className="cat-key-input"
          />
        ) : (
          <p className="chart-caption">
            Clé générée : <strong>{effectiveKey || '—'}</strong> (interne, stable, non modifiable
            ensuite)
          </p>
        )}
      </section>

      <section className="panel">
        <p className="panel-title">Actives ({active.length})</p>
        {loading && <p className="muted-note">Chargement…</p>}
        {!loading && active.length === 0 && (
          <p className="muted-note">Aucune catégorie active — ajoutez-en une ci-dessus.</p>
        )}
        <ul className="category-list">
          {active.map((cat, i) => (
            <CategoryRow key={cat.id} cat={cat} index={i} />
          ))}
        </ul>
      </section>

      {archived.length > 0 && (
        <section className="panel">
          <p className="panel-title">Archivées ({archived.length})</p>
          <ul className="category-list">
            {archived.map((cat) => (
              <CategoryRow key={cat.id} cat={cat} index={null} />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
