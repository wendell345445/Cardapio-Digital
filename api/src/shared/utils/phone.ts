/**
 * Normaliza um número de telefone para o formato brasileiro sem formatação.
 * Aceita qualquer entrada: "+5548999990001", "5548999990001", "48999990001", "(48) 9999-0001"
 * Retorna sempre: "5548999990001" (13 dígitos, sem + ou espaços)
 *
 * Portado de personal-ai/apps/api/src/lib/phone.ts para suportar sessões LID do Baileys 7.x
 */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')

  let normalized = digits

  // Sem código de país e com 10-11 dígitos → adiciona 55 (Brasil)
  if (!normalized.startsWith('55') && (normalized.length === 10 || normalized.length === 11)) {
    normalized = '55' + normalized
  }

  // Celular BR: 55 + DDD(2) + 9 + número(8) = 13 dígitos
  // Se veio com 12 dígitos (sem o 9), adiciona o 9 após o DDD
  if (normalized.startsWith('55') && normalized.length === 12) {
    normalized = normalized.slice(0, 4) + '9' + normalized.slice(4)
  }

  return normalized // ex: "5548999990001"
}

/**
 * Converte número normalizado em JID do Baileys (@s.whatsapp.net)
 */
export function phoneToJid(phone: string): string {
  return `${normalizePhone(phone)}@s.whatsapp.net`
}
