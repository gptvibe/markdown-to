# markdown to

markdown to is a web app that converts ChatGPT-style Markdown into platform-specific message formatting for:

- WhatsApp
- Telegram (user-typed mode)
- Discord

It also renders source and converted Markdown side-by-side and shows a compatibility report for lossy or unsupported transformations.

## What Is Implemented

- Parser-first conversion pipeline (Markdown AST via remark)
- Platform-specific output adapters (WhatsApp, Telegram, Discord)
- Compatibility warnings for degraded or unsupported features
- Desktop + mobile responsive UI
- Input and output preview rendering
- Unit tests for core converter behavior

## Platform Mapping (V1)

| Feature | Source (ChatGPT Markdown) | WhatsApp | Telegram (user-typed) | Discord |
| --- | --- | --- | --- | --- |
| Bold | **text** | *text* | *text* | **text** |
| Italic | *text* | _text_ | _text_ | *text* |
| Strikethrough | ~~text~~ | ~text~ | ~text~ | ~~text~~ |
| Inline code | `text` | `text` | `text` | `text` |
| Code block | ``` | ``` | ``` | ``` |
| List | -, 1. | -, 1. | -, 1. | -, 1. |
| Blockquote | > text | > text | > text | > text |
| Underline | HTML or intent | degraded | degraded | __text__ |
| Tables | GFM table | plain-text grid | plain-text grid | plain-text grid |

## Conversion Strategy

1. Parse Markdown to AST using remark.
2. Normalize and walk nodes in deterministic order:
   Block transforms first, then inline transforms.
3. Apply platform adapter rules.
4. Emit compatibility warnings for non-lossless transforms.
5. Render final output and previews.

## Run Locally

```bash
npm install
npm run dev
```

Build:

```bash
npm run build
```

Tests:

```bash
npm run test
```

## Project Structure

- src/App.tsx: Main app UI and state
- src/converter/convert.ts: Conversion engine
- src/converter/types.ts: Shared converter types
- src/converter/convert.test.ts: Unit tests for conversion behavior

## Adding New Platforms

1. Add a new PlatformId in src/converter/types.ts.
2. Extend rendering rules in src/converter/convert.ts.
3. Add mapping and warning behavior for unsupported syntax.
4. Add fixture tests in src/converter/convert.test.ts.
