# Multi-Select Menu — Phase 1: MultiSearchableSelect Component

## Platform

frontend

## Status

Not Started

## Goals

- Create a new `MultiSearchableSelect` component in `desktop/ui/components/shared/`
- Supports selecting MULTIPLE options (unlike `SearchableSelect` which is single-select)
- Shows selected items as removable tags/chips in the trigger
- Dropdown shows checkboxes next to each option
- Search/filter options in real-time
- Pure Tailwind + React — no new packages

## Notes

- This is a NEW component — `SearchableSelect` remains unchanged for single-select uses elsewhere
- Follows the same styling patterns as `SearchableSelect` for visual consistency
- Props use `string[]` for value instead of `string | null`
- Tags in the trigger should truncate long names and show an "X" to remove

## Component Interface

```typescript
interface MultiSearchableSelectOption {
  value: string
  label: string
}

interface Props {
  options: MultiSearchableSelectOption[]
  value: string[]
  onChange: (values: string[]) => void
  placeholder?: string
  searchPlaceholder?: string
  disabled?: boolean
  className?: string
  maxVisibleTags?: number  // default: 3, then "+N more"
}
```

## UI Behavior

### Trigger (closed state)
- Shows selected items as small chips/tags with "X" buttons
- If more than `maxVisibleTags` selected, shows "+N more" tag
- If nothing selected, shows `placeholder` text
- Click to open dropdown

### Dropdown (open state)
- Search input at top (same as SearchableSelect)
- Each option has a checkbox (checked if in `value` array)
- Clicking an option toggles it in/out of the array
- Click outside to close (same as SearchableSelect)

### Tags
- Small rounded pills with the option label + X button
- Truncate long labels with `truncate` class
- X button removes that option from the selection

## File Location

`desktop/ui/components/shared/MultiSearchableSelect.tsx`

## Verification

- Component renders with a list of options
- Clicking options toggles checkboxes and adds/removes tags
- Search filters the dropdown options
- Tags show "+N more" when exceeding maxVisibleTags
- Click outside closes the dropdown
- X on a tag removes that option
