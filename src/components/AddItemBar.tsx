import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useItemsStore } from '@/stores/itemsStore'
import { SELECTABLE_CATEGORIES } from '@/lib/categories'
import { Input } from '@/components/ui/input'
import { buttonVariants } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface AddItemBarProps {
  listId: string
  addedBy: string
  /**
   * When true, the form is inert (e.g., before the user's name is set).
   * Prevents creating anonymous items if the name prompt is bypassed (WR-04).
   */
  disabled?: boolean
}

/**
 * Item entry form pinned above the items list.
 * Supports quick add (name only via Enter/tap) and expanded mode
 * for quantity and category. Prevents double-submit via submitting state.
 *
 * Per D-01/D-02/D-03: always-visible input with expandable details.
 * Per review: category dropdown shows SELECTABLE_CATEGORIES only (no Uncategorized).
 * Per review: all text inputs are 16px+ (text-base) to prevent iOS zoom.
 */
export function AddItemBar({ listId, addedBy, disabled = false }: AddItemBarProps) {
  const addItem = useItemsStore((state) => state.addItem)
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('')
  const [category, setCategory] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // The form is inert while submitting or while externally disabled
  // (e.g., before the user's name is set — WR-04).
  const isInert = submitting || disabled

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (isInert) return
    const trimmedName = name.trim()
    if (!trimmedName) return

    setSubmitting(true)

    try {
      await addItem(
        listId,
        trimmedName,
        quantity.trim() || undefined,
        category || undefined,
        addedBy
      )

      setName('')
      setQuantity('')
      setCategory('')
      setExpanded(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Add an item..."
          disabled={isInert}
          className="min-h-[48px] flex-1 text-base"
        />
        <button
          type="submit"
          disabled={isInert}
          className={buttonVariants({ className: 'h-12 w-12' })}
          aria-label="Add item"
        >
          <Plus className="size-6" />
        </button>
      </div>

      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="self-start min-h-[44px] flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        {expanded ? 'Less details' : 'More details'}
      </button>

      {expanded && (
        <div className="flex items-center gap-2">
          <Input
            type="text"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="Qty"
            disabled={isInert}
            className="w-20 text-base"
          />
          <Select
            value={category}
            onValueChange={(val) => setCategory(val ?? '')}
          >
            <SelectTrigger className="h-11 flex-1" disabled={isInert}>
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">
                None
              </SelectItem>
              {SELECTABLE_CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </form>
  )
}
