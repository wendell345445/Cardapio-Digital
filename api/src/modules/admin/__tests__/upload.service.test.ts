// ─── TASK-042: Cloudinary Upload — Unit Tests ─────────────────────────────────

const mockUploadStream = jest.fn()

jest.mock('cloudinary', () => ({
  v2: {
    config: jest.fn(),
    uploader: {
      upload_stream: jest.fn((options: unknown, callback: Function) => {
        mockUploadStream(options, callback)
        return {
          end: (_buffer: Buffer) => {
            // Invoked synchronously during test setup via mockUploadStream
          },
        }
      }),
    },
  },
}))

import { uploadImage } from '../upload.service'

const makeFile = (mimetype: string, size = 1024): Express.Multer.File => ({
  mimetype,
  buffer: Buffer.alloc(size),
  fieldname: 'image',
  originalname: 'test.jpg',
  encoding: '7bit',
  size,
  destination: '',
  filename: '',
  path: '',
  stream: null as any,
})

beforeEach(() => jest.clearAllMocks())

// ─── Type validation ──────────────────────────────────────────────────────────

describe('uploadImage — type validation', () => {
  it('throws 422 for PDF files (tipo inválido)', async () => {
    const file = makeFile('application/pdf')

    await expect(uploadImage(file, 'store-1')).rejects.toMatchObject({ status: 422 })
  })

  it('throws 422 for GIF files', async () => {
    const file = makeFile('image/gif')

    await expect(uploadImage(file, 'store-1')).rejects.toMatchObject({ status: 422 })
  })

  it('throws 422 for text/plain files', async () => {
    const file = makeFile('text/plain')

    await expect(uploadImage(file, 'store-1')).rejects.toMatchObject({ status: 422 })
  })

  it('accepts image/jpeg', async () => {
    const { v2: cloudinary } = require('cloudinary')
    const mockStream = { end: jest.fn() }

    ;(cloudinary.uploader.upload_stream as jest.Mock).mockImplementation(
      (_opts: unknown, cb: Function) => {
        cb(null, { secure_url: 'https://res.cloudinary.com/img.jpg', public_id: 'supercardapio/store-1/products/img' })
        return mockStream
      }
    )

    const file = makeFile('image/jpeg')
    const result = await uploadImage(file, 'store-1')

    expect(result.url).toBe('https://res.cloudinary.com/img.jpg')
    expect(result.publicId).toContain('supercardapio')
  })

  it('accepts image/png', async () => {
    const { v2: cloudinary } = require('cloudinary')
    const mockStream = { end: jest.fn() }

    ;(cloudinary.uploader.upload_stream as jest.Mock).mockImplementation(
      (_opts: unknown, cb: Function) => {
        cb(null, { secure_url: 'https://res.cloudinary.com/img.png', public_id: 'supercardapio/store-1/products/img' })
        return mockStream
      }
    )

    const file = makeFile('image/png')
    const result = await uploadImage(file, 'store-1')

    expect(result.url).toBeDefined()
  })

  it('accepts image/webp', async () => {
    const { v2: cloudinary } = require('cloudinary')
    const mockStream = { end: jest.fn() }

    ;(cloudinary.uploader.upload_stream as jest.Mock).mockImplementation(
      (_opts: unknown, cb: Function) => {
        cb(null, { secure_url: 'https://res.cloudinary.com/img.webp', public_id: 'supercardapio/store-1/products/img' })
        return mockStream
      }
    )

    const file = makeFile('image/webp')
    const result = await uploadImage(file, 'store-1')

    expect(result.url).toBeDefined()
  })

  it('uploads to the correct storeId folder in Cloudinary', async () => {
    const { v2: cloudinary } = require('cloudinary')
    const mockStream = { end: jest.fn() }
    let capturedOptions: any

    ;(cloudinary.uploader.upload_stream as jest.Mock).mockImplementation(
      (opts: unknown, cb: Function) => {
        capturedOptions = opts
        cb(null, { secure_url: 'https://res.cloudinary.com/img.jpg', public_id: 'supercardapio/my-store/products/img' })
        return mockStream
      }
    )

    const file = makeFile('image/jpeg')
    await uploadImage(file, 'my-store')

    expect(capturedOptions.folder).toBe('supercardapio/my-store/products')
  })

  it('throws 500 when Cloudinary upload fails', async () => {
    const { v2: cloudinary } = require('cloudinary')
    const mockStream = { end: jest.fn() }

    ;(cloudinary.uploader.upload_stream as jest.Mock).mockImplementation(
      (_opts: unknown, cb: Function) => {
        cb(new Error('Cloudinary unavailable'), null)
        return mockStream
      }
    )

    const file = makeFile('image/jpeg')
    await expect(uploadImage(file, 'store-1')).rejects.toMatchObject({ status: 500 })
  })
})
