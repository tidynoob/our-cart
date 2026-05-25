import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useItemsStore } from '@/stores/itemsStore'
import { SELECTABLE_CATEGORIES } from '@/lib/categories'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
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
export function AddItemBar({ listId, addedBy }: AddItemBarProps) {
  const addItem = useItemsStore((state) => state.addItem)
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('')
  const [category, setCategory] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (submitting) return
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
          disabled={submitting}
          className="min-h-[48px] flex-1 text-base"
        />
        <Button
          type="submit"
          disabled={submitting}
          className="h-12 w-12"
          aria-label="Add item"
        >
          <Plus className="size-6" />
        </Button>
      </div>

      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="self-start text-sm text-muted-foreground hover:text-foreground"
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
            disabled={submitting}
            className="w-20 text-base"
          />
          <Select
            value={category}
            onValueChange={(val) => setCategory(val ?? '')}
          >
            <SelectTrigger className="h-8 flex-1" disabled={submitting}>
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
