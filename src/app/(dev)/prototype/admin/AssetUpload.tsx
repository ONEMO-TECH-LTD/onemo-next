// AssetUpload — reusable upload button for any asset type (GLBs, HDRIs, textures)
// Uploads to /api/dev/assets/upload?type=<type> and triggers a refresh callback

'use client'

import { useRef, useState } from 'react'

interface AssetUploadProps {
  type: 'shapes' | 'env' | 'materials'
  accept: string  // e.g., '.glb,.gltf' or '.exr,.hdr' or 'image/*'
  label: string   // e.g., 'Upload GLB' or 'Upload HDRI'
  folder?: string // subfolder inside type dir (e.g., 'custom-set')
  slot?: string   // texture slot name (normal|roughness|height|sheen) — renames file
  onUploaded: () => void  // refresh asset list after upload
}

export default function AssetUpload({ type, accept, label, folder, slot, onUploaded }: AssetUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const handleUpload = async (file: File) => {
    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)

    const params = new URLSearchParams({ type })
    if (folder) params.set('folder', folder)
    if (slot) params.set('slot', slot)
    await fetch(`/api/dev/assets/upload?${params}`, {
      method: 'POST',
      body: formData,
    })

    setUploading(false)
    onUploaded()
  }

  return (
    <>
      <button
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        style={{
          padding: '3px 8px',
          background: '#555',
          color: '#fff',
          border: 'none',
          borderRadius: 3,
          fontSize: 10,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        {uploading ? '...' : label}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept={accept}
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleUpload(file)
          e.target.value = ''
        }}
      />
    </>
  )
}
