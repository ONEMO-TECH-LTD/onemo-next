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
  { id: 'effect-pro', label: 'Sample · thermal PRO', url: '/effects/effect-pro.png' },
  { id: 'effect-lime-clover', label: 'Sample · lime clover', url: '/effects/effect-lime-clover.png' },
  { id: 'effect-tv', label: 'Sample · TV shape (photo)', url: '/effects/effect-tv.png' },
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

/**
 * Where the garment is in the photo: its bounding box in photo pixels. Uses the photo's transparency when
 * it is a cut-out, otherwise everything that differs from the background colour in the corners.
 */
export async function garmentBox(img: Loaded): Promise<{ x0: number; y0: number; x1: number; y1: number; shoulder: number }> {
  const im = new Image(); im.src = img.href; await im.decode()
  const S = 256, k = S / Math.max(img.width, img.height)
  const w = Math.max(1, Math.round(img.width * k)), h = Math.max(1, Math.round(img.height * k))
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h
  const ctx = cv.getContext('2d', { willReadFrequently: true })!; ctx.drawImage(im, 0, 0, w, h)
  const px = ctx.getImageData(0, 0, w, h).data
  const at = (x: number, y: number) => (y * w + x) * 4
  const cut = px[at(0, 0) + 3] < 20 && px[at(w - 1, h - 1) + 3] < 20
  const bg = [px[0], px[1], px[2]]
  let x0 = w, y0 = h, x1 = -1, y1 = -1
  const rowWidth = new Array(h).fill(0)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = at(x, y)
    const on = cut ? px[i + 3] > 40 : Math.abs(px[i] - bg[0]) + Math.abs(px[i + 1] - bg[1]) + Math.abs(px[i + 2] - bg[2]) > 36
    if (on) { rowWidth[y]++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
  }
  if (x1 < 0) return { x0: 0, y0: 0, x1: img.width, y1: img.height, shoulder: img.height * 0.3 }
  // shoulder line: the first row (from the top) where the garment reaches half its widest — below any hood or collar
  const widest = Math.max(...rowWidth)
  const shoulder = rowWidth.findIndex((v) => v >= widest * 0.5)
  return { x0: x0 / k, y0: y0 / k, x1: (x1 + 1) / k, y1: (y1 + 1) / k, shoulder: shoulder / k }
}

/** Which of the listed assets actually exist on disk — generated stock may still be on its way. */
export async function available(list: Asset[]): Promise<Asset[]> {
  const ok = await Promise.all(list.map((a) => (a.url ? load(a.url).then((x) => !!x) : Promise.resolve(true))))
  return list.filter((_, i) => ok[i])
}
