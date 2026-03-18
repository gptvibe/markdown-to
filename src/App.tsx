import { useMemo, useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { convertMarkdown } from './converter/convert'
import { PlatformPreview } from './components/PlatformPreview'
import type { PlatformId } from './converter/types'
import './App.css'

const PLATFORM_LABELS: Record<PlatformId, string> = {
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
  discord: 'Discord',
}

const SAMPLE_INPUT = `# Introducing markdown-to by GPTVibe

Hey everyone! 🎉 We just launched **markdown-to** — a free tool that converts ChatGPT-style Markdown into _platform-ready_ formatting for WhatsApp, Telegram, and Discord.

Built entirely with [GitHub Copilot](https://github.com/features/copilot) as a pair-programming session — from converter engine to Docker deployment.

## What it does

1. Paste any **ChatGPT** response into the editor
2. Pick your *target platform*
3. Copy the converted output — ready to send!

> No more asterisks showing up as literal text in WhatsApp. Just clean, properly formatted messages.

\`\`\`bash
docker run -d -p 43817:80 gptvibe/markdown-to:latest
\`\`\`

| Platform | Bold | Italic | Strikethrough |
| --- | --- | --- | --- |
| WhatsApp | *text* | _text_ | ~text~ |
| Telegram | *text* | _text_ | ~text~ |
| Discord | **text** | *text* | ~~text~~ |

Give it a try and ⭐ the repo at [github.com/gptvibe/markdown-to](https://github.com/gptvibe/markdown-to)!`

function App() {
  const [input, setInput] = useState<string>(SAMPLE_INPUT)
  const [platform, setPlatform] = useState<PlatformId>('whatsapp')

  const result = useMemo(() => convertMarkdown(input, platform), [input, platform])

  const copyOutput = async (): Promise<void> => {
    await navigator.clipboard.writeText(result.output)
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <p className="eyebrow">markdown to</p>
        <h1>ChatGPT Markdown to Messaging Formats</h1>
        <p className="subtitle">
          Convert standard Markdown into platform-ready output for WhatsApp, Telegram, and Discord.
        </p>
        <a
          className="github-link"
          href="https://github.com/gptvibe/markdown-to"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="View source on GitHub"
        >
          <svg height="18" viewBox="0 0 16 16" width="18" aria-hidden="true" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38
              0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13
              -.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66
              .07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15
              -.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.65 7.65 0 0 1 2-.27
              c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12
              .51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48
              0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"
            />
          </svg>
          gptvibe/markdown-to
        </a>
      </header>

      <section className="control-row">
        <label htmlFor="platform">Target platform</label>
        <select
          id="platform"
          value={platform}
          onChange={(event) => setPlatform(event.target.value as PlatformId)}
        >
          {Object.entries(PLATFORM_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button type="button" onClick={copyOutput}>
          Copy Output
        </button>
      </section>

      <section className="editor-grid">
        <div className="panel">
          <h2>Source (ChatGPT Markdown)</h2>
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            spellCheck={false}
            aria-label="Source markdown input"
          />
        </div>
        <div className="panel">
          <h2>Output ({PLATFORM_LABELS[platform]})</h2>
          <textarea value={result.output} readOnly spellCheck={false} aria-label="Converted output" />
        </div>
      </section>

      <section className="preview-grid">
        <div className="panel preview">
          <h2>Source Preview</h2>
          <Markdown remarkPlugins={[remarkGfm]}>{input}</Markdown>
        </div>
        <div className="panel panel--platform">
          <h2>Platform Preview <span className="platform-label">({PLATFORM_LABELS[platform]})</span></h2>
          <PlatformPreview platform={platform} text={result.output} />
        </div>
      </section>

      <section className="panel warning-panel">
        <h2>Compatibility Notes</h2>
        {result.warnings.length === 0 ? (
          <p className="status-ok">No formatting compatibility issues detected for this conversion.</p>
        ) : (
          <ul>
            {result.warnings.map((warning) => (
              <li key={`${warning.feature}-${warning.level}-${warning.message}`}>
                <strong>{warning.feature}</strong> ({warning.level}): {warning.message}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}

export default App
