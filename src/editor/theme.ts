import { EditorView } from '@codemirror/view'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'

export const folioEditorTheme = EditorView.theme(
  {
    '&': {
      backgroundColor: 'transparent',
      color: 'var(--ink)',
      fontFamily: 'var(--font-serif)',
      fontSize: '19px',
      height: '100%',
    },
    '.cm-scroller': {
      fontFamily: 'var(--font-serif)',
      lineHeight: '1.85',
      overflow: 'auto',
    },
    '.cm-content': {
      caretColor: 'var(--accent)',
      padding: '8px 8px 48vh',
      maxWidth: '720px',
      margin: '0 auto',
    },
    '.cm-line': {
      padding: '1px 0',
    },
    '&.cm-focused': {
      outline: 'none',
    },
    '.cm-gutters': {
      display: 'none',
    },
    '.cm-activeLine': {
      backgroundColor: 'transparent',
    },
    '.cm-selectionBackground, &.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground': {
      backgroundColor: 'color-mix(in srgb, var(--accent) 18%, transparent)',
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: 'var(--accent)',
      borderLeftWidth: '2px',
    },
    '.cm-placeholder': {
      color: 'var(--ink-faint)',
      fontStyle: 'italic',
    },
    '.cm-header-1': { fontSize: '2.05em', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: '1.25' },
    '.cm-header-2': { fontSize: '1.45em', fontWeight: 650, letterSpacing: '-0.02em', lineHeight: '1.35' },
    '.cm-header-3': { fontSize: '1.18em', fontWeight: 600, lineHeight: '1.4' },
    '.tok-mark': {
      color: 'var(--mark)',
      fontFamily: 'var(--font-sans)',
      fontSize: '0.78em',
      fontWeight: 500,
    },
  },
  { dark: false },
)

export const folioHighlight = syntaxHighlighting(
  HighlightStyle.define([
    { tag: t.heading, fontWeight: '700', color: 'var(--ink)' },
    { tag: t.heading1, fontSize: '2.05em', fontWeight: '700' },
    { tag: t.heading2, fontSize: '1.45em', fontWeight: '650' },
    { tag: t.heading3, fontSize: '1.18em', fontWeight: '600' },
    { tag: t.strong, fontWeight: '700' },
    { tag: t.emphasis, fontStyle: 'italic' },
    { tag: t.strikethrough, textDecoration: 'line-through', color: 'var(--ink-mute)' },
    { tag: t.link, color: 'var(--accent)', textDecoration: 'underline', textUnderlineOffset: '3px' },
    { tag: t.url, color: 'var(--ink-mute)', fontFamily: 'var(--font-sans)', fontSize: '0.86em' },
    { tag: t.quote, color: 'var(--ink-mute)', fontStyle: 'italic' },
    { tag: t.monospace, fontFamily: 'var(--font-mono)', fontSize: '0.9em', color: 'var(--ink)' },
    { tag: t.processingInstruction, color: 'var(--mark)', fontFamily: 'var(--font-sans)', fontSize: '0.78em' },
    { tag: t.meta, color: 'var(--mark)' },
    { tag: t.atom, color: 'var(--mark)' },
    { tag: t.list, color: 'var(--ink)' },
  ]),
)
