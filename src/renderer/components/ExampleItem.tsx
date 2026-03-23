// src/renderer/components/ExampleItem.tsx
import React from 'react'
import type { WordExample } from '../../types'

interface ExampleItemProps {
  example: WordExample
}

export function ExampleItem({ example }: ExampleItemProps) {
  return (
    <div className="group space-y-1.5 p-3 rounded-xl border border-gray-100 hover:border-blue-100 hover:bg-blue-50/30 transition-all duration-300">
      <div className="flex gap-2">
        <div className="mt-1.5 w-1 h-1 rounded-full bg-blue-400 group-hover:scale-125 transition-transform shrink-0" />
        <p className="text-[15px] text-gray-800 font-medium leading-relaxed">
          {example.en}
        </p>
      </div>
      <p className="pl-3 text-sm text-gray-500 italic leading-relaxed">
        {example.pt}
      </p>
    </div>
  )
}
