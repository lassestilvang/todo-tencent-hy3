/**
 * Dynamic favicon progress ring.
 *
 * Draws a colored ring around the app icon to indicate daily task
 * completion, visible on the browser tab. Uses an off-screen canvas
 * to composite the ring onto the base favicon, then swaps the
 * document's <link rel="icon"> href to a blob URL.
 */

const BASE_FAVICON = '/icons/icon-192x192.png'

let baseImageLoaded = false
let baseImage: HTMLImageElement | null = null
let currentHref: string | null = null

function ensureBaseImage(): Promise<HTMLImageElement> {
  if (baseImage && baseImageLoaded) {
    return Promise.resolve(baseImage)
  }
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      baseImageLoaded = true
      baseImage = img
      resolve(img)
    }
    img.onerror = reject
    img.src = BASE_FAVICON
  })
}

/**
 * Draw a progress ring on a 192x192 canvas and return a blob URL.
 *
 * @param progress  0–1 fraction completed
 * @param color     ring color (use Tailwind-ish hex)
 */
export async function setProgressFavicon(
  progress: number,
  color: string = '#6366f1'
): Promise<void> {
  if (progress <= 0 || progress >= 1) {
    // Clear the custom favicon back to the default.
    clearProgressFavicon()
    return
  }

  try {
    const img = await ensureBaseImage()
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const size = 192
    canvas.width = size
    canvas.height = size

    // Clear and draw base icon
    ctx.clearRect(0, 0, size, size)
    ctx.drawImage(img, 0, 0, size, size)

    // Draw ring
    const center = size / 2
    const radius = size / 2 - 8
    const lineWidth = 10
    const startAngle = -Math.PI / 2
    const endAngle = startAngle + 2 * Math.PI * progress

    // Subtle dark background ring
    ctx.beginPath()
    ctx.arc(center, center, radius, 0, 2 * Math.PI)
    ctx.strokeStyle = 'rgba(0,0,0,0.15)'
    ctx.lineWidth = lineWidth
    ctx.lineCap = 'round'
    ctx.stroke()

    // Foreground progress arc
    ctx.beginPath()
    ctx.arc(center, center, radius, startAngle, endAngle)
    ctx.strokeStyle = color
    ctx.lineWidth = lineWidth
    ctx.lineCap = 'round'
    ctx.stroke()

    // Generate blob URL
    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob)
        setFavicon(url)
      }
    }, 'image/png')
  } catch (error) {
    console.error('Failed to set progress favicon:', error)
  }
}

function setFavicon(href: string): void {
  // Clean up previous blob URL
  if (currentHref && currentHref.startsWith('blob:')) {
    URL.revokeObjectURL(currentHref)
  }
  currentHref = href

  const link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]')
  if (link) {
    link.href = href
  } else {
    const newLink = document.createElement('link')
    newLink.rel = 'icon'
    newLink.href = href
    document.head.appendChild(newLink)
  }
}

function clearProgressFavicon(): void {
  if (currentHref && currentHref.startsWith('blob:')) {
    URL.revokeObjectURL(currentHref)
    currentHref = null
  }
  const link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]')
  if (link) {
    link.href = BASE_FAVICON
  }
}
