// Swatches for members + labels. Picked so they all read on a white card and
// none of them collide with the status colors too badly.
export const SWATCHES = [
  '#2F5D50', // spruce
  '#3B6FB6', // denim
  '#7C5CD6', // violet
  '#C2477B', // berry
  '#D4483B', // brick
  '#D9930D', // amber
  '#3E9B6E', // fern
  '#5B6B7F', // slate
]

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// hex -> rgba, used for the soft label chip backgrounds
export function tint(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function randomSwatch(): string {
  return SWATCHES[Math.floor(Math.random() * SWATCHES.length)]
}
