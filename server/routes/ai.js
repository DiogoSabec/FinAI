import express from 'express';
import { all, get } from '../db.js';
import { handleRouteError, HttpError } from '../http.js';

function getGeminiApiKey() {
  const fromDb = get("SELECT value FROM settings WHERE key = 'gemini_api_key'")?.value;
  const candidate = fromDb && String(fromDb).trim() ? fromDb : process.env.GEMINI_API_KEY;
  return candidate ? String(candidate).trim() : '';
}
import {
  MAX_AI_SUGGESTION_ITEMS,
  assertMaxItems,
  parseOptionalString,
  parsePositiveAmount,
  parseRequiredString,
} from '../validation.js';

const router = express.Router();

const AI_CATEGORY_LIST = [
  'Food',
  'Housing',
  'Transport',
  'Health',
  'Entertainment',
  'Shopping',
  'Subscriptions',
  'Education',
  'Investments',
  'Other',
];

const AI_CATEGORY_SET = new Set(AI_CATEGORY_LIST);
const AI_CATEGORY_MAP = new Map(AI_CATEGORY_LIST.map((category) => [category.toLowerCase(), category]));
const AI_SUGGESTION_CHUNK_SIZE = 25;
const AI_SUGGESTION_FALLBACK_CHUNK_SIZE = 8;
const AI_REQUEST_TIMEOUT_MS = 15000;
const AI_CHAT_TIMEOUT_MS = 30000;
const MAX_CHAT_MESSAGE_LENGTH = 2000;
const MAX_CHAT_HISTORY_ENTRIES = 20;
const MAX_CHAT_HISTORY_CONTENT = 4000;
const MAX_TOOL_ITERATIONS = 6;
const TOOL_ROW_LIMIT_DEFAULT = 50;
const TOOL_ROW_LIMIT_MAX = 200;
const GEMINI_MODEL = 'gemini-2.5-flash';

function chunkArray(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function sanitizeSuggestedCategory(value) {
  if (!value) return null;
  const cleaned = String(value).trim();
  if (AI_CATEGORY_SET.has(cleaned)) return cleaned;
  return AI_CATEGORY_MAP.get(cleaned.toLowerCase()) || null;
}

function cleanDescriptionForCategorization(value) {
  return String(value || '')
    .trim()
    .replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi, ' ')
    .replace(/^(compra no (debito|débito|credito|crédito)|compra)\s*-\s*/i, '')
    .replace(/^(pagamento (de )?fatura|pagamento boleto)\s*-\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeDescription(value) {
  return cleanDescriptionForCategorization(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b\d{2,}\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseAiJsonObject(text) {
  const cleaned = String(text || '')
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
      throw new Error('AI returned unexpected JSON shape');
    }
    return parsed;
  } catch (initialError) {
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw initialError;
    }
    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
      throw new Error('AI returned unexpected JSON shape');
    }
    return parsed;
  }
}

async function fetchWithTimeout(url, options, timeoutMs = AI_REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new HttpError(504, 'AI request timed out');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function getHistoricalCategoryMap() {
  const historyRows = all(`
    SELECT description, category, COUNT(*) as count
    FROM expenses
    WHERE description IS NOT NULL AND category IS NOT NULL
    GROUP BY description, category
    ORDER BY count DESC
  `);

  const bestCategoryByKey = new Map();

  for (const row of historyRows) {
    const key = normalizeDescription(row.description);
    const category = sanitizeSuggestedCategory(row.category);
    const count = Number(row.count) || 0;

    if (!key || !category || category === 'Other') continue;

    const current = bestCategoryByKey.get(key);
    if (!current || count > current.count) {
      bestCategoryByKey.set(key, { category, count });
    }
  }

  return new Map(
    [...bestCategoryByKey.entries()].map(([key, value]) => [key, value.category])
  );
}

function buildCategoryPrompt(entries) {
  const numbered = entries
    .map((entry, index) => `${index}. ${entry.cleanedDescription || entry.description || 'Imported transaction'} (R$ ${entry.amount})`)
    .join('\n');

  return `You categorize bank transactions for a personal finance app.

Allowed categories (use exactly one of these strings, in English, exactly as written):
${AI_CATEGORY_LIST.join(', ')}.

Category guide:
- Food: restaurants, grocery stores, cafes, delivery, bakeries, supermarkets (padaria, mercado, restaurante, lanchonete, ifood, rappi).
- Housing: rent, utilities, home services, internet, phone bills, maintenance.
- Transport: ride apps (uber, 99), fuel/posto, parking, tolls, transit, vehicle services.
- Health: pharmacies (drogaria, farmacia), hospitals, dentists, labs, clinics, gyms.
- Entertainment: bars, movies, games, events, hobbies, leisure.
- Shopping: retail, e-commerce, clothes, electronics, home goods, marketplaces (amazon, magalu, mercado livre, shopee).
- Subscriptions: recurring software, apps, streaming (netflix, spotify, disney+), memberships.
- Education: courses, books, tuition, schools, training.
- Investments: brokerages, crypto, stocks, retirement contributions.
- Other: only when the description is genuinely unclear.

Rules:
- Output an array with one object per transaction: { "i": <0-based index>, "c": <category> }.
- Cover every index from 0 to ${entries.length - 1}, in order, no duplicates, no extras.
- Use the English category strings above. Do not translate them.
- Ignore bank prefixes like "Compra no débito -" and random identifiers.

Transactions:
${numbered}`;
}

const CATEGORY_RESPONSE_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      i: { type: 'integer' },
      c: { type: 'string', enum: AI_CATEGORY_LIST },
    },
    required: ['i', 'c'],
  },
};

function parseCategoryArray(text) {
  const cleaned = String(text || '')
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (initialError) {
    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
    if (!arrayMatch) throw initialError;
    parsed = JSON.parse(arrayMatch[0]);
  }

  if (!Array.isArray(parsed)) {
    throw new Error('AI response was not an array');
  }
  return parsed;
}

async function requestGeminiCategoryChunk(entries, apiKey) {
  const geminiBody = {
    contents: [{ role: 'user', parts: [{ text: buildCategoryPrompt(entries) }] }],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 4096,
      responseMimeType: 'application/json',
      responseSchema: CATEGORY_RESPONSE_SCHEMA,
      thinkingConfig: { thinkingBudget: 0 },
    },
  };

  const geminiRes = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey.trim()}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody),
    }
  );

  if (!geminiRes.ok) {
    const rawError = await geminiRes.text();
    throw new Error(`Gemini API error (${geminiRes.status}): ${rawError.slice(0, 200)}`);
  }

  const geminiData = await geminiRes.json();
  const candidate = geminiData.candidates?.[0];
  const text = candidate?.content?.parts?.map((p) => p.text).filter(Boolean).join('') || '';
  const finishReason = candidate?.finishReason;

  if (!text) {
    throw new Error(`Empty response from AI (finishReason=${finishReason || 'unknown'})`);
  }

  let parsedArray;
  try {
    parsedArray = parseCategoryArray(text);
  } catch (parseError) {
    throw new Error(`Could not parse AI response (finishReason=${finishReason || 'unknown'}): ${parseError.message}`);
  }

  const suggestions = {};
  for (const item of parsedArray) {
    const index = Number(item?.i);
    if (!Number.isInteger(index) || index < 0 || index >= entries.length) continue;
    const category = sanitizeSuggestedCategory(item?.c);
    if (!category) continue;
    const entry = entries[index];
    if (entry) suggestions[entry.id] = category;
  }

  return suggestions;
}

// Run a chunk; on failure, fall back to smaller sub-chunks so a single bad
// response doesn't cost us 25 suggestions in one go.
async function requestCategoryChunkWithFallback(entries, apiKey) {
  try {
    return { suggestions: await requestGeminiCategoryChunk(entries, apiKey), error: null };
  } catch (firstError) {
    if (entries.length <= AI_SUGGESTION_FALLBACK_CHUNK_SIZE) {
      return { suggestions: {}, error: firstError };
    }

    const subChunks = chunkArray(entries, AI_SUGGESTION_FALLBACK_CHUNK_SIZE);
    const merged = {};
    let lastError = null;
    for (const subChunk of subChunks) {
      try {
        Object.assign(merged, await requestGeminiCategoryChunk(subChunk, apiKey));
      } catch (subError) {
        lastError = subError;
      }
    }

    if (Object.keys(merged).length === 0) {
      return { suggestions: {}, error: lastError || firstError };
    }
    return { suggestions: merged, error: null };
  }
}

function todayLocalIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function readCurrencySettings() {
  const code = get("SELECT value FROM settings WHERE key = 'currency'")?.value || 'BRL';
  const symbol = get("SELECT value FROM settings WHERE key = 'currency_symbol'")?.value || 'R$';
  return { code, symbol };
}

function isValidIsoDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function clampLimit(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return TOOL_ROW_LIMIT_DEFAULT;
  return Math.min(Math.floor(n), TOOL_ROW_LIMIT_MAX);
}

// Builds a parameterized WHERE clause for expenses or income tables.
// `kind` selects the description column ('description' for expenses, 'source' for income).
function buildTransactionFilters(kind, args) {
  const descriptionColumn = kind === 'income' ? 'source' : 'description';
  const conditions = [];
  const params = [];

  if (isValidIsoDate(args.date_from)) {
    conditions.push('date >= ?');
    params.push(args.date_from);
  }
  if (isValidIsoDate(args.date_to)) {
    conditions.push('date <= ?');
    params.push(args.date_to);
  }
  if (kind === 'expenses' && typeof args.category === 'string' && args.category.trim()) {
    conditions.push('category = ?');
    params.push(args.category.trim());
  }
  if (typeof args.description_contains === 'string' && args.description_contains.trim()) {
    conditions.push(`LOWER(${descriptionColumn}) LIKE ?`);
    params.push(`%${args.description_contains.trim().toLowerCase()}%`);
  }
  if (Number.isFinite(Number(args.min_amount))) {
    conditions.push('amount >= ?');
    params.push(Number(args.min_amount));
  }
  if (Number.isFinite(Number(args.max_amount))) {
    conditions.push('amount <= ?');
    params.push(Number(args.max_amount));
  }
  if (Number.isFinite(Number(args.account_id))) {
    conditions.push('account_id = ?');
    params.push(Number(args.account_id));
  }
  if (kind === 'expenses' && typeof args.payment_method === 'string' && args.payment_method.trim()) {
    conditions.push('payment_method = ?');
    params.push(args.payment_method.trim().toLowerCase());
  }

  const excludeTransfers = args.exclude_transfers !== false;
  const excludeIgnored = args.exclude_ignored !== false;
  if (excludeTransfers) conditions.push('(is_transfer IS NULL OR is_transfer = 0)');
  if (excludeIgnored) conditions.push('(ignore_dashboard IS NULL OR ignore_dashboard = 0)');

  return {
    where: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
  };
}

function toolGetContext() {
  const today = todayLocalIso();
  const currency = readCurrencySettings();
  const accounts = all('SELECT id, name, type, balance, currency FROM accounts ORDER BY name');
  const categoryRows = all('SELECT DISTINCT category FROM expenses WHERE category IS NOT NULL');
  const usedCategories = categoryRows.map((r) => r.category).filter(Boolean);

  const earliestExpense = get('SELECT MIN(date) as d FROM expenses')?.d || null;
  const earliestIncome = get('SELECT MIN(date) as d FROM income')?.d || null;
  const latestExpense = get('SELECT MAX(date) as d FROM expenses')?.d || null;
  const latestIncome = get('SELECT MAX(date) as d FROM income')?.d || null;

  return {
    today,
    currency,
    accounts,
    valid_categories: AI_CATEGORY_LIST,
    categories_in_use: usedCategories,
    data_range: {
      expenses: { earliest: earliestExpense, latest: latestExpense },
      income: { earliest: earliestIncome, latest: latestIncome },
    },
  };
}

function toolQueryTransactions(args = {}) {
  const kind = args.kind === 'income' ? 'income' : 'expenses';
  const { where, params } = buildTransactionFilters(kind, args);

  const sortMap = {
    date_desc: 'date DESC, id DESC',
    date_asc: 'date ASC, id ASC',
    amount_desc: 'amount DESC',
    amount_asc: 'amount ASC',
  };
  const orderBy = sortMap[args.sort] || sortMap.date_desc;
  const limit = clampLimit(args.limit);

  const columns = kind === 'income'
    ? 'id, source, amount, date, recurrence, account_id, is_transfer, ignore_dashboard, notes'
    : 'id, description, amount, category, date, payment_method, account_id, is_transfer, ignore_dashboard, notes';

  const rows = all(
    `SELECT ${columns} FROM ${kind} ${where} ORDER BY ${orderBy} LIMIT ?`,
    [...params, limit]
  );

  const totalRow = get(`SELECT COUNT(*) as c, COALESCE(SUM(amount), 0) as t FROM ${kind} ${where}`, params);

  return {
    kind,
    filters_applied: {
      ...args,
      exclude_transfers: args.exclude_transfers !== false,
      exclude_ignored: args.exclude_ignored !== false,
    },
    matched_rows_total: Number(totalRow?.c) || 0,
    matched_amount_total: Number(totalRow?.t) || 0,
    returned_count: rows.length,
    rows,
    truncated: (Number(totalRow?.c) || 0) > rows.length,
  };
}

function toolAggregateTransactions(args = {}) {
  const kind = args.kind === 'income' ? 'income' : 'expenses';
  const { where, params } = buildTransactionFilters(kind, args);
  const groupBy = args.group_by || 'none';

  const totalRow = get(
    `SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total, COALESCE(AVG(amount), 0) as avg, COALESCE(MIN(amount), 0) as min, COALESCE(MAX(amount), 0) as max FROM ${kind} ${where}`,
    params
  );

  const summary = {
    count: Number(totalRow?.count) || 0,
    total: Number(totalRow?.total) || 0,
    avg: Number(totalRow?.avg) || 0,
    min: Number(totalRow?.min) || 0,
    max: Number(totalRow?.max) || 0,
  };

  if (groupBy === 'none' || !groupBy) {
    return { kind, group_by: 'none', summary, breakdown: null };
  }

  let groupSql;
  let groupLabel;
  let extraJoin = '';

  if (groupBy === 'category') {
    if (kind !== 'expenses') return { kind, group_by: 'category', error: 'group_by=category is only valid for expenses', summary };
    groupSql = 'category';
    groupLabel = 'category';
  } else if (groupBy === 'month') {
    groupSql = "substr(date, 1, 7)";
    groupLabel = 'month';
  } else if (groupBy === 'description') {
    groupSql = kind === 'income' ? 'source' : 'description';
    groupLabel = kind === 'income' ? 'source' : 'description';
  } else if (groupBy === 'payment_method') {
    if (kind !== 'expenses') return { kind, group_by: 'payment_method', error: 'group_by=payment_method is only valid for expenses', summary };
    groupSql = 'payment_method';
    groupLabel = 'payment_method';
  } else if (groupBy === 'account') {
    extraJoin = `LEFT JOIN accounts a ON a.id = ${kind}.account_id`;
    groupSql = 'COALESCE(a.name, \'(no account)\')';
    groupLabel = 'account';
  } else {
    return { kind, group_by: groupBy, error: `Unsupported group_by: ${groupBy}`, summary };
  }

  const breakdown = all(
    `SELECT ${groupSql} as bucket, COUNT(*) as count, COALESCE(SUM(amount), 0) as total
     FROM ${kind} ${extraJoin} ${where}
     GROUP BY bucket
     ORDER BY total DESC
     LIMIT 100`,
    params
  ).map((row) => ({
    [groupLabel]: row.bucket,
    count: Number(row.count) || 0,
    total: Number(row.total) || 0,
  }));

  return {
    kind,
    group_by: groupBy,
    filters_applied: {
      ...args,
      exclude_transfers: args.exclude_transfers !== false,
      exclude_ignored: args.exclude_ignored !== false,
    },
    summary,
    breakdown,
  };
}

function toolListSubscriptions(args = {}) {
  const activeOnly = args.active_only !== false;
  const rows = all(
    `SELECT id, name, amount, cycle, category, renewal_date, active, notes
     FROM subscriptions
     ${activeOnly ? 'WHERE active = 1' : ''}
     ORDER BY active DESC, amount DESC`
  );

  const monthlyEquivalent = (sub) => {
    const amount = Number(sub.amount) || 0;
    if (sub.cycle === 'monthly') return amount;
    if (sub.cycle === 'yearly') return amount / 12;
    if (sub.cycle === 'weekly') return amount * (52 / 12);
    return amount;
  };

  const enriched = rows.map((sub) => ({
    ...sub,
    monthly_equivalent: Number(monthlyEquivalent(sub).toFixed(2)),
  }));

  const totalMonthly = enriched
    .filter((sub) => sub.active)
    .reduce((sum, sub) => sum + sub.monthly_equivalent, 0);

  return {
    active_only: activeOnly,
    count: enriched.length,
    total_monthly_equivalent: Number(totalMonthly.toFixed(2)),
    subscriptions: enriched,
  };
}

function toolListBudgetGoals() {
  const goals = all('SELECT category, monthly_limit FROM budget_goals ORDER BY monthly_limit DESC');
  const today = todayLocalIso();
  const monthPrefix = today.slice(0, 7);

  const goalsWithActuals = goals.map((goal) => {
    const actualRow = get(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM expenses
       WHERE category = ? AND substr(date, 1, 7) = ?
         AND (is_transfer IS NULL OR is_transfer = 0)
         AND (ignore_dashboard IS NULL OR ignore_dashboard = 0)`,
      [goal.category, monthPrefix]
    );
    const actual = Number(actualRow?.total) || 0;
    const limit = Number(goal.monthly_limit) || 0;
    return {
      category: goal.category,
      monthly_limit: limit,
      current_month_spent: actual,
      remaining: Number((limit - actual).toFixed(2)),
      pct_used: limit > 0 ? Number(((actual / limit) * 100).toFixed(1)) : null,
    };
  });

  return { current_month: monthPrefix, goals: goalsWithActuals };
}

function executeTool(name, args) {
  try {
    switch (name) {
      case 'get_context': return toolGetContext();
      case 'query_transactions': return toolQueryTransactions(args || {});
      case 'aggregate_transactions': return toolAggregateTransactions(args || {});
      case 'list_subscriptions': return toolListSubscriptions(args || {});
      case 'list_budget_goals': return toolListBudgetGoals();
      default: return { error: `Unknown tool: ${name}` };
    }
  } catch (error) {
    console.error(`Tool ${name} failed:`, error);
    return { error: `Tool ${name} failed: ${error.message}` };
  }
}

const RAG_TOOLS = [{
  functionDeclarations: [
    {
      name: 'get_context',
      description: "Returns today's date, the user's currency, the list of accounts, the list of valid expense categories, and the date range of stored data. Call this first if you need today's date or the currency, or to know what accounts/categories exist.",
      parameters: { type: 'object', properties: {} },
    },
    {
      name: 'query_transactions',
      description: 'Fetch raw expense or income rows with filters. Use for questions about specific transactions or recent activity. Returns matched_rows_total (the true count) plus up to `limit` rows. By default excludes internal transfers and items the user marked ignore-on-dashboard.',
      parameters: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: ['expenses', 'income'], description: 'Which table to query.' },
          date_from: { type: 'string', description: 'Inclusive lower bound, YYYY-MM-DD.' },
          date_to: { type: 'string', description: 'Inclusive upper bound, YYYY-MM-DD.' },
          category: { type: 'string', description: 'Exact category match (expenses only). Must be one of the valid categories.' },
          description_contains: { type: 'string', description: 'Case-insensitive substring match against description (expenses) or source (income).' },
          min_amount: { type: 'number' },
          max_amount: { type: 'number' },
          account_id: { type: 'integer', description: 'Filter to a single account.' },
          payment_method: { type: 'string', description: 'Expenses only: credit, debit, pix, cash, transfer, other.' },
          sort: { type: 'string', enum: ['date_desc', 'date_asc', 'amount_desc', 'amount_asc'], description: 'Default date_desc.' },
          limit: { type: 'integer', description: `Max rows to return. Default ${TOOL_ROW_LIMIT_DEFAULT}, max ${TOOL_ROW_LIMIT_MAX}.` },
          exclude_transfers: { type: 'boolean', description: 'Default true. Set false to include internal transfer rows.' },
          exclude_ignored: { type: 'boolean', description: 'Default true. Set false to include rows marked ignore-on-dashboard.' },
        },
        required: ['kind'],
      },
    },
    {
      name: 'aggregate_transactions',
      description: 'Compute totals (count, sum, avg, min, max) over expenses or income, optionally grouped. Use for questions about how much was spent or earned, breakdowns by category/month/etc. By default excludes transfers and ignored items so figures match the dashboard.',
      parameters: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: ['expenses', 'income'] },
          group_by: { type: 'string', enum: ['none', 'category', 'month', 'description', 'payment_method', 'account'], description: 'Default none. category and payment_method only valid for expenses.' },
          date_from: { type: 'string' },
          date_to: { type: 'string' },
          category: { type: 'string' },
          description_contains: { type: 'string' },
          min_amount: { type: 'number' },
          max_amount: { type: 'number' },
          account_id: { type: 'integer' },
          payment_method: { type: 'string' },
          exclude_transfers: { type: 'boolean' },
          exclude_ignored: { type: 'boolean' },
        },
        required: ['kind'],
      },
    },
    {
      name: 'list_subscriptions',
      description: 'List subscriptions with billing cycle and a normalized monthly cost. Use for questions about recurring charges or subscriptions to consider canceling.',
      parameters: {
        type: 'object',
        properties: {
          active_only: { type: 'boolean', description: 'Default true.' },
        },
      },
    },
    {
      name: 'list_budget_goals',
      description: "List budget goals (per-category monthly limits) with the current calendar month's actual spending in each category and the percentage used.",
      parameters: { type: 'object', properties: {} },
    },
  ],
}];

function buildSystemInstruction({ today, currency }) {
  return `You are a precise personal finance advisor inside the user's own finance app. The user's data lives in a database accessed only through the tools you can call.

STRICT RULES:
1. NEVER invent, estimate, round, or extrapolate numbers, dates, descriptions, or categories. Every figure you state about the user's data must come from a tool result you obtained in this conversation.
2. To answer any question about totals, trends, comparisons, specific transactions, subscriptions, accounts, or goals, you MUST call the relevant tool. Use aggregate_transactions for totals/breakdowns and query_transactions for specific rows.
3. Resolve relative dates ("this month", "last month", "year-to-date") yourself using the current date below, then pass explicit YYYY-MM-DD bounds to tools.
4. By default the aggregation/query tools exclude internal account transfers and items the user marked ignore-on-dashboard, matching the numbers shown in the dashboard. Only set exclude_transfers=false or exclude_ignored=false if the user explicitly asks.
5. If a tool returns no rows or zero total for the requested filter, say so plainly. Do not guess or fabricate a placeholder.
6. Format currency using ${currency.symbol} (${currency.code}). Format numbers with two decimals.
7. Be concise. Lead with the answer; keep reasoning brief. Use bullet points for lists, not for every reply.
8. You may call multiple tools per turn and chain calls across turns. Stop calling tools as soon as you have what you need.

CONTEXT:
- Today's date: ${today}
- Currency: ${currency.symbol} (${currency.code})`;
}

function parseChatHistory(rawHistory) {
  if (rawHistory === undefined || rawHistory === null) return [];
  if (!Array.isArray(rawHistory)) {
    throw new HttpError(400, 'history must be an array if provided');
  }

  const trimmed = rawHistory.slice(-MAX_CHAT_HISTORY_ENTRIES);
  const contents = [];

  for (const entry of trimmed) {
    if (!entry || typeof entry !== 'object') continue;
    const role = entry.role === 'assistant' ? 'model' : entry.role === 'user' ? 'user' : null;
    if (!role) continue;
    const content = String(entry.content ?? '').slice(0, MAX_CHAT_HISTORY_CONTENT).trim();
    if (!content) continue;
    contents.push({ role, parts: [{ text: content }] });
  }

  return contents;
}

async function runRagChatLoop({ message, history, apiKey }) {
  const systemInstruction = buildSystemInstruction({
    today: todayLocalIso(),
    currency: readCurrencySettings(),
  });

  const contents = [...history, { role: 'user', parts: [{ text: message }] }];
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey.trim()}`;

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const requestBody = {
      system_instruction: { parts: [{ text: systemInstruction }] },
      contents,
      tools: RAG_TOOLS,
      generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
    };

    let geminiRes;
    try {
      geminiRes = await fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        },
        AI_CHAT_TIMEOUT_MS
      );
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(502, `Network error reaching Gemini API: ${error.message}`);
    }

    const rawBody = await geminiRes.text();

    if (!geminiRes.ok) {
      if (geminiRes.status === 429) {
        let retryIn = '';
        try {
          const parsed = JSON.parse(rawBody);
          const retryDetail = parsed?.error?.details?.find((detail) => detail['@type']?.includes('RetryInfo'));
          if (retryDetail?.retryDelay) retryIn = ` retry in ${retryDetail.retryDelay}`;
        } catch {
          // ignore malformed retry info
        }
        throw new HttpError(422, `Rate limit reached for this API key (429 —${retryIn}). Wait about a minute and try again, or check the key's Google project quota.`);
      }
      if (geminiRes.status === 403) {
        throw new HttpError(422, 'API key is invalid or the Gemini API is not enabled for this project.');
      }
      throw new HttpError(502, `Gemini API returned an error (${geminiRes.status}). ${rawBody.slice(0, 200)}`);
    }

    let geminiData;
    try {
      geminiData = JSON.parse(rawBody);
    } catch {
      throw new HttpError(502, 'Received unexpected response from Gemini API.');
    }

    const candidate = geminiData.candidates?.[0];
    const parts = candidate?.content?.parts || [];

    if (parts.length === 0) {
      throw new HttpError(502, 'Gemini returned an empty response structure.');
    }

    const functionCalls = parts.filter((p) => p.functionCall);

    if (functionCalls.length === 0) {
      const text = parts.map((p) => p.text).filter(Boolean).join('\n').trim();
      if (!text) {
        throw new HttpError(502, 'Gemini returned no text and no tool calls.');
      }
      return text;
    }

    contents.push({ role: 'model', parts });

    const responseParts = functionCalls.map((part) => {
      const { name, args } = part.functionCall;
      const result = executeTool(name, args || {});
      return { functionResponse: { name, response: { result } } };
    });
    contents.push({ role: 'user', parts: responseParts });
  }

  return "I gathered partial data but ran out of retrieval steps before composing a final answer. Try asking a more specific question (e.g. limit to a single category or month).";
}

router.post('/chat', async (req, res) => {
  try {
    const message = parseRequiredString('message', req.body?.message, { max: MAX_CHAT_MESSAGE_LENGTH });
    const history = parseChatHistory(req.body?.history);
    const apiKey = getGeminiApiKey();

    if (!apiKey) {
      throw new HttpError(503, 'Gemini API key not configured');
    }

    const reply = await runRagChatLoop({ message, history, apiKey });
    return res.json({ reply });
  } catch (error) {
    return handleRouteError(res, error, 'AI request failed');
  }
});

router.get('/ping', (req, res) => res.json({ status: 'ai router ok' }));

router.post('/suggest-categories', async (req, res) => {
  try {
    const rawExpenses = assertMaxItems(req.body?.expenses, MAX_AI_SUGGESTION_ITEMS, 'expenses');
    const apiKey = getGeminiApiKey();

    if (!apiKey) {
      throw new HttpError(503, 'Gemini API key not configured');
    }

    const expenses = rawExpenses.map((expense) => ({
      id: parseRequiredString('id', expense?.id, { max: 80 }),
      description: parseOptionalString(expense?.description, { max: 200, defaultValue: '' }),
      amount: parsePositiveAmount('amount', expense?.amount, { allowZero: true }),
    }));

    const historicalCategoryMap = getHistoricalCategoryMap();
    const suggestions = {};
    const groupedUnknownExpenses = new Map();
    const warnings = [];
    let historyMatches = 0;
    let aiMatches = 0;

    for (const expense of expenses) {
      const description = expense.description.trim();
      const cleanedDescription = cleanDescriptionForCategorization(description);
      const normalizedDescription = normalizeDescription(description);

      if (!normalizedDescription) {
        suggestions[expense.id] = 'Other';
        continue;
      }

      const historicalCategory = historicalCategoryMap.get(normalizedDescription);
      if (historicalCategory) {
        suggestions[expense.id] = historicalCategory;
        historyMatches++;
        continue;
      }

      const existingGroup = groupedUnknownExpenses.get(normalizedDescription);
      if (existingGroup) {
        existingGroup.ids.push(expense.id);
      } else {
        groupedUnknownExpenses.set(normalizedDescription, {
          ids: [expense.id],
          description,
          cleanedDescription: cleanedDescription || description || 'Imported transaction',
          amount: expense.amount,
        });
      }
    }

    const aiQueue = [...groupedUnknownExpenses.values()].map((group) => ({
      id: group.ids[0],
      ids: group.ids,
      description: group.description || 'Imported transaction',
      cleanedDescription: group.cleanedDescription || group.description || 'Imported transaction',
      amount: group.amount,
    }));

    const chunks = chunkArray(aiQueue, AI_SUGGESTION_CHUNK_SIZE);

    for (const [index, chunk] of chunks.entries()) {
      const { suggestions: chunkSuggestions, error } = await requestCategoryChunkWithFallback(chunk, apiKey);

      for (const entry of chunk) {
        const category = chunkSuggestions[entry.id];
        if (!category) continue;
        for (const originalId of entry.ids) {
          suggestions[originalId] = category;
          aiMatches++;
        }
      }

      if (error) {
        console.error(`Suggest categories chunk ${index + 1} failed:`, error);
        warnings.push(`Chunk ${index + 1} failed: ${error.message}`);
      }
    }

    return res.json({
      suggestions,
      meta: {
        requested: expenses.length,
        resolved: Object.keys(suggestions).length,
        unresolved: Math.max(expenses.length - Object.keys(suggestions).length, 0),
        historyMatches,
        aiMatches,
        warnings,
      },
    });
  } catch (error) {
    return handleRouteError(res, error, 'Failed to suggest categories');
  }
});

export default router;
