import { Checkbox as CheckboxPrimitive } from '@base-ui/react/checkbox'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

function Checkbox({
  className,
  checked,
  onCheckedChange,
  ...props
}: CheckboxPrimitive.Root.Props & { className?: string }) {
  return (
    <div className={cn('flex h-[44px] w-[44px] items-center justify-center', className)}>
      <CheckboxPrimitive.Root
        checked={checked}
        onCheckedChange={onCheckedChange}
        {...props}
      >
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-input bg-background data-[checked]:bg-primary data-[checked]:border-primary">
          <CheckboxPrimitive.Indicator>
            <Check className="h-3.5 w-3.5 text-primary-foreground" />
          </CheckboxPrimitive.Indicator>
        </span>
      </CheckboxPrimitive.Root>
    </div>
  )
}

export { Checkbox }
