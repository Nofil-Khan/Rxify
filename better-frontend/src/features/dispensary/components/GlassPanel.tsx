import * as React from 'react';
import { cn } from '@/lib/utils';

export type GlassPanelTilt = 'left' | 'right' | 'none';

export interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  as?: React.ElementType;
  tilt?: GlassPanelTilt;
  children?: React.ReactNode;
}

export const GlassPanel: React.FC<GlassPanelProps> = ({
  as: Component = 'div',
  tilt = 'none',
  className,
  children,
  style,
  ...props
}) => {
  return (
    <Component
      className={cn(
        'glass-panel transition-all duration-300 ease-out will-change-transform',
        tilt === 'left' && 'tilt-left',
        tilt === 'right' && 'tilt-right',
        className
      )}
      style={{
        transformStyle: 'preserve-3d',
        ...style,
      }}
      {...props}
    >
      {children}
    </Component>
  );
};

export default GlassPanel;
