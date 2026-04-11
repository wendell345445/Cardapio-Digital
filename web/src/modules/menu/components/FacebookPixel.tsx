import { useEffect } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

declare global {
  interface Window {
    fbq: (
      command: string,
      event: string,
      data?: Record<string, unknown>
    ) => void
    _fbq?: unknown
  }
}

// ─── fbq wrapper ──────────────────────────────────────────────────────────────

/**
 * Fires a Facebook Pixel event if the pixel script has been loaded.
 */
export function fbq(event: string, data?: Record<string, unknown>) {
  if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
    window.fbq('track', event, data)
  }
}

// ─── Convenience event helpers ────────────────────────────────────────────────

export function trackPageView() {
  fbq('PageView')
}

export function trackViewContent(productId: string, productName?: string) {
  fbq('ViewContent', {
    content_ids: [productId],
    content_name: productName,
    content_type: 'product',
  })
}

export function trackAddToCart(productId: string, value?: number, currency = 'BRL') {
  fbq('AddToCart', {
    content_ids: [productId],
    content_type: 'product',
    value,
    currency,
  })
}

export function trackPurchase(orderId: string, value: number, currency = 'BRL') {
  fbq('Purchase', {
    order_id: orderId,
    value,
    currency,
  })
}

// ─── Component ────────────────────────────────────────────────────────────────

interface FacebookPixelProps {
  pixelId: string
}

/**
 * Injects the Facebook Pixel base script into <head> and fires PageView on mount.
 * Place this component near the root of the menu app.
 */
export function FacebookPixel({ pixelId }: FacebookPixelProps) {
  useEffect(() => {
    if (!pixelId) return

    // Avoid injecting twice
    if (document.getElementById('fb-pixel-script')) {
      trackPageView()
      return
    }

    // Facebook Pixel base code (official snippet, minified)
    const script = document.createElement('script')
    script.id = 'fb-pixel-script'
    script.type = 'text/javascript'
    script.innerHTML = `
      !function(f,b,e,v,n,t,s)
      {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};
      if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
      n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t,s)}(window, document,'script',
      'https://connect.facebook.net/en_US/fbevents.js');
      fbq('init', '${pixelId}');
      fbq('track', 'PageView');
    `
    document.head.appendChild(script)

    // No-script fallback image tag
    const noscript = document.createElement('noscript')
    const img = document.createElement('img')
    img.height = 1
    img.width = 1
    img.style.display = 'none'
    img.src = `https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`
    noscript.appendChild(img)
    document.head.appendChild(noscript)

    return () => {
      // Cleanup on unmount (e.g., if pixelId changes, though rare)
      const existing = document.getElementById('fb-pixel-script')
      if (existing) existing.remove()
    }
  }, [pixelId])

  // This component renders nothing to the DOM
  return null
}
