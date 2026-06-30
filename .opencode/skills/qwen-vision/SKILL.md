---
name: qwen-vision
description: Analyzes screenshots in @context/screenshots/ using qwen2.5vl:3b vision model. Extracts colors, layout structure, component hierarchy, and design tokens. Triggers on: analyze screenshot, vision, analyze image, screenshot.
---

# Vision Analysis

Uses `qwen2.5vl:3b` (local Ollama vision-language model) to analyze UI screenshots (gemma3:4b does not support vision inputs).

## Source

Screenshots are stored in `@context/screenshots/`.

## Pipeline Position

```
Screenshot → gemma3:4b → design spec → deepseek-coder:6.7b → frontend code
              (vision)                  (frontend gen)
                                       → qwen2.5-coder:7b  → backend code
                                                              (backend gen)
```

> **Note:** gemma3:4b only does vision analysis. **It does NOT generate code.** All frontend code generation is handled by `deepseek-coder:6.7b`. All backend code generation is handled by `qwen2.5-coder:7b`.

## Actions

| Action | Description |
|--------|-------------|
| **analyze** | Send a screenshot to qwen2.5vl:3b, extract colors/layout/components, save analysis |

## What Gemma Extracts

| Aspect | Output |
|--------|--------|
| Colors | Hex codes for header, sidebar, content, text, accents, borders |
| Layout | Structure diagram (header, sidebar, main, footer, sections) |
| Components | List of UI components visible (cards, tables, buttons, forms, etc.) |
| Typography | Font sizes, weights, text styles |
| Spacing | Padding, margins, gap patterns |
| Icons | Icon types and placement |
| States | Empty states, loading indicators, error displays |

## Keywords That Trigger This Skill

- "analyze screenshot" / "analyze image"
- "gemma analyze" / "gemma vision" / "gemma see"
- "what's in the screenshot" / "extract from screenshot"
- "vision" / "screenshot"
