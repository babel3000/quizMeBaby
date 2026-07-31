import { next } from '@vercel/edge'

/**
 * Optional site lock. Set SITE_PASSWORD in Vercel env to require Basic Auth.
 * Leave unset to keep the site open (still noindex via robots / headers).
 */
export const config = {
  matcher: ['/((?!robots.txt).*)'],
}

export default function middleware(request) {
  const password = process.env.SITE_PASSWORD
  if (!password) return next()

  const header = request.headers.get('authorization')
  if (header?.startsWith('Basic ')) {
    try {
      const decoded = atob(header.slice(6))
      const sep = decoded.indexOf(':')
      const pass = sep >= 0 ? decoded.slice(sep + 1) : decoded
      if (pass === password) return next()
    } catch {
      // fall through to 401
    }
  }

  return new Response('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="PubQuiz"',
      'Cache-Control': 'no-store',
    },
  })
}
