import { EventEmitter } from 'events'
import * as fs from 'fs'
import * as path from 'path'

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

const instances = new Map<string, WhatsAppInstance>()
const connecting = new Set<string>() // guard contra race condition
const emitter = new EventEmitter()

const SESSIONS_DIR = process.env.WHATSAPP_SESSIONS_DIR || path.join(process.cwd(), '.whatsapp-sessions')

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
    console.log(`[WhatsApp] Session cleared for storeId=${storeId}`)
  }
}

export function hasInstance(storeId: string): boolean {
  return instances.has(storeId)
}

export async function connectWhatsApp(storeId: string): Promise<void> {
  if (instances.has(storeId) || connecting.has(storeId)) return
  connecting.add(storeId)
  console.log(`[WhatsApp] connectWhatsApp called storeId=${storeId}`)

  ensureSessionsDir()

  let baileys: any
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    baileys = await (new Function('m', 'return import(m)'))('@whiskeysockets/baileys')
  } catch {
    console.log('[WhatsApp] Baileys not installed. Install @whiskeysockets/baileys to enable WhatsApp.')
    connecting.delete(storeId)
    return
  }

  const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestWaWebVersion } = baileys

  const sessionPath = path.join(SESSIONS_DIR, storeId)
  const { state, saveCreds } = await useMultiFileAuthState(sessionPath)

  const { version } = await fetchLatestWaWebVersion({})
  console.log(`[WhatsApp] WA Web version: ${version.join('.')}`)

  const { default: P } = await (new Function('m', 'return import(m)'))('pino')
  const logger = P({ level: 'silent' })

  let sock: any
  try {
    sock = makeWASocket({
      auth: state,
      version,
      printQRInTerminal: false,
      logger,
      browser: ['Menu Panda', 'Chrome', '131.0.0'],
      connectTimeoutMs: 30_000,
    })
    console.log('[WhatsApp] makeWASocket ok')
  } catch (err) {
    console.log(`[WhatsApp] makeWASocket threw: ${err}`)
    connecting.delete(storeId)
    return
  }

  const instance: WhatsAppInstance = { sock, qrCode: null, isConnected: false, storeId }
  instances.set(storeId, instance)
  connecting.delete(storeId)

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }: any) => {
    if (qr) {
      console.log(`[WhatsApp] QR received for storeId=${storeId}`)
      instance.qrCode = qr
      emitter.emit(`qr:${storeId}`, qr)
    }

    if (connection === 'open') {
      instance.isConnected = true
      instance.qrCode = null
      emitter.emit(`connected:${storeId}`)
      console.log(`[WhatsApp] Store ${storeId} CONNECTED ✓`)
    }

    if (connection === 'close') {
      const error = lastDisconnect?.error as any
      const statusCode = error?.output?.statusCode
      const isLoggedOut = statusCode === DisconnectReason.loggedOut
      const isBadSession = statusCode === DisconnectReason.badSession
      console.log(`[WhatsApp] connection CLOSE storeId=${storeId} statusCode=${statusCode} error="${error?.message}"`)

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
        console.log(`[WhatsApp] Self-message detectado, ignorando: ${replyJid}`)
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
          console.log(`[WhatsApp] LID→PN: ${replyJid} → ${pnJid}`)
          if (pnJid) phoneJid = pnJid
        } catch {
          // signalRepository pode não ter o mapeamento
        }
      }

      const from = normalizePhone(
        phoneJid.replace(/:.*$/, '').replace(/@.*$/, '')
      )
      if (!from) continue

      console.log(`[WhatsApp] MSG recebida: replyJid=${replyJid} from=${from}`)

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
          console.log(`[WhatsApp] Human mode active for ${from} — skipping auto-response`)
          continue
        }

        // 2. Resolver JID para envio via onWhatsApp (chamada de rede, pode demorar)
        let sendJid = replyJid
        try {
          const [result] = await sock.onWhatsApp(from)
          if (result?.exists && result.jid) {
            sendJid = result.jid
            console.log(`[WhatsApp] onWhatsApp resolveu: ${from} → ${sendJid}`)
            // Atualizar waJid salvo com o JID correto
            await prisma.conversation.update({
              where: { id: conversation.id },
              data: { waJid: sendJid },
            })
          }
        } catch {
          console.log(`[WhatsApp] onWhatsApp falhou, usando replyJid: ${replyJid}`)
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
        console.log(`[WhatsApp] isOpen=${isOpen} aiRecentCount=${aiRecentCount} storeId=${storeId}`)

        // Helper: enviar direto pelo sendJid (PN JID resolvido, não LID)
        const sendDirect = async (text: string) => {
          console.log(`[WhatsApp] sendDirect → jid=${sendJid} text="${text.slice(0, 50)}"`)
          try {
            await sock.sendMessage(sendJid, { text })
            console.log(`[WhatsApp] sendDirect OK → ${sendJid}`)
          } catch (err) {
            console.error(`[WhatsApp] sendDirect ERRO → ${sendJid}:`, err)
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
        console.error('[WhatsApp] Error handling incoming message:', err)
      }
    }
  })
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
    console.log('[WhatsApp] Could not read sessions dir, skipping restore')
    return
  }

  if (dirs.length === 0) {
    console.log('[WhatsApp] No saved sessions to restore')
    return
  }

  console.log(`[WhatsApp] Restoring ${dirs.length} saved session(s)...`)

  for (const storeId of dirs) {
    try {
      await connectWhatsApp(storeId)
    } catch (err) {
      console.log(`[WhatsApp] Failed to restore session for storeId=${storeId}: ${err}`)
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
  // Remove session files
  const sessionPath = path.join(SESSIONS_DIR, storeId)
  if (fs.existsSync(sessionPath)) {
    fs.rmSync(sessionPath, { recursive: true })
  }
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
  // No instance yet but session files exist on disk → about to reconnect
  if (!inst) {
    const sessionPath = path.join(SESSIONS_DIR, storeId)
    return fs.existsSync(sessionPath)
  }
  return false
}

/**
 * Resolve o JID correto para envio, com suporte a sessões LID (Baileys 7.x).
 *
 * Ordem de prioridade:
 * 1. waJid salvo na Conversation (JID real recebido pelo Baileys — pode ser LID)
 * 2. Resolução PN → LID via signalRepository (para contas migradas para LID)
 * 3. Fallback para JID de telefone normalizado
 *
 * Portado de personal-ai/apps/api/src/modules/whatsapp/notifier.ts
 */
async function resolveJid(sock: any, storeId: string, phone: string): Promise<string> {
  const normalized = normalizePhone(phone)
  const pnJid = phoneToJid(phone)

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
      return conversation.waJid
    }
  } catch {
    // não bloqueia se banco não responder
  }

  // 2. Resolver via onWhatsApp (consulta o backend do WhatsApp — mais confiável)
  try {
    const [result] = await sock.onWhatsApp(normalized)
    if (result?.exists && result.jid) {
      return result.jid
    }
  } catch {
    // onWhatsApp pode falhar por timeout de rede
  }

  // 3. Tentar resolver PN → LID via signalRepository
  try {
    const lidJid = await sock.signalRepository.lidMapping.getLIDForPN(pnJid)
    if (lidJid) {
      return lidJid
    }
  } catch {
    // signalRepository pode não estar disponível ou não ter o mapeamento
  }

  // 4. Fallback para JID de telefone normalizado
  return pnJid
}

export async function sendMessage(storeId: string, to: string, text: string): Promise<void> {
  const instance = instances.get(storeId)
  if (!instance?.isConnected || !instance.sock) {
    console.warn(`[WhatsApp] Store ${storeId} not connected. Message not sent to ${to}.`)
    return
  }

  try {
    const jid = await resolveJid(instance.sock, storeId, to)
    await instance.sock.sendMessage(jid, { text })
  } catch (err) {
    console.error(`[WhatsApp] Error sending to ${to}:`, err)
  }
}

/** Envia mensagem diretamente pelo JID (sem resolução de telefone).
 *  Portado do padrão personal-ai: sock.sendMessage(replyJid, { text }) */
export async function sendMessageDirect(storeId: string, jid: string, text: string): Promise<void> {
  const instance = instances.get(storeId)
  if (!instance?.isConnected || !instance.sock) {
    console.warn(`[WhatsApp] Store ${storeId} not connected. Message not sent to ${jid}.`)
    return
  }

  try {
    await instance.sock.sendMessage(jid, { text })
  } catch (err) {
    console.error(`[WhatsApp] Error sending direct to ${jid}:`, err)
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
    console.log(`[WhatsApp] isStoreOpenNow: no businessHours for day ${dayOfWeek} → closed`)
    return false
  }

  const [openH, openM] = (todayHours.openTime as string).split(':').map(Number)
  const [closeH, closeM] = (todayHours.closeTime as string).split(':').map(Number)
  const openMinutes = openH * 60 + openM
  const closeMinutes = closeH * 60 + closeM

  const result = currentMinutes >= openMinutes && currentMinutes < closeMinutes
  console.log(`[WhatsApp] isStoreOpenNow: day=${dayOfWeek} brt=${brt.getUTCHours()}:${String(brt.getUTCMinutes()).padStart(2,'0')} range=${todayHours.openTime}-${todayHours.closeTime} → ${result ? 'open' : 'closed'}`)
  return result
}
