'use client'

import { useRef } from 'react'
import { browseAndUpload } from './browseFile'

interface FileFieldProps {
  label: string
  value: string
  type: 'shapes' | 'env' | 'materials'
  accept: string
  slot?: string
  onChange: (path: string) => void
}

export default function FileField({ label, value, type, accept, slot, onChange }: FileFieldProps) {
  const displayName = value ? value.split('/').pop() || value : 'none'

  const handleClick = async () => {
    const path = await browseAndUpload(type, accept, slot)
    if (path) onChange(path)
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '4px 8px',
      minHeight: 28,
    }}>
      <label style={{
        fontSize: 11,
        color: '#222',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        flexShrink: 0,
        width: 90,
      }}>
        {label}
      </label>
      <button
        onClick={handleClick}
        title={value || 'Click to select file'}
        style={{
          flex: 1,
          padding: '4px 8px',
          background: '#fff',
          border: '1px solid #ccc',
          borderRadius: 4,
          fontSize: 11,
          color: '#333',
          cursor: 'pointer',
          textAlign: 'left',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontFamily: 'ui-monospace, SFMono-Regular, monospace',
        }}
      >
        {displayName}
      </button>
    </div>
  )
}
