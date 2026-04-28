// TASK-006: Socket.io — Setup Base
export {}

const mockEmit = jest.fn()
const mockTo = jest.fn().mockReturnValue({ emit: mockEmit })
const mockJoin = jest.fn()
const mockOn = jest.fn()

const mockIo = {
  to: mockTo,
  on: jest.fn(),
}

jest.mock('socket.io', () => ({
  Server: jest.fn().mockImplementation(() => mockIo),
}))

beforeEach(() => {
  jest.resetModules()
  mockEmit.mockClear()
  mockTo.mockClear()
  mockJoin.mockClear()
  mockOn.mockClear()
})

async function setupSocket() {
  const { initSocket, emit } = require('../socket')

  // Mock http server
  const fakeServer = {}
  initSocket(fakeServer as any)

  return emit as typeof import('../socket')['emit']
}

describe('emit helpers', () => {
  it('emit.orderUpdated sends order:updated to store room', async () => {
    const emit = await setupSocket()
    const order = { id: 'o1', status: 'CONFIRMED' }
    emit.orderUpdated('store-1', order)
    expect(mockTo).toHaveBeenCalledWith('store:store-1')
    expect(mockEmit).toHaveBeenCalledWith('order:updated', order)
  })

  it('emit.orderNew sends order:new to store room', async () => {
    const emit = await setupSocket()
    const order = { id: 'o2', status: 'WAITING_CONFIRMATION' }
    emit.orderNew('store-1', order)
    expect(mockTo).toHaveBeenCalledWith('store:store-1')
    expect(mockEmit).toHaveBeenCalledWith('order:new', order)
  })

  it('emit.orderStatus sends order:status to store room', async () => {
    const emit = await setupSocket()
    const data = { orderId: 'o3', status: 'PREPARING' }
    emit.orderStatus('store-1', data)
    expect(mockTo).toHaveBeenCalledWith('store:store-1')
    expect(mockEmit).toHaveBeenCalledWith('order:status', data)
  })

  it('emit.menuUpdated sends menu:updated to store room', async () => {
    const emit = await setupSocket()
    emit.menuUpdated('store-1')
    expect(mockTo).toHaveBeenCalledWith('store:store-1')
    expect(mockEmit).toHaveBeenCalledWith('menu:updated')
  })

  it('emit.itemStatus sends item:status to table room', async () => {
    const emit = await setupSocket()
    const data = { itemId: 'i1', status: 'DELIVERED' }
    emit.itemStatus('store-1', 'table-5', data)
    expect(mockTo).toHaveBeenCalledWith('table:store-1:table-5')
    expect(mockEmit).toHaveBeenCalledWith('item:status', data)
  })

  it('emit.orderScheduledAlert sends order:scheduled_alert to store room', async () => {
    const emit = await setupSocket()
    const data = { orderId: 'o4', scheduledFor: '2026-04-07T12:00:00Z' }
    emit.orderScheduledAlert('store-1', data)
    expect(mockTo).toHaveBeenCalledWith('store:store-1')
    expect(mockEmit).toHaveBeenCalledWith('order:scheduled_alert', data)
  })

  it('emit.cashFlowUpdated sends cashflow:updated to store room', async () => {
    const emit = await setupSocket()
    const data = { cashFlowId: 'cf1', status: 'OPEN' }
    emit.cashFlowUpdated('store-1', data)
    expect(mockTo).toHaveBeenCalledWith('store:store-1')
    expect(mockEmit).toHaveBeenCalledWith('cashflow:updated', data)
  })

  // ─── TASK-110: Conversation socket events ──────────────────────────────────
  it('emit.conversationUpdated sends conversation:updated to store room', async () => {
    const emit = await setupSocket()
    const data = { conversationId: 'conv-1', message: { role: 'CUSTOMER', content: 'Olá' } }
    emit.conversationUpdated('store-1', data)
    expect(mockTo).toHaveBeenCalledWith('store:store-1')
    expect(mockEmit).toHaveBeenCalledWith('conversation:updated', data)
  })

  it('emit.conversationTakeover sends conversation:takeover to store room', async () => {
    const emit = await setupSocket()
    const data = { conversationId: 'conv-1', isHumanMode: true }
    emit.conversationTakeover('store-1', data)
    expect(mockTo).toHaveBeenCalledWith('store:store-1')
    expect(mockEmit).toHaveBeenCalledWith('conversation:takeover', data)
  })

  it('emit.conversationReleased sends conversation:released to store room', async () => {
    const emit = await setupSocket()
    const data = { conversationId: 'conv-1', isHumanMode: false }
    emit.conversationReleased('store-1', data)
    expect(mockTo).toHaveBeenCalledWith('store:store-1')
    expect(mockEmit).toHaveBeenCalledWith('conversation:released', data)
  })

  it('does NOT send conversation events to wrong store room', async () => {
    const emit = await setupSocket()
    emit.conversationUpdated('store-A', { conversationId: 'conv-1' })
    expect(mockTo).not.toHaveBeenCalledWith('store:store-B')
    expect(mockTo).toHaveBeenCalledWith('store:store-A')
  })
})

describe('getIo', () => {
  it('throws when initSocket was not called', () => {
    jest.resetModules()
    const { getIo } = require('../socket')
    expect(() => getIo()).toThrow('Socket.io not initialized')
  })

  it('returns the io instance after initSocket', () => {
    jest.resetModules()
    const { initSocket, getIo } = require('../socket')
    initSocket({} as any)
    expect(getIo()).toBeDefined()
  })
})

describe('initSocket — room joining', () => {
  it('joins store room on connection when storeId is provided', () => {
    jest.resetModules()

    let connectionHandler: (socket: any) => void = () => {}
    const localIo = {
      to: mockTo,
      on: jest.fn().mockImplementation((event: string, handler: any) => {
        if (event === 'connection') connectionHandler = handler
      }),
    }
    jest.mock('socket.io', () => ({
      Server: jest.fn().mockReturnValue(localIo),
    }))

    const { initSocket } = require('../socket')
    initSocket({} as any)

    const socket = {
      id: 'socket-1',
      handshake: { auth: { storeId: 'store-abc' } },
      join: mockJoin,
      on: jest.fn(),
    }
    connectionHandler(socket)

    expect(mockJoin).toHaveBeenCalledWith('store:store-abc')
  })
})
