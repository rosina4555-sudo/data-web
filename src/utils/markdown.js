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

  // A hash target is an anchor inside this document: it must stay in the
  // current tab (the view scrolls it) rather than open a second copy of the
  // page whose router would not know the hash.
  const inPage = href.startsWith('#')
  const target = inPage ? '' : ' target="_blank" rel="noopener noreferrer"'

  return (
    '<a href="' + escapeHtml(href) + '"' + target + ' class="' + LINK_CLASS + '">' +
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
const H2 = 'group mt-10 scroll-mt-24 font-heading text-xl font-bold tracking-tight text-ink sm:text-2xl'
const H3 = 'mt-7 scroll-mt-24 font-heading text-base font-bold text-ink sm:text-lg'
const H4 = 'mt-5 font-heading text-sm font-bold text-ink'
const UL = 'mt-3 list-disc space-y-2 pl-5 text-sm leading-7 text-ink/70 marker:text-brand'
const OL = 'mt-3 list-decimal space-y-2 pl-5 text-sm leading-7 text-ink/70 marker:font-bold marker:text-brand'
const PARAGRAPH = 'mt-3 text-sm leading-7 text-ink/70'
const TH = 'border-b border-brand/15 bg-bg px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted'
const TD = 'border-b border-brand/10 px-3 py-2.5 align-top text-[13px] leading-6 text-ink/70'

/**
 * Endpoint headings (`### GET /path`) render as a method badge plus the path,
 * the way a reference page marks an operation. Only the five verbs the
 * document uses are recognised; anything else stays an ordinary h3.
 */
const ENDPOINT_RE = /^(GET|POST|PUT|PATCH|DELETE)\s+(\S+)$/
const METHOD_BADGE = {
  GET: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  POST: 'border-amber-200 bg-amber-50 text-amber-700',
  PUT: 'border-sky-200 bg-sky-50 text-sky-700',
  PATCH: 'border-sky-200 bg-sky-50 text-sky-700',
  DELETE: 'border-red-200 bg-red-50 text-red-700',
}

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
        '<div class="dp-code group relative mt-4 overflow-hidden rounded-xl border border-ink/20 bg-ink/95">' +
          '<div class="flex items-center justify-between border-b border-white/10 px-4 py-1.5">' +
            '<span class="font-mono text-[10px] font-bold tracking-wider text-white/40 uppercase">' +
            (language ? escapeHtml(language) : '') +
            '</span>' +
            '<button type="button" data-copy class="rounded px-2 py-0.5 text-[10px] font-semibold text-white/40 transition hover:bg-white/10 hover:text-white/90">Copy</button>' +
          '</div>' +
          '<pre class="overflow-x-auto p-4 text-[12.5px] leading-relaxed text-emerald-50/90"><code class="font-mono">' +
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
      const plain = plainText(text)
      const endpoint = level === 3 ? plain.match(ENDPOINT_RE) : null

      if (endpoint) {
        const verb = endpoint[1]
        out.push(
          '<div id="' + id + '" class="dp-endpoint mt-8 flex scroll-mt-24 flex-wrap items-center gap-3 border-b border-brand/15 pb-3">' +
            '<span class="inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-[11px] font-bold tracking-wider ' +
            METHOD_BADGE[verb] +
            '">' +
            verb +
            '</span>' +
            '<code class="font-mono text-sm font-semibold break-all text-ink">' +
            escapeHtml(endpoint[2]) +
            '</code>' +
          '</div>',
        )
      } else {
        const classes = level === 1 ? H1 : level === 2 ? H2 : level === 3 ? H3 : H4
        // The anchor scrolls in place through the view's click handler: a raw
        // #hash would be read by the router as an unknown route and drop the
        // reader on the home page.
        const anchor =
          level === 2
            ? ' <a href="#' +
              id +
              '" data-jump="' +
              id +
              '" aria-hidden="true" tabindex="-1" class="align-middle text-sm font-medium text-brand/0 transition-colors group-hover:text-brand/50">#</a>'
            : ''
        out.push(
          '<h' + level + ' id="' + id + '" class="' + classes + '">' + inline(text) + anchor + '</h' + level + '>',
        )
      }

      if (level === 2 || level === 3) toc.push({ id, text: plain, level })
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
      // The document's tables all lead with a code value (scope, bucket,
      // status, slug), so the first cell is set in mono to read as data.
      const body = rows
        .map(
          (cells) =>
            '<tr>' +
            cells
              .map(
                (cell, index) =>
                  '<td class="' +
                  TD +
                  (index === 0 ? ' font-mono text-[12.5px] font-medium text-ink' : '') +
                  '">' +
                  inline(cell) +
                  '</td>',
              )
              .join('') +
            '</tr>',
        )
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
