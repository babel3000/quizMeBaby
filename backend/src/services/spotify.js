import axios from 'axios'

let tokenCache = { token: null, expiresAt: 0 }

async function getAccessToken() {
  if (tokenCache.token && Date.now() < tokenCache.expiresAt) return tokenCache.token

  const credentials = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString('base64')

  const { data } = await axios.post(
    'https://accounts.spotify.com/api/token',
    'grant_type=client_credentials',
    { headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' } }
  )

  tokenCache = { token: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 }
  return tokenCache.token
}

export async function searchTrack(query, limit = 10) {
  const token = await getAccessToken()
  const { data } = await axios.get('https://api.spotify.com/v1/search', {
    headers: { Authorization: `Bearer ${token}` },
    params: { q: query, type: 'track', limit },
  })
  return data.tracks.items.map(t => ({
    id: t.id,
    name: t.name,
    artist: t.artists.map(a => a.name).join(', '),
    album: t.album.name,
    previewUrl: t.preview_url,
    albumArt: t.album.images[1]?.url ?? t.album.images[0]?.url ?? null,
  }))
}

export async function getTrack(trackId) {
  const token = await getAccessToken()
  const { data } = await axios.get(`https://api.spotify.com/v1/tracks/${trackId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return {
    id: data.id,
    name: data.name,
    artist: data.artists[0].name,
    album: data.album.name,
    previewUrl: data.preview_url,
    albumArt: data.album.images[0]?.url,
  }
}
