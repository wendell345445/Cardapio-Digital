#!/usr/bin/env node
// ─── E2E ao vivo — migração de billing Stripe → Asaas ─────────────────────────
// Roda contra o API LOCAL (:3001) + SANDBOX Asaas REAL. Exercita:
//   • Registro + trial local (cria Asaas customer de verdade)
//   • Checkout de cartão (cria Checkout hospedado no Asaas sandbox)
//   • Webhook Asaas: PAYMENT_RECEIVED/OVERDUE/REFUNDED + PIX_AUTOMATIC_* + guards
//   • PIX Automático bloqueado por permissão de conta (422)
//   • Guards de auth (sem token / token inválido / senha errada)
//
// Uso:  node scripts/e2e-asaas.mjs [runId]
//   runId opcional (default: timestamp) — torna o email da loja-fixture único por run.
//
// Design derivado de um workflow multi-agente (design + verificação adversarial)
// e ancorado no código real (contratos de resposta, guards, rate-limits).
//
// Convenções de contrato (lidas do fonte):
//   register-store → 201 top-level { accessToken, store:{ id, slug, trialEndsAt } }
//   login          → 200 { data:{ accessToken, user:{ role, storeId } } }
//   checkout       → 200 { url }   (body vazio; storeId vem do JWT)
//   erros          → { success:false, error:'<msg>' }   (campo `error`, não `message`)

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const API = 'http://localhost:3001/api/v1'
const PSQL_CONTAINER = 'menupanda_postgres'
const WEBHOOK_TOKEN = process.env.ASAAS_WEBHOOK_TOKEN || readEnvToken()
const runId = process.argv[2] || `t${process.hrtime.bigint() / 1000000n}`

// ─── infra de asserção ────────────────────────────────────────────────────────
let pass = 0, fail = 0, skip = 0
const fails = []
function ok(name, cond, detail = '') {
  if (cond) { pass++; console.log(`  ✅ ${name}`) }
  else { fail++; fails.push(name); console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`) }
}
function skipCase(name, why) { skip++; console.log(`  ⏭️  SKIP ${name} — ${why}`) }
function section(t) { console.log(`\n── ${t} ──`) }

function readEnvToken() {
  try {
    const env = readFileSync(new URL('../.env', import.meta.url), 'utf8')
    const m = env.match(/^ASAAS_WEBHOOK_TOKEN="?([^"\n]+)"?/m)
    return m ? m[1] : ''
  } catch { return '' }
}

async function http(method, path, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  let res
  try {
    res = await fetch(API + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  } catch (e) {
    return { status: 0, json: {}, netError: String(e) }
  }
  let json = {}
  try { json = await res.json() } catch { /* corpo vazio */ }
  return { status: res.status, json }
}
async function webhook(body, token = WEBHOOK_TOKEN) {
  const res = await fetch(API + '/webhooks/asaas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'asaas-access-token': token },
    body: JSON.stringify(body),
  })
  let json = {}
  try { json = await res.json() } catch { /* corpo vazio */ }
  return { status: res.status, json }
}
// psql: SQL como arg único (aspas simples externas no shell não são necessárias — execFileSync não passa por shell)
function db(sql) {
  return execFileSync('docker', ['exec', PSQL_CONTAINER, 'psql', '-U', 'postgres', '-d', 'menupanda', '-tAc', sql])
    .toString().trim()
}
function storeRow(id) {
  const raw = db(
    `SELECT status, COALESCE("asaasSubscriptionId",''), COALESCE("billingMethod"::text,''), ` +
    `COALESCE("trialEndsAt"::text,''), COALESCE("asaasPixAuthId",''), COALESCE("asaasCustomerId",'') ` +
    `FROM "Store" WHERE id='${id}'`
  )
  const [status, sub, method, trialEndsAt, pixAuthId, customerId] = raw.split('|')
  return { status, sub, method, trialEndsAt, pixAuthId, customerId }
}
function isRateLimited(r) {
  return r.status === 429 || /too many requests/i.test(r.json?.error || '')
}

// ─── FASE 0: registrar a loja-fixture (1 registro por run) ────────────────────
// register é rate-limited 5/h/IP e o login rotaciona a sessão; então registramos
// UMA vez e usamos o token do register direto pro resto do run.
async function setupFixture() {
  section('Fase 0 — registrar loja-fixture (trial local + Asaas customer real)')
  const email = `e2e.${runId}@menupanda-e2e.test`
  const t0 = Date.now()
  const reg = await http('POST', '/auth/register-store', {
    body: {
      storeName: `E2E ${runId}`,
      segment: 'PIZZERIA',
      email,
      password: 'senha-e2e-12345',
      confirmPassword: 'senha-e2e-12345',
      whatsapp: '11987654321',
      plan: 'PROFESSIONAL',
    },
  })
  if (isRateLimited(reg)) {
    console.log('\n⛔ register rate-limited (5/h/IP). Rode com outro runId daqui a pouco ou aguarde a janela.')
    process.exit(2)
  }
  ok('register-store → 201', reg.status === 201, `status ${reg.status} ${JSON.stringify(reg.json).slice(0, 200)}`)
  const token = reg.json.accessToken
  const store = reg.json.store || {}
  ok('register retorna accessToken', typeof token === 'string' && token.length > 20)
  ok('register retorna store.id (uuid)', /^[0-9a-f-]{36}$/.test(store.id || ''))
  ok('register retorna trialEndsAt', !!store.trialEndsAt)

  // Estado inicial no banco
  const row = storeRow(store.id)
  ok('loja nasce TRIAL', row.status === 'TRIAL', `status=${row.status}`)
  ok('asaasCustomerId criado no Asaas (cus_)', row.customerId.startsWith('cus_'), `customerId=${row.customerId || '(vazio)'}`)
  ok('asaasSubscriptionId ainda vazio', row.sub === '')
  // trialEndsAt ≈ now+7d (tolerância relativa a t0)
  const deltaDays = (new Date(store.trialEndsAt).getTime() - t0) / 86400000
  ok('trialEndsAt ≈ +7 dias', deltaDays > 6.9 && deltaDays < 7.1, `delta=${deltaDays.toFixed(3)}d`)

  return { token, storeId: store.id, email }
}

// ─── Bloco A: Checkout de cartão (Asaas sandbox real) ─────────────────────────
async function testCardCheckout(fx) {
  section('Bloco A — Checkout de cartão (cria Checkout real no Asaas)')
  const r = await http('POST', '/billing/checkout-session', { token: fx.token, body: {} })
  if (isRateLimited(r)) return skipCase('checkout-session', 'rate limited')
  ok('checkout-session → 200', r.status === 200, `status ${r.status} err=${r.json?.error || ''}`)
  const url = r.json?.url || ''
  ok('retorna { url } com "checkoutSession"', /checkoutSession/i.test(url), `url=${url}`)
  ok('url é domínio asaas.com', /asaas\.com/i.test(url), `url=${url}`)
  // asaasCheckoutId persistido
  const cid1 = db(`SELECT COALESCE("asaasCheckoutId",'') FROM "Store" WHERE id='${fx.storeId}'`)
  ok('asaasCheckoutId persistido', cid1 !== '', `checkoutId=${cid1}`)

  // Idempotência: 2ª chamada gera outro checkout id (POST /checkouts sempre cria novo)
  const r2 = await http('POST', '/billing/checkout-session', { token: fx.token, body: {} })
  if (!isRateLimited(r2)) {
    ok('2ª chamada → 200', r2.status === 200)
    const cid2 = db(`SELECT COALESCE("asaasCheckoutId",'') FROM "Store" WHERE id='${fx.storeId}'`)
    ok('2ª chamada cria novo checkout id', cid2 !== '' && cid2 !== cid1, `cid1=${cid1} cid2=${cid2}`)
  } else skipCase('checkout idempotência', 'rate limited')
}

// ─── Bloco B: Webhook cartão ──────────────────────────────────────────────────
// Cada caso mutante reseta o estado da loja via psql antes de rodar (isolamento).
async function testWebhookCard(fx) {
  section('Bloco B — Webhook cartão (PAYMENT_*)')
  const reset = (status, extra = '') =>
    db(`UPDATE "Store" SET status='${status}', "trialEndsAt"=NULL, "asaasSubscriptionId"=NULL, "billingMethod"=NULL${extra} WHERE id='${fx.storeId}'`)

  // W1 — token inválido → 401, sem efeito
  reset('TRIAL')
  const before = storeRow(fx.storeId)
  const w1 = await webhook({ event: 'PAYMENT_RECEIVED', payment: { id: 'pay_x', externalReference: fx.storeId } }, 'TOKEN_ERRADO')
  ok('W1 token inválido → 401', w1.status === 401)
  ok('W1 não mudou a loja', storeRow(fx.storeId).status === before.status)

  // W2 — PAYMENT_RECEIVED → ACTIVE + subscription + CARD
  reset('TRIAL')
  const w2 = await webhook({ event: 'PAYMENT_RECEIVED', payment: { id: 'pay_w2', externalReference: fx.storeId, subscription: 'sub_w2' } })
  ok('W2 → 200 {received:true}', w2.status === 200 && w2.json?.received === true)
  const a2 = storeRow(fx.storeId)
  ok('W2 loja → ACTIVE', a2.status === 'ACTIVE', `status=${a2.status}`)
  ok('W2 grava asaasSubscriptionId', a2.sub === 'sub_w2', `sub=${a2.sub}`)
  ok('W2 billingMethod = CARD', a2.method === 'CARD', `method=${a2.method}`)
  ok('W2 trialEndsAt zerado', a2.trialEndsAt === '')

  // W3 — PAYMENT_OVERDUE → grace (trialEndsAt futuro)
  reset('TRIAL')
  const tBefore = Date.now()
  const w3 = await webhook({ event: 'PAYMENT_OVERDUE', payment: { id: 'pay_w3', externalReference: fx.storeId } })
  ok('W3 → 200', w3.status === 200)
  const a3 = storeRow(fx.storeId)
  ok('W3 seta trialEndsAt (grace)', a3.trialEndsAt !== '', `trialEndsAt=${a3.trialEndsAt}`)
  if (a3.trialEndsAt) {
    // GRACE_PERIOD_DAYS=0 em dev → grace ≈ agora; aceitamos qualquer data >= tBefore-2s
    const graceMs = new Date(a3.trialEndsAt).getTime()
    ok('W3 grace >= momento do request', graceMs >= tBefore - 2000, `grace=${a3.trialEndsAt}`)
  }

  // W4 — PAYMENT_REFUNDED → SUSPENDED
  reset('ACTIVE')
  const w4 = await webhook({ event: 'PAYMENT_REFUNDED', payment: { id: 'pay_w4', externalReference: fx.storeId } })
  ok('W4 → 200', w4.status === 200)
  ok('W4 loja → SUSPENDED', storeRow(fx.storeId).status === 'SUSPENDED')

  // W5 — loja inexistente → 200 {received:true}, sem efeito
  reset('TRIAL')
  const ghost = '00000000-0000-4000-8000-000000000000'
  const w5 = await webhook({ event: 'PAYMENT_RECEIVED', payment: { id: 'pay_w5', externalReference: ghost, subscription: 'sub_ghost' } })
  ok('W5 loja fantasma → 200 {received:true}', w5.status === 200 && w5.json?.received === true)
  ok('W5 fixture intacta (TRIAL)', storeRow(fx.storeId).status === 'TRIAL')

  // W6 — evento desconhecido → 200 no-op
  reset('TRIAL')
  const w6 = await webhook({ event: 'PAYMENT_CHECKOUT_VIEWED', payment: { id: 'pay_w6', externalReference: fx.storeId } })
  ok('W6 evento desconhecido → 200 no-op', w6.status === 200 && storeRow(fx.storeId).status === 'TRIAL')
}

// ─── Bloco C: Webhook PIX Automático ──────────────────────────────────────────
async function testWebhookPixAuto(fx) {
  section('Bloco C — Webhook PIX Automático')
  // vincula um asaasPixAuthId à fixture pra o match por authorization.id funcionar
  const authId = `auth_e2e_${runId}`
  db(`UPDATE "Store" SET status='TRIAL', "asaasPixAuthId"='${authId}', "billingMethod"=NULL WHERE id='${fx.storeId}'`)

  const c1 = await webhook({ event: 'PIX_AUTOMATIC_RECURRING_AUTHORIZATION_ACTIVATED', authorization: { id: authId, status: 'ACTIVE' } })
  ok('C1 ACTIVATED → 200', c1.status === 200)
  const a1 = storeRow(fx.storeId)
  ok('C1 loja → ACTIVE', a1.status === 'ACTIVE', `status=${a1.status}`)
  ok('C1 billingMethod = PIX_AUTO', a1.method === 'PIX_AUTO', `method=${a1.method}`)

  db(`UPDATE "Store" SET status='ACTIVE' WHERE id='${fx.storeId}'`)
  const c2 = await webhook({ event: 'PIX_AUTOMATIC_RECURRING_AUTHORIZATION_CANCELLED', authorization: { id: authId } })
  ok('C2 CANCELLED → 200', c2.status === 200)
  ok('C2 loja → SUSPENDED', storeRow(fx.storeId).status === 'SUSPENDED')

  // limpa o pixAuthId pra não interferir noutros runs
  db(`UPDATE "Store" SET "asaasPixAuthId"=NULL, status='TRIAL' WHERE id='${fx.storeId}'`)
}

// ─── Bloco D: PIX Automático (bloqueado por permissão de conta) ───────────────
async function testPixAutoBlocked(fx) {
  section('Bloco D — PIX Automático real (bloqueado: conta sem permissão)')
  const before = storeRow(fx.storeId)
  const r = await http('POST', '/billing/pix-auto', { token: fx.token, body: {} })
  if (isRateLimited(r)) return skipCase('pix-auto', 'rate limited')
  ok('pix-auto → 422 (sem permissão na conta)', r.status === 422, `status ${r.status}`)
  ok('mensagem menciona permissão', /permiss/i.test(r.json?.error || ''), `error=${r.json?.error}`)
  // não deixou a loja inconsistente (status inalterado)
  ok('loja não mudou de status', storeRow(fx.storeId).status === before.status)
}

// ─── Bloco E: Guards de auth ──────────────────────────────────────────────────
async function testAuthGuards(fx) {
  section('Bloco E — Guards de autenticação')
  const g1 = await http('POST', '/billing/checkout-session', { body: {} }) // sem token
  if (isRateLimited(g1)) skipCase('guard sem auth', 'rate limited')
  else {
    ok('sem Authorization → 401', g1.status === 401, `status ${g1.status}`)
    ok('erro = Unauthorized', g1.json?.error === 'Unauthorized', `error=${g1.json?.error}`)
  }

  const g2 = await http('POST', '/billing/checkout-session', { token: 'garbage.token.xyz', body: {} })
  if (isRateLimited(g2)) skipCase('guard token lixo', 'rate limited')
  else {
    ok('Bearer lixo → 401', g2.status === 401, `status ${g2.status}`)
    ok('erro = Invalid or expired token', g2.json?.error === 'Invalid or expired token', `error=${g2.json?.error}`)
  }

  const g3 = await http('POST', '/auth/login', { body: { email: fx.email, password: 'senha-errada' } })
  if (isRateLimited(g3)) skipCase('login senha errada', 'rate limited')
  else {
    ok('login senha errada → 401', g3.status === 401, `status ${g3.status}`)
    ok('erro = Credenciais inválidas', g3.json?.error === 'Credenciais inválidas', `error=${g3.json?.error}`)
  }

  // email duplicado no register → 422 (guard roda antes de tocar o Asaas)
  const g4 = await http('POST', '/auth/register-store', {
    body: {
      storeName: 'Dup', segment: 'OTHER', email: fx.email,
      password: 'senha-e2e-12345', confirmPassword: 'senha-e2e-12345',
      whatsapp: '11987654321', plan: 'PROFESSIONAL',
    },
  })
  if (isRateLimited(g4)) skipCase('email duplicado', 'rate limited')
  else ok('email duplicado → 422', g4.status === 422, `status ${g4.status} error=${g4.json?.error}`)
}

// ─── runner ───────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🧪 E2E Asaas — runId=${runId}  api=${API}`)
  if (!WEBHOOK_TOKEN) { console.log('⛔ ASAAS_WEBHOOK_TOKEN não encontrado (env ou api/.env).'); process.exit(2) }
  // health
  try {
    const h = await fetch('http://localhost:3001/health')
    if (h.status !== 200) throw new Error('status ' + h.status)
  } catch (e) {
    console.log(`⛔ API local não respondeu em :3001/health (${e}). Suba com: npm run dev -w api`)
    process.exit(2)
  }

  const fx = await setupFixture()
  await testCardCheckout(fx)
  await testWebhookCard(fx)
  await testWebhookPixAuto(fx)
  await testPixAutoBlocked(fx)
  await testAuthGuards(fx)

  console.log(`\n${'═'.repeat(48)}`)
  console.log(`RESUMO: ${pass} passaram · ${fail} falharam · ${skip} pulados`)
  if (fail) console.log('FALHAS:\n  - ' + fails.join('\n  - '))
  console.log('═'.repeat(48))
  process.exit(fail ? 1 : 0)
}

main().catch((e) => { console.error('erro fatal no E2E:', e); process.exit(3) })
