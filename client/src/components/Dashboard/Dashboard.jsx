import React, { useEffect, useState } from 'react';
import { api } from '../../utils/api.js';
import { useCurrency } from '../../hooks/useCurrency.jsx';
import { useTheme } from '../../hooks/useTheme.jsx';
import { ACCENT_THEMES, getChartPalette } from '../../utils/themes.js';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip,
  XAxis, YAxis, CartesianGrid, Legend, AreaChart, Area
} from 'recharts';
import './Dashboard.css';

const now = new Date();
const THIS_MONTH = String(now.getMonth() + 1);
const THIS_YEAR  = String(now.getFullYear());

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function Dashboard() {
  const { fmt } = useCurrency();
  const { themeId } = useTheme();
  const theme = ACCENT_THEMES.find(t => t.id === themeId) ?? ACCENT_THEMES[0];
  const chartPalette = getChartPalette(theme);
  const hexAlpha = (hex, a) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${a})`;
  };
  const [income, setIncome]   = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [subs, setSubs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [trendRange, setTrendRange] = useState('6m');
  const [pieRange, setPieRange] = useState('all');

  useEffect(() => {
    Promise.all([
      api.get('/income'),
      api.get('/expenses'),
      api.get('/subscriptions'),
    ]).then(([inc, exp, sub]) => {
      setIncome(inc.filter(i => !i.is_transfer && !i.ignore_dashboard));
      setExpenses(exp.filter(e => !e.is_transfer && !e.ignore_dashboard));
      setSubs(sub);
    }).finally(() => setLoading(false));
  }, []);

  // This month totals
  const monthIncome = income
    .filter(i => {
      const d = new Date(i.date + 'T12:00:00');
      return d.getMonth() + 1 === parseInt(THIS_MONTH) && d.getFullYear() === parseInt(THIS_YEAR);
    })
    .reduce((s, i) => s + i.amount, 0);

  const monthExpenses = expenses
    .filter(e => {
      const d = new Date(e.date + 'T12:00:00');
      return d.getMonth() + 1 === parseInt(THIS_MONTH) && d.getFullYear() === parseInt(THIS_YEAR);
    })
    .reduce((s, e) => s + e.amount, 0);

  const monthSubCost = subs.filter(s => s.active).reduce((total, s) => {
    if (s.cycle === 'monthly') return total + s.amount;
    if (s.cycle === 'yearly')  return total + s.amount / 12;
    if (s.cycle === 'weekly')  return total + s.amount * 4.33;
    return total + s.amount;
  }, 0);

  const netBalance = monthIncome - monthExpenses - monthSubCost;
  const savingsRate = monthIncome > 0 ? ((netBalance / monthIncome) * 100).toFixed(1) : 0;
  const monthlyExpenseCount = expenses.filter(e => {
    const d = new Date(e.date + 'T12:00:00');
    return d.getMonth() + 1 === parseInt(THIS_MONTH) && d.getFullYear() === parseInt(THIS_YEAR);
  }).length;
  const activeSubscriptions = subs.filter(s => s.active).length;

  // Spending by category
  let filteredPieExpenses = expenses;
  if (pieRange !== 'all') {
    filteredPieExpenses = expenses.filter(e => {
      const d = new Date(e.date + 'T12:00:00');
      const m = d.getMonth();
      const y = d.getFullYear();
      
      if (pieRange === 'this_month') {
        return m === now.getMonth() && y === now.getFullYear();
      }
      if (pieRange === 'last_month') {
        const lastMonth = now.getMonth() - 1;
        const targetM = lastMonth < 0 ? 11 : lastMonth;
        const targetY = lastMonth < 0 ? now.getFullYear() - 1 : now.getFullYear();
        return m === targetM && y === targetY;
      }
      const diffMonths = (now.getFullYear() - y) * 12 + (now.getMonth() - m);
      if (pieRange === '3m') return diffMonths >= 0 && diffMonths < 3;
      if (pieRange === '6m') return diffMonths >= 0 && diffMonths < 6;
      return true;
    });
  }

  const byCat = {};
  filteredPieExpenses.forEach(e => {
    byCat[e.category] = (byCat[e.category] || 0) + e.amount;
  });
  const pieData = Object.entries(byCat)
    .map(([cat, total]) => ({ name: cat, value: total }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)
    .map((d, i) => ({ ...d, color: chartPalette[i % chartPalette.length] }));
  const topCategory = pieData[0] || null;
  const averageTicket = monthlyExpenseCount > 0 ? monthExpenses / monthlyExpenseCount : 0;
  const incomeCoverage = monthExpenses > 0 ? monthIncome / monthExpenses : 0;
  const insights = [
    {
      label: 'Top spending category',
      value: topCategory ? topCategory.name : 'No data yet',
      detail: topCategory ? fmt(topCategory.value) : 'Add expense entries to reveal your top category.',
    },
    {
      label: 'Average ticket this month',
      value: monthlyExpenseCount > 0 ? fmt(averageTicket) : 'No spend yet',
      detail: monthlyExpenseCount > 0 ? `${monthlyExpenseCount} transactions logged this month.` : 'Once you log transactions, ticket size will appear here.',
    },
    {
      label: 'Recurring load',
      value: fmt(monthSubCost),
      detail: `${activeSubscriptions} active subscription${activeSubscriptions === 1 ? '' : 's'} currently affecting monthly cash flow.`,
    },
    {
      label: 'Income coverage',
      value: monthExpenses > 0 ? `${incomeCoverage.toFixed(1)}x` : '∞',
      detail: monthExpenses > 0 ? 'Monthly income divided by monthly expenses.' : 'No expenses recorded this month.',
    },
  ];

  // Trend Chart Data
  const trendData = [];
  if (trendRange === 'this_month' || trendRange === 'last_month') {
    const targetMonth = trendRange === 'this_month' ? now.getMonth() : now.getMonth() - 1;
    const targetYear = targetMonth < 0 ? now.getFullYear() - 1 : now.getFullYear();
    const realTargetMonth = targetMonth < 0 ? 11 : targetMonth;
    const daysInMonth = new Date(targetYear, realTargetMonth + 1, 0).getDate();

    for (let i = 1; i <= daysInMonth; i++) {
      const inc = income.filter(x => {
        const d = new Date(x.date + 'T12:00:00');
        return d.getDate() === i && d.getMonth() === realTargetMonth && d.getFullYear() === targetYear;
      }).reduce((s, x) => s + x.amount, 0);
      const exp = expenses.filter(x => {
        const d = new Date(x.date + 'T12:00:00');
        return d.getDate() === i && d.getMonth() === realTargetMonth && d.getFullYear() === targetYear;
      }).reduce((s, x) => s + x.amount, 0);

      trendData.push({ label: `${i} ${MONTHS[realTargetMonth]}`, Income: inc, Expenses: exp });
    }
  } else {
    let monthsToShow = 6;
    if (trendRange === '3m') monthsToShow = 3;
    if (trendRange === 'all') {
      const allDates = [...income, ...expenses].map(x => new Date(x.date + 'T12:00:00'));
      if (allDates.length > 0) {
        const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
        monthsToShow = (now.getFullYear() - minDate.getFullYear()) * 12 + (now.getMonth() - minDate.getMonth()) + 1;
      } else {
        monthsToShow = 6;
      }
    }

    // Cap to a reasonable amount to avoid freezing if 100 years of data
    if (monthsToShow > 120) monthsToShow = 120; 

    for (let i = monthsToShow - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const m = d.getMonth() + 1;
      const y = d.getFullYear();
      const inc = income.filter(x => {
        const xd = new Date(x.date + 'T12:00:00');
        return xd.getMonth() + 1 === m && xd.getFullYear() === y;
      }).reduce((s, x) => s + x.amount, 0);
      const exp = expenses.filter(x => {
        const xd = new Date(x.date + 'T12:00:00');
        return xd.getMonth() + 1 === m && xd.getFullYear() === y;
      }).reduce((s, x) => s + x.amount, 0);
      
      const label = trendRange === 'all' && monthsToShow > 12 ? `${MONTHS[d.getMonth()]} '${String(y).slice(2)}` : MONTHS[d.getMonth()];
      trendData.push({ label, Income: inc, Expenses: exp });
    }
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="chart-tooltip">
        <div className="chart-tooltip-label">{label}</div>
        {payload.map(p => (
          <div key={p.name} className="chart-tooltip-row" style={{ color: p.color }}>
            <span>{p.name}</span><span>{fmt(p.value)}</span>
          </div>
        ))}
      </div>
    );
  };

  const PieTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="chart-tooltip">
        <div className="chart-tooltip-label">{payload[0].name}</div>
        <div className="chart-tooltip-row" style={{ color: payload[0].payload.color }}>
          <span>Total</span><span>{fmt(payload[0].value)}</span>
        </div>
      </div>
    );
  };

  if (loading) return (
    <div className="page-content" style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'50vh' }}>
      <div className="spinner" style={{ width:40, height:40 }} />
    </div>
  );

  return (
    <div className="page-content">
      <div className="dashboard-hero">
        <div className="dashboard-hero-copy">
          <span className="dashboard-kicker">Private Wealth Overview</span>
          <h1>Dashboard</h1>
          <p>
            A cinematic command center for your money, with clear focus on monthly flow,
            category pressure, and recurring spend.
          </p>
          <div className="dashboard-chip-row">
            <span className="dashboard-chip">{MONTHS[now.getMonth()]} {now.getFullYear()}</span>
            <span className="dashboard-chip">Savings rate {savingsRate}%</span>
            <span className="dashboard-chip">{activeSubscriptions} active subscriptions</span>
          </div>
        </div>

        <div className="dashboard-hero-panel">
          <div className="dashboard-hero-focus">
            <span className="dashboard-hero-label">Net position this month</span>
            <strong className={netBalance >= 0 ? 'text-green' : 'text-red'}>{fmt(netBalance)}</strong>
            <p>
              {netBalance >= 0
                ? 'Your monthly cash flow is in positive territory.'
                : 'Expenses and recurring costs are currently ahead of income.'}
            </p>
          </div>
          <div className="dashboard-hero-grid">
            <div className="dashboard-hero-stat">
              <span>Top spend</span>
              <strong>{topCategory ? topCategory.name : 'No data'}</strong>
              <small>{topCategory ? fmt(topCategory.value) : 'Add expenses to unlock this view'}</small>
            </div>
            <div className="dashboard-hero-stat">
              <span>Average ticket</span>
              <strong>{monthlyExpenseCount > 0 ? fmt(averageTicket) : 'No spend'}</strong>
              <small>{monthlyExpenseCount > 0 ? `${monthlyExpenseCount} transactions this month` : 'Waiting for monthly expenses'}</small>
            </div>
            <div className="dashboard-hero-stat">
              <span>Recurring drag</span>
              <strong>{fmt(monthSubCost)}</strong>
              <small>{activeSubscriptions} active services</small>
            </div>
            <div className="dashboard-hero-stat">
              <span>Income coverage</span>
              <strong>{monthExpenses > 0 ? `${incomeCoverage.toFixed(1)}x` : '∞'}</strong>
              <small>Income relative to monthly expenses</small>
            </div>
          </div>
        </div>
      </div>

      <div className="grid-4 mb-4">
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background:'var(--green-soft)' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
          <div className="stat-card-label">Monthly Income</div>
          <div className="stat-card-value text-green">{fmt(monthIncome)}</div>
          <div className="stat-card-sub">{income.length} entries total</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background:'var(--red-soft)' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20"><polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/></svg>
          </div>
          <div className="stat-card-label">Monthly Expenses</div>
          <div className="stat-card-value text-red">{fmt(monthExpenses)}</div>
          <div className="stat-card-sub">{expenses.filter(e => {
            const d = new Date(e.date + 'T12:00:00');
            return d.getMonth()+1 === parseInt(THIS_MONTH) && d.getFullYear() === parseInt(THIS_YEAR);
          }).length} transactions</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background:'var(--blue-soft)' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
          </div>
          <div className="stat-card-label">Subscriptions/mo</div>
          <div className="stat-card-value" style={{ color:'var(--accent-2)' }}>{fmt(monthSubCost)}</div>
          <div className="stat-card-sub">{subs.filter(s=>s.active).length} active</div>
        </div>
        <div className="stat-card" style={{ borderColor: netBalance >= 0 ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)' }}>
          <div className="stat-card-icon" style={{ background: netBalance >= 0 ? 'var(--green-soft)' : 'var(--red-soft)' }}>
            {netBalance >= 0 ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20"><polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/></svg>
            )}
          </div>
          <div className="stat-card-label">Net Balance</div>
          <div className={`stat-card-value ${netBalance >= 0 ? 'text-green' : 'text-red'}`}>{fmt(netBalance)}</div>
          <div className="stat-card-sub">Savings rate: {savingsRate}%</div>
        </div>
      </div>

      <div className="grid-2 mb-4">
        <div className="card dashboard-chart-card">
          <div className="card-header">
            <span className="card-title">Income vs Expenses</span>
            <select 
              className="dashboard-filter"
              value={trendRange}
              onChange={e => setTrendRange(e.target.value)}
            >
              <option value="all">All time</option>
              <option value="6m">Last 6 months</option>
              <option value="3m">Last 3 months</option>
              <option value="last_month">Last month</option>
              <option value="this_month">This month</option>
            </select>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={trendData} margin={{ top:5, right:10, left:10, bottom:5 }}>
                <defs>
                  <linearGradient id="incGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={theme.color2} stopOpacity={0.38}/>
                    <stop offset="95%" stopColor={theme.color2} stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#d66b52" stopOpacity={0.34}/>
                    <stop offset="95%" stopColor="#d66b52" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={hexAlpha(theme.color1, 0.08)} />
                <XAxis dataKey="label" tick={{ fill: theme.textMuted, fontSize:12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: theme.textMuted, fontSize:11 }} axisLine={false} tickLine={false} width={55}
                  tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ color: theme.textSecondary, fontSize:'0.8rem' }} />
                <Area type="monotone" dataKey="Income" stroke={theme.color2} fill="url(#incGrad)" strokeWidth={2.5} dot={false} />
                <Area type="monotone" dataKey="Expenses" stroke="#d66b52" fill="url(#expGrad)" strokeWidth={2.2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card dashboard-chart-card">
          <div className="card-header">
            <span className="card-title">Spending by Category</span>
            <select 
              className="dashboard-filter"
              value={pieRange}
              onChange={e => setPieRange(e.target.value)}
            >
              <option value="all">All time</option>
              <option value="6m">Last 6 months</option>
              <option value="3m">Last 3 months</option>
              <option value="last_month">Last month</option>
              <option value="this_month">This month</option>
            </select>
          </div>
          <div className="card-body dash-pie-wrap">
            {pieData.length > 0 ? (
              <div className="dash-pie-inner">
                <ResponsiveContainer width="50%" height={220}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={90}
                      paddingAngle={3} dataKey="value">
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="dash-pie-legend">
                  {pieData.map(d => (
                    <div key={d.name} className="dash-pie-legend-item">
                      <span className="dash-pie-dot" style={{ background: d.color }} />
                      <span className="dash-pie-name">{d.name}</span>
                      <span className="dash-pie-val">{fmt(d.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="40" height="40"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                </div>
                <h3>No expense data yet</h3>
                <p>Add expenses or import a CSV to see breakdown</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Recent Transactions</span>
          </div>
          <div className="table-wrap">
            {expenses.slice(0,8).length > 0 ? (
              <table>
                <thead>
                  <tr>
                    <th>Date</th><th>Description</th><th>Category</th><th style={{textAlign:'right'}}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.slice(0,8).map(e => (
                    <tr key={e.id}>
                      <td className="text-muted">{e.date}</td>
                      <td>{e.description}</td>
                      <td><span className="badge badge-muted">{e.category}</span></td>
                      <td style={{textAlign:'right'}} className="text-red">{fmt(e.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="40" height="40"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                </div>
                <h3>No transactions yet</h3>
                <p>Start by adding expenses or importing a CSV</p>
              </div>
            )}
          </div>
        </div>

        <div className="card dashboard-insight-card">
          <div className="card-header">
            <span className="card-title">House View</span>
          </div>
          <div className="card-body dashboard-insight-list">
            {insights.map(item => (
              <div key={item.label} className="dashboard-insight">
                <span className="dashboard-insight-label">{item.label}</span>
                <strong className="dashboard-insight-value">{item.value}</strong>
                <p>{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
