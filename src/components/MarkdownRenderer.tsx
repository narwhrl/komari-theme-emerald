interface Token {
  type: 'text' | 'bold' | 'italic' | 'link' | 'image' | 'code' | 'br'
  content?: string
  url?: string
  alt?: string
}

const IMAGE_REGEX = /^!\[([^\]]*)\]\(([^)]+)\)/
const LINK_REGEX = /^\[([^\]]+)\]\(([^)]+)\)/
const BOLD_ASTERISK_REGEX = /^\*\*([^*]+)\*\*/
const BOLD_UNDERSCORE_REGEX = /^__([^_]+)__/
const ITALIC_ASTERISK_REGEX = /^\*([^*]+)\*/
const ITALIC_UNDERSCORE_REGEX = /^_([^_]+)_/
const CODE_REGEX = /^`([^`]+)`/
const NEXT_SPECIAL_REGEX = /[![*_`\n]/

function parseMarkdown(text: string): Token[] {
  if (!text)
    return []

  const tokens: Token[] = []
  let remaining = text

  while (remaining.length > 0) {
    const imageMatch = remaining.match(IMAGE_REGEX)
    if (imageMatch) {
      tokens.push({ type: 'image', alt: imageMatch[1], url: imageMatch[2] })
      remaining = remaining.slice(imageMatch[0].length)
      continue
    }

    const linkMatch = remaining.match(LINK_REGEX)
    if (linkMatch) {
      tokens.push({ type: 'link', content: linkMatch[1], url: linkMatch[2] })
      remaining = remaining.slice(linkMatch[0].length)
      continue
    }

    const boldMatch = remaining.match(BOLD_ASTERISK_REGEX) || remaining.match(BOLD_UNDERSCORE_REGEX)
    if (boldMatch) {
      tokens.push({ type: 'bold', content: boldMatch[1] })
      remaining = remaining.slice(boldMatch[0].length)
      continue
    }

    const italicMatch = remaining.match(ITALIC_ASTERISK_REGEX) || remaining.match(ITALIC_UNDERSCORE_REGEX)
    if (italicMatch) {
      tokens.push({ type: 'italic', content: italicMatch[1] })
      remaining = remaining.slice(italicMatch[0].length)
      continue
    }

    const codeMatch = remaining.match(CODE_REGEX)
    if (codeMatch) {
      tokens.push({ type: 'code', content: codeMatch[1] })
      remaining = remaining.slice(codeMatch[0].length)
      continue
    }

    if (remaining[0] === '\n') {
      tokens.push({ type: 'br' })
      remaining = remaining.slice(1)
      continue
    }

    const nextSpecial = remaining.search(NEXT_SPECIAL_REGEX)
    if (nextSpecial === -1) {
      tokens.push({ type: 'text', content: remaining })
      break
    }
    else if (nextSpecial === 0) {
      tokens.push({ type: 'text', content: remaining[0] })
      remaining = remaining.slice(1)
    }
    else {
      tokens.push({ type: 'text', content: remaining.slice(0, nextSpecial) })
      remaining = remaining.slice(nextSpecial)
    }
  }

  return tokens
}

export default function MarkdownRenderer({ content }: { content: string }) {
  const tokens = parseMarkdown(content)

  return (
    <span className="leading-[1.6]">
      {tokens.map((token, index) => {
        switch (token.type) {
          case 'image':
            return <img key={index} src={token.url} alt={token.alt} loading="lazy" className="inline-block h-auto max-w-full rounded align-middle" style={{ maxHeight: 200 }} />
          case 'link':
            return <a key={index} href={token.url} target="_blank" rel="noopener noreferrer" className="text-primary underline-offset-4 hover:underline">{token.content}</a>
          case 'bold':
            return <strong key={index}>{token.content}</strong>
          case 'italic':
            return <em key={index}>{token.content}</em>
          case 'code':
            return <code key={index} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">{token.content}</code>
          case 'br':
            return <br key={index} />
          case 'text':
          default:
            return <span key={index}>{token.content}</span>
        }
      })}
    </span>
  )
}
