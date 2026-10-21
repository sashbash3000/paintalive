async function request(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`)
  return res.json()
}

export default {
  async getAnimals(scene) {
    const query = scene ? `?scene=${encodeURIComponent(scene)}` : ''
    return (await request(`/api/animals${query}`)).animals
  },
  createAnimal(animal) {
    return request('/api/animals', { method: 'POST', body: JSON.stringify(animal) })
  },
  deleteAnimal(id) {
    return request(`/api/animals/${id}`, { method: 'DELETE' })
  },
  getInfo() {
    return request('/api/info')
  },
}
