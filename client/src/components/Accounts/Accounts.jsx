import { useEffect, useState } from 'react';
import { api } from '../../utils/api.js';
import { useCurrency } from '../../hooks/useCurrency.jsx';
import { IconEdit, IconTrash, IconClose, IconAccounts } from '../icons.jsx';

const EMPTY = { name: '', type: 'Checking', balance: '' };

const ACCOUNT_TYPES = [
  { value: 'Checking', label: 'Checking' },
  { value: 'Savings', label: 'Savings' },
  { value: 'Credit', label: 'Credit Card' },
  { value: 'Investment', label: 'Investment' },
  { value: 'Cash', label: 'Cash' }
];

export default function Accounts() {
  const { fmt } = useCurrency();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const load = () => api.get('/accounts').then(setItems).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const totalBalance = items.reduce((s, i) => s + (i.type === 'Credit' ? -i.balance : i.balance), 0);
  const totalAssets = items.reduce((s, i) => s + (i.type !== 'Credit' ? i.balance : 0), 0);
  const totalDebt = items.reduce((s, i) => s + (i.type === 'Credit' ? i.balance : 0), 0);

  const openAdd = () => { setEditing(null); setForm(EMPTY); setShowModal(true); };
  const openEdit = (item) => { setEditing(item); setForm({ ...item }); setShowModal(true); };
  const close = () => { setShowModal(false); setEditing(null); };

  const save = async () => {
    if (!form.name || !form.type || form.balance === '') return;
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/accounts/${editing.id}`, form);
      } else {
        await api.post('/accounts', form);
      }
      await load();
      close();
    } catch (e) {
      alert(e.message);
    } finally { setSaving(false); }
  };

  const remove = async (id) => {
    setDeleteConfirm(id);
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await api.delete(`/accounts/${deleteConfirm}`);
      setItems((prev) => prev.filter((i) => i.id !== deleteConfirm));
      setDeleteConfirm(null);
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <div className="page-content">
      <div className="page-header flex justify-between items-center">
        <div>
          <h1>Accounts</h1>
          <p>Manage your bank accounts, credit cards, and cash</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd} id="add-account-btn">
          + Add Account
        </button>
      </div>

      <div className="dashboard-kpi-bar">
        <div className="dashboard-kpi dashboard-kpi-primary">
          <span className="dashboard-kpi-label">Net worth</span>
          <strong className="dashboard-kpi-value text-accent">{fmt(totalBalance)}</strong>
          <span className="dashboard-kpi-meta">Assets minus credit balances</span>
        </div>
        <div className="dashboard-kpi">
          <span className="dashboard-kpi-label">Total assets</span>
          <strong className="dashboard-kpi-value text-green">{fmt(totalAssets)}</strong>
          <span className="dashboard-kpi-meta">Checking, savings, cash, investments</span>
        </div>
        <div className="dashboard-kpi">
          <span className="dashboard-kpi-label">Total debt</span>
          <strong className="dashboard-kpi-value text-red">{fmt(totalDebt)}</strong>
          <span className="dashboard-kpi-meta">Credit balances outstanding</span>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Your Accounts</span>
        </div>
        <div className="table-wrap">
          {loading ? (
            <div className="empty-state">
              <div className="spinner" />
            </div>
          ) : items.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon" aria-hidden="true">
                <IconAccounts width={32} height={32} />
              </div>
              <h3>No accounts created yet</h3>
              <p>Add your first bank account or wallet</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th style={{ textAlign: 'right' }}>Balance</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.name}</strong>
                    </td>
                    <td>
                      <span className="badge badge-accent">{item.type}</span>
                    </td>
                    <td
                      style={{ textAlign: 'right' }}
                      className={item.type === 'Credit' ? 'text-red' : 'text-green'}
                    >
                      <strong>{fmt(item.balance)}</strong>
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button
                          className="btn btn-ghost btn-sm btn-icon"
                          aria-label={`Edit ${item.name}`}
                          onClick={() => openEdit(item)}
                        >
                          <IconEdit />
                        </button>
                        <button
                          className="btn btn-danger btn-sm btn-icon"
                          aria-label={`Delete ${item.name}`}
                          onClick={() => remove(item.id)}
                        >
                          <IconTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {deleteConfirm && (
        <div
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && setDeleteConfirm(null)}
        >
          <div className="modal" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <span className="modal-title">Confirm Delete</span>
              <button className="btn btn-ghost btn-icon" aria-label="Close dialog" onClick={() => setDeleteConfirm(null)}>
                <IconClose />
              </button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete this account?</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={confirmDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && close()}
        >
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">{editing ? 'Edit Account' : 'Add Account'}</span>
              <button className="btn btn-ghost btn-icon" aria-label="Close dialog" onClick={close}>
                <IconClose />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Account Name *</label>
                <input
                  id="account-name"
                  className="form-input"
                  placeholder="e.g. Main Checking, Chase Sapphie"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Type *</label>
                  <select
                    id="account-type"
                    className="form-select"
                    value={form.type}
                    onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                  >
                    {ACCOUNT_TYPES.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Balance *</label>
                  <input
                    id="account-balance"
                    type="number"
                    step="0.01"
                    className="form-input"
                    placeholder="0.00"
                    value={form.balance}
                    onChange={(e) => setForm((f) => ({ ...f, balance: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={close}>
                Cancel
              </button>
              <button id="save-account-btn" className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? <span className="spinner" /> : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
