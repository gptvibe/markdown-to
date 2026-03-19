import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import type {
  Blockquote,
  Code,
  Content,
  Delete,
  Emphasis,
  Heading,
  Html,
  InlineCode,
  Link,
  List,
  ListItem,
  Parent,
  PhrasingContent,
  Root,
  Strong,
  Table,
  TableCell,
  Text,
} from 'mdast'
import type { ConversionResult, ConversionWarning, PlatformId } from './types'

interface Context {
  platform: PlatformId
  warnings: ConversionWarning[]
}

const parser = unified().use(remarkParse).use(remarkGfm)

export function convertMarkdown(input: string, platform: PlatformId): ConversionResult {
  const tree = parser.parse(input) as Root
  const context: Context = { platform, warnings: [] }
  const output = renderRoot(tree, context).trim()

  return {
    output,
    warnings: dedupeWarnings(context.warnings),
  }
}

function dedupeWarnings(warnings: ConversionWarning[]): ConversionWarning[] {
  const seen = new Set<string>()
  const deduped: ConversionWarning[] = []

  for (const warning of warnings) {
    const key = `${warning.feature}:${warning.level}:${warning.message}`
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    deduped.push(warning)
  }

  return deduped
}

function warn(context: Context, warning: ConversionWarning): void {
  context.warnings.push(warning)
}

function renderRoot(root: Root, context: Context): string {
  return root.children
    .map((node) => renderBlock(node, context, 0))
    .join('')
    .replace(/\n{3,}/g, '\n\n')
}

function renderBlock(node: Content, context: Context, indent: number): string {
  switch (node.type) {
    case 'paragraph':
      return `${renderInlines(node.children, context)}\n\n`
    case 'heading':
      return renderHeading(node, context)
    case 'blockquote':
      return renderBlockquote(node, context)
    case 'list':
      return renderList(node, context, indent)
    case 'code':
      return renderCodeBlock(node, context)
    case 'thematicBreak':
      return context.platform === 'discord' ? '---\n\n' : '----------\n\n'
    case 'table':
      return renderTable(node, context)
    case 'html':
      return renderHtmlBlock(node, context)
    default:
      return ''
  }
}

function renderHeading(heading: Heading, context: Context): string {
  const text = renderInlines(extractPhrasingChildren(heading), context)

  if (context.platform === 'discord') {
    return `${'#'.repeat(Math.max(1, Math.min(3, heading.depth)))} ${text}\n\n`
  }

  warn(context, {
    feature: 'heading',
    level: 'degraded',
    message: 'Headings were converted to plain text for this platform.',
  })

  return `${text.toUpperCase()}\n\n`
}

function renderBlockquote(node: Blockquote, context: Context): string {
  const inner = node.children
    .map((child) => renderBlock(child, context, 0).trimEnd())
    .join('\n')
    .split('\n')
    .map((line) => (line.length > 0 ? `> ${line}` : '>'))
    .join('\n')

  return `${inner}\n\n`
}

function renderList(node: List, context: Context, indent: number): string {
  const lines = node.children.map((item, index) => renderListItem(item, index, node.ordered, context, indent))
  return `${lines.join('\n')}\n\n`
}

function renderListItem(
  item: ListItem,
  index: number,
  ordered: boolean | null | undefined,
  context: Context,
  indent: number,
): string {
  const marker = ordered ? `${index + 1}.` : '-'
  const prefix = `${' '.repeat(indent)}${marker} `
  const nestedIndent = indent + 2

  const renderedChildren = item.children
    .map((child) => {
      if (child.type === 'paragraph') {
        return renderInlines(child.children, context)
      }

      const rendered = renderBlock(child, context, nestedIndent).trimEnd()
      return rendered
        .split('\n')
        .map((line) => `${' '.repeat(nestedIndent)}${line}`)
        .join('\n')
        .trimEnd()
        .replace(/\n+$/g, '')
    })
    .filter((chunk) => chunk.length > 0)

  if (renderedChildren.length === 0) {
    return `${prefix}`
  }

  const [first, ...rest] = renderedChildren
  return [`${prefix}${first}`, ...rest].join('\n')
}

function renderCodeBlock(node: Code, context: Context): string {
  if (context.platform === 'plaintext') {
    return `${node.value}\n\n`
  }

  const language = node.lang ? node.lang.trim() : ''
  const fence = language.length > 0 ? `\`\`\`${language}` : '```'
  return `${fence}\n${node.value}\n\`\`\`\n\n`
}

function renderTable(node: Table, context: Context): string {
  warn(context, {
    feature: 'table',
    level: 'degraded',
    message: 'Tables were converted to plain text grid output.',
  })

  const rows = node.children.map((row) => row.children.map((cell) => tableCellText(cell, context).trim()))
  const columnCount = Math.max(0, ...rows.map((row) => row.length))
  const widths = new Array(columnCount).fill(0).map((_, column) => {
    return Math.max(...rows.map((row) => (row[column] ?? '').length), 1)
  })

  const formattedRows = rows.map((row) => {
    const padded = widths.map((width, column) => (row[column] ?? '').padEnd(width, ' '))
    return `| ${padded.join(' | ')} |`
  })

  return `${formattedRows.join('\n')}\n\n`
}

function tableCellText(cell: TableCell, context: Context): string {
  const phrasing = cell.children.filter(isPhrasingContent)
  return renderInlines(phrasing, context)
}

function renderHtmlBlock(node: Html, context: Context): string {
  const raw = node.value.trim()
  const underlineMatch = raw.match(/^<u>([\s\S]+)<\/u>$/i)

  if (!underlineMatch) {
    warn(context, {
      feature: 'html',
      level: 'unsupported',
      message: 'Inline HTML is not reliably supported and was preserved as plain text.',
    })

    return `${raw}\n\n`
  }

  const content = underlineMatch[1]
  if (context.platform === 'discord') {
    return `__${content}__\n\n`
  }

  if (context.platform === 'plaintext') {
    return `${content}\n\n`
  }

  warn(context, {
    feature: 'underline',
    level: 'degraded',
    message: 'Underline is not native on this platform and was flattened to plain text.',
  })

  return `${content}\n\n`
}

function renderInlines(nodes: PhrasingContent[], context: Context): string {
  return nodes.map((node) => renderInline(node, context)).join('')
}

function renderInline(node: PhrasingContent, context: Context): string {
  switch (node.type) {
    case 'text':
      return renderText(node, context)
    case 'strong':
      return renderStrong(node, context)
    case 'emphasis':
      return renderEmphasis(node, context)
    case 'delete':
      return renderDelete(node, context)
    case 'inlineCode':
      return renderInlineCode(node, context)
    case 'link':
      return renderLink(node, context)
    case 'break':
      return '\n'
    case 'html':
      return renderInlineHtml(node, context)
    default:
      return ''
  }
}

function renderText(node: Text, context: Context): string {
  return escapeLiteralText(node.value, context.platform)
}

function escapeLiteralText(value: string, platform: PlatformId): string {
  if (platform === 'plaintext') {
    return value
  }

  if (platform === 'whatsapp') {
    return escapeWithSet(value, new Set(['*', '_', '~', '`']))
  }

  if (platform === 'telegram') {
    return escapeWithSet(value, new Set(['*', '_', '~', '`', '[', ']', '(', ')']))
  }

  return escapeWithSet(value, new Set(['\\', '*', '_', '~', '`', '[', ']', '(', ')']))
}

function escapeWithSet(value: string, chars: Set<string>): string {
  let output = ''

  for (let i = 0; i < value.length; i += 1) {
    const current = value[i]
    const previous = i > 0 ? value[i - 1] : ''
    if (chars.has(current) && previous !== '\\') {
      output += `\\${current}`
      continue
    }

    output += current
  }

  return output
}

function renderStrong(node: Strong, context: Context): string {
  const content = renderInlines(extractPhrasingChildren(node), context)

  if (context.platform === 'plaintext') {
    return content
  }

  if (context.platform === 'discord') {
    return `**${content}**`
  }

  return `*${content}*`
}

function renderEmphasis(node: Emphasis, context: Context): string {
  const content = renderInlines(extractPhrasingChildren(node), context)

  if (context.platform === 'plaintext') {
    return content
  }

  if (context.platform === 'discord') {
    return `*${content}*`
  }

  return `_${content}_`
}

function renderDelete(node: Delete, context: Context): string {
  const content = renderInlines(extractPhrasingChildren(node), context)

  if (context.platform === 'plaintext') {
    return content
  }

  if (context.platform === 'discord') {
    return `~~${content}~~`
  }

  return `~${content}~`
}

function renderInlineCode(node: InlineCode, context: Context): string {
  const content = node.value.replace(/`/g, '\\`')

  if (context.platform === 'plaintext') {
    return content
  }

  return `\`${content}\``
}

function renderLink(node: Link, context: Context): string {
  const label = renderInlines(extractPhrasingChildren(node), context) || node.url

  if (context.platform === 'whatsapp' || context.platform === 'plaintext') {
    warn(context, {
      feature: 'link',
      level: 'degraded',
      message:
        context.platform === 'whatsapp'
          ? 'Labeled links were converted to readable text for WhatsApp compatibility.'
          : 'Labeled links were converted to readable text for plain text compatibility.',
    })

    if (label === node.url) {
      return node.url
    }

    return `${label} (${node.url})`
  }

  return `[${label}](${node.url})`
}

function renderInlineHtml(node: Html, context: Context): string {
  const raw = node.value.trim()
  const underlineMatch = raw.match(/^<u>([\s\S]+)<\/u>$/i)

  if (!underlineMatch) {
    warn(context, {
      feature: 'html',
      level: 'unsupported',
      message: 'Inline HTML was preserved as plain text.',
    })
    return raw
  }

  const content = underlineMatch[1]

  if (context.platform === 'discord') {
    return `__${content}__`
  }

  if (context.platform === 'plaintext') {
    return content
  }

  warn(context, {
    feature: 'underline',
    level: 'degraded',
    message: 'Underline is not native on this platform and was flattened to plain text.',
  })

  return content
}

function extractPhrasingChildren(node: Parent): PhrasingContent[] {
  return node.children.filter(isPhrasingContent)
}

function isPhrasingContent(value: Content): value is PhrasingContent {
  return (
    value.type === 'text' ||
    value.type === 'strong' ||
    value.type === 'emphasis' ||
    value.type === 'delete' ||
    value.type === 'inlineCode' ||
    value.type === 'link' ||
    value.type === 'break' ||
    value.type === 'html'
  )
}
