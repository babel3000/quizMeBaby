import axios from 'axios'

export async function searchImages(query, limit = 15) {
  const key = process.env.PIXABAY_API_KEY
  if (!key) throw new Error('PIXABAY_API_KEY not configured')

  const { data } = await axios.get('https://pixabay.com/api/', {
    params: {
      key,
      q: query,
      image_type: 'all',
      safesearch: true,
      per_page: limit,
    },
  })

  return (data.hits ?? []).map(h => ({
    id: String(h.id),
    thumbUrl: h.previewURL,
    url: h.webformatURL,
    largeUrl: h.largeImageURL,
    tags: h.tags,
    user: h.user,
  }))
}
