# Analyze Action

Triggered by: "analyze screenshot", "gemma analyze <filename>"

## Flow

### Step 1: Read the screenshot
Screenshots are in `@context/screenshots/<filename>.png`

### Step 2: Send to gemma3:4b via Ollama API
```bash
IMAGE_PATH="context/screenshots/<filename>.png"
B64=$(base64 -i "$IMAGE_PATH")

python3 -c "
import json
payload = {
    'model': 'gemma3:4b',
    'prompt': 'Analyze this UI screenshot. Extract:
1. Color palette (hex codes for all distinct colors):
   - Header background and text
   - Sidebar background and text
   - Main content background
   - Primary/accent colors
   - Text colors (headings, body, muted)
   - Border colors
   - Any other notable colors
2. Layout structure (describe the grid/arrangement)
3. UI components visible (cards, tables, buttons, inputs, etc.)
4. Typography hints (font sizes, weights)
5. Spacing patterns (padding, margins)
6. Any icons or visual elements

Return as a structured analysis.',
    'images': ['$B64'],
    'stream': False
}
with open(\"/tmp/gemma_vision_payload.json\",\"w\") as f:
    json.dump(payload, f)
"
curl -s -X POST http://localhost:11434/api/generate \
  -d @/tmp/gemma_vision_payload.json \
  -o /tmp/gemma_vision_output.json \
  --max-time 300

python3 -c "
import json
d = json.load(open('/tmp/gemma_vision_output.json'))
analysis = d.get('response', 'ERROR')
print(analysis)
# Save for reference
with open('context/screenshots/<filename>-analysis.md', 'w') as f:
    f.write('# Screenshot Analysis: <filename>\\n\\n')
    f.write(analysis)
"
```

### Step 3: Apply findings
Save the color palette as temporary brand tokens in `index.css` or note them in `current-feature.md` under Notes.
Use the layout analysis to guide component structure.
Reference the component list for what UI elements to implement.
