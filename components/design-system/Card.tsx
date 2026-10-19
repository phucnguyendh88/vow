// components/design-system/Card.tsx
import React from 'react'
import { cn } from '@/lib/utils'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hover?: boolean
}

export const Card: React.FC<CardProps> = ({
  className,
  children,
  hover = true,
  ...rest
}) => {
  const base = 'bg-surface rounded-md shadow-sm overflow-hidden'
  const hoverClass = hover ? 'hover:shadow-md transition-shadow' : ''
  return (
    <div className={cn(base, hoverClass, className)} {...rest}>
      {children}
    </div>
  )
}
