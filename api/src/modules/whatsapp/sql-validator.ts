// ─── TASK-0911: SQL Validator ─────────────────────────────────────────────────

const ALLOWED_STARTS = /^\s*SELECT\s/i
const DANGEROUS_KEYWORDS = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|EXEC|EXECUTE)\b/i

/**
 * Validates that a SQL string is a safe SELECT-only query.
 * Returns { valid: true } or { valid: false, reason: string }.
 */
export function validateSQL(
  sql: string,
  storeId: string
): { valid: true } | { valid: false; reason: string } {
  const trimmed = sql.trim()

  if (!ALLOWED_STARTS.test(trimmed)) {
    return { valid: false, reason: 'Only SELECT queries are allowed' }
  }

  if (DANGEROUS_KEYWORDS.test(trimmed)) {
    return { valid: false, reason: 'Query contains forbidden keywords' }
  }

  // Enforce row-level security: storeId must be present in the query
  if (!trimmed.includes(storeId)) {
    return { valid: false, reason: 'Query must be scoped to the store (storeId missing)' }
  }

  return { valid: true }
}
