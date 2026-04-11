import { z } from 'zod'

// ─── TASK-060: Menu Público ───────────────────────────────────────────────────

export const menuParamsSchema = z.object({
  slug: z.string().min(1).max(100),
})

export type MenuParamsInput = z.infer<typeof menuParamsSchema>
