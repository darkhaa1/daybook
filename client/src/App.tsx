import { useEffect, useState } from 'react';
import { TodayView } from './components/TodayView.tsx';
import { WeekView } from './components/WeekView.tsx';
import { GoalsView } from './components/GoalsView.tsx';
import { CategoriesView } from './components/CategoriesView.tsx';
import { HistoryView } from './components/HistoryView.tsx';
import { TemplateView } from './components/TemplateView.tsx';
import { todayISO, formatBlueprint } from './lib/date.ts';

type Tab = 'today' | 'week' | 'goals' | 'categories' | 'history' | 'template';

const TAB_IDS: Tab[] = ['today', 'week', 'goals', 'categories', 'history', 'template'];

const TABS: { id: Tab; label: string; code: string }[] = [
  { id: 'today', label: 'Aujourd’hui', code: 'A' },
  { id: 'week', label: 'Semaine', code: 'B' },
  { id: 'goals', label: 'Buts', code: 'C' },
  { id: 'categories', label: 'Catégories', code: 'D' },
  { id: 'history', label: 'Historique', code: 'E' },
  { id: 'template', label: 'Planning type', code: 'F' },
];

const STORAGE_KEY = 'console.activeTab';

function loadTab(): Tab {
  const saved = localStorage.getItem(STORAGE_KEY);
  return (TAB_IDS as string[]).includes(saved ?? '') ? (saved as Tab) : 'today';
}

// Horloge live, comme la maquette.
function Clock({ day }: { day: string }) {
  const [time, setTime] = useState(() => new Date().toLocaleTimeString('fr-FR'));
  useEffect(() => {
    const id = setInterval(() => setTime(new Date().toLocaleTimeString('fr-FR')), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="clock">
      <b>{time}</b>
      {formatBlueprint(day)}
    </div>
  );
}

export function App() {
  const [tab, setTab] = useState<Tab>(loadTab);
  const day = todayISO();

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, tab);
  }, [tab]);

  return (
    <>
      <div className="corner tl" aria-hidden="true" />
      <div className="corner tr" aria-hidden="true" />
      <div className="corner bl" aria-hidden="true" />
      <div className="corner br" aria-hidden="true" />

      <div className="wrap">
        <header>
          <div>
            <div className="eyebrow">Console de pilotage — Darkhaa</div>
            <h1>Planche du jour</h1>
          </div>
          <Clock day={day} />
        </header>

        <nav className="tabs" aria-label="Sections">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`tab${tab === t.id ? ' active' : ''}`}
              aria-current={tab === t.id ? 'page' : undefined}
              onClick={() => setTab(t.id)}
            >
              <span className="tab-code">{t.code}</span>
              {t.label}
            </button>
          ))}
        </nav>

        {tab === 'today' && <TodayView day={day} />}
        {tab === 'week' && <WeekView referenceDay={day} />}
        {tab === 'goals' && <GoalsView />}
        {tab === 'categories' && <CategoriesView />}
        {tab === 'history' && <HistoryView />}
        {tab === 'template' && <TemplateView />}

        <div className="titleblock">
          <div className="tb-head">PLANIFICATION QUOTIDIENNE</div>
          <div className="tb-row">
            <span>Dessiné par</span>
            <span>Darkhaa</span>
          </div>
          <div className="tb-row">
            <span>Date</span>
            <span>{formatBlueprint(day)}</span>
          </div>
          <div className="tb-row">
            <span>Planche N°</span>
            <span>001</span>
          </div>
          <div className="tb-row">
            <span>Rév.</span>
            <span>B — live</span>
          </div>
        </div>
      </div>
    </>
  );
}
