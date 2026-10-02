// Stock photos, sample Effects and material textures, plus anything the user uploads. Every image is
// turned into a data URL (so the render embeds it and can be exported as a PNG) and measured once.

export interface Asset {
  id: string
  label: string
  url: string
}

export const STOCK: Asset[] = [
  { id: 'tshirt-white-flat', label: 'T-shirt · white', url: '/stock/tshirt-white-flat.png' },
  { id: 'tshirt-black-flat', label: 'T-shirt · black', url: '/stock/tshirt-black-flat.png' },
  { id: 'tshirt-grey-flat', label: 'T-shirt · grey', url: '/stock/tshirt-grey-flat.png' },
  { id: 'tshirt-blue-flat', label: 'T-shirt · ONEMO blue', url: '/stock/tshirt-blue-flat.png' },
  { id: 'tshirt-lime-flat', label: 'T-shirt · ONEMO lime', url: '/stock/tshirt-lime-flat.png' },
  { id: 'tshirt-white-model', label: 'T-shirt · on model', url: '/stock/tshirt-white-model.png' },
  { id: 'hoodie-black', label: 'Hoodie · black', url: '/stock/hoodie-black.png' },
  { id: 'trousers-pink', label: 'Trousers · pink', url: '/stock/trousers-pink.png' },
  { id: 'trousers-tan', label: 'Trousers · tan', url: '/stock/trousers-tan.png' },
]

export const EFFECTS: Asset[] = [
  { id: 'effect-tv', label: 'Sample · TV shape', url: '/effects/effect-tv.png' },
  { id: 'effect-clover', label: 'Sample · clover', url: '/effects/effect-clover.png' },
  { id: 'effect-round', label: 'Sample · round', url: '/effects/effect-round.png' },
]

export const MATERIALS: Asset[] = [
  { id: 'none', label: 'None', url: '' },
  { id: 'suede', label: 'Suede', url: '/materials/suede.png' },
  { id: 'velour', label: 'Velour', url: '/materials/velour.png' },
  { id: 'fabric', label: 'Woven fabric', url: '/materials/fabric.png' },
]

export interface Loaded {
  href: string
  width: number
  height: number
}

const cache = new Map<string, Promise<Loaded | null>>()
const uploads = new Map<string, Asset>()

export function addUpload(kind: 'stock' | 'effect', file: File): Promise<Asset> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => {
      const a = { id: `upload-${kind}-${Date.now()}`, label: `Upload · ${file.name}`, url: String(r.result) }
      uploads.set(a.id, a)
      ;(kind === 'stock' ? STOCK : EFFECTS).unshift(a)
      resolve(a)
    }
    r.onerror = () => reject(r.error)
    r.readAsDataURL(file)
  })
}

function toDataUrl(url: string): Promise<string> {
  if (url.startsWith('data:')) return Promise.resolve(url)
  return fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error(String(res.status))
      return res.blob()
    })
    .then((b) => new Promise<string>((ok) => {
      const fr = new FileReader()
      fr.onload = () => ok(String(fr.result))
      fr.readAsDataURL(b)
    }))
}

/** The image as an embeddable data URL with its natural size; null if it does not exist (yet). */
export function load(url: string): Promise<Loaded | null> {
  if (!url) return Promise.resolve(null)
  let p = cache.get(url)
  if (!p) {
    p = toDataUrl(url)
      .then((href) => new Promise<Loaded>((ok, bad) => {
        const img = new Image()
        img.onload = () => ok({ href, width: img.naturalWidth, height: img.naturalHeight })
        img.onerror = bad
        img.src = href
      }))
      .catch(() => null)
    cache.set(url, p)
  }
  return p
}

/** Which of the listed assets actually exist on disk — generated stock may still be on its way. */
export async function available(list: Asset[]): Promise<Asset[]> {
  const ok = await Promise.all(list.map((a) => (a.url ? load(a.url).then((x) => !!x) : Promise.resolve(true))))
  return list.filter((_, i) => ok[i])
}
