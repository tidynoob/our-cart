import { useState, useRef, useEffect, useCallback } from 'react'
import { Trash2 } from 'lucide-react'
import type { Item } from '@/types/item'
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

interface ItemRowProps {
  item: Item
  isEditing: boolean
  isDeleting: boolean
  onTap: () => void
  onDelete: () => void
  onCancelDelete: () => void
  onConfirmDelete: () => void
  onCancelEdit: () => void
  onSave: (id: string, changes: Partial<Pick<Item, 'name' | 'quantity' | 'category'>>) => void
  onToggle: (id: string) => void
  currentUserId?: string | null
  currentUserDisplayName?: string
  currentUserAvatarUrl?: string | null
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
  currentUserId,
  currentUserDisplayName,
  currentUserAvatarUrl,
}: ItemRowProps) {
  const rowRef = useRef<HTMLDivElement>(null)
  const selectOpenRef = useRef(false)
  const [editName, setEditName] = useState('')
  const [editQuantity, setEditQuantity] = useState('')
  const [editCategory, setEditCategory] = useState('')

  // Initialize local edit state when entering edit mode
  useEffect(() => {
    if (isEditing) {
      setEditName(item.name)
      setEditQuantity(item.quantity || '')
      setEditCategory(item.category || '')
    }
  }, [isEditing, item.name, item.quantity, item.category])

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

    const nameChanged = trimmedName !== item.name
    const quantityChanged = newQuantity !== item.quantity
    const categoryChanged = newCategory !== item.category

    if (nameChanged || quantityChanged || categoryChanged) {
      const changes: Partial<Pick<Item, 'name' | 'quantity' | 'category'>> = {}
      if (nameChanged) changes.name = trimmedName
      if (quantityChanged) changes.quantity = newQuantity
      if (categoryChanged) changes.category = newCategory
      onSave(item.id, changes)
    } else {
      onCancelEdit()
    }
  }, [editName, editQuantity, editCategory, item, onSave, onCancelEdit])

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

      {/* Attribution badge (position unchanged per D-02) */}
      {/* D-06: own item → live name + avatar; else frozen added_by → initials; else "?" */}
      {(() => {
        const isOwnItem = item.user_id != null && item.user_id === currentUserId
        if (isOwnItem) {
          return (
            <AttributionBadge
              name={currentUserDisplayName ?? item.added_by ?? '?'}
              avatarUrl={currentUserAvatarUrl ?? undefined}
            />
          )
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

      {/* Name — conditional strikethrough per D-05 */}
      <span className={cn('flex-1 text-base', item.checked && 'line-through')}>
        {item.name}
      </span>

      {item.quantity && (
        <span className="text-sm text-muted-foreground">{item.quantity}</span>
      )}
    </div>
  )
}
