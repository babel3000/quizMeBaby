import axios from 'axios'

function mapTrack(t) {
  return {
    id: String(t.id),
    name: t.title,
    artist: t.artist.name,
    artistId: String(t.artist.id),
    album: t.album.title,
    previewUrl: t.preview ?? null,
    albumArt: t.album.cover_medium ?? null,
  }
}

export async function searchTracks(query, limit = 10) {
  const { data } = await axios.get('https://api.deezer.com/search', {
    params: { q: query, limit },
  })
  return (data.data ?? []).map(mapTrack)
}

export async function getArtistRadio(artistId, limit = 8) {
  const { data } = await axios.get(`https://api.deezer.com/artist/${artistId}/radio`, {
    params: { limit },
  })
  return (data.data ?? []).map(mapTrack)
}
