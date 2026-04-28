// ─── TASK-050/051/052: Configurações da Loja — Unit Tests ────────────────────

jest.mock('../../../shared/prisma/prisma', () => ({
  prisma: {
    store: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    businessHour: {
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
    auditLog: { create: jest.fn() },
  },
}))

jest.mock('../../../shared/redis/redis', () => ({
  cache: { del: jest.fn() },
}))

jest.mock('../../../shared/socket/socket', () => ({
  emit: { menuUpdated: jest.fn() },
}))

jest.mock('../../auth/auth.service', () => ({
  reauth: jest.fn(),
}))

import { prisma } from '../../../shared/prisma/prisma'
import { cache } from '../../../shared/redis/redis'
import { emit } from '../../../shared/socket/socket'
import { reauth } from '../../auth/auth.service'
import {
  getStore,
  updateStore,
  getBusinessHours,
  updateBusinessHours,
  updateStoreStatus,
  updateWhatsapp,
  updatePix,
  updatePaymentSettings,
} from '../store.service'

const mockPrisma = prisma as jest.Mocked<typeof prisma>
const mockCache = cache as jest.Mocked<typeof cache>
const mockEmit = emit as jest.Mocked<typeof emit>
const mockReauth = reauth as jest.Mock

const STORE_ID = 'store-1'
const USER_ID = 'user-1'
const IP = '127.0.0.1'

const mockStore = {
  id: STORE_ID,
  name: 'Pizzaria do Zé',
  slug: 'pizzaria-do-ze',
  description: 'As melhores pizzas',
  logo: null,
  address: 'Rua A, 123',
  phone: '5548999990000',
  manualOpen: null,
  pixKey: null,
  pixKeyType: null,
  allowCashOnDelivery: true,
  allowPickup: false,
  serviceChargePercent: null,
  features: { allowPix: true },
  plan: 'PROFESSIONAL',
  status: 'ACTIVE',
  createdAt: new Date(),
  updatedAt: new Date(),
}

beforeEach(() => jest.clearAllMocks())

// ─── getStore ─────────────────────────────────────────────────────────────────

describe('getStore', () => {
  it('retorna dados da loja quando encontrada', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)

    const result = await getStore(STORE_ID)

    expect(mockPrisma.store.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: STORE_ID } })
    )
    expect(result.id).toBe(STORE_ID)
    expect(result.name).toBe('Pizzaria do Zé')
  })

  it('lança 404 quando loja não existe', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(null)

    await expect(getStore(STORE_ID)).rejects.toMatchObject({ status: 404 })
  })
})

// ─── updateStore ──────────────────────────────────────────────────────────────

describe('updateStore', () => {
  it('atualiza dados e invalida cache', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.store.update as jest.Mock).mockResolvedValue({
      id: STORE_ID,
      name: 'Nova Pizzaria',
      description: null,
      logo: null,
      address: 'Rua B, 456',
    })
    ;(mockCache.del as jest.Mock).mockResolvedValue(undefined)
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    const result = await updateStore(STORE_ID, { name: 'Nova Pizzaria' }, USER_ID, IP)

    expect(result.name).toBe('Nova Pizzaria')
    expect(mockCache.del).toHaveBeenCalledWith(`menu:${STORE_ID}`)
    expect(mockEmit.menuUpdated).toHaveBeenCalledWith(STORE_ID)
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'store.update',
          entity: 'Store',
          entityId: STORE_ID,
          storeId: STORE_ID,
          userId: USER_ID,
        }),
      })
    )
  })

  it('lança 404 quando loja não existe', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(null)

    await expect(
      updateStore(STORE_ID, { name: 'X' }, USER_ID)
    ).rejects.toMatchObject({ status: 404 })

    expect(mockCache.del).not.toHaveBeenCalled()
  })

  it('aceita campos opcionais individualmente (partial update)', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.store.update as jest.Mock).mockResolvedValue({
      id: STORE_ID,
      name: 'Pizzaria do Zé',
      description: 'Nova descrição',
      logo: null,
      address: null,
    })
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    const result = await updateStore(STORE_ID, { description: 'Nova descrição' }, USER_ID)

    expect(mockPrisma.store.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ description: 'Nova descrição' }),
      })
    )
    expect(result.description).toBe('Nova descrição')
  })
})

// ─── getBusinessHours ─────────────────────────────────────────────────────────

describe('getBusinessHours', () => {
  it('retorna 7 dias preenchendo com defaults para os que não existem no DB', async () => {
    ;(mockPrisma.businessHour.findMany as jest.Mock).mockResolvedValue([
      { id: 'bh-1', storeId: STORE_ID, dayOfWeek: 0, openTime: '09:00', closeTime: '21:00', isClosed: false },
    ])

    const result = await getBusinessHours(STORE_ID)

    expect(result).toHaveLength(7)
    expect(result[0].dayOfWeek).toBe(0)
    expect(result[0].openTime).toBe('09:00') // dado real do DB
    expect(result[1].dayOfWeek).toBe(1)
    expect(result[1].openTime).toBe('08:00') // default
    expect(result[1].id).toBeNull() // não existe no DB
  })

  it('retorna todos os 7 dias quando nenhum existe no DB (todos defaults)', async () => {
    ;(mockPrisma.businessHour.findMany as jest.Mock).mockResolvedValue([])

    const result = await getBusinessHours(STORE_ID)

    expect(result).toHaveLength(7)
    result.forEach((h, i) => {
      expect(h.dayOfWeek).toBe(i)
      expect(h.id).toBeNull()
    })
    // Sábado (6) tem horário diferente
    expect(result[6].closeTime).toBe('18:00')
  })

  it('retorna todos do DB quando todos os 7 dias existem', async () => {
    const dbHours = Array.from({ length: 7 }, (_, i) => ({
      id: `bh-${i}`,
      storeId: STORE_ID,
      dayOfWeek: i,
      openTime: '10:00',
      closeTime: '20:00',
      isClosed: false,
    }))
    ;(mockPrisma.businessHour.findMany as jest.Mock).mockResolvedValue(dbHours)

    const result = await getBusinessHours(STORE_ID)

    expect(result).toHaveLength(7)
    result.forEach((h) => expect(h.id).not.toBeNull())
  })
})

// ─── updateBusinessHours ──────────────────────────────────────────────────────

describe('updateBusinessHours', () => {
  const hours = Array.from({ length: 7 }, (_, i) => ({
    dayOfWeek: i,
    openTime: '09:00',
    closeTime: '22:00',
    isClosed: false,
  }))

  it('faz upsert dos 7 dias e invalida cache', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.businessHour.upsert as jest.Mock).mockImplementation(({ create }) =>
      Promise.resolve({ ...create, id: `bh-${create.dayOfWeek}` })
    )
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    const result = await updateBusinessHours(STORE_ID, hours, USER_ID, IP)

    expect(mockPrisma.businessHour.upsert).toHaveBeenCalledTimes(7)
    expect(result).toHaveLength(7)
    // Ordenados por dayOfWeek
    expect(result[0].dayOfWeek).toBe(0)
    expect(result[6].dayOfWeek).toBe(6)
    expect(mockCache.del).toHaveBeenCalledWith(`menu:${STORE_ID}`)
    expect(mockEmit.menuUpdated).toHaveBeenCalledWith(STORE_ID)
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'store.hours.update' }),
      })
    )
  })

  it('lança 404 quando loja não existe', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(null)

    await expect(
      updateBusinessHours(STORE_ID, hours, USER_ID)
    ).rejects.toMatchObject({ status: 404 })

    expect(mockPrisma.businessHour.upsert).not.toHaveBeenCalled()
  })

  it('suporta dia marcado como isClosed=true com horários nulos', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.businessHour.upsert as jest.Mock).mockImplementation(({ create }) =>
      Promise.resolve({ ...create, id: `bh-${create.dayOfWeek}` })
    )
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    const hoursWithClosed = hours.map((h, i) =>
      i === 0 ? { ...h, isClosed: true, openTime: null, closeTime: null } : h
    )

    await updateBusinessHours(STORE_ID, hoursWithClosed, USER_ID)

    expect(mockPrisma.businessHour.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ isClosed: true, openTime: null, closeTime: null }),
      })
    )
  })
})

// ─── updateStoreStatus ────────────────────────────────────────────────────────

describe('updateStoreStatus', () => {
  it('define manualOpen=true (abre manualmente) e invalida cache', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.store.update as jest.Mock).mockResolvedValue({ id: STORE_ID, manualOpen: true })
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    const result = await updateStoreStatus(STORE_ID, { manualOpen: true }, USER_ID, IP)

    expect(result.manualOpen).toBe(true)
    expect(mockCache.del).toHaveBeenCalledWith(`menu:${STORE_ID}`)
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'store.status.update' }),
      })
    )
  })

  it('define manualOpen=false (fecha manualmente)', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.store.update as jest.Mock).mockResolvedValue({ id: STORE_ID, manualOpen: false })
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    const result = await updateStoreStatus(STORE_ID, { manualOpen: false }, USER_ID)

    expect(result.manualOpen).toBe(false)
  })

  it('define manualOpen=null (retorna ao controle automático por horário)', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.store.update as jest.Mock).mockResolvedValue({ id: STORE_ID, manualOpen: null })
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    const result = await updateStoreStatus(STORE_ID, { manualOpen: null }, USER_ID)

    expect(result.manualOpen).toBeNull()
  })

  it('lança 404 quando loja não existe', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(null)

    await expect(
      updateStoreStatus(STORE_ID, { manualOpen: true }, USER_ID)
    ).rejects.toMatchObject({ status: 404 })
  })
})

// ─── updateWhatsapp ───────────────────────────────────────────────────────────

describe('updateWhatsapp', () => {
  it('exige reauth e atualiza phone com AuditLog registrando valor anterior/novo', async () => {
    mockReauth.mockResolvedValue(undefined)
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.store.update as jest.Mock).mockResolvedValue({ id: STORE_ID, phone: '5548988880000' })
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    const result = await updateWhatsapp(
      STORE_ID,
      { phone: '5548988880000', password: 'senha123' },
      USER_ID,
      IP
    )

    expect(mockReauth).toHaveBeenCalledWith(USER_ID, 'senha123')
    expect(result.phone).toBe('5548988880000')
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'store.whatsapp.update',
          data: expect.objectContaining({
            previousPhone: mockStore.phone,
            newPhone: '5548988880000',
          }),
        }),
      })
    )
    expect(mockCache.del).toHaveBeenCalledWith(`menu:${STORE_ID}`)
  })

  it('lança erro de reauth (422) sem atualizar a loja', async () => {
    const authError = Object.assign(new Error('Senha incorreta'), { status: 422 })
    mockReauth.mockRejectedValue(authError)

    await expect(
      updateWhatsapp(STORE_ID, { phone: '5548900000000', password: 'errada' }, USER_ID)
    ).rejects.toMatchObject({ status: 422 })

    expect(mockPrisma.store.findUnique).not.toHaveBeenCalled()
    expect(mockPrisma.store.update).not.toHaveBeenCalled()
  })

  it('lança 404 quando loja não existe (após reauth ok)', async () => {
    mockReauth.mockResolvedValue(undefined)
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(null)

    await expect(
      updateWhatsapp(STORE_ID, { phone: '5548900000000', password: 'senha' }, USER_ID)
    ).rejects.toMatchObject({ status: 404 })
  })
})

// ─── updatePix ────────────────────────────────────────────────────────────────

describe('updatePix', () => {
  it('exige reauth e atualiza chave Pix com AuditLog registrando valor anterior/novo', async () => {
    mockReauth.mockResolvedValue(undefined)
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.store.update as jest.Mock).mockResolvedValue({
      id: STORE_ID,
      pixKey: 'fulano@email.com',
      pixKeyType: 'EMAIL',
    })
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    const result = await updatePix(
      STORE_ID,
      { pixKey: 'fulano@email.com', pixKeyType: 'EMAIL', password: 'senha123' },
      USER_ID,
      IP
    )

    expect(mockReauth).toHaveBeenCalledWith(USER_ID, 'senha123')
    expect(result.pixKey).toBe('fulano@email.com')
    expect(result.pixKeyType).toBe('EMAIL')
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'store.pix.update',
          data: expect.objectContaining({
            newPixKey: 'fulano@email.com',
            newPixKeyType: 'EMAIL',
          }),
        }),
      })
    )
  })

  it('lança erro de reauth (422) sem alterar Pix', async () => {
    const authError = Object.assign(new Error('Senha incorreta'), { status: 422 })
    mockReauth.mockRejectedValue(authError)

    await expect(
      updatePix(STORE_ID, { pixKey: 'x', pixKeyType: 'EVP', password: 'errada' }, USER_ID)
    ).rejects.toMatchObject({ status: 422 })

    expect(mockPrisma.store.update).not.toHaveBeenCalled()
  })

  it('lança 404 quando loja não existe (após reauth ok)', async () => {
    mockReauth.mockResolvedValue(undefined)
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(null)

    await expect(
      updatePix(STORE_ID, { pixKey: 'x', pixKeyType: 'EVP', password: 'senha' }, USER_ID)
    ).rejects.toMatchObject({ status: 404 })
  })
})

// ─── updatePaymentSettings ────────────────────────────────────────────────────

describe('updatePaymentSettings', () => {
  it('atualiza allowCashOnDelivery e invalida cache', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.store.update as jest.Mock).mockResolvedValue({
      id: STORE_ID,
      allowCashOnDelivery: false,
      allowPickup: false,
      serviceChargePercent: null,
      features: { allowPix: true },
    })
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    const result = await updatePaymentSettings(STORE_ID, { allowCashOnDelivery: false }, USER_ID, IP)

    expect(result.allowCashOnDelivery).toBe(false)
    expect(mockCache.del).toHaveBeenCalledWith(`menu:${STORE_ID}`)
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'store.payment-settings.update' }),
      })
    )
  })

  it('armazena allowPix no campo features (JSON) sem migration', async () => {
    const storeWithFeatures = { ...mockStore, features: { allowPix: true, someOtherFlag: true } }
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(storeWithFeatures)
    ;(mockPrisma.store.update as jest.Mock).mockResolvedValue({
      id: STORE_ID,
      allowCashOnDelivery: true,
      allowPickup: false,
      serviceChargePercent: null,
      features: { allowPix: false, someOtherFlag: true },
    })
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    await updatePaymentSettings(STORE_ID, { allowPix: false }, USER_ID)

    expect(mockPrisma.store.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          features: { allowPix: false, someOtherFlag: true }, // mantém flags existentes
        }),
      })
    )
  })

  it('atualiza allowPickup e serviceChargePercent juntos', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.store.update as jest.Mock).mockResolvedValue({
      id: STORE_ID,
      allowCashOnDelivery: true,
      allowPickup: true,
      serviceChargePercent: 10,
      features: { allowPix: true },
    })
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    const result = await updatePaymentSettings(
      STORE_ID,
      { allowPickup: true, serviceChargePercent: 10 },
      USER_ID
    )

    expect(result.allowPickup).toBe(true)
    expect(result.serviceChargePercent).toBe(10)
  })

  it('lança 404 quando loja não existe', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(null)

    await expect(
      updatePaymentSettings(STORE_ID, { allowCashOnDelivery: false }, USER_ID)
    ).rejects.toMatchObject({ status: 404 })
  })
})
