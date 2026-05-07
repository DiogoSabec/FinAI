import { useEffect } from 'react';

export default function ActionSheet({ open, onClose, title, actions = [] }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="action-sheet-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      role="dialog"
      aria-modal="true"
      aria-label={title || 'Actions'}
    >
      <div className="action-sheet">
        {title && (
          <div style={{
            padding: '14px 16px 6px',
            fontSize: '0.74rem',
            fontWeight: 700,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
            textAlign: 'center',
          }}>
            {title}
          </div>
        )}
        <div className="action-sheet-list">
          {actions.map((a, i) => (
            <button
              key={i}
              type="button"
              className={`action-sheet-item ${a.danger ? 'is-danger' : ''}`}
              onClick={() => { a.onClick?.(); onClose?.(); }}
              disabled={a.disabled}
            >
              {a.icon && <span style={{display:'inline-flex'}}>{a.icon}</span>}
              <span style={{flex:1}}>{a.label}</span>
            </button>
          ))}
          <button
            type="button"
            className="action-sheet-item action-sheet-cancel"
            onClick={onClose}
            style={{justifyContent:'center', color:'var(--text-secondary)'}}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
