interface Token {
  key: string
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
  let offset = 0

  function appendToken(token: Omit<Token, 'key'>, length: number) {
    tokens.push({ ...token, key: `${offset}-${token.type}` })
    offset += length
    remaining = remaining.slice(length)
  }

  while (remaining.length > 0) {
    const imageMatch = remaining.match(IMAGE_REGEX)
    if (imageMatch) {
      appendToken({ type: 'image', alt: imageMatch[1], url: imageMatch[2] }, imageMatch[0].length)
      continue
    }

    const linkMatch = remaining.match(LINK_REGEX)
    if (linkMatch) {
      appendToken({ type: 'link', content: linkMatch[1], url: linkMatch[2] }, linkMatch[0].length)
      continue
    }

    const boldMatch = remaining.match(BOLD_ASTERISK_REGEX) || remaining.match(BOLD_UNDERSCORE_REGEX)
    if (boldMatch) {
      appendToken({ type: 'bold', content: boldMatch[1] }, boldMatch[0].length)
      continue
    }

    const italicMatch = remaining.match(ITALIC_ASTERISK_REGEX) || remaining.match(ITALIC_UNDERSCORE_REGEX)
    if (italicMatch) {
      appendToken({ type: 'italic', content: italicMatch[1] }, italicMatch[0].length)
      continue
    }

    const codeMatch = remaining.match(CODE_REGEX)
    if (codeMatch) {
      appendToken({ type: 'code', content: codeMatch[1] }, codeMatch[0].length)
      continue
    }

    if (remaining[0] === '\n') {
      appendToken({ type: 'br' }, 1)
      continue
    }

    const nextSpecial = remaining.search(NEXT_SPECIAL_REGEX)
    if (nextSpecial === -1) {
      appendToken({ type: 'text', content: remaining }, remaining.length)
      break
    }
    else if (nextSpecial === 0) {
      appendToken({ type: 'text', content: remaining[0] }, 1)
    }
    else {
      appendToken({ type: 'text', content: remaining.slice(0, nextSpecial) }, nextSpecial)
    }
  }

  return tokens
}

export default function MarkdownRenderer({ content }: { content: string }) {
  const tokens = parseMarkdown(content)

  return (
    <span className="leading-[1.6]">
      {tokens.map((token) => {
        switch (token.type) {
          case 'image':
            return <img key={token.key} src={token.url} alt={token.alt} loading="lazy" className="inline-block h-auto max-w-full rounded align-middle" style={{ maxHeight: 200 }} />
          case 'link':
            return <a key={token.key} href={token.url} target="_blank" rel="noopener noreferrer" className="text-primary underline-offset-4 hover:underline">{token.content}</a>
          case 'bold':
            return <strong key={token.key}>{token.content}</strong>
          case 'italic':
            return <em key={token.key}>{token.content}</em>
          case 'code':
            return <code key={token.key} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">{token.content}</code>
          case 'br':
            return <br key={token.key} />
          case 'text':
          default:
            return <span key={token.key}>{token.content}</span>
        }
      })}
    </span>
  )
}
