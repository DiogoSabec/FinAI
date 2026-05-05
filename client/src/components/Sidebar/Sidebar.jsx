import { useTheme } from '../../hooks/useTheme.jsx';
import {
  IconDashboard, IconAccounts, IconArrowDown, IconArrowUp,
  IconRecurring, IconImport, IconTarget, IconSparkle, IconSettings, IconClose
} from '../icons.jsx';
import './Sidebar.css';

const NAV = [
  { id: 'dashboard',     Icon: IconDashboard, label: 'Dashboard',     sub: 'Overview' },
  { id: 'accounts',      Icon: IconAccounts,  label: 'Accounts',      sub: 'Assets & liabilities' },
  { id: 'income',        Icon: IconArrowDown, label: 'Income',        sub: 'Cash in' },
  { id: 'expenses',      Icon: IconArrowUp,   label: 'Expenses',      sub: 'Cash out' },
  { id: 'subscriptions', Icon: IconRecurring, label: 'Subscriptions', sub: 'Recurring' },
  { id: 'csv-import',    Icon: IconImport,    label: 'Import CSV',    sub: 'Bring data in' },
  { id: 'budget-goals',  Icon: IconTarget,    label: 'Budget Goals',  sub: 'Targets' },
  { id: 'ai-advisor',    Icon: IconSparkle,   label: 'AI Advisor',    sub: 'Guidance' },
  { id: 'settings',      Icon: IconSettings,  label: 'Settings',      sub: 'Preferences' },
];

export default function Sidebar({ active, onNavigate, open, onClose }) {
  const { colorMode, setColorMode } = useTheme();
  return (
    <aside className={`sidebar ${open ? 'is-open' : ''}`}>
      <div className="sidebar-shell">
        <div className="sidebar-topbar">
          <div className="sidebar-logo">
            <span className="sidebar-logo-icon" aria-hidden="true">
              <IconSparkle width={18} height={18} />
            </span>
            <span className="sidebar-logo-text">Finance<span className="text-accent">AI</span></span>
          </div>
          <button className="sidebar-close" type="button" onClick={onClose} aria-label="Close navigation">
            <IconClose />
          </button>
        </div>

        <nav className="sidebar-nav" aria-label="Main navigation">
          {NAV.map(({ id, Icon, label, sub }) => (
            <button
              key={id}
              className={`sidebar-item ${active === id ? 'active' : ''}`}
              aria-current={active === id ? 'page' : undefined}
              onClick={() => onNavigate(id)}
            >
              <span className="sidebar-item-icon" aria-hidden="true">
                <Icon width={18} height={18} />
              </span>
              <span className="sidebar-item-copy">
                <span className="sidebar-item-label">{label}</span>
                <span className="sidebar-item-sub">{sub}</span>
              </span>
              {active === id && <span className="sidebar-active-bar" aria-hidden="true" />}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button
            className="sidebar-mode-toggle"
            type="button"
            onClick={() => setColorMode(colorMode === 'dark' ? 'light' : 'dark')}
            aria-label={`Switch to ${colorMode === 'dark' ? 'light' : 'dark'} mode`}
          >
            <span className="sidebar-mode-toggle-icon" aria-hidden="true">
              {colorMode === 'dark' ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                  <circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
              )}
            </span>
            <span className="sidebar-mode-toggle-label">
              {colorMode === 'dark' ? 'Light mode' : 'Dark mode'}
            </span>
            <span className="sidebar-mode-toggle-track" aria-hidden="true">
              <span className={`sidebar-mode-toggle-thumb ${colorMode === 'light' ? 'is-on' : ''}`} />
            </span>
          </button>
          <div className="sidebar-footer-meta">
            <div className="sidebar-footer-text">FinanceAI v1.0</div>
            <div className="sidebar-footer-sub">Calm, deliberate money management</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
