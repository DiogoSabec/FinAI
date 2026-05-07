/**
 * Generic bank CSV parser.
 *
 * Auto-detects common column names (English + Portuguese) and normalises
 * each row into the app's internal { date, description, amount, type,
 * category, payment_method, notes } shape.
 *
 * Supported column aliases:
 *   date        → date, data
 *   amount      → amount, valor
 *   description → title, título, descrição, description, identificador, memo
 *   category    → category, categoria
 *
 * Sign convention:
 *   - If the file looks like a checking-account export (has an `identificador`
 *     or `balance` column), positive amounts = income, negative = expense.
 *   - Otherwise (credit-card export style), positive = expense, negative
 *     = payment/refund (treated as income).
 */

import { CATEGORIES } from './categories.js';

// Common bank category labels → our canonical categories.
// Covers EN + PT (Brazilian) labels; extend as needed.
const CATEGORY_MAP = {
  'restaurantes': 'Food',
  'restaurants': 'Food',
  'alimentação': 'Food',
  'food': 'Food',
  'groceries': 'Food',
  'mercado': 'Food',
  'supermercado': 'Food',
  'transporte': 'Transport',
  'transport': 'Transport',
  'transportation': 'Transport',
  'uber': 'Transport',
  '99': 'Transport',
  'gas': 'Transport',
  'fuel': 'Transport',
  'saúde': 'Health',
  'health': 'Health',
  'pharmacy': 'Health',
  'farmácia': 'Health',
  'entertainment': 'Entertainment',
  'entretenimento': 'Entertainment',
  'streaming': 'Subscriptions',
  'subscriptions': 'Subscriptions',
  'assinaturas': 'Subscriptions',
  'education': 'Education',
  'educação': 'Education',
  'casa': 'Housing',
  'home': 'Housing',
  'moradia': 'Housing',
  'housing': 'Housing',
  'rent': 'Housing',
  'compras': 'Shopping',
  'shopping': 'Shopping',
  'roupas': 'Shopping',
  'clothing': 'Shopping',
  'eletrônicos': 'Shopping',
  'electronics': 'Shopping',
};

function mapCategory(raw) {
  if (!raw) return 'Other';
  const lower = raw.toLowerCase().trim();
  for (const [key, val] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(key)) return val;
  }
  return 'Other';
}

function parseDate(raw) {
  if (!raw) return new Date().toISOString().slice(0, 10);
  // DD/MM/YYYY → YYYY-MM-DD
  const dmy = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  // MM/DD/YYYY → YYYY-MM-DD (US-style)
  // Already covered above for both interpretations; explicit YMD wins next.
  // YYYY-MM-DD already fine
  const ymd = raw.match(/^\d{4}-\d{2}-\d{2}/);
  if (ymd) return raw.slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

function findColumn(headers, candidates) {
  for (const c of candidates) {
    const found = headers.find(h => h.toLowerCase().trim() === c.toLowerCase());
    if (found) return found;
  }
  return null;
}

export function parseBankCSV(rows) {
  if (!rows || rows.length === 0) return [];
  const headers = Object.keys(rows[0]);

  const dateCol   = findColumn(headers, ['date', 'data']);
  const amountCol = findColumn(headers, ['amount', 'valor']);
  const descCol   = findColumn(headers, ['title', 'título', 'descrição', 'description', 'identificador', 'memo']);
  const catCol    = findColumn(headers, ['category', 'categoria']);

  return rows
    .filter(row => {
      const amt = parseFloat(String(row[amountCol] || '').replace(',', '.'));
      return !isNaN(amt) && amt !== 0;
    })
    .map(row => {
      const raw = String(row[amountCol] || '0').replace(',', '.');
      const parsedAmt = parseFloat(raw);

      const isAccountStatement = headers.some(h => {
        const k = h.toLowerCase();
        return k === 'identificador' || k === 'balance' || k === 'saldo';
      });
      let type = 'expense';

      if (isAccountStatement) {
        // Account statement: positive = income, negative = expense
        type = parsedAmt > 0 ? 'income' : 'expense';
      } else {
        // Credit-card statement: positive = expense, negative = payment/refund
        type = parsedAmt < 0 ? 'income' : 'expense';
      }

      const amount = Math.abs(parsedAmt);

      return {
        date: parseDate(row[dateCol]),
        description: row[descCol] || 'Imported',
        amount,
        type,
        category: catCol ? mapCategory(row[catCol]) : 'Other',
        payment_method: 'credit',
        notes: '',
      };
    });
}
