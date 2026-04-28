import { registerStoreSchema } from '../register.schema'

const validInput = {
  storeName: 'Pizzaria Dona Maria',
  segment: 'PIZZERIA' as const,
  email: 'dona.maria@example.com',
  password: 'senha1234',
  confirmPassword: 'senha1234',
  whatsapp: '48999990000',
}

describe('registerStoreSchema', () => {
  it('parses a valid happy-path payload', () => {
    const result = registerStoreSchema.safeParse(validInput)
    expect(result.success).toBe(true)
  })

  it('fails when storeName is too short', () => {
    const result = registerStoreSchema.safeParse({ ...validInput, storeName: 'A' })
    expect(result.success).toBe(false)
  })

  it('fails when password and confirmPassword do not match', () => {
    const result = registerStoreSchema.safeParse({
      ...validInput,
      password: 'senha1234',
      confirmPassword: 'outra-senha',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === 'confirmPassword')
      expect(issue).toBeDefined()
      expect(issue?.message).toBe('As senhas não coincidem')
    }
  })

  it('fails when whatsapp does not have 11 digits', () => {
    const result = registerStoreSchema.safeParse({ ...validInput, whatsapp: '4899999000' })
    expect(result.success).toBe(false)
  })

  it('fails when whatsapp has masked format', () => {
    const result = registerStoreSchema.safeParse({
      ...validInput,
      whatsapp: '(48) 99999-0000',
    })
    expect(result.success).toBe(false)
  })

  it('fails when password is shorter than 8 chars', () => {
    const result = registerStoreSchema.safeParse({
      ...validInput,
      password: '123',
      confirmPassword: '123',
    })
    expect(result.success).toBe(false)
  })

  it('fails when email is invalid', () => {
    const result = registerStoreSchema.safeParse({ ...validInput, email: 'no-at-symbol' })
    expect(result.success).toBe(false)
  })

  it('fails when segment is unknown', () => {
    const result = registerStoreSchema.safeParse({
      ...validInput,
      segment: 'UNKNOWN' as never,
    })
    expect(result.success).toBe(false)
  })
})
