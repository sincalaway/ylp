import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
const buttonVariants = cva('inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50', {
 variants: {
  variant: { default: 'bg-herb text-white hover:bg-[#214c37]', destructive: 'bg-cinnabar text-white hover:bg-[#7f1d22]', outline: 'border border-[#c9d2c3] bg-transparent text-herb hover:bg-mist', secondary: 'bg-mist text-herb hover:bg-[#dce7d9]', ghost: 'text-ink hover:bg-mist', link: 'text-herb underline-offset-4 hover:underline' },
  size: { default: 'h-10 px-4 py-2', sm: 'h-9 px-3', lg: 'h-11 px-7', icon: 'h-10 w-10' }
 }, defaultVariants: { variant: 'default', size: 'default' }
})
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> { asChild?: boolean }
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild = false, ...props }, ref) => {
 const Comp = asChild ? Slot : 'button'
 return <Comp className={cn(buttonVariants({ variant, size }), className)} ref={ref} {...props}/>
})
Button.displayName = 'Button'
export { Button, buttonVariants }
