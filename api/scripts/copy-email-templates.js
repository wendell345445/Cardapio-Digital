#!/usr/bin/env node
/**
 * Copia os templates HTML/MD de e-mail de `src/shared/email/templates`
 * para `dist/shared/email/templates` após o build TypeScript.
 *
 * Necessário porque `tsc` só copia arquivos `.ts` — assets ficam de fora.
 * Executado automaticamente pelo script `build` do package.json.
 */
const fs = require('fs')
const path = require('path')

const SRC = path.join(__dirname, '..', 'src', 'shared', 'email', 'templates')
const DST = path.join(__dirname, '..', 'dist', 'shared', 'email', 'templates')

if (!fs.existsSync(SRC)) {
  console.error(`[copy-email-templates] source directory not found: ${SRC}`)
  process.exit(1)
}

fs.mkdirSync(DST, { recursive: true })

const files = fs.readdirSync(SRC).filter((f) => /\.(html|md)$/.test(f))
let copied = 0

for (const file of files) {
  fs.copyFileSync(path.join(SRC, file), path.join(DST, file))
  copied += 1
}

console.log(`[copy-email-templates] copied ${copied} file(s) to ${path.relative(process.cwd(), DST)}`)
