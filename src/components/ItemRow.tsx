import { useState, useRef, useEffect, useCallback } from 'react'
import { Trash2, Minus, Plus } from 'lucide-react'
import type { Item } from '@/types/item'
import { parseQuantity } from '@/lib/ordering'
import { AttributionBadge } from '@/components/AttributionBadge'
import { DeleteConfirmation } from '@/components/DeleteConfirmation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { SELECTABLE_CATEGORIES } from '@/lib/categories'
import { useProfilesStore } from '@/stores/profilesStore'

interface ItemRowProps {
  item: Item
  isEditing: boolean
  isDeleting: boolean
  onTap: () => void
  onDelete: () => void
  onCancelDelete: () => void
  onConfirmDelete: () => void
  onCancelEdit: () => void
  onSave: (
    id: string,
    changes: Partial<Pick<Item, 'name' | 'quantity' | 'category' | 'note' | 'position'>>
  ) => void
  onToggle: (id: string) => void
}

/**
 * Single item row with display mode and inline focus-scope edit mode.
 *
 * FOCUS-SCOPE PATTERN (addresses review concern #1 — inline edit blur/focus):
 * - The edit row container has an onBlur handler using setTimeout(0) to check
 *   document.activeElement after the browser completes the focus transfer.
 * - If focus moved OUTSIDE the row: trigger save and exit edit mode.
 * - If focus moved INSIDE the row (between inputs, Select, trash, cancel): do nothing.
 * - All interactive elements use onMouseDown preventDefault to prevent blur
 *   before their onClick fires.
 *
 * Per D-09: save when focus leaves the whole row. Enter also saves.
 * Per D-10: trash icon only in edit mode.
 * Per D-11: trash opens delete confirmation (rendered via isDeleting prop).
 *
 * Phase 3 additions:
 * Per D-01: checkbox is a separate gesture target — tapping it does NOT open edit mode.
 * Per D-05: checked item shows filled checkbox, line-through name, opacity-50 row.
 */
export function ItemRow({
  item,
  isEditing,
  isDeleting,
  onTap,
  onDelete,
  onCancelDelete,
  onConfirmDelete,
  onCancelEdit,
  onSave,
  onToggle,
}: ItemRowProps) {
  // REACTIVE selector — re-renders when profilesStore.profiles changes (PROF-05 live names)
  // Do NOT use useProfilesStore.getState().profiles — non-reactive snapshot breaks PROF-05.
  const profiles = useProfilesStore((state) => state.profiles)
  const rowRef = useRef<HTMLDivElement>(null)
  const selectOpenRef = useRef(false)
  const [editName, setEditName] = useState('')
  const [editQuantity, setEditQuantity] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editNote, setEditNote] = useState('')

  // Initialize local edit state when entering edit mode
  useEffect(() => {
    if (isEditing) {
      setEditName(item.name)
      setEditQuantity(item.quantity || '')
      setEditCategory(item.category || '')
      setEditNote(item.note ?? '')
    }
  }, [isEditing, item.name, item.quantity, item.category, item.note])

  /**
   * DIRTY-CHECK before calling onSave (addresses review concern about redundant updates).
   * Compares current field values against item prop. Only calls onSave if at least one
   * field actually changed. Empty name reverts to item.name without saving.
   */
  const handleSave = useCallback(() => {
    const trimmedName = editName.trim()

    // Empty name validation: revert without saving
    if (!trimmedName) {
      onCancelEdit()
      return
    }

    const newQuantity = editQuantity.trim() || null
    const newCategory = editCategory || null
    const newNote = editNote.trim() || null

    const nameChanged = trimmedName !== item.name
    const quantityChanged = newQuantity !== item.quantity
    const categoryChanged = newCategory !== item.category
    const noteChanged = newNote !== item.note

    if (nameChanged || quantityChanged || categoryChanged || noteChanged) {
      const changes: Partial<
        Pick<Item, 'name' | 'quantity' | 'category' | 'note' | 'position'>
      > = {}
      if (nameChanged) changes.name = trimmedName
      if (quantityChanged) changes.quantity = newQuantity
      if (categoryChanged) changes.category = newCategory
      if (noteChanged) changes.note = newNote
      onSave(item.id, changes)
    } else {
      onCancelEdit()
    }
  }, [editName, editQuantity, editCategory, editNote, item, onSave, onCancelEdit])

  /**
   * Focus-scope blur handler: uses setTimeout(0) to let the browser complete
   * the focus transfer, then checks if the new activeElement is inside the row.
   */
  const handleRowBlur = useCallback(() => {
    setTimeout(() => {
      if (selectOpenRef.current) return
      if (rowRef.current && !rowRef.current.contains(document.activeElement)) {
        handleSave()
      }
    }, 0)
  }, [handleSave])

  /**
   * Enter key saves and exits edit mode.
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleSave()
      }
    },
    [handleSave]
  )

  // Delete confirmation mode
  if (isDeleting) {
    return (
      <DeleteConfirmation
        itemId={item.id}
        onCancel={onCancelDelete}
        onConfirm={onConfirmDelete}
      />
    )
  }

  // Edit mode
  if (isEditing) {
    return (
      <div
        ref={rowRef}
        className="flex flex-col gap-2 border-b border-border bg-secondary/50 px-3 py-2"
        onBlur={handleRowBlur}
      >
        {/* Row 1: Name + Quantity inputs */}
        <div className="flex items-center gap-2">
          <Input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            className="min-h-[40px] flex-1 text-base"
            aria-label="Item name"
          />
          <Input
            type="text"
            value={editQuantity}
            onChange={(e) => setEditQuantity(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Qty"
            className="min-h-[40px] w-16 text-base"
            aria-label="Quantity"
          />
        </div>
        {/* Row 2: Category Select + Trash + Cancel */}
        <div className="flex items-center gap-2">
          <Select
            value={editCategory}
            onValueChange={(val) => setEditCategory(val ?? '')}
            onOpenChange={(open) => { selectOpenRef.current = open }}
          >
            <SelectTrigger
              className="h-11 flex-1"
              onMouseDown={(e) => e.preventDefault()}
            >
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
          <Button
            variant="ghost"
            size="icon"
            onMouseDown={(e) => e.preventDefault()}
            onClick={onDelete}
            aria-label="Delete item"
          >
            <Trash2 className="size-5 text-muted-foreground hover:text-destructive" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onMouseDown={(e) => e.preventDefault()}
            onClick={onCancelEdit}
          >
            Cancel
          </Button>
        </div>
        {/* Row 3: Note input (ITEM-01 / D-04) — single-line, ≥16px, saves via handleSave */}
        <Input
          type="text"
          value={editNote}
          onChange={(e) => setEditNote(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a note (optional)"
          className="min-h-[40px] flex-1 text-base"
          aria-label="Note"
        />
      </div>
    )
  }

  // Display mode
  return (
    <div
      className={cn(
        'flex min-h-[48px] cursor-pointer items-center gap-3 border-b border-border px-3 py-2 hover:bg-secondary active:bg-secondary',
        item.checked && 'opacity-50'
      )}
      onClick={onTap}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onTap()
        }
      }}
    >
      {/* Checkbox FIRST — stops propagation so row-body onClick does not fire (D-01) */}
      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <Checkbox
          checked={item.checked}
          onCheckedChange={() => onToggle(item.id)}
          aria-label={`Mark ${item.name} as ${item.checked ? 'not bought' : 'bought'}`}
        />
      </div>

      {/* Attribution badge — reads from profilesStore by item.user_id (D-04/PROF-04)
          Fallback chain: profile avatar → profile name initials → frozen added_by → "?" */}
      {(() => {
        const profile = profiles[item.user_id ?? '']
        if (profile?.avatar_url) {
          return (
            <AttributionBadge
              name={profile.display_name ?? item.added_by ?? '?'}
              avatarUrl={profile.avatar_url}
            />
          )
        }
        if (profile?.display_name) {
          return <AttributionBadge name={profile.display_name} />
        }
        if (item.added_by) {
          return <AttributionBadge name={item.added_by} />
        }
        return (
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground"
            aria-label="Unknown person added this"
          >
            ?
          </div>
        )
      })()}

      {/* Name + note (stacked) — conditional strikethrough per D-05.
          Note (ITEM-01) renders as an escaped JSX text node ONLY — never
          dangerouslySetInnerHTML (stored-XSS guard, RESEARCH §V5). */}
      <div className="flex min-w-0 flex-1 flex-col">
        <span className={cn('text-base', item.checked && 'line-through')}>
          {item.name}
        </span>
        {item.note && (
          <span className="truncate text-sm text-muted-foreground">{item.note}</span>
        )}
      </div>

      {/* Quantity stepper (ITEM-03 / D-12/D-13) — replaces the plain quantity span.
          parseQuantity normalizes free text → leading int; − disabled at 1.
          Both buttons stopPropagation so a tap never opens edit mode. */}
      {(() => {
        const qty = parseQuantity(item.quantity)
        return (
          <div className="flex shrink-0 items-center">
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11"
              disabled={qty <= 1}
              aria-label="Decrease quantity"
              onClick={(e) => {
                e.stopPropagation()
                onSave(item.id, { quantity: String(Math.max(1, qty - 1)) })
              }}
            >
              <Minus className="size-5 text-muted-foreground" />
            </Button>
            <span className="w-6 text-center text-base tabular-nums">{qty}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11"
              aria-label="Increase quantity"
              onClick={(e) => {
                e.stopPropagation()
                onSave(item.id, { quantity: String(qty + 1) })
              }}
            >
              <Plus className="size-5 text-muted-foreground" />
            </Button>
          </div>
        )
      })()}
    </div>
  )
}
