import { useEffect, useRef, useState } from 'react';
import { api } from '../../utils/api.js';
import { useCurrency } from '../../hooks/useCurrency.jsx';
import { CURRENCIES } from '../../utils/categories.js';
import { ACCENT_THEMES, THEME_STORAGE_KEY, applyAccentTheme } from '../../utils/themes.js';
import { useTheme } from '../../hooks/useTheme.jsx';
import { IconClose } from '../icons.jsx';

const RESET_CONFIRMATION = 'RESET-ALL-DATA';

export default function Settings() {
  const { setSymbol, setCode } = useCurrency();
  const { setThemeId } = useTheme();
  const [settings, setSettings] = useState({ currency:'BRL', currency_symbol:'R$' });
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [clearing, setClearing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [accentTheme, setAccentTheme] = useState(() => localStorage.getItem(THEME_STORAGE_KEY) ?? 'gold');
  const [geminiKey, setGeminiKey]       = useState('');
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [savingKey, setSavingKey]       = useState(false);
  const [keySaved, setKeySaved]         = useState(false);
  const [importing, setImporting]       = useState(false);
  const [importConfirm, setImportConfirm] = useState(null);
  const fileInputRef = useRef(null);

  const handleThemeChange = (id) => {
    setAccentTheme(id);
    applyAccentTheme(id);
    localStorage.setItem(THEME_STORAGE_KEY, id);
    setThemeId(id);
  };

  const clearDatabase = async () => {
    setShowConfirm(false);
    setClearing(true);
    try {
      await api.post(
        '/settings/reset',
        { confirmation: RESET_CONFIRMATION },
        { headers: { 'X-Reset-Confirmation': RESET_CONFIRMATION } }
      );
      window.location.href = '/'; // Redirect to home so they get a fresh state
    } catch (e) {
      alert("Failed to clear database: " + e.message);
      setClearing(false);
    }
  };

  useEffect(() => {
    api.get('/settings').then(s => {
      setSettings(s);
      setGeminiKey(s?.gemini_api_key ?? '');
    }).catch(() => {});
  }, []);

  const exportBackup = () => {
    const link = document.createElement('a');
    link.href = '/api/backup/export';
    link.download = `finai-backup-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportFileChange = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setImportConfirm(file);
  };

  const runImport = async () => {
    const file = importConfirm;
    setImportConfirm(null);
    if (!file) return;

    setImporting(true);
    try {
      const text = await file.text();
      const res = await fetch('/api/backup/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/csv',
          'X-Finance-App-Request': '1',
          'X-Reset-Confirmation': RESET_CONFIRMATION,
        },
        body: text,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || `Import failed (HTTP ${res.status})`);
      }
      window.location.href = '/';
    } catch (e) {
      alert('Failed to import backup: ' + e.message);
      setImporting(false);
    }
  };

  const saveGeminiKey = async () => {
    setSavingKey(true);
    try {
      const updated = await api.put('/settings', { gemini_api_key: geminiKey.trim() });
      setGeminiKey(updated?.gemini_api_key ?? '');
      setKeySaved(true);
      setTimeout(() => setKeySaved(false), 2500);
    } catch (e) {
      alert('Failed to save API key: ' + e.message);
    } finally {
      setSavingKey(false);
    }
  };

  const handleCurrencyChange = (e) => {
    const cur = CURRENCIES.find(c => c.code === e.target.value);
    if (cur) setSettings(s => ({ ...s, currency: cur.code, currency_symbol: cur.symbol }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const updated = await api.put('/settings', { currency: settings.currency });
      setSymbol(updated.currency_symbol);
      setCode(updated.currency);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally { setSaving(false); }
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <h1>Settings</h1>
        <p>Configure your dashboard preferences</p>
      </div>

      <div className="card" style={{maxWidth:560}}>
        <div className="card-header">
          <span className="card-title">💱 Currency</span>
        </div>
        <div className="card-body" style={{display:'flex', flexDirection:'column', gap:20}}>
          <div className="form-group">
            <label className="form-label">Display Currency</label>
            <select id="currency-select" className="form-select" value={settings.currency} onChange={handleCurrencyChange}>
              {CURRENCIES.map(c => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </select>
            <div style={{fontSize:'0.78rem', color:'var(--text-muted)', marginTop:4}}>
              All amounts will display in {settings.currency_symbol} {settings.currency}
            </div>
          </div>
          <div style={{display:'flex', alignItems:'center', gap:12}}>
            <button id="save-settings-btn" className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? <span className="spinner" /> : 'Save Settings'}
            </button>
            {saved && <span className="badge badge-green">✓ Saved</span>}
          </div>
        </div>
      </div>

      <div className="card" style={{maxWidth:560, marginTop:20}}>
        <div className="card-header">
          <span className="card-title">🤖 AI Advisor Setup</span>
        </div>
        <div className="card-body" style={{display:'flex', flexDirection:'column', gap:16}}>
          <div style={{background:'var(--accent-gradient-soft)', border:'1px solid var(--border-accent)', borderRadius:'var(--radius-md)', padding:16}}>
            <div style={{fontWeight:600, marginBottom:8}}>How to get your Gemini API key</div>
            <ol style={{listStyle:'decimal', paddingLeft:18, display:'flex', flexDirection:'column', gap:6, fontSize:'0.875rem', color:'var(--text-secondary)'}}>
              <li>Visit <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" style={{color:'var(--text-accent)'}}>aistudio.google.com/app/apikey</a></li>
              <li>Sign in with your Google account</li>
              <li>Click <strong style={{color:'var(--text-primary)'}}>Create API Key</strong></li>
              <li>Copy the key and paste it below — it’s stored locally in your database.</li>
            </ol>
            <div style={{fontSize:'0.78rem', color:'var(--text-muted)', marginTop:8}}>
              Free tier: 1,500 requests/day — more than enough for personal use.
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="gemini-key-input">Gemini API Key</label>
            <div style={{display:'flex', gap:8, alignItems:'stretch'}}>
              <input
                id="gemini-key-input"
                type={showGeminiKey ? 'text' : 'password'}
                className="form-input"
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                placeholder="Paste your Gemini API key"
                autoComplete="off"
                spellCheck={false}
                style={{flex:1, fontFamily:'monospace'}}
              />
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowGeminiKey(v => !v)}
                aria-label={showGeminiKey ? 'Hide API key' : 'Show API key'}
              >
                {showGeminiKey ? 'Hide' : 'Show'}
              </button>
            </div>
            <div style={{fontSize:'0.78rem', color:'var(--text-muted)', marginTop:6}}>
              Stored locally in your database. Leave empty to disable AI features.
            </div>
          </div>

          <div style={{display:'flex', alignItems:'center', gap:12}}>
            <button className="btn btn-primary" onClick={saveGeminiKey} disabled={savingKey}>
              {savingKey ? <span className="spinner" /> : 'Save API Key'}
            </button>
            {keySaved && <span className="badge badge-green">✓ Saved</span>}
          </div>
        </div>
      </div>

      <div className="card" style={{maxWidth:560, marginTop:20}}>
        <div className="card-header">
          <span className="card-title">💾 Data</span>
        </div>
        <div className="card-body" style={{display:'flex', flexDirection:'column', gap:12}}>
          <div style={{fontSize:'0.875rem', color:'var(--text-secondary)'}}>
            Your data is stored locally in <code style={{background:'var(--bg-input)',padding:'1px 6px',borderRadius:4}}>server/finances.db</code> on your machine. Standard tracking features stay local. If you use AI chat or AI categorization, the relevant prompt and financial context are sent to Gemini.
          </div>
          <div style={{gap:8, display:'flex'}}>
            <span className="badge badge-green">✓ Local-First</span>
            <span className="badge badge-muted">No Account Required</span>
            <span className="badge badge-muted">AI Uses Internet</span>
          </div>

          <div style={{height:1, background:'var(--border)', margin:'4px 0'}} />

          <div style={{fontSize:'0.875rem', color:'var(--text-secondary)'}}>
            Backup all your data to a single CSV file, or restore from a previous backup. Importing replaces all current data.
          </div>
          <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
            <button className="btn btn-secondary" onClick={exportBackup} disabled={importing}>
              Export Backup (CSV)
            </button>
            <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()} disabled={importing}>
              {importing ? <span className="spinner" /> : 'Import Backup (CSV)'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              style={{display:'none'}}
              onChange={handleImportFileChange}
            />
          </div>
        </div>
      </div>

      <div className="card" style={{maxWidth:560, marginTop:20}}>
        <div className="card-header">
          <span className="card-title">🎨 Appearance</span>
        </div>
        <div className="card-body" style={{display:'flex', flexDirection:'column', gap:16}}>
          <div className="form-group">
            <label className="form-label">Accent Color</label>
            <div style={{fontSize:'0.78rem', color:'var(--text-muted)', marginBottom:12}}>
              Choose an accent color for the interface — applied instantly
            </div>
            <div style={{display:'flex', gap:10, flexWrap:'wrap'}}>
              {ACCENT_THEMES.map(theme => {
                const active = accentTheme === theme.id;
                return (
                  <button
                    key={theme.id}
                    title={theme.name}
                    onClick={() => handleThemeChange(theme.id)}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      background: `linear-gradient(135deg, ${theme.color3} 0%, ${theme.color1} 55%, ${theme.color2} 100%)`,
                      border: 'none',
                      outline: 'none',
                      boxShadow: active
                        ? `0 0 0 3px ${theme.color1}, 0 0 0 5px rgba(255,255,255,0.14)`
                        : '0 2px 6px rgba(0,0,0,0.35)',
                      cursor: 'pointer',
                      transition: 'transform 180ms, box-shadow 180ms',
                      transform: active ? 'scale(1.18)' : 'scale(1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#0b0906',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      flexShrink: 0,
                    }}
                  >
                    {active && '✓'}
                  </button>
                );
              })}
            </div>
            <div style={{marginTop:10, fontSize:'0.82rem', color:'var(--text-accent)', fontWeight:600, letterSpacing:'0.04em'}}>
              {ACCENT_THEMES.find(t => t.id === accentTheme)?.name ?? 'Gold'}
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{maxWidth:560, marginTop:20, borderColor:'rgba(239, 68, 68, 0.4)'}}>
        <div className="card-header" style={{borderBottomColor:'rgba(239, 68, 68, 0.2)'}}>
          <span className="card-title text-red">⚠️ Danger Zone</span>
        </div>
        <div className="card-body" style={{display:'flex', flexDirection:'column', gap:12}}>
          <div style={{fontSize:'0.875rem', color:'var(--text-secondary)'}}>
            This action will permanently delete all your data including accounts, income, expenses, subscriptions, budget goals, and saved settings. This action cannot be undone.
          </div>
          <div>
            <button className="btn btn-danger" onClick={() => setShowConfirm(true)} disabled={clearing}>
              {clearing ? <span className="spinner" /> : 'Delete All Data & Reset Application'}
            </button>
          </div>
        </div>
      </div>

      {importConfirm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setImportConfirm(null)}>
          <div className="modal" style={{maxWidth: '500px'}}>
            <div className="modal-header">
              <span className="modal-title text-red">Confirm restore from backup</span>
              <button className="btn btn-ghost btn-icon" aria-label="Close dialog" onClick={() => setImportConfirm(null)}><IconClose /></button>
            </div>
            <div className="modal-body">
              <p>Importing <strong>{importConfirm.name}</strong> will replace ALL existing data — accounts, income, expenses, subscriptions, goals, and settings.</p>
              <p style={{marginTop: 10, fontWeight: 600}}>This cannot be undone. Continue?</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setImportConfirm(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={runImport}>Replace All Data</button>
            </div>
          </div>
        </div>
      )}

      {showConfirm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowConfirm(false)}>
          <div className="modal" style={{maxWidth: '500px'}}>
            <div className="modal-header">
              <span className="modal-title text-red">Confirm full reset</span>
              <button className="btn btn-ghost btn-icon" aria-label="Close dialog" onClick={() => setShowConfirm(false)}><IconClose /></button>
            </div>
            <div className="modal-body">
              <p>WARNING: This will permanently delete ALL data (Accounts, Income, Expenses, Subscriptions, Goals) and reset all settings. This action cannot be undone.</p>
              <p style={{marginTop: 10, fontWeight: 600}}>Are you absolutely sure?</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowConfirm(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={clearDatabase}>Confirm Delete All</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
