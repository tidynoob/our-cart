import type { Item } from '@/types/item'
import { ItemRow } from '@/components/ItemRow'

interface CategorySectionProps {
  category: string
  items: Item[]
  editingItemId: string | null
  deletingItemId: string | null
  onItemTap: (id: string) => void
  onCancelEdit: () => void
  onSave: (id: string, changes: Partial<Pick<Item, 'name' | 'quantity' | 'category'>>) => void
  onDelete: (id: string) => void
  onConfirmDelete: (id: string) => void
  onCancelDelete: () => void
  onToggle: (id: string) => void
}

/**
 * Category section with a header and list of item rows.
 * Empty categories are never rendered (handled by groupItemsByCategory).
 *
 * Per D-06: bold section headers with uppercase text.
 * Per accessibility spec: category headers have role="heading" aria-level={3}.
 * Passes edit/delete/toggle state and handlers through to each ItemRow.
 */
export function CategorySection({
  category,
  items,
  editingItemId,
  deletingItemId,
  onItemTap,
  onCancelEdit,
  onSave,
  onDelete,
  onConfirmDelete,
  onCancelDelete,
  onToggle,
}: CategorySectionProps) {
  return (
    <div>
      <div
        className="rounded-sm bg-secondary px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        role="heading"
        aria-level={3}
      >
        {category}
      </div>
      <div>
        {items.map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            isEditing={item.id === editingItemId}
            isDeleting={item.id === deletingItemId}
            onTap={() => onItemTap(item.id)}
            onCancelEdit={onCancelEdit}
            onSave={onSave}
            onDelete={() => onDelete(item.id)}
            onCancelDelete={onCancelDelete}
            onConfirmDelete={() => onConfirmDelete(item.id)}
            onToggle={() => onToggle(item.id)}
          />
        ))}
      </div>
    </div>
  )
}
