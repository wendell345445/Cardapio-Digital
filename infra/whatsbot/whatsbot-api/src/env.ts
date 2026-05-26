function req(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`${name} ausente`)
  return v
}

function num(name: string, def: number): number {
  const v = process.env[name]
  return v ? Number(v) : def
}

export const env = {
  PORT: num('PORT', 3000),
  OLLAMA_URL: process.env.OLLAMA_URL ?? 'http://ollama:11434',
  OLLAMA_CHAT_MODEL: process.env.OLLAMA_CHAT_MODEL ?? 'llama3:8b',
  OLLAMA_EMBED_MODEL: process.env.OLLAMA_EMBED_MODEL ?? 'nomic-embed-text',
  DATABASE_URL: req('DATABASE_URL'),
  RAG_TOP_K: num('RAG_TOP_K', 5),
  RECENT_MSGS: num('RECENT_MSGS', 6),
  PROFILE_REFRESH_EVERY: num('PROFILE_REFRESH_EVERY', 20),
  MEMORY_RETENTION_DAYS: num('MEMORY_RETENTION_DAYS', 365),
}
