import axios from 'axios'

const BASE = 'https://www.googleapis.com/youtube/v3'

export async function searchVideo(query) {
  const { data } = await axios.get(`${BASE}/search`, {
    params: {
      key: process.env.YOUTUBE_API_KEY,
      q: query,
      type: 'video',
      part: 'snippet',
      maxResults: 5,
      videoEmbeddable: true,
    },
  })
  return data.items.map(v => ({
    id: v.id.videoId,
    title: v.snippet.title,
    channel: v.snippet.channelTitle,
    thumbnail: v.snippet.thumbnails.medium?.url,
    embedUrl: `https://www.youtube.com/embed/${v.id.videoId}`,
  }))
}

export async function getVideo(videoId) {
  const { data } = await axios.get(`${BASE}/videos`, {
    params: {
      key: process.env.YOUTUBE_API_KEY,
      id: videoId,
      part: 'snippet',
    },
  })
  const v = data.items[0]
  if (!v) return null
  return {
    id: v.id,
    title: v.snippet.title,
    channel: v.snippet.channelTitle,
    thumbnail: v.snippet.thumbnails.medium?.url,
    embedUrl: `https://www.youtube.com/embed/${v.id}`,
  }
}
