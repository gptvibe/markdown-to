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

const SAMPLE_INPUT = `# Product Update

Hey team, here is the **launch summary**:

1. The *mobile build* is live.
2. Please review \`/release-notes\`.
3. Escalations should go to [On-call Guide](https://example.com/on-call).

> Shipping quality matters more than speed.

| Area | Status |
| --- | --- |
| Auth | Done |
| Billing | In review |

Thanks!`

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
