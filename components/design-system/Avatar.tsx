// components/design-system/Avatar.tsx
import React from 'react'
import Image from 'next/image'
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
  const placeholder = '/placeholder-avatar.png' // assume placeholder exists in public
  return (
    <div className={cn('rounded-full overflow-hidden bg-muted', sizeMap[size], className)}>
      <Image
        src={src ?? placeholder}
        alt={alt}
        width={40}
        height={40}
        className="object-cover w-full h-full"
      />
    </div>
  )
}
