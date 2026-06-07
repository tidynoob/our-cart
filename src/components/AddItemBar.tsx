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
  // Live store items for the non-blocking duplicate warning (ITEM-04 / D-14).
  const items = useItemsStore((state) => state.items)
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('')
  const [category, setCategory] = useState('')
  // QOL-01 / D-08: once the user manually picks a category (Select onValueChange
  // or autocomplete selection), further keystrokes must NOT clobber that choice.
  // The flag resets on submit and when the name field is cleared (fresh entry).
  const [categoryTouched, setCategoryTouched] = useState(false)
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

  // Local prefix filter for autocomplete (D-02) + QOL-01 auto-categorize prefill.
  function handleNameChange(value: string) {
    setName(value)
    const trimmed = value.trim()
    if (trimmed.length === 0) {
      setSuggestions([])
      setFocusedIndex(-1)
      // NOTE: categoryTouched is NOT reset here. The frozen 14-01 RED contract
      // (no-clobber test: clear input -> retype exact match -> manual pick must
      // survive) requires the guard to persist across an in-session clear. The
      // flag resets only on submit (next item starts clean).
      return
    }
    const lower = value.toLowerCase()
    const matches = distinctItems
      .filter((item) => item.name.toLowerCase().startsWith(lower))
      .slice(0, 8)
    setSuggestions(matches)
    setFocusedIndex(-1)

    // QOL-01 / D-08: silent auto-categorize. On an EXACT case-insensitive trimmed
    // name match against per-list history (distinctItems) with a non-null category,
    // prefill the Select and expand the details row. Guarded by !categoryTouched so
    // a manual pick is never clobbered. Silent — no badge/hint (UI-SPEC §4).
    if (!categoryTouched) {
      const lowerTrimmed = trimmed.toLowerCase()
      const match = distinctItems.find(
        (item) => item.name.trim().toLowerCase() === lowerTrimmed && item.category,
      )
      if (match?.category) {
        setCategory(match.category)
        setExpanded(true)
      }
    }
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
      // Picking a suggestion is a deliberate category choice — guard it from a
      // later keystroke clobbering it (QOL-01 / D-08).
      setCategoryTouched(true)
    }
    setSuggestions([])
    setFocusedIndex(-1)
  }

  // The form is inert while submitting — prevents double-submit.
  const isInert = submitting

  // Live duplicate warning (ITEM-04 / D-14): unchecked-only, case-insensitive
  // match against the current store items. Informational only — does NOT gate
  // submit (D-15). XSS-safe: the typed name is rendered via JSX text interpolation
  // (React auto-escapes; T-13-V5), never raw HTML.
  const dupExists =
    name.trim().length > 0 &&
    items.some(
      (i) => !i.checked && i.name.toLowerCase() === name.trim().toLowerCase()
    )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (isInert) return
    const trimmedName = name.trim()
    if (!trimmedName) return

    // Capture submitted field values into locals BEFORE clearing, since the
    // clears now precede the await (UAT gap 6 fix).
    const trimmedQuantity = quantity.trim() || undefined
    const submitCategory = category || undefined

    setSubmitting(true)

    // Clear the input SYNCHRONOUSLY before awaiting addItem so the optimistic
    // insert never coincides with a populated `name` — otherwise dupExists is
    // true for one frame and the role=status warning flashes (UAT gap 6,
    // .planning/debug/additembar-dup-warning-flicker.md).
    setName('')
    setQuantity('')
    setCategory('')
    // Reset the auto-categorize guard so the next item starts clean (QOL-01).
    setCategoryTouched(false)
    setExpanded(false)
    setSuggestions([])
    setFocusedIndex(-1)

    try {
      await addItem(listId, trimmedName, trimmedQuantity, submitCategory, addedBy)
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

      {/* Live duplicate warning (ITEM-04) — non-blocking, amber (informational,
          NOT destructive red). role="status" is a polite live region (no focus
          theft). Add stays enabled; the form's flex-col gap-2 reserves the line. */}
      {dupExists && (
        <p role="status" className="text-sm text-amber-600">
          "{name.trim()}" is already on your list
        </p>
      )}

      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="self-start min-h-[44px] flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        {expanded ? 'Less details' : 'More details'}
      </button>

      {/* Details row. The category Select is ALWAYS mounted so its controlled
          value is observable even when the row is visually collapsed (the
          auto-categorize prefill can fire before the user opens the row); the
          wrapper is hidden, not unmounted, when !expanded. The quantity Input
          stays conditionally mounted (only when expanded). */}
      <div className={expanded ? 'flex items-center gap-2' : 'hidden'}>
        {expanded && (
          <Input
            type="text"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="Qty"
            disabled={isInert}
            className="w-20 text-base"
          />
        )}
        <Select
          value={category}
          onValueChange={(val) => {
            setCategory(val ?? '')
            // A manual pick locks the category against keystroke prefill (D-08).
            setCategoryTouched(true)
          }}
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
    </form>
  )
}
