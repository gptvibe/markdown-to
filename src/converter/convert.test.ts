import { describe, expect, it } from 'vitest'
import { convertMarkdown } from './convert'

describe('convertMarkdown', () => {
  it('converts strong emphasis for WhatsApp', () => {
    const result = convertMarkdown('**hello**', 'whatsapp')
    expect(result.output).toBe('*hello*')
  })

  it('keeps Discord heading syntax', () => {
    const result = convertMarkdown('# Title', 'discord')
    expect(result.output).toBe('# Title')
    expect(result.warnings).toHaveLength(0)
  })

  it('degrades headings for WhatsApp with a warning', () => {
    const result = convertMarkdown('## Launch', 'whatsapp')
    expect(result.output).toBe('LAUNCH')
    expect(result.warnings.some((warning) => warning.feature === 'heading')).toBe(true)
  })

  it('converts markdown links to readable text for WhatsApp', () => {
    const result = convertMarkdown('[Guide](https://example.com)', 'whatsapp')
    expect(result.output).toBe('Guide (https://example.com)')
    expect(result.warnings.some((warning) => warning.feature === 'link')).toBe(true)
  })

  it('renders Discord strikethrough syntax', () => {
    const result = convertMarkdown('~~deprecated~~', 'discord')
    expect(result.output).toBe('~~deprecated~~')
  })

  it('degrades table output and emits warning', () => {
    const markdown = '| A | B |\n| - | - |\n| 1 | 2 |'
    const result = convertMarkdown(markdown, 'telegram')
    expect(result.output).toContain('| A | B |')
    expect(result.warnings.some((warning) => warning.feature === 'table')).toBe(true)
  })

  it('strips markdown emphasis tokens for plain text mode', () => {
    const result = convertMarkdown('**bold** _ital_ ~~old~~ `code`', 'plaintext')
    expect(result.output).toBe('bold ital old code')
  })

  it('converts labeled links to readable text for plain text mode', () => {
    const result = convertMarkdown('[Repo](https://github.com/gptvibe/markdown-to)', 'plaintext')
    expect(result.output).toBe('Repo (https://github.com/gptvibe/markdown-to)')
    expect(result.warnings.some((warning) => warning.feature === 'link')).toBe(true)
  })
})
