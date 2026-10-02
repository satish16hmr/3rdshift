import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import Link from 'next/link';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  `inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg
  text-sm font-semibold transition-all 
  cursor-pointer

  disabled:cursor-not-allowed
  disabled:bg-zinc-100
  disabled:text-zinc-400
  disabled:border-zinc-200
  disabled:shadow-none
  disabled:hover:bg-zinc-100
  disabled:hover:text-zinc-400
  disabled:hover:border-zinc-200

  [&_svg]:pointer-events-none
  [&_svg:not([class*='size-'])]:size-4
  shrink-0 [&_svg]:shrink-0
  outline-none`,
  {
    variants: {
      variant: {
        default:
          'bg-zinc-100 text-[#A4A7AE] hover:bg-blue-500 hover:text-white border border-zinc-200',
        destructive:
          'bg-red-600 text-white shadow-xs hover:bg-red-600/90 focus-visible:ring-red-600/20 dark:focus-visible:ring-red-600/40 dark:bg-red-600/60',
        outline:
          'border border-[#D5D7DA] hover:bg-zinc-100 text-zinc-700',
        secondary:
          'bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80',
        ghost:
          'hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50',
        link: 'text-primary underline-offset-4 hover:underline',
        primary: 'bg-blue-500 hover:bg-blue-500/85 text-white border border-zinc-200 hover:scale-101 transition duration-300'
      },
      size: {
        default: 'h-9 px-4 py-2 has-[>svg]:px-3',
        sm: 'h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5',
        lg: 'h-10 rounded-md px-6 has-[>svg]:px-4',
        icon: 'size-9'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  href,
  outline,
  primary,
  secondary,
  ghost,
  destructive,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    href?: string;
    outline?: boolean;
    primary?: boolean;
    secondary?: boolean;
    ghost?: boolean;
    destructive?: boolean;
  }) {
  const computedVariant =
    variant ||
    (outline ? 'outline' : undefined) ||
    (primary ? 'primary' : undefined) ||
    (secondary ? 'secondary' : undefined) ||
    (ghost ? 'ghost' : undefined) ||
    (destructive ? 'destructive' : undefined);

  if (href) {
    return (
      <Link
        href={href}
        className={cn(buttonVariants({ variant: computedVariant, size, className }))}
        {...(props as any)}
      />
    );
  }

  const Comp = asChild ? Slot : 'button';

  return (
    <Comp
      data-slot='button'
      className={cn(buttonVariants({ variant: computedVariant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
