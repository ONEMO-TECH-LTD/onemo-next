// Opens native file picker, uploads selected file to assets folder, returns the path.
// Used by Leva button controls for per-slot texture import.

export async function browseAndUpload(
  type: 'shapes' | 'env' | 'materials',
  accept: string,
  slot?: string
): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept

    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) { resolve(null); return }

      const params = new URLSearchParams({ type })
      if (slot) {
        params.set('folder', 'imported')
        params.set('slot', slot)
      }

      try {
        const formData = new FormData()
        formData.append('file', file)
        const res = await fetch(`/api/dev/assets/upload?${params}`, {
          method: 'POST',
          body: formData,
        })
        const data = await res.json()
        resolve(data.path || null)
      } catch {
        resolve(null)
      }
    }

    input.oncancel = () => resolve(null)
    input.click()
  })
}
