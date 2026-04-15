// ─── TASK-053: Cadastro de Motoboys — Unit Tests ──────────────────────────────

jest.mock('../../../shared/prisma/prisma', () => ({
  prisma: {
    user: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    refreshToken: { deleteMany: jest.fn() },
    auditLog: { create: jest.fn() },
  },
}))

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
}))

import { prisma } from '../../../shared/prisma/prisma'
import { listMotoboys, createMotoboy, deleteMotoboy, updateMotoboy } from '../motoboys.service'

const mockPrisma = prisma as jest.Mocked<typeof prisma>

const STORE_ID = 'store-1'
const USER_ID = 'admin-1'
const IP = '127.0.0.1'
const MOTOBOY_ID = 'motoboy-1'

const mockMotoboy = {
  id: MOTOBOY_ID,
  name: 'Carlos Moto',
  email: 'carlos@moto.com',
  whatsapp: '5548999990001',
  passwordHash: 'hashed-password',
  role: 'MOTOBOY' as const,
  storeId: STORE_ID,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const mockMotoboySelect = {
  id: mockMotoboy.id,
  name: mockMotoboy.name,
  email: mockMotoboy.email,
  whatsapp: mockMotoboy.whatsapp,
  isActive: mockMotoboy.isActive,
  storeId: mockMotoboy.storeId,
}

beforeEach(() => jest.clearAllMocks())

// ─── listMotoboys ─────────────────────────────────────────────────────────────

describe('listMotoboys', () => {
  it('retorna motoboys da loja ordenados por nome', async () => {
    ;(mockPrisma.user.findMany as jest.Mock).mockResolvedValue([mockMotoboySelect])

    const result = await listMotoboys(STORE_ID)

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { storeId: STORE_ID, role: 'MOTOBOY' },
        orderBy: { name: 'asc' },
      })
    )
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Carlos Moto')
  })

  it('retorna lista vazia quando a loja não tem motoboys', async () => {
    ;(mockPrisma.user.findMany as jest.Mock).mockResolvedValue([])

    const result = await listMotoboys(STORE_ID)

    expect(result).toHaveLength(0)
  })

  it('não retorna motoboys de outra loja (isolamento multi-tenant)', async () => {
    ;(mockPrisma.user.findMany as jest.Mock).mockResolvedValue([])

    await listMotoboys('outra-loja')

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { storeId: 'outra-loja', role: 'MOTOBOY' } })
    )
  })
})

// ─── createMotoboy ────────────────────────────────────────────────────────────

describe('createMotoboy', () => {
  const input = { name: 'Carlos Moto', email: 'carlos@moto.com', whatsapp: '5548999990001', password: '12345678' }

  it('cria motoboy com senha hasheada (bcrypt salt 12) e registra AuditLog', async () => {
    ;(mockPrisma.user.findFirst as jest.Mock).mockResolvedValue(null)
    ;(mockPrisma.user.create as jest.Mock).mockResolvedValue(mockMotoboySelect)
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    const result = await createMotoboy(STORE_ID, input, USER_ID, IP)

    const { hash } = await import('bcrypt')
    expect(hash).toHaveBeenCalledWith('12345678', 12)

    expect(mockPrisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          role: 'MOTOBOY',
          storeId: STORE_ID,
          passwordHash: 'hashed-password',
        }),
      })
    )
    expect(result.id).toBe(MOTOBOY_ID)
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'motoboy.create', entity: 'User' }),
      })
    )
  })

  it('lança 422 quando nem email nem whatsapp são informados', async () => {
    await expect(
      createMotoboy(STORE_ID, { name: 'X', password: '12345678' } as any, USER_ID)
    ).rejects.toMatchObject({ status: 422 })

    expect(mockPrisma.user.create).not.toHaveBeenCalled()
  })

  it('lança 422 quando email já existe nesta loja', async () => {
    ;(mockPrisma.user.findFirst as jest.Mock).mockResolvedValueOnce(mockMotoboy) // email check

    await expect(
      createMotoboy(STORE_ID, input, USER_ID)
    ).rejects.toMatchObject({ status: 422 })

    expect(mockPrisma.user.create).not.toHaveBeenCalled()
  })

  it('lança 422 quando whatsapp já existe nesta loja', async () => {
    ;(mockPrisma.user.findFirst as jest.Mock)
      .mockResolvedValueOnce(null)       // email ok
      .mockResolvedValueOnce(mockMotoboy) // whatsapp duplicado

    await expect(
      createMotoboy(STORE_ID, input, USER_ID)
    ).rejects.toMatchObject({ status: 422 })

    expect(mockPrisma.user.create).not.toHaveBeenCalled()
  })

  it('cria motoboy apenas com email (sem whatsapp)', async () => {
    ;(mockPrisma.user.findFirst as jest.Mock).mockResolvedValue(null)
    ;(mockPrisma.user.create as jest.Mock).mockResolvedValue({ ...mockMotoboySelect, whatsapp: null })
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    const result = await createMotoboy(
      STORE_ID,
      { name: 'Carlos Moto', email: 'carlos@moto.com', password: '12345678' },
      USER_ID
    )

    expect(result.whatsapp).toBeNull()
  })

  it('cria motoboy apenas com whatsapp (sem email)', async () => {
    ;(mockPrisma.user.findFirst as jest.Mock).mockResolvedValue(null)
    ;(mockPrisma.user.create as jest.Mock).mockResolvedValue({ ...mockMotoboySelect, email: null })
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    const result = await createMotoboy(
      STORE_ID,
      { name: 'Carlos Moto', whatsapp: '5548999990001', password: '12345678' },
      USER_ID
    )

    expect(result.email).toBeNull()
  })
})

// ─── updateMotoboy ────────────────────────────────────────────────────────────

describe('updateMotoboy', () => {
  it('atualiza nome e email, registra AuditLog', async () => {
    ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockMotoboy)
    ;(mockPrisma.user.findFirst as jest.Mock).mockResolvedValue(null)
    ;(mockPrisma.user.update as jest.Mock).mockResolvedValue({ ...mockMotoboySelect, name: 'Novo Nome' })
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    const result = await updateMotoboy(
      STORE_ID,
      MOTOBOY_ID,
      { name: 'Novo Nome', email: 'novo@moto.com' },
      USER_ID,
      IP
    )

    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: MOTOBOY_ID },
        data: expect.objectContaining({ name: 'Novo Nome', email: 'novo@moto.com' }),
      })
    )
    expect(result.name).toBe('Novo Nome')
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'motoboy.update', entity: 'User' }),
      })
    )
  })

  it('reseta senha (hash novo + invalida refresh tokens)', async () => {
    ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockMotoboy)
    ;(mockPrisma.user.update as jest.Mock).mockResolvedValue(mockMotoboySelect)
    ;(mockPrisma.refreshToken.deleteMany as jest.Mock).mockResolvedValue({ count: 1 })
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    await updateMotoboy(STORE_ID, MOTOBOY_ID, { password: 'nova-senha-123' }, USER_ID)

    const { hash } = await import('bcrypt')
    expect(hash).toHaveBeenCalledWith('nova-senha-123', 12)
    expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId: MOTOBOY_ID } })
  })

  it('lança 404 quando motoboy pertence a outra loja', async () => {
    ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      ...mockMotoboy,
      storeId: 'outra-loja',
    })

    await expect(
      updateMotoboy(STORE_ID, MOTOBOY_ID, { name: 'X' }, USER_ID)
    ).rejects.toMatchObject({ status: 404 })
  })

  it('lança 422 quando novo email já existe em outro motoboy da mesma loja', async () => {
    ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockMotoboy)
    ;(mockPrisma.user.findFirst as jest.Mock).mockResolvedValue({ ...mockMotoboy, id: 'outro' })

    await expect(
      updateMotoboy(STORE_ID, MOTOBOY_ID, { email: 'conflito@moto.com' }, USER_ID)
    ).rejects.toMatchObject({ status: 422 })

    expect(mockPrisma.user.update).not.toHaveBeenCalled()
  })

  it('lança 422 quando remove ambos email e whatsapp', async () => {
    ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockMotoboy)

    await expect(
      updateMotoboy(STORE_ID, MOTOBOY_ID, { email: null, whatsapp: null }, USER_ID)
    ).rejects.toMatchObject({ status: 422 })
  })
})

// ─── deleteMotoboy ────────────────────────────────────────────────────────────

describe('deleteMotoboy', () => {
  it('remove motoboy, invalida refresh tokens e registra AuditLog', async () => {
    ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockMotoboy)
    ;(mockPrisma.refreshToken.deleteMany as jest.Mock).mockResolvedValue({ count: 2 })
    ;(mockPrisma.user.delete as jest.Mock).mockResolvedValue(mockMotoboy)
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    await deleteMotoboy(STORE_ID, MOTOBOY_ID, USER_ID, IP)

    expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: MOTOBOY_ID },
    })
    expect(mockPrisma.user.delete).toHaveBeenCalledWith({ where: { id: MOTOBOY_ID } })
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'motoboy.delete', entity: 'User' }),
      })
    )
  })

  it('lança 404 quando motoboy não existe', async () => {
    ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null)

    await expect(deleteMotoboy(STORE_ID, 'nao-existe', USER_ID)).rejects.toMatchObject({ status: 404 })

    expect(mockPrisma.user.delete).not.toHaveBeenCalled()
  })

  it('lança 404 quando motoboy pertence a outra loja (isolamento multi-tenant)', async () => {
    ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      ...mockMotoboy,
      storeId: 'outra-loja',
    })

    await expect(deleteMotoboy(STORE_ID, MOTOBOY_ID, USER_ID)).rejects.toMatchObject({ status: 404 })

    expect(mockPrisma.user.delete).not.toHaveBeenCalled()
  })

  it('lança 404 quando usuário existe mas não é MOTOBOY', async () => {
    ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      ...mockMotoboy,
      role: 'CLIENT',
    })

    await expect(deleteMotoboy(STORE_ID, MOTOBOY_ID, USER_ID)).rejects.toMatchObject({ status: 404 })
  })
})
