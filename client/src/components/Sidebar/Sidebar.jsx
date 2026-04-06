import React from 'react';
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
          <div className="sidebar-footer-meta">
            <div className="sidebar-footer-text">FinanceAI v1.0</div>
            <div className="sidebar-footer-sub">Designed for calm, deliberate money management</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
