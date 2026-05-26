import { cn } from '@/lib/utils'

export type SuggestionItem = {
  name: string
  category: string | null
  quantity: string | null
}

interface AutocompleteSuggestionsProps {
  suggestions: SuggestionItem[]
  focusedIndex: number
  onSelect: (item: SuggestionItem) => void
}

export function AutocompleteSuggestions({
  suggestions,
  focusedIndex,
  onSelect,
}: AutocompleteSuggestionsProps) {
  return (
    <ul
      id="autocomplete-listbox"
      role="listbox"
      className="absolute left-0 right-0 z-50 mt-1 max-h-[280px] overflow-y-auto rounded-lg border border-border bg-popover shadow-md"
    >
      {suggestions.map((item, index) => (
        <li
          key={item.name}
          id={`suggestion-${index}`}
          role="option"
          aria-selected={index === focusedIndex}
          className={cn(
            'flex min-h-[44px] cursor-pointer items-center gap-2 border-b border-border px-3 py-2 last:border-b-0 hover:bg-accent hover:text-accent-foreground',
            index === focusedIndex && 'bg-accent text-accent-foreground'
          )}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onSelect(item)}
        >
          <span className="flex-1 text-base">{item.name}</span>
          {item.category && (
            <span className="text-sm text-muted-foreground">
              {item.category}
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}
