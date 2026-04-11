/**
 * Unit tests — Epic 02: owner.schema.ts
 *
 * Covers:
 *  - TASK-021: Zod validations (slug RN-001, whatsapp RN-003, email, plan)
 *  - TASK-023: updateStorePlanSchema
 *  - TASK-024: auditLogsQuerySchema
 */

import {
  auditLogsQuerySchema,
  createStoreSchema,
  listStoresSchema,
  updateStorePlanSchema,
  updateStoreSchema,
} from '../owner.schema'

// ─── createStoreSchema ────────────────────────────────────────────────────────

describe('createStoreSchema — slug validation (RN-001)', () => {
  const base = {
    name: 'Minha Loja',
    plan: 'PROFESSIONAL' as const,
    adminEmail: 'admin@loja.com',
    whatsapp: '48999998888',
  }

  it('accepts valid lowercase slug with hyphens', () => {
    const result = createStoreSchema.safeParse({ ...base, slug: 'minha-loja' })
    expect(result.success).toBe(true)
  })

  it('accepts slug with only alphanumeric chars', () => {
    const result = createStoreSchema.safeParse({ ...base, slug: 'minhalojatest123' })
    expect(result.success).toBe(true)
  })

  it('rejects slug with uppercase letters', () => {
    const result = createStoreSchema.safeParse({ ...base, slug: 'MinhaLoja' })
    expect(result.success).toBe(false)
  })

  it('rejects slug with spaces', () => {
    const result = createStoreSchema.safeParse({ ...base, slug: 'minha loja' })
    expect(result.success).toBe(false)
  })

  it('rejects slug with special characters', () => {
    const result = createStoreSchema.safeParse({ ...base, slug: 'minha@loja' })
    expect(result.success).toBe(false)
  })

  it('rejects slug shorter than 2 characters', () => {
    const result = createStoreSchema.safeParse({ ...base, slug: 'a' })
    expect(result.success).toBe(false)
  })

  it('rejects slug longer than 50 characters', () => {
    const result = createStoreSchema.safeParse({ ...base, slug: 'a'.repeat(51) })
    expect(result.success).toBe(false)
  })

  it('rejects slug starting or ending with hyphen', () => {
    expect(createStoreSchema.safeParse({ ...base, slug: '-minha-loja' }).success).toBe(false)
    expect(createStoreSchema.safeParse({ ...base, slug: 'minha-loja-' }).success).toBe(false)
  })

  // RN-001C: slugs reservados pelo sistema (ver shared/utils/reserved-slugs.ts)
  it.each([
    'api',
    'www',
    'admin',
    'dashboard',
    'cdn',
    'mail',
    'webhook',
    'cadastro',
    'login',
  ])('rejects reserved slug %s (RN-001C)', (slug) => {
    const result = createStoreSchema.safeParse({ ...base, slug })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => /reservado/i.test(i.message))).toBe(true)
    }
  })

  it('accepts slug that merely starts with a reserved prefix (apiburgers)', () => {
    // Defesa contra falso-positivo: só o match exato é bloqueado,
    // "apiburgers" e "admin-central" continuam válidos.
    expect(createStoreSchema.safeParse({ ...base, slug: 'apiburgers' }).success).toBe(true)
    expect(createStoreSchema.safeParse({ ...base, slug: 'admin-central' }).success).toBe(true)
  })
})

describe('createStoreSchema — whatsapp validation (RN-003)', () => {
  const base = {
    name: 'Loja',
    slug: 'loja-test',
    plan: 'PROFESSIONAL' as const,
    adminEmail: 'admin@loja.com',
  }

  it('accepts 11-digit whatsapp (DDD + number)', () => {
    const result = createStoreSchema.safeParse({ ...base, whatsapp: '48999998888' })
    expect(result.success).toBe(true)
  })

  it('rejects whatsapp with 10 digits (missing DDD digit)', () => {
    const result = createStoreSchema.safeParse({ ...base, whatsapp: '4899999888' })
    expect(result.success).toBe(false)
  })

  it('rejects whatsapp with 12 digits', () => {
    const result = createStoreSchema.safeParse({ ...base, whatsapp: '489999988881' })
    expect(result.success).toBe(false)
  })

  it('rejects whatsapp with non-numeric chars', () => {
    const result = createStoreSchema.safeParse({ ...base, whatsapp: '4899999-8888' })
    expect(result.success).toBe(false)
  })
})

describe('createStoreSchema — email and plan validation', () => {
  const base = {
    name: 'Loja',
    slug: 'loja-test',
    whatsapp: '48999998888',
  }

  it('rejects invalid email', () => {
    const result = createStoreSchema.safeParse({ ...base, plan: 'PROFESSIONAL', adminEmail: 'not-an-email' })
    expect(result.success).toBe(false)
  })

  it('rejects unknown plan value', () => {
    const result = createStoreSchema.safeParse({ ...base, adminEmail: 'admin@loja.com', plan: 'FREE' })
    expect(result.success).toBe(false)
  })

  it('accepts PROFESSIONAL plan', () => {
    const result = createStoreSchema.safeParse({ ...base, adminEmail: 'admin@loja.com', plan: 'PROFESSIONAL' })
    expect(result.success).toBe(true)
  })

  it('accepts PREMIUM plan', () => {
    const result = createStoreSchema.safeParse({ ...base, adminEmail: 'admin@loja.com', plan: 'PREMIUM' })
    expect(result.success).toBe(true)
  })

  it('accepts optional adminName when provided', () => {
    const result = createStoreSchema.safeParse({
      ...base,
      adminEmail: 'admin@loja.com',
      plan: 'PROFESSIONAL',
      adminName: 'João Silva',
    })
    expect(result.success).toBe(true)
  })
})

// ─── listStoresSchema ─────────────────────────────────────────────────────────

describe('listStoresSchema — status filter', () => {
  it('accepts valid status values', () => {
    for (const status of ['TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED']) {
      expect(listStoresSchema.safeParse({ status }).success).toBe(true)
    }
  })

  it('accepts missing status (optional)', () => {
    expect(listStoresSchema.safeParse({}).success).toBe(true)
  })

  it('rejects invalid status', () => {
    expect(listStoresSchema.safeParse({ status: 'PAUSED' }).success).toBe(false)
  })
})

// ─── updateStoreSchema ────────────────────────────────────────────────────────

describe('updateStoreSchema', () => {
  it('accepts partial updates', () => {
    expect(updateStoreSchema.safeParse({ name: 'Nova Loja' }).success).toBe(true)
    expect(updateStoreSchema.safeParse({ description: 'Descrição' }).success).toBe(true)
    expect(updateStoreSchema.safeParse({ status: 'ACTIVE' }).success).toBe(true)
  })

  it('accepts empty object (all fields optional)', () => {
    expect(updateStoreSchema.safeParse({}).success).toBe(true)
  })

  it('rejects description longer than 500 chars', () => {
    expect(updateStoreSchema.safeParse({ description: 'x'.repeat(501) }).success).toBe(false)
  })

  it('rejects name shorter than 2 chars', () => {
    expect(updateStoreSchema.safeParse({ name: 'A' }).success).toBe(false)
  })
})

// ─── updateStorePlanSchema ────────────────────────────────────────────────────

describe('updateStorePlanSchema', () => {
  it('accepts PROFESSIONAL and PREMIUM', () => {
    expect(updateStorePlanSchema.safeParse({ plan: 'PROFESSIONAL' }).success).toBe(true)
    expect(updateStorePlanSchema.safeParse({ plan: 'PREMIUM' }).success).toBe(true)
  })

  it('rejects missing plan', () => {
    expect(updateStorePlanSchema.safeParse({}).success).toBe(false)
  })

  it('rejects invalid plan value', () => {
    expect(updateStorePlanSchema.safeParse({ plan: 'BASIC' }).success).toBe(false)
  })
})

// ─── auditLogsQuerySchema ─────────────────────────────────────────────────────

describe('auditLogsQuerySchema', () => {
  it('uses defaults for page and limit', () => {
    const result = auditLogsQuerySchema.parse({})
    expect(result.page).toBe(1)
    expect(result.limit).toBe(20)
  })

  it('coerces string page to number', () => {
    const result = auditLogsQuerySchema.parse({ page: '3', limit: '50' })
    expect(result.page).toBe(3)
    expect(result.limit).toBe(50)
  })

  it('rejects page < 1', () => {
    expect(auditLogsQuerySchema.safeParse({ page: 0 }).success).toBe(false)
  })

  it('rejects limit > 100', () => {
    expect(auditLogsQuerySchema.safeParse({ limit: 101 }).success).toBe(false)
  })

  it('rejects invalid UUID for userId', () => {
    expect(auditLogsQuerySchema.safeParse({ userId: 'not-a-uuid' }).success).toBe(false)
  })

  it('accepts valid UUID for userId', () => {
    expect(
      auditLogsQuerySchema.safeParse({ userId: '123e4567-e89b-12d3-a456-426614174000' }).success
    ).toBe(true)
  })

  it('coerces valid date strings', () => {
    const result = auditLogsQuerySchema.parse({ from: '2024-01-01', to: '2024-12-31' })
    expect(result.from).toBeInstanceOf(Date)
    expect(result.to).toBeInstanceOf(Date)
  })
})
