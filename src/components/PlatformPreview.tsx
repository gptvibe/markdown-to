import { useMemo } from 'react'
import type { PlatformId } from '../converter/types'
import './PlatformPreview.css'

// ─── Inline token types ──────────────────────────────────────────────────────

type InlineToken =
  | { type: 'text'; value: string }
  | { type: 'bold'; value: string }
  | { type: 'italic'; value: string }
  | { type: 'strike'; value: string }
  | { type: 'underline'; value: string }
  | { type: 'code'; value: string }
  | { type: 'link'; label: string; url: string }

// ─── Block types ─────────────────────────────────────────────────────────────

type Block =
  | { type: 'paragraph'; lines: InlineToken[][] }
  | { type: 'blockquote'; lines: InlineToken[][] }
  | { type: 'ul'; items: InlineToken[][] }
  | { type: 'ol'; items: InlineToken[][] }
  | { type: 'codeblock'; lang: string; code: string }
  | { type: 'heading'; level: number; tokens: InlineToken[] }
  | { type: 'table'; rows: string[][] }

// ─── Inline tokenizer ─────────────────────────────────────────────────────────

function tokenizeInline(text: string, platform: PlatformId): InlineToken[] {
  const tokens: InlineToken[] = []
  let i = 0
  let buf = ''

  const flush = () => {
    if (buf) {
      tokens.push({ type: 'text', value: buf })
      buf = ''
    }
  }

  while (i < text.length) {
    const s = text.slice(i)

    // Inline code (all platforms)
    const code = s.match(/^`([^`\n]+)`/)
    if (code) {
      flush()
      tokens.push({ type: 'code', value: code[1] })
      i += code[0].length
      continue
    }

    // Markdown link [label](url) — Telegram + Discord
    if (platform !== 'whatsapp') {
      const link = s.match(/^\[([^\]\n]+)\]\(([^)\n]+)\)/)
      if (link) {
        flush()
        tokens.push({ type: 'link', label: link[1], url: link[2] })
        i += link[0].length
        continue
      }
    }

    if (platform === 'discord') {
      const bold = s.match(/^\*\*(.+?)\*\*/)
      if (bold) { flush(); tokens.push({ type: 'bold', value: bold[1] }); i += bold[0].length; continue }
      const italic = s.match(/^\*(.+?)\*/)
      if (italic) { flush(); tokens.push({ type: 'italic', value: italic[1] }); i += italic[0].length; continue }
      const strike = s.match(/^~~(.+?)~~/)
      if (strike) { flush(); tokens.push({ type: 'strike', value: strike[1] }); i += strike[0].length; continue }
      const under = s.match(/^__(.+?)__/)
      if (under) { flush(); tokens.push({ type: 'underline', value: under[1] }); i += under[0].length; continue }
    } else {
      // WhatsApp / Telegram (user-typed syntax)
      const bold = s.match(/^\*([^*\n]+)\*/)
      if (bold) { flush(); tokens.push({ type: 'bold', value: bold[1] }); i += bold[0].length; continue }
      const italic = s.match(/^_([^_\n]+)_/)
      if (italic) { flush(); tokens.push({ type: 'italic', value: italic[1] }); i += italic[0].length; continue }
      const strike = s.match(/^~([^~\n]+)~/)
      if (strike) { flush(); tokens.push({ type: 'strike', value: strike[1] }); i += strike[0].length; continue }
    }

    buf += text[i]
    i++
  }

  flush()
  return tokens
}

// ─── Block parser ─────────────────────────────────────────────────────────────

function isTableLine(line: string): boolean {
  return /^\|.+\|/.test(line)
}

function parseTableRow(line: string): string[] {
  return line.split('|').slice(1, -1).map((cell) => cell.trim())
}

function parseBlocks(text: string, platform: PlatformId): Block[] {
  const lines = text.split('\n')
  const blocks: Block[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    if (line.trim() === '') { i++; continue }

    // Code block
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim()
      const code: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) { code.push(lines[i]); i++ }
      i++ // skip closing ```
      blocks.push({ type: 'codeblock', lang, code: code.join('\n') })
      continue
    }

    // Blockquote
    if (line.startsWith('> ') || line === '>') {
      const bqLines: InlineToken[][] = []
      while (i < lines.length && (lines[i].startsWith('> ') || lines[i] === '>')) {
        bqLines.push(tokenizeInline(lines[i].replace(/^> ?/, ''), platform))
        i++
      }
      blocks.push({ type: 'blockquote', lines: bqLines })
      continue
    }

    // Discord heading
    if (platform === 'discord') {
      const hm = line.match(/^(#{1,3}) (.+)/)
      if (hm) {
        blocks.push({ type: 'heading', level: hm[1].length, tokens: tokenizeInline(hm[2], platform) })
        i++
        continue
      }
    }

    // Unordered list
    if (/^- /.test(line)) {
      const items: InlineToken[][] = []
      while (i < lines.length && /^- /.test(lines[i])) {
        items.push(tokenizeInline(lines[i].slice(2), platform))
        i++
      }
      blocks.push({ type: 'ul', items })
      continue
    }

    // Ordered list
    if (/^\d+\. /.test(line)) {
      const items: InlineToken[][] = []
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(tokenizeInline(lines[i].replace(/^\d+\. /, ''), platform))
        i++
      }
      blocks.push({ type: 'ol', items })
      continue
    }

    // Table (pipe-delimited)
    if (isTableLine(line)) {
      const rows: string[][] = []
      while (i < lines.length && isTableLine(lines[i])) {
        rows.push(parseTableRow(lines[i]))
        i++
      }
      blocks.push({ type: 'table', rows })
      continue
    }

    // Paragraph — collect until blank line or new block type
    const paraLines: InlineToken[][] = []
    while (i < lines.length) {
      const l = lines[i]
      if (l.trim() === '') break
      if (l.startsWith('```') || l.startsWith('> ') || l === '>') break
      if (/^- /.test(l) || /^\d+\. /.test(l)) break
      if (isTableLine(l)) break
      if (platform === 'discord' && /^#{1,3} /.test(l)) break
      paraLines.push(tokenizeInline(l, platform))
      i++
    }
    if (paraLines.length > 0) blocks.push({ type: 'paragraph', lines: paraLines })
  }

  return blocks
}

// ─── Render helpers ───────────────────────────────────────────────────────────

function renderTokens(tokens: InlineToken[], keyPrefix: string): React.ReactNode[] {
  return tokens.map((t, idx) => {
    const k = `${keyPrefix}-${idx}`
    switch (t.type) {
      case 'text': return t.value
      case 'bold': return <strong key={k}>{t.value}</strong>
      case 'italic': return <em key={k}>{t.value}</em>
      case 'strike': return <del key={k}>{t.value}</del>
      case 'underline': return <u key={k}>{t.value}</u>
      case 'code': return <code key={k} className="pp-icode">{t.value}</code>
      case 'link': return <a key={k} href={t.url} target="_blank" rel="noopener noreferrer">{t.label}</a>
    }
  })
}

function renderLines(lines: InlineToken[][], keyPrefix: string): React.ReactNode[] {
  const result: React.ReactNode[] = []
  lines.forEach((line, li) => {
    if (li > 0) result.push(<br key={`${keyPrefix}-br-${li}`} />)
    result.push(...renderTokens(line, `${keyPrefix}-${li}`))
  })
  return result
}

function renderBlocks(blocks: Block[]): React.ReactNode {
  return blocks.map((block, bi) => {
    const k = `b${bi}`
    switch (block.type) {
      case 'heading':
        if (block.level === 1) return <h3 key={k} className="pp-h1">{renderTokens(block.tokens, k)}</h3>
        if (block.level === 2) return <h4 key={k} className="pp-h2">{renderTokens(block.tokens, k)}</h4>
        return <h5 key={k} className="pp-h3">{renderTokens(block.tokens, k)}</h5>
      case 'codeblock':
        return (
          <pre key={k} className="pp-cb">
            {block.lang && <span className="pp-cb-lang">{block.lang}</span>}
            <code>{block.code}</code>
          </pre>
        )
      case 'blockquote':
        return (
          <blockquote key={k} className="pp-bq">
            {block.lines.map((line, li) => (
              <p key={`${k}-${li}`}>{renderTokens(line, `${k}-${li}`)}</p>
            ))}
          </blockquote>
        )
      case 'ul':
        return (
          <ul key={k} className="pp-ul">
            {block.items.map((item, ii) => (
              <li key={`${k}-${ii}`}>{renderTokens(item, `${k}-${ii}`)}</li>
            ))}
          </ul>
        )
      case 'ol':
        return (
          <ol key={k} className="pp-ol">
            {block.items.map((item, ii) => (
              <li key={`${k}-${ii}`}>{renderTokens(item, `${k}-${ii}`)}</li>
            ))}
          </ol>
        )
      case 'table':
        return (
          <div key={k} className="pp-table-wrap">
            <table className="pp-table">
              <tbody>
                {block.rows.map((row, ri) => (
                  <tr key={`${k}-r${ri}`} className={ri === 0 ? 'pp-table-head' : ''}>
                    {row.map((cell, ci) => <td key={`${k}-r${ri}-c${ci}`}>{cell}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      case 'paragraph':
        return <p key={k} className="pp-para">{renderLines(block.lines, k)}</p>
      default:
        return null
    }
  })
}

// ─── WhatsApp shell ───────────────────────────────────────────────────────────

function WhatsAppPreview({ blocks }: { blocks: Block[] }) {
  return (
    <div className="pp-shell pp-wa">
      <div className="pp-bar pp-bar--wa">
        <div className="pp-bar-back" aria-hidden="true">‹</div>
        <div className="pp-bar-avatar pp-bar-avatar--wa" aria-hidden="true" />
        <div className="pp-bar-info">
          <div className="pp-bar-name">GPTVibe</div>
          <div className="pp-bar-sub">online</div>
        </div>
        <div className="pp-bar-actions" aria-hidden="true">
          <span>📹</span>
          <span>📞</span>
          <span>⋮</span>
        </div>
      </div>
      <div className="pp-chat pp-chat--wa">
        <div className="pp-msg pp-msg--wa">
          <div className="pp-msg-body">{renderBlocks(blocks)}</div>
          <div className="pp-msg-meta">
            11:59 <span className="pp-ticks">✓✓</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Telegram shell ───────────────────────────────────────────────────────────

function TelegramPreview({ blocks }: { blocks: Block[] }) {
  return (
    <div className="pp-shell pp-tg">
      <div className="pp-bar pp-bar--tg">
        <div className="pp-bar-back" aria-hidden="true">‹</div>
        <div className="pp-bar-avatar pp-bar-avatar--tg" aria-hidden="true" />
        <div className="pp-bar-info">
          <div className="pp-bar-name">GPTVibe</div>
          <div className="pp-bar-sub">online</div>
        </div>
        <div className="pp-bar-actions" aria-hidden="true">
          <span>🔍</span>
          <span>⋮</span>
        </div>
      </div>
      <div className="pp-chat pp-chat--tg">
        <div className="pp-msg pp-msg--tg">
          <div className="pp-msg-body">{renderBlocks(blocks)}</div>
          <div className="pp-msg-meta">11:59</div>
        </div>
      </div>
    </div>
  )
}

// ─── Discord shell ────────────────────────────────────────────────────────────

function DiscordPreview({ blocks }: { blocks: Block[] }) {
  return (
    <div className="pp-shell pp-dc">
      <div className="pp-dc-sidebar" aria-hidden="true">
        <div className="pp-dc-guild pp-dc-guild--active" />
        <div className="pp-dc-sep" />
        <div className="pp-dc-guild pp-dc-guild--dim" />
        <div className="pp-dc-guild pp-dc-guild--dim" />
      </div>
      <div className="pp-dc-channels" aria-hidden="true">
        <div className="pp-dc-server-name">GPTVibe</div>
        <div className="pp-dc-channel-group">TEXT CHANNELS</div>
        <div className="pp-dc-channel pp-dc-channel--active"># general</div>
        <div className="pp-dc-channel"># random</div>
        <div className="pp-dc-channel"># announcements</div>
      </div>
      <div className="pp-dc-main">
        <div className="pp-dc-topbar">
          <span className="pp-dc-topbar-hash">#</span> general
        </div>
        <div className="pp-chat pp-chat--dc">
          <div className="pp-dc-msg">
            <div className="pp-dc-avatar" aria-hidden="true">G</div>
            <div className="pp-dc-msgbody">
              <div className="pp-dc-meta">
                <span className="pp-dc-username">GPTVibe</span>
                <span className="pp-dc-ts">Today at 11:59 AM</span>
              </div>
              <div className="pp-dc-content">{renderBlocks(blocks)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function PlainTextPreview({ blocks }: { blocks: Block[] }) {
  return (
    <div className="pp-shell pp-im">
      <div className="pp-bar pp-bar--im">
        <div className="pp-bar-back" aria-hidden="true">‹</div>
        <div className="pp-bar-info">
          <div className="pp-bar-name">Messages</div>
          <div className="pp-bar-sub">iMessage-friendly plain text</div>
        </div>
      </div>
      <div className="pp-chat pp-chat--im">
        <div className="pp-msg pp-msg--im">
          <div className="pp-msg-body">{renderBlocks(blocks)}</div>
          <div className="pp-msg-meta">11:59</div>
        </div>
      </div>
    </div>
  )
}

// ─── Exported component ───────────────────────────────────────────────────────

interface Props {
  platform: PlatformId
  text: string
}

export function PlatformPreview({ platform, text }: Props) {
  const blocks = useMemo(() => parseBlocks(text, platform), [text, platform])

  if (platform === 'whatsapp') return <WhatsAppPreview blocks={blocks} />
  if (platform === 'telegram') return <TelegramPreview blocks={blocks} />
  if (platform === 'plaintext') return <PlainTextPreview blocks={blocks} />
  return <DiscordPreview blocks={blocks} />
}
