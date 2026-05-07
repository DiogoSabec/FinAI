import {
  IconDashboard, IconArrowUp, IconArrowDown, IconSparkle,
} from '../icons.jsx';

const TABS = [
  { id: 'dashboard',  Icon: IconDashboard, label: 'Home' },
  { id: 'expenses',   Icon: IconArrowUp,   label: 'Expenses' },
  { id: 'income',     Icon: IconArrowDown, label: 'Income' },
  { id: 'ai-advisor', Icon: IconSparkle,   label: 'AI' },
];

export default function BottomNav({ active, onNavigate }) {
  return (
    <nav className="bottom-nav" aria-label="Primary">
      <div className="bottom-nav-inner">
        {TABS.map(({ id, Icon, label }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              type="button"
              className={`bottom-nav-item ${isActive ? 'is-active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => onNavigate(id)}
            >
              <span className="bottom-nav-item-icon" aria-hidden="true">
                <Icon width={22} height={22} />
              </span>
              <span className="bottom-nav-item-label">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
