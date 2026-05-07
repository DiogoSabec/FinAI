import { useEffect, useState } from 'react';
import { api } from '../../utils/api.js';
import { useCurrency } from '../../hooks/useCurrency.jsx';
import { RECURRENCE_OPTIONS } from '../../utils/categories.js';
import { IconEdit, IconTrash, IconClose, IconArrowSwap, IconInfo } from '../icons.jsx';
import ActionSheet from '../shared/ActionSheet.jsx';

const EMPTY = { source:'', amount:'', date: new Date().toISOString().slice(0,10), recurrence:'one-time', notes:'', account_id: null, is_transfer: false, from_account_id: null, ignore_dashboard: false };

export default function Income() {
  const { fmt } = useCurrency();
  const [items, setItems]   = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]   = useState(null);
  const [form, setForm]         = useState(EMPTY);
  const [saving, setSaving]     = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [search, setSearch]     = useState('');
  const [filterMonth, setFilterMonth] = useState('');

  // Selection state
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [lastClickedId, setLastClickedId] = useState(null);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [bulkForm, setBulkForm] = useState({ recurrence: '', account_id: '', ignore_dashboard: '' });
  const [bulkFields, setBulkFields] = useState({ recurrence: false, account_id: false, ignore_dashboard: false });
  const [bulkSaving, setBulkSaving] = useState(false);
  const [sheetItem, setSheetItem] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const load = () => {
    Promise.all([api.get('/income'), api.get('/accounts')]).then(([inc, acc]) => {
      setItems(inc);
      setAccounts(acc);
    }).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const totalMonthly = items.reduce((s, i) => {
    if (i.recurrence === 'monthly') return s + i.amount;
    if (i.recurrence === 'yearly')  return s + i.amount / 12;
    if (i.recurrence === 'weekly')  return s + i.amount * 4.33;
    if (i.recurrence === 'bi-weekly') return s + i.amount * 2.17;
    return s;
  }, 0);

  const totalAllTime = items.reduce((s, i) => s + i.amount, 0);

  const filtered = items.filter(i => {
    const matchSearch = !search || i.source.toLowerCase().includes(search.toLowerCase());
    const matchMonth = !filterMonth || i.date.startsWith(filterMonth);
    return matchSearch && matchMonth;
  });

  const filteredTotal = filtered.reduce((s, i) => s + i.amount, 0);

  const openAdd  = () => { setEditing(null); setForm(EMPTY); setShowModal(true); };
  const openEdit = (item) => { setEditing(item); setForm({ ...item }); setShowModal(true); };
  const close    = () => { setShowModal(false); setEditing(null); };

  const save = async () => {
    if (!form.source || !form.amount || !form.date) return;
    if (form.is_transfer && !form.account_id) { alert("Please select a Destination Account for the transfer."); return; }
    if (form.is_transfer && !editing?.is_transfer && !form.from_account_id) { alert("Please select a Source Account where the money came from."); return; }

    setSaving(true);
    try {
      if (editing) {
        await api.put(`/income/${editing.id}`, form);

        if (form.is_transfer && !editing.is_transfer && form.from_account_id) {
          const toAccountName = accounts.find(a => a.id === form.account_id)?.name || 'Account';
          await api.post('/expenses', {
            description: `Transfer to ${toAccountName} (${form.source})`,
            amount: form.amount,
            date: form.date,
            account_id: form.from_account_id,
            category: 'Transfer',
            is_transfer: 1,
            payment_method: 'transfer',
            notes: form.notes
          });
        }
      } else {
        await api.post('/income', form);

        if (form.is_transfer && form.from_account_id) {
          const toAccountName = accounts.find(a => a.id === form.account_id)?.name || 'Account';
          await api.post('/expenses', {
            description: `Transfer to ${toAccountName} (${form.source})`,
            amount: form.amount,
            date: form.date,
            account_id: form.from_account_id,
            category: 'Transfer',
            is_transfer: 1,
            payment_method: 'transfer',
            notes: form.notes
          });
        }
      }
      await load();
      close();
    } finally { setSaving(false); }
  };

  const remove = async (id) => {
    setDeleteConfirm(id);
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    await api.delete(`/income/${deleteConfirm}`);
    setItems(prev => prev.filter(i => i.id !== deleteConfirm));
    setDeleteConfirm(null);
  };

  // Selection helpers
  const toggleSelectMode = () => {
    setSelectMode(v => !v);
    setSelected(new Set());
    setLastClickedId(null);
  };

  const handleSelect = (id, shiftKey) => {
    if (shiftKey && lastClickedId !== null && lastClickedId !== id) {
      const ids = filtered.map(i => i.id);
      const lastIdx = ids.indexOf(lastClickedId);
      const curIdx = ids.indexOf(id);
      if (lastIdx >= 0 && curIdx >= 0) {
        const [from, to] = lastIdx < curIdx ? [lastIdx, curIdx] : [curIdx, lastIdx];
        const range = ids.slice(from, to + 1);
        const selecting = !selected.has(id);
        setSelected(prev => {
          const next = new Set(prev);
          for (const rid of range) {
            if (selecting) next.add(rid); else next.delete(rid);
          }
          return next;
        });
        setLastClickedId(id);
        return;
      }
    }
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    setLastClickedId(id);
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(i => i.id)));
    }
    setLastClickedId(null);
  };

  const confirmBulkDelete = async () => {
    await api.delete('/income/bulk', { ids: [...selected] });
    setItems(prev => prev.filter(i => !selected.has(i.id)));
    setSelected(new Set());
    setBulkDeleteConfirm(false);
  };

  const openBulkEdit = () => {
    setBulkForm({ recurrence: '', account_id: '', ignore_dashboard: '' });
    setBulkFields({ recurrence: false, account_id: false, ignore_dashboard: false });
    setShowBulkEdit(true);
  };

  const confirmBulkEdit = async () => {
    const updates = {};
    if (bulkFields.recurrence && bulkForm.recurrence) updates.recurrence = bulkForm.recurrence;
    if (bulkFields.account_id) updates.account_id = bulkForm.account_id ? parseInt(bulkForm.account_id) : null;
    if (bulkFields.ignore_dashboard && bulkForm.ignore_dashboard !== '') updates.ignore_dashboard = bulkForm.ignore_dashboard === 'true';
    if (Object.keys(updates).length === 0) return;
    setBulkSaving(true);
    try {
      await api.put('/income/bulk', { ids: [...selected], updates });
      await load();
      setSelected(new Set());
      setShowBulkEdit(false);
    } catch (e) {
      alert('Failed to update: ' + e.message);
    } finally { setBulkSaving(false); }
  };

  return (
    <div className="page-content">
      <div className="page-header flex justify-between items-center">
        <div>
          <h1>Income</h1>
          <p>Track your income sources</p>
        </div>
        <div className="flex gap-2">
          <button className={`btn ${selectMode ? 'btn-secondary' : 'btn-ghost'} btn-sm`} onClick={toggleSelectMode}>
            {selectMode ? 'Cancel' : 'Select'}
          </button>
          <button className="btn btn-primary" onClick={openAdd} id="add-income-btn">+ Add Income</button>
        </div>
      </div>

      <div className="dashboard-kpi-bar">
        <div className="dashboard-kpi dashboard-kpi-primary">
          <span className="dashboard-kpi-label">Monthly recurring</span>
          <strong className="dashboard-kpi-value text-green">{fmt(totalMonthly)}</strong>
          <span className="dashboard-kpi-meta">Income that repeats each month</span>
        </div>
        <div className="dashboard-kpi">
          <span className="dashboard-kpi-label">Total entries</span>
          <strong className="dashboard-kpi-value">{items.length}</strong>
          <span className="dashboard-kpi-meta">Across all time</span>
        </div>
        <div className="dashboard-kpi">
          <span className="dashboard-kpi-label">All-time total</span>
          <strong className="dashboard-kpi-value text-accent">{fmt(totalAllTime)}</strong>
          <span className="dashboard-kpi-meta">Sum of every entry</span>
        </div>
      </div>

      <div className="card mb-4">
        <div className="card-body filter-bar">
          <div className="filter-field">
            <label className="form-label" htmlFor="income-search">Search source</label>
            <input id="income-search" className="form-input" placeholder="Salary, freelance…"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="filter-field">
            <label className="form-label" htmlFor="income-month">Month</label>
            <input id="income-month" className="form-input" type="month" value={filterMonth}
              onChange={e => setFilterMonth(e.target.value)} />
          </div>
          {(search || filterMonth) && (
            <button className="btn btn-ghost btn-sm filter-clear" onClick={() => { setSearch(''); setFilterMonth(''); }}>Clear</button>
          )}
          <div className="filter-summary">
            <span className="text-muted" style={{fontSize:'0.8rem'}}>{filtered.length} entries</span>
            <span className="badge badge-green">{fmt(filteredTotal)}</span>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          {loading ? (
            <div className="empty-state"><div className="spinner" /></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon" aria-hidden="true">
                <IconArrowSwap width={32} height={32} />
              </div>
              <h3>{items.length === 0 ? 'No income entries yet' : 'No results'}</h3>
              <p>{items.length === 0 ? 'Add your salary, freelance work, or any income source' : 'Try a different filter'}</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  {selectMode && (
                    <th style={{width:36}}>
                      <input type="checkbox" aria-label="Select all"
                        style={{width:'auto',margin:0}}
                        checked={filtered.length > 0 && selected.size === filtered.length}
                        onChange={toggleAll} />
                    </th>
                  )}
                  <th>Source</th><th>Account</th><th>Date</th><th>Recurrence</th><th>Notes</th><th style={{textAlign:'right'}}>Amount</th><th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => (
                  <tr key={item.id} className={`${selectMode ? 'cursor-pointer is-selectable' : ''} ${selected.has(item.id) ? 'is-selected' : ''}`}
                    onClick={selectMode ? (e) => handleSelect(item.id, e.shiftKey) : undefined}>
                    {selectMode && (
                      <td onClick={e => e.stopPropagation()}>
                        <input type="checkbox" aria-label={`Select ${item.source}`}
                          style={{width:'auto',margin:0}}
                          checked={selected.has(item.id)}
                          onChange={(e) => handleSelect(item.id, e.nativeEvent.shiftKey)} />
                      </td>
                    )}
                    <td>
                      <strong>{item.source}</strong>
                      {item.is_transfer ? <span className="badge badge-blue" style={{marginLeft: 6, fontSize: '0.7rem'}}>Transfer</span> : null}
                      {item.ignore_dashboard && !item.is_transfer ? <span className="badge badge-muted" style={{marginLeft: 6, fontSize: '0.7rem'}}>Hidden</span> : null}
                    </td>
                    <td><span className="badge badge-muted">{accounts.find(a => a.id === item.account_id)?.name || '-'}</span></td>
                    <td className="text-muted">{item.date}</td>
                    <td><span className="badge badge-blue">{item.recurrence}</span></td>
                    <td className="text-muted" style={{maxWidth:150,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.notes||'-'}</td>
                    <td style={{textAlign:'right'}} className="text-green"><strong>{fmt(item.amount)}</strong></td>
                    <td>
                      {!selectMode && (
                        <div className="flex gap-2">
                          <button className="btn btn-ghost btn-sm btn-icon" aria-label={`Edit ${item.source}`} onClick={() => openEdit(item)}>
                            <IconEdit />
                          </button>
                          <button className="btn btn-danger btn-sm btn-icon" aria-label={`Delete ${item.source}`} onClick={() => remove(item.id)}>
                            <IconTrash />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {!loading && filtered.length > 0 && (
            <ul className="list-card-view" aria-label="Income list">
              {filtered.map(item => {
                const acct = accounts.find(a => a.id === item.account_id);
                const isExpanded = expandedId === item.id;
                return (
                  <li
                    key={item.id}
                    className={`list-card ${selected.has(item.id) ? 'is-selected' : ''}`}
                    onClick={() => {
                      if (selectMode) handleSelect(item.id, false);
                      else setExpandedId(prev => prev === item.id ? null : item.id);
                    }}
                  >
                    {selectMode && (
                      <span className="list-card-check" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          aria-label={`Select ${item.source}`}
                          checked={selected.has(item.id)}
                          onChange={(e) => handleSelect(item.id, e.nativeEvent.shiftKey)}
                        />
                      </span>
                    )}
                    <div className="list-card-body">
                      <div className="list-card-row1">
                        <span className="list-card-title">{item.source}</span>
                        <span className="list-card-amount text-green">{fmt(item.amount)}</span>
                      </div>
                      <div className="list-card-meta">
                        <span className="badge badge-blue">{item.recurrence}</span>
                        {acct && <span>· {acct.name}</span>}
                        <span>· {item.date}</span>
                        {item.is_transfer && <span className="badge badge-blue">Transfer</span>}
                        {item.ignore_dashboard && !item.is_transfer && (
                          <span className="badge badge-muted">Hidden</span>
                        )}
                      </div>
                    </div>
                    {!selectMode && (
                      <button
                        type="button"
                        className="list-card-action"
                        aria-label={`Actions for ${item.source}`}
                        onClick={e => { e.stopPropagation(); setSheetItem(item); }}
                      >
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
                          <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
                        </svg>
                      </button>
                    )}
                    {isExpanded && item.notes && (
                      <div className="list-card-notes" onClick={e => e.stopPropagation()}>
                        {item.notes}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <ActionSheet
        open={!!sheetItem}
        onClose={() => setSheetItem(null)}
        title={sheetItem?.source}
        actions={sheetItem ? [
          { label: 'Edit', icon: <IconEdit />, onClick: () => openEdit(sheetItem) },
          { label: 'Delete', danger: true, icon: <IconTrash />, onClick: () => remove(sheetItem.id) },
        ] : []}
      />

      {selectMode && selected.size > 0 && (
        <div className="bulk-bar" role="toolbar" aria-label="Bulk actions">
          <span className="bulk-bar-count">{selected.size} selected</span>
          <span className="bulk-bar-hint">Shift-click to range-select</span>
          <button className="btn btn-ghost btn-sm" onClick={openBulkEdit}>Edit fields</button>
          <button className="btn btn-danger btn-sm" onClick={() => setBulkDeleteConfirm(true)}>Delete selected</button>
        </div>
      )}

      {deleteConfirm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setDeleteConfirm(null)}>
          <div className="modal" style={{maxWidth: '400px'}}>
            <div className="modal-header">
              <span className="modal-title">Confirm Delete</span>
              <button className="btn btn-ghost btn-icon" aria-label="Close dialog" onClick={() => setDeleteConfirm(null)}><IconClose /></button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete this income entry?</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={confirmDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {bulkDeleteConfirm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setBulkDeleteConfirm(false)}>
          <div className="modal" style={{maxWidth: '400px'}}>
            <div className="modal-header">
              <span className="modal-title">Delete {selected.size} Income Entries</span>
              <button className="btn btn-ghost btn-icon" aria-label="Close dialog" onClick={() => setBulkDeleteConfirm(false)}><IconClose /></button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete <strong>{selected.size}</strong> income entr{selected.size !== 1 ? 'ies' : 'y'}? This cannot be undone.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setBulkDeleteConfirm(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={confirmBulkDelete}>Delete All</button>
            </div>
          </div>
        </div>
      )}

      {showBulkEdit && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowBulkEdit(false)}>
          <div className="modal" style={{maxWidth: '520px'}}>
            <div className="modal-header">
              <span className="modal-title">Edit {selected.size} Income Entr{selected.size !== 1 ? 'ies' : 'y'}</span>
              <button className="btn btn-ghost btn-icon" aria-label="Close dialog" onClick={() => setShowBulkEdit(false)}><IconClose /></button>
            </div>
            <div className="modal-body">
              <p style={{color:'var(--text-muted)', fontSize:'0.85rem', marginBottom:16, marginTop:0}}>
                Toggle a field to overwrite it across the selected entries. Untouched fields stay as they are.
              </p>

              <div style={{display:'flex', flexDirection:'column', gap:10}}>
                <BulkField label="Recurrence" hint="How often this income repeats"
                  active={bulkFields.recurrence}
                  onToggle={(v) => setBulkFields(f => ({...f, recurrence: v}))}>
                  <select className="form-select" value={bulkForm.recurrence}
                    onChange={e => setBulkForm(f=>({...f, recurrence: e.target.value}))}>
                    <option value="">-- Select --</option>
                    {RECURRENCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </BulkField>

                <BulkField label="Account" hint="Linked account"
                  active={bulkFields.account_id}
                  onToggle={(v) => setBulkFields(f => ({...f, account_id: v}))}>
                  <select className="form-select" value={bulkForm.account_id}
                    onChange={e => setBulkForm(f=>({...f, account_id: e.target.value}))}>
                    <option value="">-- No Account --</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </BulkField>

                <BulkField label="Dashboard Visibility" hint="Include or exclude from totals"
                  active={bulkFields.ignore_dashboard}
                  onToggle={(v) => setBulkFields(f => ({...f, ignore_dashboard: v}))}>
                  <select className="form-select" value={bulkForm.ignore_dashboard}
                    onChange={e => setBulkForm(f=>({...f, ignore_dashboard: e.target.value}))}>
                    <option value="false">Show on Dashboard</option>
                    <option value="true">Hide from Dashboard</option>
                  </select>
                </BulkField>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowBulkEdit(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={confirmBulkEdit} disabled={bulkSaving || !Object.values(bulkFields).some(Boolean)}>
                {bulkSaving ? <span className="spinner" /> : `Apply to ${selected.size}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && close()}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">{editing ? 'Edit Income' : 'Add Income'}</span>
              <button className="btn btn-ghost btn-icon" aria-label="Close dialog" onClick={close}><IconClose /></button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Source *</label>
                  <input id="income-source" className="form-input" placeholder="e.g. Salary, Freelance" value={form.source}
                    onChange={e => setForm(f=>({...f, source:e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Account</label>
                  <select className="form-select" value={form.account_id || ''}
                    onChange={e => setForm(f=>({...f, account_id: e.target.value ? parseInt(e.target.value) : null}))}>
                    <option value="">-- No Account --</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Amount *</label>
                  <input id="income-amount" type="number" step="0.01" className="form-input" placeholder="0.00" value={form.amount}
                    onChange={e => setForm(f=>({...f, amount:e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Date *</label>
                  <input id="income-date" type="date" className="form-input" value={form.date}
                    onChange={e => setForm(f=>({...f, date:e.target.value}))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Recurrence</label>
                <select id="income-recurrence" className="form-select" value={form.recurrence}
                  onChange={e => setForm(f=>({...f, recurrence:e.target.value}))}>
                  {RECURRENCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <input className="form-input" placeholder="Optional note" value={form.notes||''}
                  onChange={e => setForm(f=>({...f, notes:e.target.value}))} />
              </div>
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '1rem' }}>
                <input type="checkbox" id="income-is-transfer" checked={!!form.is_transfer}
                  onChange={e => setForm(f=>({...f, is_transfer: e.target.checked}))} style={{ width: 'auto', margin: 0 }} />
                <label htmlFor="income-is-transfer" style={{ margin: 0, fontWeight: 'bold', cursor: 'pointer', color: 'var(--blue)', display:'inline-flex', alignItems:'center', gap:8 }} className="form-label">
                  <IconArrowSwap />
                  Mark as Transfer between accounts
                </label>
              </div>

              {!form.is_transfer && (
                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '0.5rem' }}>
                  <input type="checkbox" id="income-ignore-dashboard" checked={!!form.ignore_dashboard}
                    onChange={e => setForm(f=>({...f, ignore_dashboard: e.target.checked}))} style={{ width: 'auto', margin: 0 }} />
                  <label htmlFor="income-ignore-dashboard" style={{ margin: 0, fontWeight: 'normal', cursor: 'pointer' }} className="form-label">
                    Hide from Dashboard statistics
                  </label>
                </div>
              )}

              {form.is_transfer && (
                <div className="form-group" style={{ padding: '12px', background: 'var(--bg-body)', borderRadius: '8px', border: '1px solid var(--border)', marginTop: '0.5rem' }}>
                  {editing?.is_transfer ? (
                    <div style={{color: 'var(--text-muted)', fontSize: '0.85rem', display:'flex', alignItems:'flex-start', gap:8}}>
                      <IconInfo />
                      <span>This is a transfer record. Editing it here will only update this side of the transaction.</span>
                    </div>
                  ) : (
                    <>
                      <label className="form-label" style={{ color: 'var(--accent)' }}>Transfer From (Source Account) *</label>
                      <select className="form-select" value={form.from_account_id || ''}
                        onChange={e => setForm(f=>({...f, from_account_id: e.target.value ? parseInt(e.target.value) : null}))}>
                        <option value="">-- Select Source Account --</option>
                        {accounts.filter(a => a.id !== form.account_id).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    </>
                  )}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={close}>Cancel</button>
              <button id="save-income-btn" className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? <span className="spinner" /> : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BulkField({ label, hint, active, onToggle, children }) {
  return (
    <div style={{
      border: `1px solid ${active ? 'var(--border-accent)' : 'var(--border)'}`,
      background: active ? 'rgba(var(--accent-rgb), 0.05)' : 'transparent',
      borderRadius: 10,
      padding: 12,
      transition: 'border-color 0.15s, background 0.15s'
    }}>
      <label style={{display:'flex', alignItems:'center', gap:10, cursor:'pointer', margin:0}}>
        <input type="checkbox" checked={active}
          onChange={e => onToggle(e.target.checked)}
          style={{width:'auto', margin:0}} />
        <div style={{flex:1}}>
          <div style={{fontWeight:600, fontSize:'0.88rem', color:'var(--text-primary)'}}>{label}</div>
          {hint && <div style={{fontSize:'0.74rem', color:'var(--text-muted)', marginTop:2}}>{hint}</div>}
        </div>
      </label>
      {active && (
        <div style={{marginTop:10}}>
          {children}
        </div>
      )}
    </div>
  );
}
