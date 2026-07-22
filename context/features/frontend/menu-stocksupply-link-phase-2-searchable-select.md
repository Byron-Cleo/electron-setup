# Menu-StockSupply Link — Phase 2: Reusable SearchableSelect Component

## Platform

frontend

## Status

Not Started

## Goals

- Create a reusable `SearchableSelect` component in `desktop/ui/components/shared/`
- Shows ALL dropdown options by default when opened
- Filters options in real-time as user types to search
- Allows selecting an option to populate the input field
- Pure Tailwind + React — no new packages

## Notes

- This phase depends on Phase 1 (backend must accept `menuId`)
- Component goes in `shared/` folder for reuse across the app
- Label only shows menu item name (e.g. "Beef Fry"), not IDs or extra details
- The internal value is the ID, but user only sees the name

---

## Files to Create/Modify

| File | Action | Changes |
|------|--------|---------|
| desktop/ui/components/shared/SearchableSelect.tsx | **Create** | New reusable searchable dropdown component |

---

## Tasks

### Task 1: Create SearchableSelect Component

1. Create `desktop/ui/components/shared/SearchableSelect.tsx`

### Component Interface

```typescript
interface SearchableSelectOption {
  value: string    // ID or any unique value
  label: string    // Display text (menu name)
}

interface Props {
  options: SearchableSelectOption[]
  value: string | null
  onChange: (value: string | null) => void
  placeholder?: string          // e.g. "Select menu item"
  searchPlaceholder?: string    // e.g. "Search menus..."
  disabled?: boolean
}
```

### Behavior

1. **Closed state**: Shows a button/trigger displaying the selected label or placeholder text
2. **Open state**: Shows an input field + scrollable list of options below
3. **All options visible**: When opened, ALL options are shown immediately
4. **Search filtering**: As user types in the input, options filter in real-time (case-insensitive)
5. **Select option**: Click an option → populates the input with the label, closes dropdown
6. **Clear selection**: X button to clear the selected value (sets to null)
7. **Click outside**: Closes the dropdown

### UI Layout

```
┌──────────────────────────────────────────┐
│  [Search input field_______________] [X] │
│  ──────────────────────────────────────  │
│  │ Beef Fry                          │  │
│  │ Chicken Fry                       │  │
│  │ Chicken Stew                      │  │
│  │ Fish Fry                          │  │
│  │ Rice                              │  │
│  └─────────────────────────────────────┘ │
└──────────────────────────────────────────┘
```

When typing "chicken":
```
┌──────────────────────────────────────────┐
│  [chicken________________________] [X]   │
│  ──────────────────────────────────────  │
│  │ Chicken Fry                       │  │
│  │ Chicken Stew                      │  │
│  └─────────────────────────────────────┘ │
└──────────────────────────────────────────┘
```

### Styling

- Match existing shadcn/ui patterns (border, rounded, padding)
- Use `cn()` from `@/lib/utils` for conditional classes
- Dropdown uses `bg-popover` with shadow and border
- Hover state on options: `bg-admin-content/50`
- Selected option highlighted with `bg-admin-accent/10 text-admin-accent`
- Max height with overflow-y-auto for long lists (max-h-60)
- Empty state: "No results found"

---

## UI Mockup

### Default (no selection)

```
┌──────────────────────────────────────────┐
│  Select menu item...                  ▼  │
└──────────────────────────────────────────┘
```

### Open (all options)

```
┌──────────────────────────────────────────┐
│  Search menus...                     [X] │
├──────────────────────────────────────────┤
│  Beef Fry                                │
│  Chicken Fry                             │
│  Chicken Stew                            │
│  Fish Fry                                │
│  Rice                                    │
└──────────────────────────────────────────┘
```

### With selection

```
┌──────────────────────────────────────────┐
│  Chicken Fry                        [X]  │
└──────────────────────────────────────────┘
```

---

## State Management

```typescript
const [open, setOpen] = useState(false)
const [search, setSearch] = useState("")

const filteredOptions = useMemo(() => {
  if (!search) return options
  const q = search.toLowerCase()
  return options.filter(opt => opt.label.toLowerCase().includes(q))
}, [options, search])
```

---

## Edge Cases

- **Empty options list**: Show "No options available"
- **No search results**: Show "No results found"
- **Long option names**: Truncate with ellipsis
- **Many options**: Scroll with max-height container
- **Disabled state**: Greyed out, non-interactive
- **Clear button**: Only show when a value is selected

---

## Testing Checklist

- [ ] Component renders with placeholder when no value selected
- [ ] Clicking opens dropdown with all options visible
- [ ] Typing filters options in real-time (case-insensitive)
- [ ] Clicking an option selects it and closes dropdown
- [ ] X button clears the selection
- [ ] Empty options shows "No options available"
- [ ] No search results shows "No results found"
- [ ] Component works with disabled state
- [ ] Component integrates with form field layout
