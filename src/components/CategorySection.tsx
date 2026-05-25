import type { Item } from '@/types/item'
import { ItemRow } from '@/components/ItemRow'

interface CategorySectionProps {
  category: string
  items: Item[]
  onItemTap: (id: string) => void
}

/**
 * Category section with a header and list of item rows.
 * Empty categories are never rendered (handled by groupItemsByCategory).
 *
 * Per D-06: bold section headers with uppercase text.
 * Per accessibility spec: category headers have role="heading" aria-level={3}.
 */
export function CategorySection({ category, items, onItemTap }: CategorySectionProps) {
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
            isEditing={false}
            onTap={() => onItemTap(item.id)}
          />
        ))}
      </div>
    </div>
  )
}
