/**
 * Beep curto (880Hz, 0.6s) usado pra notificar admin de novo pedido.
 * Falha silenciosa em browsers que não permitem AudioContext sem gesto do usuário.
 */
export function playBeep(): void {
  try {
    const ctx = new AudioContext()
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    oscillator.connect(gain)
    gain.connect(ctx.destination)
    oscillator.frequency.value = 880
    oscillator.type = 'sine'
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6)
    oscillator.start(ctx.currentTime)
    oscillator.stop(ctx.currentTime + 0.6)
  } catch {
    // AudioContext indisponível
  }
}
