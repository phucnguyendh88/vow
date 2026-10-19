// components/design-system/Icon.tsx
import React from 'react';
import * as LucideIcons from 'lucide-react';
import { cn } from '@/lib/utils';

type IconProps = React.SVGProps<SVGSVGElement> & {
  /**
   * Name of a Lucide icon to render. Ignored if `as` is provided.
   */
  name?: keyof typeof LucideIcons;
  /**
   * Direct component to render (e.g., imported from lucide-react).
   */
  as?: React.ElementType<React.SVGProps<SVGSVGElement>>;
  /** Size in pixels */
  size?: number;
  className?: string;
};

export const Icon: React.FC<IconProps> = ({ name, as, size = 24, className, ...rest }) => {
  // Prefer the explicit component via `as`; otherwise look up by name.
  const Component = as ?? (name ? (LucideIcons as any)[name] : null);
  if (!Component) return null;
  return (
    <Component
      className={cn('inline-block', className)}
      width={size}
      height={size}
      {...rest}
    />
  );
};
