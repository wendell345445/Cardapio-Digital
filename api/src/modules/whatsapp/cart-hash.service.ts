// ─── TASK-072: Cart Hash Service ─────────────────────────────────────────────

export interface CartHashItem {
  productId: string
  variationId?: string
  qty: number
}

export function encodeCartHash(items: CartHashItem[]): string {
  const json = JSON.stringify(items)
  return Buffer.from(json).toString('base64url')
}

export function decodeCartHash(hash: string): CartHashItem[] | null {
  try {
    const json = Buffer.from(hash, 'base64url').toString('utf8')
    const parsed: unknown = JSON.parse(json)
    if (!Array.isArray(parsed)) return null
    return parsed as CartHashItem[]
  } catch {
    return null
  }
}
