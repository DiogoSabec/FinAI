import React, { useState, useEffect, useRef } from 'react';
import { CurrencyProvider } from './hooks/useCurrency.jsx';
import { ThemeProvider } from './hooks/useTheme.jsx';
import Sidebar from './components/Sidebar/Sidebar.jsx';
import BottomNav from './components/BottomNav/BottomNav.jsx';
import Dashboard from './components/Dashboard/Dashboard.jsx';
import Accounts from './components/Accounts/Accounts.jsx';
import Income from './components/Income/Income.jsx';
import Expenses from './components/Expenses/Expenses.jsx';
import Subscriptions from './components/Subscriptions/Subscriptions.jsx';
import CSVImport from './components/CSVImport/CSVImport.jsx';
import BudgetGoals from './components/BudgetGoals/BudgetGoals.jsx';
import AIAdvisor from './components/AIAdvisor/AIAdvisor.jsx';
import Settings from './components/Settings/Settings.jsx';
import { IconBars } from './components/icons.jsx';

const PAGES = {
  'dashboard':     <Dashboard />,
  'accounts':      <Accounts />,
  'income':        <Income />,
  'expenses':      <Expenses />,
  'subscriptions': <Subscriptions />,
  'csv-import':    <CSVImport />,
  'budget-goals':  <BudgetGoals />,
  'ai-advisor':    <AIAdvisor />,
  'settings':      <Settings />,
};

const PAGE_META = {
  'dashboard': { title: 'Dashboard', label: 'Command Center' },
  'accounts': { title: 'Accounts', label: 'Balance Sheet' },
  'income': { title: 'Income', label: 'Revenue Ledger' },
  'expenses': { title: 'Expenses', label: 'Spending Ledger' },
  'subscriptions': { title: 'Subscriptions', label: 'Recurring Spend' },
  'csv-import': { title: 'Import CSV', label: 'Data Intake' },
  'budget-goals': { title: 'Budget Goals', label: 'Spend Limits' },
  'ai-advisor': { title: 'AI Advisor', label: 'Analyst Desk' },
  'settings': { title: 'Settings', label: 'Studio Controls' },
};

export default function App() {
  const [page, setPage] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navigate = (nextPage) => {
    setPage(nextPage);
    setSidebarOpen(false);
  };

  // Edge-swipe to open the sidebar drawer (touch only, near left edge)
  const swipeRef = useRef({ startX: 0, startY: 0, tracking: false });
  useEffect(() => {
    const onStart = (e) => {
      const t = e.touches?.[0];
      if (!t) return;
      // Only initiate if starting near the left edge AND drawer is closed
      if (t.clientX <= 24 && !sidebarOpen) {
        swipeRef.current = { startX: t.clientX, startY: t.clientY, tracking: true };
      }
    };
    const onMove = (e) => {
      const s = swipeRef.current;
      if (!s.tracking) return;
      const t = e.touches?.[0];
      if (!t) return;
      const dx = t.clientX - s.startX;
      const dy = Math.abs(t.clientY - s.startY);
      if (dx > 60 && dy < 40) {
        setSidebarOpen(true);
        swipeRef.current.tracking = false;
      }
    };
    const onEnd = () => { swipeRef.current.tracking = false; };
    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    };
  }, [sidebarOpen]);

  // Lock body scroll when drawer is open on mobile
  useEffect(() => {
    if (sidebarOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [sidebarOpen]);

  const pageMeta = PAGE_META[page] || PAGE_META.dashboard;

  return (
    <ThemeProvider>
    <CurrencyProvider>
      <div className="app-layout">
        <div
          className={`app-sidebar-backdrop ${sidebarOpen ? 'is-open' : ''}`}
          onClick={() => setSidebarOpen(false)}
        />
        <Sidebar
          active={page}
          onNavigate={navigate}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <main className="app-main">
          <div className="app-main-glow app-main-glow-left" />
          <div className="app-main-glow app-main-glow-right" />
          <div className="app-mobile-bar">
            <button
              className="app-mobile-toggle"
              type="button"
              aria-label="Open navigation"
              onClick={() => setSidebarOpen(true)}
            >
              <IconBars width={20} height={20} />
            </button>
            <div className="app-mobile-meta">
              <span className="app-mobile-kicker">{pageMeta.label}</span>
              <strong>{pageMeta.title}</strong>
            </div>
          </div>
          <div className="page-shell" key={page}>
            {PAGES[page] || PAGES.dashboard}
          </div>
        </main>
        <BottomNav active={page} onNavigate={navigate} />
      </div>
    </CurrencyProvider>
    </ThemeProvider>
  );
}
