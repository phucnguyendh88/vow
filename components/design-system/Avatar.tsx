// components/design-system/Avatar.tsx
import React from 'react'
import { cn } from '@/lib/utils'

type AvatarProps = {
  src?: string | null
  alt?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const sizeMap = {
  xs: 'w-6 h-6',
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
  xl: 'w-14 h-14',
}

export const Avatar: React.FC<AvatarProps> = ({
  src,
  alt = 'Avatar',
  size = 'md',
  className,
}) => {
  const placeholder = '/placeholder-avatar.png'
  return (
    <div className={cn('rounded-full overflow-hidden bg-muted', sizeMap[size], className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src || placeholder}
        alt={alt}
        width={40}
        height={40}
        loading="lazy"
        onError={(e) => {
          e.currentTarget.style.display = 'none'
        }}
        className="object-cover w-full h-full"
      />
    </div>
  )
}

