/** Tiny crypto-random ID generator (no extra dependency) */
export function nanoid(size = 12): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const arr = crypto.getRandomValues(new Uint8Array(size))
  return Array.from(arr, (b) => chars[b % chars.length]).join('')
}
