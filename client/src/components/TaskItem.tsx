import { useEffect, useRef, useState } from 'react';
import type { Task } from '../types.ts';
import { nowHHMM } from '../lib/date.ts';
import { CategoryDot } from './CategoryDot.tsx';
import { CategorySelect } from './CategorySelect.tsx';
import { SlotField } from './SlotField.tsx';

// Ligne de tâche partagée entre Aujourd'hui et Planning : lecture compacte
// (zéro chrome) + édition inline au clic (créneau 24h, catégorie, texte, ×).

export type TaskPatch = Partial<{
  done: boolean;
  text: string;
  category: string;
  start_time: string | null;
  end_time: string | null;
}>;

// Créneau compact "08:00–09:00" en lecture ; "—" si non planifiée.
export function formatSlot(task: Task): string {
  if (task.start_time && task.end_time) return `${task.start_time}–${task.end_time}`;
  if (task.start_time) return task.start_time;
  if (task.end_time) return `–${task.end_time}`;
  return '—';
}

// Heure courante "HH:MM", rafraîchie toutes les 30 s — pour le repère
// « maintenant » et le surlignage de la tâche en cours.
export function useNowHHMM(): string {
  const [now, setNow] = useState(() => nowHHMM());
  useEffect(() => {
    const id = setInterval(() => setNow(nowHHMM()), 30_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

// La tâche est-elle en cours à l'instant `now` ? (créneau complet requis)
export function isOngoing(task: Task, now: string): boolean {
  return task.start_time !== null && task.end_time !== null
    ? task.start_time <= now && now < task.end_time
    : false;
}

// Index d'insertion du repère « maintenant » dans une liste triée comme le
// serveur (planifiées chrono puis non-planifiées) : après la dernière tâche
// déjà commencée. null si aucune tâche planifiée (repère sans signification).
export function nowLineIndex(tasks: Task[], now: string): number | null {
  if (!tasks.some((t) => t.start_time !== null)) return null;
  let idx = 0;
  tasks.forEach((t, i) => {
    if (t.start_time !== null && t.start_time <= now) idx = i + 1;
  });
  return idx;
}

// Repère visuel « maintenant » inséré dans la liste des tâches.
export function NowLine({ now }: { now: string }) {
  return (
    <li className="now-line" aria-hidden="true">
      <span>{now}</span>
    </li>
  );
}

interface BodyProps {
  task: Task;
  onPatch: (task: Task, data: TaskPatch) => void;
  onOpen: (id: number) => void;
}

// Corps d'une ligne en lecture : [pastille = toggle done] [créneau] [titre ->
// ouvre l'édition]. À envelopper dans un <li className="planner-task-line">
// (le Planning y ajoute ses attributs de drag & drop et la poignée ≡).
export function TaskLineBody({ task, onPatch, onOpen }: BodyProps) {
  return (
    <>
      <button
        type="button"
        className="planner-task-toggle"
        aria-pressed={task.done}
        aria-label={`Marquer « ${task.text} » comme ${task.done ? 'à faire' : 'terminé'}`}
        onClick={() => onPatch(task, { done: !task.done })}
      >
        <CategoryDot categoryKey={task.category} />
      </button>
      <button
        type="button"
        className="planner-task-open"
        title={task.text}
        aria-label={`Modifier « ${task.text} »`}
        onClick={() => onOpen(task.id)}
      >
        <span className="planner-task-slot">{formatSlot(task)}</span>
        <span className="planner-task-title">{task.text}</span>
      </button>
    </>
  );
}

interface EditorProps {
  task: Task;
  onClose: () => void;
  onPatch: (task: Task, data: TaskPatch) => void;
  onDelete: (id: number) => void;
}

// Édition inline : la ligne devient éditable sur place, une seule à la fois.
// Enter valide, Escape annule (texte non commité), clic hors de la ligne
// commit + ferme. Ligne 1 : créneau + catégorie + × ; ligne 2 : texte.
export function TaskInlineEditor({ task, onClose, onPatch, onDelete }: EditorProps) {
  const cardRef = useRef<HTMLLIElement | null>(null);
  const textRef = useRef<HTMLInputElement | null>(null);

  function commitText() {
    const v = textRef.current?.value.trim();
    if (v && v !== task.text) onPatch(task, { text: v });
  }

  // Clic hors de la ligne -> commit du texte en cours puis fermeture.
  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      const card = cardRef.current;
      if (!card || !(e.target instanceof Node) || card.contains(e.target)) return;
      const v = textRef.current?.value.trim();
      if (v && v !== task.text) onPatch(task, { text: v });
      onClose();
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [task, onPatch, onClose]);

  return (
    <li
      className="planner-task-inline-edit"
      ref={cardRef}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commitText();
          onClose();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
        }
      }}
    >
      <div className="planner-inline-times">
        <SlotField
          start={task.start_time}
          end={task.end_time}
          onCommit={(start, end) => onPatch(task, { start_time: start, end_time: end })}
          ariaLabel={`Créneau de « ${task.text} »`}
        />
        <CategorySelect
          value={task.category}
          onChange={(v) => onPatch(task, { category: v })}
          ariaLabel={`Catégorie de « ${task.text} »`}
        />
        <button
          type="button"
          className="del-btn planner-inline-del"
          onClick={() => onDelete(task.id)}
          aria-label={`Supprimer « ${task.text} »`}
          title="Supprimer"
        >
          ×
        </button>
      </div>
      <input
        ref={textRef}
        type="text"
        defaultValue={task.text}
        autoFocus
        aria-label="Texte de la tâche"
        onBlur={commitText}
      />
    </li>
  );
}
