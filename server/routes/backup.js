import express from 'express';
import { all, run, persist } from '../db.js';
import { handleRouteError, HttpError } from '../http.js';
import { RESET_CONFIRMATION_HEADER, RESET_CONFIRMATION_VALUE } from '../validation.js';

const router = express.Router();

const TABLES = [
  {
    name: 'accounts',
    columns: ['id', 'name', 'type', 'balance', 'currency', 'created_at'],
  },
  {
    name: 'income',
    columns: ['id', 'source', 'amount', 'date', 'recurrence', 'notes', 'created_at', 'account_id', 'is_transfer', 'ignore_dashboard'],
  },
  {
    name: 'expenses',
    columns: ['id', 'description', 'amount', 'category', 'date', 'payment_method', 'notes', 'created_at', 'account_id', 'is_transfer', 'ignore_dashboard'],
  },
  {
    name: 'subscriptions',
    columns: ['id', 'name', 'amount', 'cycle', 'category', 'renewal_date', 'active', 'notes', 'created_at'],
  },
  {
    name: 'budget_goals',
    columns: ['id', 'category', 'monthly_limit'],
  },
  {
    name: 'settings',
    columns: ['key', 'value'],
  },
];

const TABLE_BY_NAME = new Map(TABLES.map((table) => [table.name, table]));

function escapeCsvCell(value) {
  if (value === null || value === undefined) return '';
  const stringValue = String(value);
  if (/[",\r\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function buildCsv() {
  const lines = [];

  for (const table of TABLES) {
    const rows = all(`SELECT ${table.columns.join(', ')} FROM ${table.name}`);
    lines.push(`# ${table.name}`);
    lines.push(table.columns.join(','));
    for (const row of rows) {
      lines.push(table.columns.map((column) => escapeCsvCell(row[column])).join(','));
    }
    lines.push('');
  }

  return lines.join('\n');
}

function parseCsvLine(line) {
  const cells = [];
  let current = '';
  let insideQuotes = false;

  for (let index = 0; index < line.length; index++) {
    const char = line[index];

    if (insideQuotes) {
      if (char === '"') {
        if (line[index + 1] === '"') {
          current += '"';
          index++;
        } else {
          insideQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      insideQuotes = true;
    } else if (char === ',') {
      cells.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  cells.push(current);
  return cells;
}

function parseCsvBackup(rawText) {
  const normalized = String(rawText || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');

  const sections = new Map();
  let currentTable = null;
  let currentBuffer = [];

  const flushCurrent = () => {
    if (currentTable) {
      sections.set(currentTable, currentBuffer);
    }
    currentTable = null;
    currentBuffer = [];
  };

  for (const rawLine of lines) {
    if (rawLine.startsWith('# ')) {
      flushCurrent();
      currentTable = rawLine.slice(2).trim();
      currentBuffer = [];
      continue;
    }

    if (!currentTable) continue;
    if (rawLine.trim() === '') continue;

    currentBuffer.push(rawLine);
  }

  flushCurrent();

  const parsed = {};

  for (const [tableName, tableLines] of sections.entries()) {
    if (!TABLE_BY_NAME.has(tableName)) {
      throw new HttpError(400, `Unknown table in backup: ${tableName}`);
    }
    if (tableLines.length === 0) {
      parsed[tableName] = { headers: [], rows: [] };
      continue;
    }

    const headers = parseCsvLine(tableLines[0]);
    const expectedColumns = TABLE_BY_NAME.get(tableName).columns;

    for (const header of headers) {
      if (!expectedColumns.includes(header)) {
        throw new HttpError(400, `Unexpected column "${header}" in table "${tableName}"`);
      }
    }

    const rows = tableLines.slice(1).map((line) => parseCsvLine(line));
    parsed[tableName] = { headers, rows };
  }

  return parsed;
}

function coerceCellValue(rawValue) {
  if (rawValue === '' || rawValue === undefined) return null;
  return rawValue;
}

router.get('/export', (req, res) => {
  try {
    const filename = `finai-backup-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buildCsv());
  } catch (error) {
    handleRouteError(res, error, 'Failed to export backup');
  }
});

router.post('/import', express.text({ type: ['text/csv', 'text/plain'], limit: '20mb' }), (req, res) => {
  try {
    const confirmation = req.get(RESET_CONFIRMATION_HEADER);
    if (confirmation !== RESET_CONFIRMATION_VALUE) {
      throw new HttpError(400, 'Import confirmation header is required');
    }

    const rawText = typeof req.body === 'string' ? req.body : '';
    if (!rawText.trim()) {
      throw new HttpError(400, 'Empty backup file');
    }

    const parsed = parseCsvBackup(rawText);

    if (Object.keys(parsed).length === 0) {
      throw new HttpError(400, 'No table sections found in backup');
    }

    run('DELETE FROM income');
    run('DELETE FROM expenses');
    run('DELETE FROM subscriptions');
    run('DELETE FROM budget_goals');
    run('DELETE FROM accounts');
    run('DELETE FROM settings');

    const counts = {};

    const importOrder = [
      ...TABLES.filter((table) => table.name !== 'accounts'),
      TABLES.find((table) => table.name === 'accounts'),
    ];

    for (const table of importOrder) {
      const section = parsed[table.name];
      if (!section || section.rows.length === 0) {
        counts[table.name] = 0;
        continue;
      }

      const placeholders = section.headers.map(() => '?').join(', ');
      const sql = `INSERT INTO ${table.name} (${section.headers.join(', ')}) VALUES (${placeholders})`;

      let inserted = 0;
      for (const row of section.rows) {
        if (row.length !== section.headers.length) continue;
        const values = row.map((cell) => coerceCellValue(cell));
        run(sql, values);
        inserted++;
      }
      counts[table.name] = inserted;
    }

    persist();

    res.json({ success: true, counts });
  } catch (error) {
    handleRouteError(res, error, 'Failed to import backup');
  }
});

export default router;
