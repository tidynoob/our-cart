import { useState, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { useItemsStore } from '@/stores/itemsStore'
import { supabase } from '@/lib/supabase'
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
import { AutocompleteSuggestions } from '@/components/AutocompleteSuggestions'
import type { SuggestionItem } from '@/components/AutocompleteSuggestions'

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
  const [distinctItems, setDistinctItems] = useState<SuggestionItem[]>([])
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([])
  const [focusedIndex, setFocusedIndex] = useState(-1)

  // Fetch distinct item names on mount for autocomplete (D-01)
  useEffect(() => {
    async function loadDistinctItems() {
      const { data } = await supabase
        .from('items')
        .select('name, category, quantity')
        .eq('list_id', listId)
        .order('created_at', { ascending: false })
      if (data) {
        // Deduplicate by lowercase name, keeping most recent (first)
        const seen = new Set<string>()
        const deduped = data.filter((item) => {
          const key = item.name.toLowerCase()
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
        setDistinctItems(deduped)
      }
    }
    loadDistinctItems()
  }, [listId])

  // Local prefix filter for autocomplete (D-02)
  function handleNameChange(value: string) {
    setName(value)
    if (value.trim().length === 0) {
      setSuggestions([])
      setFocusedIndex(-1)
      return
    }
    const lower = value.toLowerCase()
    const matches = distinctItems
      .filter((item) => item.name.toLowerCase().startsWith(lower))
      .slice(0, 8)
    setSuggestions(matches)
    setFocusedIndex(-1)
  }

  // Keyboard navigation for autocomplete dropdown
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (suggestions.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusedIndex((i) => (i < suggestions.length - 1 ? i + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusedIndex((i) => (i > 0 ? i - 1 : suggestions.length - 1))
    } else if (e.key === 'Enter' && focusedIndex >= 0) {
      e.preventDefault()
      handleSuggestionSelect(suggestions[focusedIndex])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setSuggestions([])
      setFocusedIndex(-1)
    }
  }

  // Populate fields on suggestion selection — D-04: NO auto-submit
  function handleSuggestionSelect(item: SuggestionItem) {
    setName(item.name)
    if (item.category) {
      setCategory(item.category)
      setExpanded(true)
    }
    setSuggestions([])
    setFocusedIndex(-1)
  }

  // The form is inert while submitting — prevents double-submit.
  const isInert = submitting

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
      setSuggestions([])
      setFocusedIndex(-1)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div className="relative">
        <div className="flex items-center gap-2">
          <Input
            type="text"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => { setSuggestions([]); setFocusedIndex(-1) }}
            placeholder="Add an item..."
            disabled={isInert}
            className="min-h-[48px] flex-1 text-base"
            role="combobox"
            aria-expanded={suggestions.length > 0}
            aria-controls="autocomplete-listbox"
            aria-activedescendant={focusedIndex >= 0 ? `suggestion-${focusedIndex}` : undefined}
            aria-autocomplete="list"
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
        {suggestions.length > 0 && (
          <AutocompleteSuggestions
            suggestions={suggestions}
            focusedIndex={focusedIndex}
            onSelect={handleSuggestionSelect}
          />
        )}
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
