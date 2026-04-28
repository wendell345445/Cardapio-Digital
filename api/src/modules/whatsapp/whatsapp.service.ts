import { EventEmitter } from 'events'
import * as fs from 'fs'
import * as path from 'path'

import { logger } from '../../shared/logger/logger'
import { prisma } from '../../shared/prisma/prisma'
import { emit } from '../../shared/socket/socket'
import { normalizePhone, phoneToJid } from '../../shared/utils/phone'

// ─── TASK-070: WhatsApp Baileys Setup ────────────────────────────────────────

interface WhatsAppInstance {
  sock: any
  qrCode: string | null
  isConnected: boolean
  storeId: string
}

// Resultado tipado do envio. Worker da fila usa `reason` pra decidir retry/descarte.
export type SendResult =
  | { ok: true; jid: string }
  | {
      ok: false
      reason: 'not_configured' | 'reconnecting' | 'invalid_number' | 'send_error' | 'send_timeout'
      error?: string
    }

const instances = new Map<string, WhatsAppInstance>()
const connecting = new Set<string>() // guard contra race condition
const emitter = new EventEmitter()

// Cache em memória pra resolveJid (evita round-trips repetidos em broadcasts).
// Chave = `${storeId}:${phoneNormalizado}`, TTL 10 min.
const JID_CACHE_TTL_MS = 10 * 60 * 1000
const jidCache = new Map<string, { jid: string; expiresAt: number }>()

const SESSIONS_DIR = process.env.WHATSAPP_SESSIONS_DIR || path.join(process.cwd(), '.whatsapp-sessions')
const SEND_TIMEOUT_MS = 10_000
const ONWHATSAPP_TIMEOUT_MS = 3_000

function withTimeout<T>(promise: Promise<T>, ms: number, tag: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(tag)), ms)),
  ])
}

/** Replaces all {{var}} placeholders in a template. Unknown vars are removed. */
function applyTemplateVars(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '')
}

function ensureSessionsDir() {
  if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true })
  }
}

function clearSession(storeId: string) {
  const sessionPath = path.join(SESSIONS_DIR, storeId)
  if (fs.existsSync(sessionPath)) {
    fs.rmSync(sessionPath, { recursive: true })
    logger.info({ storeId }, '[WhatsApp] Session cleared')
  }
}

export function hasInstance(storeId: string): boolean {
  return instances.has(storeId)
}

export async function connectWhatsApp(storeId: string): Promise<void> {
  // Idempotência: se já conectado ou em conexão, noop (protege contra race no boot + admin abrindo QR)
  const existing = instances.get(storeId)
  if (existing?.isConnected) {
    logger.info({ storeId }, '[WhatsApp] connectWhatsApp: já conectado, noop')
    return
  }
  if (existing) {
    logger.info({ storeId }, '[WhatsApp] connectWhatsApp: instância aguardando connection.update, noop')
    return
  }
  if (connecting.has(storeId)) {
    logger.info({ storeId }, '[WhatsApp] connectWhatsApp: já em setup, noop')
    return
  }

  connecting.add(storeId)
  logger.info({ storeId }, '[WhatsApp] connectWhatsApp start')

  try {
    ensureSessionsDir()

    let baileys: any
    try {
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      baileys = await (new Function('m', 'return import(m)'))('@whiskeysockets/baileys')
    } catch {
      logger.warn('[WhatsApp] Baileys not installed. Install @whiskeysockets/baileys to enable WhatsApp.')
      return
    }

    const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestWaWebVersion } = baileys

    const sessionPath = path.join(SESSIONS_DIR, storeId)
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath)

    const { version } = await fetchLatestWaWebVersion({})
    logger.info({ storeId, version: version.join('.') }, '[WhatsApp] WA Web version')

    const { default: P } = await (new Function('m', 'return import(m)'))('pino')
    const baileysLogger = P({ level: 'silent' })

    const sock: any = makeWASocket({
      auth: state,
      version,
      printQRInTerminal: false,
      logger: baileysLogger,
      browser: ['Menu Panda', 'Chrome', '131.0.0'],
      connectTimeoutMs: 30_000,
      keepAliveIntervalMs: 10_000, // detecta perda de rede mais rápido que default 30s
    })
    logger.info({ storeId }, '[WhatsApp] makeWASocket ok')

    const instance: WhatsAppInstance = { sock, qrCode: null, isConnected: false, storeId }
    instances.set(storeId, instance)

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }: any) => {
      if (qr) {
        logger.info({ storeId }, '[WhatsApp] QR received')
        instance.qrCode = qr
        emitter.emit(`qr:${storeId}`, qr)
      }

      if (connection === 'open') {
        instance.isConnected = true
        instance.qrCode = null
        emitter.emit(`connected:${storeId}`)
        logger.info({ storeId }, '[WhatsApp] CONNECTED')
      }

      if (connection === 'close') {
        const error = lastDisconnect?.error as any
        const statusCode = error?.output?.statusCode
        const isLoggedOut = statusCode === DisconnectReason.loggedOut
        const isBadSession = statusCode === DisconnectReason.badSession
        logger.warn(
          { storeId, statusCode, errorMessage: error?.message },
          '[WhatsApp] connection CLOSE'
        )

        instance.isConnected = false
        instance.qrCode = null
        emitter.emit(`disconnected:${storeId}`)
        instances.delete(storeId)

        if (isLoggedOut || isBadSession) {
          // Sessão inválida ou usuário saiu: limpa sessão mas não reconecta automaticamente
          clearSession(storeId)
        } else {
          // Desconexão normal (timeout, rede, etc): reconecta preservando a sessão
          setTimeout(() => connectWhatsApp(storeId), 5_000)
        }
      }
    })

    // Incoming messages — IA handler + conversation tracking
    sock.ev.on('messages.upsert', async ({ messages: msgs, type }: any) => {
      if (type !== 'notify') return

      // JID do próprio bot para guard contra self-messaging
      const meJid = sock.user?.id ?? ''
      const mePhone = meJid.replace(/:.*$/, '').replace(/@.*$/, '')

      for (const msg of msgs as any[]) {
        if (msg.key.fromMe) continue

        // JID original para reply (pode ser LID @lid ou PN @s.whatsapp.net)
        const replyJid: string = msg.key.remoteJid ?? ''
        if (!replyJid) continue

        // Ignorar mensagens de grupo (portado de personal-ai/handler.ts)
        if (replyJid.endsWith('@g.us')) continue

        // Guard: ignorar mensagens do próprio bot (evita self-messaging loop)
        const replyPhone = replyJid.replace(/:.*$/, '').replace(/@.*$/, '')
        if (mePhone && replyPhone === mePhone) {
          logger.debug({ storeId, replyJid }, '[WhatsApp] Self-message ignorada')
          continue
        }

        const text: string | undefined =
          msg.message?.conversation || msg.message?.extendedTextMessage?.text
        if (!text?.trim()) continue

        // Resolver LID → PN para identificar o telefone do cliente
        let phoneJid = replyJid
        if (replyJid.endsWith('@lid')) {
          try {
            const pnJid = await sock.signalRepository.lidMapping.getPNForLID(replyJid)
            logger.debug({ storeId, replyJid, pnJid }, '[WhatsApp] LID→PN')
            if (pnJid) phoneJid = pnJid
          } catch {
            // signalRepository pode não ter o mapeamento
          }
        }

        const from = normalizePhone(
          phoneJid.replace(/:.*$/, '').replace(/@.*$/, '')
        )
        if (!from) continue

        logger.info({ storeId, replyJid, from }, '[WhatsApp] MSG recebida')

        try {
          // 1. Salvar mensagem + emitir para admin IMEDIATAMENTE (sem esperar onWhatsApp)
          const pushName: string | undefined = msg.pushName
          const conversation = await prisma.conversation.upsert({
            where: { storeId_customerPhone: { storeId, customerPhone: from } },
            create: { storeId, customerPhone: from, customerName: pushName ?? null, waJid: replyJid },
            update: { updatedAt: new Date(), ...(pushName ? { customerName: pushName } : {}) },
          })

          const savedMsg = await prisma.conversationMessage.create({
            data: { conversationId: conversation.id, role: 'CUSTOMER', content: text },
          })

          emit.conversationUpdated(storeId, {
            conversationId: conversation.id,
            message: savedMsg,
          })

          // Se modo humano → não responder automaticamente
          if (conversation.isHumanMode) {
            logger.info({ storeId, from }, '[WhatsApp] Human mode active — skipping auto-response')
            continue
          }

          // TASK-130: opt-in para notificações de pedido — antes de tudo
          try {
            const { tryHandleOptIn } = await import('./opt-in.service')
            const handled = await tryHandleOptIn(storeId, from, text)
            if (handled) {
              logger.info({ storeId, from }, '[WhatsApp] Opt-in de pedido processado')
              continue
            }
          } catch (err) {
            logger.error({ storeId, err }, '[WhatsApp] Erro no opt-in handler')
          }

          // 2. Resolver JID para envio via onWhatsApp (chamada de rede, pode demorar)
          let sendJid = replyJid
          try {
            const results = await withTimeout<Array<{ exists?: boolean; jid?: string }>>(
              sock.onWhatsApp(from),
              ONWHATSAPP_TIMEOUT_MS,
              'onWhatsApp_timeout'
            )
            const [result] = results
            if (result?.exists && result.jid) {
              sendJid = result.jid
              logger.debug({ storeId, from, sendJid }, '[WhatsApp] onWhatsApp resolveu')
              // Atualizar waJid salvo com o JID correto
              await prisma.conversation.update({
                where: { id: conversation.id },
                data: { waJid: sendJid },
              })
            }
          } catch {
            logger.debug({ storeId, replyJid }, '[WhatsApp] onWhatsApp falhou, usando replyJid')
          }

          // Buscar loja + contagem de msgs de IA/Agente na última hora
          const since = new Date(Date.now() - 60 * 60 * 1000) // 1h atrás
          const [store, aiRecentCount] = await Promise.all([
            prisma.store.findUnique({
              where: { id: storeId },
              select: { slug: true, name: true, businessHours: true },
            }),
            prisma.conversationMessage.count({
              where: {
                conversationId: conversation.id,
                role: { in: ['AI', 'AGENT'] },
                createdAt: { gte: since },
              },
            }),
          ])
          if (!store) continue

          const isOpen = isStoreOpenNow(store)
          logger.debug({ storeId, isOpen, aiRecentCount }, '[WhatsApp] incoming routing')

          // Helper: enviar direto pelo sendJid (PN JID resolvido, não LID)
          const sendDirect = async (msgText: string) => {
            logger.debug({ storeId, sendJid, preview: msgText.slice(0, 50) }, '[WhatsApp] sendDirect')
            try {
              await withTimeout(sock.sendMessage(sendJid, { text: msgText }), SEND_TIMEOUT_MS, 'send_timeout')
              logger.debug({ storeId, sendJid }, '[WhatsApp] sendDirect OK')
            } catch (err) {
              logger.error({ storeId, sendJid, err }, '[WhatsApp] sendDirect ERRO')
            }
          }

          if (!isOpen) {
            const { getTemplate } = await import('../admin/whatsapp-messages.service')
            const absenceTemplate = await getTemplate(storeId, 'ABSENCE')
            const absenceMsg = applyTemplateVars(absenceTemplate, { loja: store.name, horario: 'consulte nosso perfil' })
            await sendDirect(absenceMsg)
            const savedAbsence = await prisma.conversationMessage.create({
              data: { conversationId: conversation.id, role: 'AI', content: absenceMsg },
            })
            emit.conversationUpdated(storeId, { conversationId: conversation.id, message: savedAbsence })
            continue
          }

          // Enviar GREETING se não foi enviada msg de IA/Agente na última hora
          if (aiRecentCount === 0) {
            const { getTemplate } = await import('../admin/whatsapp-messages.service')
            const greetingTemplate = await getTemplate(storeId, 'GREETING')
            const greetingMsg = applyTemplateVars(greetingTemplate, { loja: store.name })
            await sendDirect(greetingMsg)
            const savedGreeting = await prisma.conversationMessage.create({
              data: { conversationId: conversation.id, role: 'AI', content: greetingMsg },
            })
            emit.conversationUpdated(storeId, { conversationId: conversation.id, message: savedGreeting })
          }

          // Passar para AI handler (passa replyJid para envio direto como personal-ai)
          const { handleIncomingMessage } = await import('./ai-handler.service')
          if (store.slug) {
            await handleIncomingMessage(storeId, from, text, store.slug, conversation.id, sendJid)
          }
        } catch (err) {
          logger.error({ storeId, err }, '[WhatsApp] Error handling incoming message')
        }
      }
    })
  } catch (err) {
    logger.error({ storeId, err }, '[WhatsApp] connectWhatsApp failed')
    throw err
  } finally {
    connecting.delete(storeId)
  }
}

/**
 * Restaura todas as sessões WhatsApp salvas em disco ao iniciar o servidor.
 * Lê os diretórios em SESSIONS_DIR (cada subpasta = storeId) e chama connectWhatsApp().
 * Sessões válidas reconectam automaticamente sem precisar escanear QR de novo.
 */
export async function restoreAllSessions(): Promise<void> {
  ensureSessionsDir()

  let dirs: string[]
  try {
    dirs = fs.readdirSync(SESSIONS_DIR).filter((entry) => {
      const fullPath = path.join(SESSIONS_DIR, entry)
      return fs.statSync(fullPath).isDirectory()
    })
  } catch {
    logger.warn('[WhatsApp] Could not read sessions dir, skipping restore')
    return
  }

  if (dirs.length === 0) {
    logger.info('[WhatsApp] No saved sessions to restore')
    return
  }

  logger.info({ count: dirs.length }, '[WhatsApp] Restoring saved sessions')

  for (const storeId of dirs) {
    // Pasta vazia (sem creds.json) = sessão abandonada, não tenta restaurar.
    // Seria inútil: sem credenciais, só serviria pra pedir novo QR.
    if (!hasValidSessionOnDisk(storeId)) {
      logger.info({ storeId }, '[WhatsApp] skip restore — session folder exists but has no creds.json')
      continue
    }
    try {
      await connectWhatsApp(storeId)
    } catch (err) {
      logger.error({ storeId, err }, '[WhatsApp] Failed to restore session')
    }
  }
}

export async function disconnectWhatsApp(storeId: string): Promise<void> {
  const instance = instances.get(storeId)
  if (!instance) return
  try {
    await instance.sock?.logout()
  } catch { /* ignore */ }
  instances.delete(storeId)
  // Invalidar cache de JID dessa loja
  for (const key of jidCache.keys()) {
    if (key.startsWith(`${storeId}:`)) jidCache.delete(key)
  }
  // Remove session files
  const sessionPath = path.join(SESSIONS_DIR, storeId)
  if (fs.existsSync(sessionPath)) {
    fs.rmSync(sessionPath, { recursive: true })
  }
  logger.info({ storeId }, '[WhatsApp] disconnectWhatsApp done')
}

export function getQrCode(storeId: string): string | null {
  return instances.get(storeId)?.qrCode ?? null
}

export function isConnected(storeId: string): boolean {
  return instances.get(storeId)?.isConnected ?? false
}

/** True when session files exist on disk and socket is still reconnecting (not yet open, no QR) */
export function isReconnecting(storeId: string): boolean {
  if (connecting.has(storeId)) return true
  const inst = instances.get(storeId)
  if (inst && !inst.isConnected && !inst.qrCode) {
    // Instance created, awaiting connection.update → 'open'
    return true
  }
  // No instance yet but VALID session files exist on disk → about to reconnect.
  // Pasta vazia (sem creds.json) não conta — é sessão "abandonada" que precisa novo QR.
  if (!inst) {
    return hasValidSessionOnDisk(storeId)
  }
  return false
}

/**
 * Erro específico para distinguir "número não existe no WhatsApp" de outros failures.
 * Worker da fila descarta o job sem retry quando vê essa mensagem.
 */
class InvalidWhatsAppNumberError extends Error {
  constructor(phone: string) {
    super(`invalid_number:${phone}`)
    this.name = 'InvalidWhatsAppNumberError'
  }
}

/**
 * Resolve o JID correto para envio, com suporte a sessões LID (Baileys 7.x).
 *
 * Ordem de prioridade:
 * 1. Cache in-memory (TTL 10min) — evita round-trips em broadcasts
 * 2. waJid salvo na Conversation (JID real recebido pelo Baileys — pode ser LID)
 * 3. onWhatsApp com timeout de 3s; se retornar exists:false, lança InvalidWhatsAppNumberError
 * 4. signalRepository PN → LID (para contas migradas)
 * 5. Fallback para JID de telefone normalizado
 *
 * Portado de personal-ai/apps/api/src/modules/whatsapp/notifier.ts
 */
async function resolveJid(sock: any, storeId: string, phone: string): Promise<string> {
  const normalized = normalizePhone(phone)
  const pnJid = phoneToJid(phone)
  const cacheKey = `${storeId}:${normalized}`

  // 0. Cache hit
  const cached = jidCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.jid
  }
  if (cached) jidCache.delete(cacheKey)

  const rememberJid = (jid: string) => {
    jidCache.set(cacheKey, { jid, expiresAt: Date.now() + JID_CACHE_TTL_MS })
    return jid
  }

  // 1. Buscar waJid salvo na Conversation (JID real do Baileys)
  try {
    const conversation = await prisma.conversation.findFirst({
      where: {
        storeId,
        customerPhone: { in: [phone, normalized, normalized.replace(/^55/, '')] },
      },
      select: { waJid: true },
    })
    if (conversation?.waJid) {
      return rememberJid(conversation.waJid)
    }
  } catch {
    // não bloqueia se banco não responder
  }

  // 2. Resolver via onWhatsApp (com timeout — backend do WhatsApp pode demorar)
  try {
    const results = await withTimeout(sock.onWhatsApp(normalized), ONWHATSAPP_TIMEOUT_MS, 'onWhatsApp_timeout')
    const [result] = results as Array<{ exists?: boolean; jid?: string }>
    if (result) {
      if (result.exists === false) {
        // Número não está no WhatsApp — não adianta tentar retry
        throw new InvalidWhatsAppNumberError(phone)
      }
      if (result.exists && result.jid) {
        return rememberJid(result.jid)
      }
    }
  } catch (err) {
    if (err instanceof InvalidWhatsAppNumberError) throw err
    // onWhatsApp timeout / rede: segue para os próximos passos
  }

  // 3. Tentar resolver PN → LID via signalRepository
  try {
    const lidJid = await sock.signalRepository.lidMapping.getLIDForPN(pnJid)
    if (lidJid) {
      return rememberJid(lidJid)
    }
  } catch {
    // signalRepository pode não estar disponível ou não ter o mapeamento
  }

  // 4. Fallback para JID de telefone normalizado
  return pnJid
}

type SendFailure = Extract<SendResult, { ok: false }>

/**
 * Distingue "loja com sessão válida em reconexão" de "loja sem credenciais".
 * A pasta `.whatsapp-sessions/<storeId>/` pode existir vazia quando o admin abriu
 * o QR mas não escaneou — nesse caso `reconnecting` é enganoso, pois não há como
 * reconectar sem novo QR. Checamos o arquivo `creds.json` pra confirmar.
 */
function hasValidSessionOnDisk(storeId: string): boolean {
  const sessionPath = path.join(SESSIONS_DIR, storeId)
  if (!fs.existsSync(sessionPath)) return false
  try {
    const credsPath = path.join(sessionPath, 'creds.json')
    if (!fs.existsSync(credsPath)) return false
    // creds.json vazio também é sessão inválida
    const stat = fs.statSync(credsPath)
    return stat.size > 0
  } catch {
    return false
  }
}

function classifyInstanceState(storeId: string): SendFailure | null {
  const instance = instances.get(storeId)
  if (!instance) {
    return { ok: false, reason: hasValidSessionOnDisk(storeId) ? 'reconnecting' : 'not_configured' }
  }
  if (!instance.isConnected || !instance.sock) {
    return { ok: false, reason: 'reconnecting' }
  }
  return null
}

export async function sendMessage(storeId: string, to: string, text: string): Promise<SendResult> {
  const stateFailure = classifyInstanceState(storeId)
  if (stateFailure) {
    logger.warn({ storeId, to, reason: stateFailure.reason }, '[WhatsApp] sendMessage abortado (instância)')
    return stateFailure
  }

  const instance = instances.get(storeId)!
  try {
    const jid = await resolveJid(instance.sock, storeId, to)

    // Re-check: socket pode ter morrido entre o get inicial e agora
    const current = instances.get(storeId)
    if (!current?.isConnected || current.sock !== instance.sock) {
      logger.warn({ storeId, to }, '[WhatsApp] sendMessage: socket trocado durante resolveJid, abort')
      return { ok: false, reason: 'reconnecting' }
    }

    await withTimeout(instance.sock.sendMessage(jid, { text }), SEND_TIMEOUT_MS, 'send_timeout')
    return { ok: true, jid }
  } catch (err) {
    if (err instanceof InvalidWhatsAppNumberError) {
      return { ok: false, reason: 'invalid_number', error: err.message }
    }
    const msg = (err as Error).message
    if (msg === 'send_timeout') {
      return { ok: false, reason: 'send_timeout', error: msg }
    }
    logger.error({ storeId, to, err }, '[WhatsApp] sendMessage erro')
    return { ok: false, reason: 'send_error', error: msg }
  }
}

/** Envia mensagem diretamente pelo JID (sem resolução de telefone).
 *  Portado do padrão personal-ai: sock.sendMessage(replyJid, { text }) */
export async function sendMessageDirect(storeId: string, jid: string, text: string): Promise<SendResult> {
  const stateFailure = classifyInstanceState(storeId)
  if (stateFailure) {
    logger.warn({ storeId, jid, reason: stateFailure.reason }, '[WhatsApp] sendMessageDirect abortado')
    return stateFailure
  }

  const instance = instances.get(storeId)!
  try {
    await withTimeout(instance.sock.sendMessage(jid, { text }), SEND_TIMEOUT_MS, 'send_timeout')
    return { ok: true, jid }
  } catch (err) {
    const msg = (err as Error).message
    if (msg === 'send_timeout') return { ok: false, reason: 'send_timeout', error: msg }
    logger.error({ storeId, jid, err }, '[WhatsApp] sendMessageDirect erro')
    return { ok: false, reason: 'send_error', error: msg }
  }
}

export { emitter as whatsappEmitter }

// ─── TASK-104: Helper — verifica se a loja está dentro do horário de funcionamento ──
// Nota: manualOpen é abertura de caixa (pedidos), NÃO afeta WhatsApp.
// WhatsApp usa apenas businessHours para decidir GREETING vs ABSENCE.
function isStoreOpenNow(store: {
  businessHours: Array<{ dayOfWeek: number; isClosed: boolean; openTime: string | null; closeTime: string | null }>
}): boolean {
  // Converter UTC → BRT (UTC-3) para comparar com horários cadastrados
  const now = new Date()
  const brtMs = now.getTime() - 3 * 60 * 60 * 1000
  const brt = new Date(brtMs)
  const dayOfWeek = brt.getUTCDay() // 0=Dom, 1=Seg...
  const currentMinutes = brt.getUTCHours() * 60 + brt.getUTCMinutes()

  const todayHours = store.businessHours?.find(h => h.dayOfWeek === dayOfWeek && !h.isClosed)
  if (!todayHours) {
    logger.debug({ dayOfWeek }, '[WhatsApp] isStoreOpenNow: no businessHours → closed')
    return false
  }

  const [openH, openM] = (todayHours.openTime as string).split(':').map(Number)
  const [closeH, closeM] = (todayHours.closeTime as string).split(':').map(Number)
  const openMinutes = openH * 60 + openM
  const closeMinutes = closeH * 60 + closeM

  const result = currentMinutes >= openMinutes && currentMinutes < closeMinutes
  logger.debug(
    {
      dayOfWeek,
      brtHour: `${brt.getUTCHours()}:${String(brt.getUTCMinutes()).padStart(2, '0')}`,
      openTime: todayHours.openTime,
      closeTime: todayHours.closeTime,
      open: result,
    },
    '[WhatsApp] isStoreOpenNow'
  )
  return result
}
