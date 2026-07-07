import axios from 'axios'

export async function searchTracks(query, limit = 10) {
  const { data } = await axios.get('https://api.deezer.com/search', {
    params: { q: query, limit },
  })
  return (data.data ?? []).map(t => ({
    id: String(t.id),
    name: t.title,
    artist: t.artist.name,
    album: t.album.title,
    previewUrl: t.preview ?? null,
    albumArt: t.album.cover_medium ?? null,
  }))
}
