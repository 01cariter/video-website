'use client';

// Adapted from beui.dev/components/motion/shader-background.
import {
  GrainGradient,
  type GrainGradientProps,
} from '@paper-design/shaders-react';
import { useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils';

export type ShaderBackgroundProps = {
  variant: 'grain-gradient';
} & GrainGradientProps;

export function ShaderBackground({
  variant: _variant,
  className,
  speed,
  ...props
}: ShaderBackgroundProps) {
  const reducedMotion = useReducedMotion();

  return (
    <GrainGradient
      {...props}
      speed={reducedMotion ? 0 : speed}
      className={cn('h-full w-full', className)}
    />
  );
}
