// src/renderer/components/SectionLabel.tsx
import React from 'react'

interface SectionLabelProps {
  children: React.ReactNode
  className?: string
}

export function SectionLabel({ children, className = '' }: SectionLabelProps) {
  return (
    <p className={`font-sans text-label font-medium tracking-label uppercase text-text-faint mb-2 ${className}`.trim()}>
      {children}
    </p>
  )
}
