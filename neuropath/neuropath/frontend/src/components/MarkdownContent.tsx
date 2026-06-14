import type { ReactNode } from 'react'

/**
 * Lightweight dependency-free Markdown renderer.
 * Supports the subset used by CurriculumAgent's content_md output:
 *   - ## headings
 *   - **bold** (incl. "**Why this matters:**" callout)
 *   - "- " bullet lists
 *   - "> " blockquotes
 *   - plain paragraphs
 */

function renderInline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*.*?\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="text-myelin font-semibold">{part.slice(2, -2)}</strong>
    }
    return <span key={i}>{part}</span>
  })
}

export default function MarkdownContent({ content }: { content: string }) {
  if (!content?.trim()) {
    return <p className="text-sm text-dim italic">No lesson content available for this concept yet.</p>
  }

  const lines = content.split('\n')
  const blocks: ReactNode[] = []
  let listBuffer: string[] = []

  function flushList(key: string) {
    if (listBuffer.length > 0) {
      blocks.push(
        <ul key={key} className="list-disc list-inside space-y-1 text-sm text-dim mb-3 ml-1">
          {listBuffer.map((item, i) => (
            <li key={i} className="text-myelin/90">{renderInline(item)}</li>
          ))}
        </ul>
      )
      listBuffer = []
    }
  }

  lines.forEach((line, idx) => {
    const trimmed = line.trim()
    const key = `b${idx}`

    if (trimmed.startsWith('## ')) {
      flushList(`l${idx}`)
      blocks.push(<h3 key={key} className="font-display text-base font-semibold text-myelin mt-4 mb-2">{trimmed.slice(3)}</h3>)
    } else if (trimmed.startsWith('- ')) {
      listBuffer.push(trimmed.slice(2))
    } else if (trimmed.startsWith('> ')) {
      flushList(`l${idx}`)
      blocks.push(
        <blockquote key={key} className="border-l-2 border-cortex/40 pl-3 text-sm text-cortex italic my-3">
          {renderInline(trimmed.slice(2))}
        </blockquote>
      )
    } else if (trimmed === '') {
      flushList(`l${idx}`)
    } else {
      flushList(`l${idx}`)
      blocks.push(<p key={key} className="text-sm text-dim leading-relaxed mb-3">{renderInline(trimmed)}</p>)
    }
  })
  flushList('lend')

  return <div>{blocks}</div>
}
