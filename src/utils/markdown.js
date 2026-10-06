/**
 * Markdown to HTML for the published API reference.
 *
 * The reference is written in `PARTNER_API.md` on the backend and arrives here
 * as text, so the site needs a renderer. It is deliberately small and covers
 * what that file uses (headings, fenced code, tables, lists, rules, paragraphs
 * and the three inline forms) rather than a markdown library: the surface is
 * fixed, the dependency would be permanent, and every line is escaped before
 * anything is built from it, so the document cannot inject markup into the
 * page.
 */

const escapeHtml = (text) =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const CODE_OPEN = '<code class="rounded bg-brand/10 px-1.5 py-0.5 font-mono text-[0.8em] font-semibold text-brand">'
const LINK_CLASS = 'font-semibold text-brand underline decoration-brand/30 underline-offset-2 hover:decoration-brand'

/**
 * Only web and mail links are followed. Anything else — `javascript:` is the
 * one that matters — is left as the literal text the document had, because the
 * href is the one place a link target is not already neutralised by escaping.
 */
const link = (label, href) => {
  if (!/^(https?:|mailto:|#|\/|\.\/)/i.test(href)) return label

  return (
    '<a href="' + escapeHtml(href) + '" target="_blank" rel="noopener noreferrer" class="' + LINK_CLASS + '">' +
    label +
    '</a>'
  )
}
const BOLD = '<strong class="font-bold text-ink">$1</strong>'

/**
 * Inline formatting on already-escaped text.
 *
 * Code spans are lifted out first and restored last: a span holding `**` or a
 * bracket pair must stay literal instead of being re-read as emphasis or a
 * link. The placeholder is a control character rather than spaces so ordinary
 * numbers in prose ("120 per minute") can never collide with one.
 */
const inline = (raw) => {
  const spans = []
  let out = escapeHtml(raw).replace(/`([^`\n]+)`/g, (match, code) => {
    spans.push(CODE_OPEN + code + '</code>')
    return '\u0000' + String(spans.length - 1) + '\u0000'
  })

  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (match, label, href) => link(label, href))
  out = out.replace(/\*\*([^*]+)\*\*/g, BOLD)
  out = out.replace(/\u0000(\d+)\u0000/g, (match, n) => spans[Number(n)])

  return out
}

/** Plain-text label for the table of contents: backticks and markers removed. */
const plainText = (raw) => raw.replace(/`/g, '').replace(/\*\*/g, '').trim()

const slugify = (text, seen) => {
  const base =
    plainText(text)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'section'
  const count = (seen[base] = (seen[base] || 0) + 1)

  return count === 1 ? base : base + '-' + String(count)
}

const isFence = (line) => /^```/.test(line)
const isHeading = (line) => /^(#{1,6})\s+\S/.test(line)
const isRule = (line) => /^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)
const isTableRow = (line) => /^\s*\|.*\|\s*$/.test(line)
const isTableSeparator = (line) => /^\s*\|?[\s:|-]*-{3,}[\s:|-]*\|?\s*$/.test(line)
const isListItem = (line) => /^\s*([-*+]|\d+\.)\s+/.test(line)
const isBlockStart = (line) =>
  isFence(line) ||
  isHeading(line) ||
  isRule(line) ||
  isListItem(line) ||
  (isTableRow(line) && !isTableSeparator(line))

const tableCells = (line) =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())

const H1 = 'mt-2 font-heading text-3xl font-bold tracking-tight text-ink sm:text-4xl'
const H2 = 'mt-10 scroll-mt-20 border-t border-brand/10 pt-8 font-heading text-xl font-bold text-ink sm:text-2xl'
const H3 = 'mt-7 scroll-mt-20 font-heading text-base font-bold text-ink sm:text-lg'
const H4 = 'mt-5 font-heading text-sm font-bold text-ink'
const UL = 'mt-3 list-disc space-y-2 pl-5 text-sm leading-7 text-ink/70 marker:text-brand'
const OL = 'mt-3 list-decimal space-y-2 pl-5 text-sm leading-7 text-ink/70 marker:font-bold marker:text-brand'
const PARAGRAPH = 'mt-3 text-sm leading-7 text-ink/70'
const TH = 'border-b border-brand/20 bg-brand/5 px-3 py-2 text-left font-bold text-ink'
const TD = 'border-b border-brand/10 px-3 py-2 align-top text-ink/70'

/**
 * Render a markdown document.
 *
 * Returns the HTML and a table of contents built from the h2/h3 headings, so
 * the view can lay out navigation without parsing the HTML back into a
 * structure. Heading ids are slugified and de-duplicated for in-page anchors.
 *
 * @param {string} source
 * @returns {{html: string, toc: Array<{id: string, text: string, level: number}>}}
 */
export const renderMarkdown = (source) => {
  const lines = String(source || '').replace(/\r\n/g, '\n').split('\n')
  const out = []
  const toc = []
  const slugs = {}
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (isFence(line)) {
      const language = line.slice(3).trim()
      const body = []
      i += 1
      while (i < lines.length && !isFence(lines[i])) {
        body.push(lines[i])
        i += 1
      }
      i += 1
      out.push(
        '<div class="group relative mt-4 overflow-x-auto rounded-xl border border-brand/10 bg-ink/95">' +
          (language
            ? '<span class="absolute right-3 top-2 font-mono text-[10px] font-bold tracking-wider text-white/30 uppercase">' +
              escapeHtml(language) +
              '</span>'
            : '') +
          '<pre class="p-4 pr-14 text-[12.5px] leading-relaxed text-emerald-50/90"><code class="font-mono">' +
          escapeHtml(body.join('\n')) +
          '</code></pre></div>',
      )
      continue
    }

    if (isHeading(line)) {
      const hashes = /^#+/.exec(line)[0]
      const level = hashes.length
      const text = line.slice(level).trim()
      const id = slugify(text, slugs)
      const classes = level === 1 ? H1 : level === 2 ? H2 : level === 3 ? H3 : H4
      out.push('<h' + level + ' id="' + id + '" class="' + classes + '">' + inline(text) + '</h' + level + '>')
      if (level === 2 || level === 3) toc.push({ id, text: plainText(text), level })
      i += 1
      continue
    }

    if (isRule(line)) {
      out.push('<hr class="my-8 border-brand/10">')
      i += 1
      continue
    }

    if (isTableRow(line) && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const header = tableCells(line)
      i += 2
      const rows = []
      while (i < lines.length && isTableRow(lines[i])) {
        rows.push(tableCells(lines[i]))
        i += 1
      }
      const head = header.map((cell) => '<th class="' + TH + '">' + inline(cell) + '</th>').join('')
      const body = rows
        .map((cells) => '<tr>' + cells.map((cell) => '<td class="' + TD + '">' + inline(cell) + '</td>').join('') + '</tr>')
        .join('')
      out.push(
        '<div class="mt-4 overflow-x-auto rounded-xl border border-brand/10 bg-surface">' +
          '<table class="w-full border-collapse text-xs sm:text-sm"><thead><tr>' +
          head +
          '</tr></thead><tbody>' +
          body +
          '</tbody></table></div>',
      )
      continue
    }

    if (isListItem(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line)
      const marker = ordered ? /^\s*\d+\./ : /^\s*[-*+]/
      const items = []
      let current = null

      while (i < lines.length) {
        const item = lines[i]
        if (isListItem(item)) {
          const itemOrdered = /^\s*\d+\.\s+/.test(item)
          // A change of marker type starts a second list rather than joining
          // unordered items to ordered ones.
          if (items.length && itemOrdered !== ordered) break
          if (current !== null) items.push(current)
          current = item.replace(marker, '').trim()
          i += 1
          continue
        }
        // Wrapped lines belong to the item they follow; anything that starts a
        // new block ends the list.
        if (current !== null && item.trim() && !isBlockStart(item)) {
          current += ' ' + item.trim()
          i += 1
          continue
        }
        break
      }
      if (current !== null) items.push(current)

      const tag = ordered ? 'ol' : 'ul'
      const listClass = ordered ? OL : UL
      out.push(
        '<' + tag + ' class="' + listClass + '">' +
          items.map((item) => '<li>' + inline(item) + '</li>').join('') +
          '</' + tag + '>',
      )
      continue
    }

    if (line.trim() && !isBlockStart(line)) {
      const paragraph = [line.trim()]
      i += 1
      while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) {
        paragraph.push(lines[i].trim())
        i += 1
      }
      out.push('<p class="' + PARAGRAPH + '">' + inline(paragraph.join(' ')) + '</p>')
      continue
    }

    i += 1
  }

  return { html: out.join('\n'), toc }
}
