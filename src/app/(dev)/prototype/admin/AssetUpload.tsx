// AssetUpload — reusable upload button for any asset type (GLBs, HDRIs, textures)
// Uploads to /api/dev/assets/upload?type=<type> and triggers a refresh callback

'use client'

import { useRef, useState } from 'react'

interface AssetUploadProps {
  type: 'shapes' | 'env' | 'materials'
  accept: string  // e.g., '.glb,.gltf' or '.exr,.hdr' or 'image/*'
  label: string   // e.g., 'Upload GLB' or 'Upload HDRI'
  onUploaded: () => void  // refresh asset list after upload
}

export default function AssetUpload({ type, accept, label, onUploaded }: AssetUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const handleUpload = async (file: File) => {
    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)

    await fetch(`/api/dev/assets/upload?type=${type}`, {
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
