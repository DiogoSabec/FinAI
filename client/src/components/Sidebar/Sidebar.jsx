import React from 'react';
import { useTheme } from '../../hooks/useTheme.jsx';
import './Sidebar.css';

const NAV = [
  { id: 'dashboard',     icon: '◈',  label: 'Dashboard' },
  { id: 'accounts',      icon: (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 8L10 2l8 6H2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
      <rect x="4" y="9" width="2" height="6" rx="0.4" fill="currentColor"/>
      <rect x="9" y="9" width="2" height="6" rx="0.4" fill="currentColor"/>
      <rect x="14" y="9" width="2" height="6" rx="0.4" fill="currentColor"/>
      <rect x="2" y="16" width="16" height="1.5" rx="0.75" fill="currentColor"/>
    </svg>
  ), label: 'Accounts' },
  { id: 'income',        icon: '↑',  label: 'Income' },
  { id: 'expenses',      icon: '↓',  label: 'Expenses' },
  { id: 'subscriptions', icon: '⟳',  label: 'Subscriptions' },
  { id: 'csv-import',    icon: '⊞',  label: 'Import CSV' },
  { id: 'budget-goals',  icon: '◎',  label: 'Budget Goals' },
  { id: 'ai-advisor',    icon: '✦',  label: 'AI Advisor' },
  { id: 'settings',      icon: '⚙',  label: 'Settings' },
];

export default function Sidebar({ active, onNavigate, open, onClose }) {
  const { colorMode, setColorMode } = useTheme();
  return (
    <aside className={`sidebar ${open ? 'is-open' : ''}`}>
      <div className="sidebar-shell">
        <div className="sidebar-topbar">
          <div className="sidebar-logo">
            <span className="sidebar-logo-icon">◈</span>
            <span className="sidebar-logo-text">Finance<span className="gradient-text">AI</span></span>
          </div>
          <button className="sidebar-close" type="button" onClick={onClose} aria-label="Close navigation">
            ✕
          </button>
        </div>

        <nav className="sidebar-nav">
          {NAV.map(item => (
            <button
              key={item.id}
              className={`sidebar-item ${active === item.id ? 'active' : ''}`}
              onClick={() => onNavigate(item.id)}
            >
              <span className="sidebar-item-icon">{item.icon}</span>
              <span className="sidebar-item-copy">
                <span className="sidebar-item-label">{item.label}</span>
                <span className="sidebar-item-sub">
                  {item.id === 'dashboard' && 'Overview'}
                  {item.id === 'accounts' && 'Assets & liabilities'}
                  {item.id === 'income' && 'Cash in'}
                  {item.id === 'expenses' && 'Cash out'}
                  {item.id === 'subscriptions' && 'Recurring'}
                  {item.id === 'csv-import' && 'Bring data in'}
                  {item.id === 'budget-goals' && 'Targets'}
                  {item.id === 'ai-advisor' && 'Guidance'}
                  {item.id === 'settings' && 'Preferences'}
                </span>
              </span>
              {active === item.id && <span className="sidebar-active-bar" />}
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
            <span className="sidebar-mode-toggle-icon">
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
            <div className="sidebar-footer-sub">Designed for calm, deliberate money management</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
