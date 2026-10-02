// @ts-nocheck
'use client'
import { useEffect, useRef, useState, forwardRef, useImperativeHandle, useCallback } from 'react'
import { Link2, TextAlignCenter, TextAlignEnd, TextAlignStart, Image as UploadImage, CornerDownLeft, ExternalLink, Trash2 } from 'lucide-react'

import { useEditor, EditorContent } from '@tiptap/react'
import { Mark, mergeAttributes } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import TextAlign from '@tiptap/extension-text-align'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'

// ─── Inline Heading Mark ──────────────────────────────────────────────────────

export const HeadingMark = Mark.create({
  name: 'headingMark',

  addAttributes() {
    return {
      level: {
        default: 1,
        parseHTML: element => {
          const levelAttr = element.getAttribute('data-heading-level') || element.getAttribute('data-heading')
          return levelAttr ? parseInt(levelAttr, 10) : 1
        },
        renderHTML: attributes => {
          return {
            'data-heading-level': attributes.level,
            class: `tiptap-inline-h${attributes.level}`,
          }
        },
      },
    }
  },

  parseHTML() {
    return [
      { tag: 'span[data-heading-level]' },
      { tag: 'span[data-heading]' },
      { tag: 'span.tiptap-inline-h1', attrs: { level: 1 } },
      { tag: 'span.tiptap-inline-h2', attrs: { level: 2 } },
      { tag: 'span.tiptap-inline-h3', attrs: { level: 3 } },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes), 0]
  },
})

// ─── Toolbar icons (inline SVG, no extra deps) ────────────────────────────────

function ToolbarButton({ onClick, active, disabled, title, children }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick() }}
      disabled={disabled}
      title={title}
      className={`tiptap-tb-btn ${active ? 'active' : ''}`}
    >
      {children}
    </button>
  )
}

// ─── Toolbar ─────────────────────────────────────────────────────────────────

function Toolbar({ editor, history = [], onRestore, onClearHistory }) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [showLinkPopover, setShowLinkPopover] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const popoverRef = useRef<HTMLDivElement>(null)

  const [showHistoryPopover, setShowHistoryPopover] = useState(false)
  const historyPopoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (historyPopoverRef.current && !historyPopoverRef.current.contains(event.target as Node)) {
        setShowHistoryPopover(false)
      }
    }
    if (showHistoryPopover) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showHistoryPopover])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setShowLinkPopover(false)
      }
    }
    if (showLinkPopover) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showLinkPopover])

  const handleApplyLink = () => {
    if (!linkUrl) {
      editor.chain().focus().unsetLink().run()
      setShowLinkPopover(false)
      return
    }

    let href = linkUrl
    if (!/^https?:\/\//i.test(href)) {
      href = `https://${href}`
    }

    const { state } = editor
    const { from, to } = state.selection
    const hasSelection = from !== to

    if (hasSelection) {
      editor.chain().focus().setLink({ href }).run()
    } else {
      editor.chain().focus().insertContent(`<a href="${href}">${linkUrl}</a>`).run()
    }
    setShowLinkPopover(false)
  }

  if (!editor) return null

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', 'image')

      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      const res = await fetch('/api/upload-file', {
        method: 'POST',
        headers: session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {},
        body: formData,
      })

      if (!res.ok) {
        throw new Error('Upload failed')
      }

      const data = await res.json()
      const srcUrl = data.publicUrl || data.content
      editor.chain().focus().setImage({ src: srcUrl }).run()
    } catch (err) {
      console.error(err)
      alert('Failed to upload image.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const toggleHeadingLevel = (level: number) => {
    if (!editor) return
    const isInlineActive = editor.isActive('headingMark', { level })
    const isBlockActive = editor.isActive('heading', { level })

    if (isInlineActive) {
      editor.chain().focus().unsetMark('headingMark').run()
    } else if (isBlockActive) {
      editor.chain().focus().toggleHeading({ level }).run()
    } else {
      editor.chain().focus().unsetMark('headingMark').setMark('headingMark', { level }).run()
    }
  }

  return (
    <div className="tiptap-toolbar-container overflow-x-auto!">
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleImageUpload}
      />

      {/* Row 1 */}
      <div className="tiptap-toolbar-row">
        {/* Group 1: Headings */}
        <div className="tiptap-toolbar-group headings-group">
          <ToolbarButton
            onClick={() => toggleHeadingLevel(1)}
            active={editor.isActive('headingMark', { level: 1 }) || editor.isActive('heading', { level: 1 })}
            title="Heading 1"
          >
            H1
          </ToolbarButton>
          <ToolbarButton
            onClick={() => toggleHeadingLevel(2)}
            active={editor.isActive('headingMark', { level: 2 }) || editor.isActive('heading', { level: 2 })}
            title="Heading 2"
          >
            H2
          </ToolbarButton>
          <ToolbarButton
            onClick={() => toggleHeadingLevel(3)}
            active={editor.isActive('headingMark', { level: 3 }) || editor.isActive('heading', { level: 3 })}
            title="Heading 3"
          >
            H3
          </ToolbarButton>
        </div>

        {/* Group 2: Inline formatting */}
        <div className="tiptap-toolbar-group format-group">
          <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold"><strong>B</strong></ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic"><em>I</em></ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Underline"><span style={{ textDecoration: 'underline' }}>U</span></ToolbarButton>
        </div>
      </div>

      {/* Row 2 */}
      <div className="tiptap-toolbar-row">
        {/* Group 3: Alignments */}
        <div className="tiptap-toolbar-group aligns-group">
          <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Align left"><TextAlignStart className="size-4" /></ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Align center"><TextAlignCenter className="size-4" /></ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="Align right"><TextAlignEnd className="size-4" /></ToolbarButton>
        </div>

        {/* Group 4: Lists */}
        <div className="tiptap-toolbar-group lists-group">
          <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered list">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
              <text x="1" y="5.5" fontSize="5" fill="currentColor" fontFamily="Arial" fontWeight="bold">1.</text>
              <text x="1" y="9" fontSize="5" fill="currentColor" fontFamily="Arial" fontWeight="bold">2.</text>
              <text x="1" y="12.5" fontSize="5" fill="currentColor" fontFamily="Arial" fontWeight="bold">3.</text>
              <rect x="6" y="3.75" width="9" height="1.5" rx="0.75" fill="currentColor" />
              <rect x="6" y="7.25" width="9" height="1.5" rx="0.75" fill="currentColor" />
              <rect x="6" y="10.75" width="9" height="1.5" rx="0.75" fill="currentColor" />
            </svg>
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet list">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
              <circle cx="2.5" cy="4.5" r="1.5" fill="currentColor" />
              <circle cx="2.5" cy="8" r="1.5" fill="currentColor" />
              <circle cx="2.5" cy="11.5" r="1.5" fill="currentColor" />
              <rect x="5.5" y="3.75" width="9" height="1.5" rx="0.75" fill="currentColor" />
              <rect x="5.5" y="7.25" width="9" height="1.5" rx="0.75" fill="currentColor" />
              <rect x="5.5" y="10.75" width="9" height="1.5" rx="0.75" fill="currentColor" />
            </svg>
          </ToolbarButton>
        </div>
      </div>

      {/* Row 3 */}
      <div className="tiptap-toolbar-row">
        {/* Group 5: Media & Link */}
        <div className="tiptap-toolbar-group actions-group">
          <ToolbarButton onClick={() => fileInputRef.current?.click()} disabled={uploading} active={editor.isActive('image')} title="Insert image"><UploadImage className="size-4" /></ToolbarButton>

          <div style={{ position: 'relative' }} ref={popoverRef}>
            <ToolbarButton
              onClick={() => {
                const activeHref = editor.getAttributes('link').href || ''
                setLinkUrl(activeHref)
                setShowLinkPopover(!showLinkPopover)
              }}
              active={editor.isActive('link') || showLinkPopover}
              title="Insert/edit link"
            >
              <Link2 className="size-4 transform -rotate-45" />
            </ToolbarButton>

            {showLinkPopover && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 99,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 10px',
                background: 'white',
                border: '1px solid rgba(0,0,0,0.1)',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                minWidth: '280px',
                maxWidth: 'calc(100vw - 32px)',
              }}>
                <input
                  type="text"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="Paste a link..."
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleApplyLink()
                    } else if (e.key === 'Escape') {
                      setShowLinkPopover(false)
                    }
                  }}
                  style={{
                    border: 'none',
                    outline: 'none',
                    fontSize: '13px',
                    color: '#18181b',
                    flex: 1,
                    minWidth: 0,
                    padding: '4px 0',
                    background: 'transparent',
                  }}
                />

                <button
                  type="button"
                  onClick={handleApplyLink}
                  title="Apply link"
                  style={{
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    color: '#52525b',
                    padding: '4px',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f4f4f5'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <CornerDownLeft className="size-3.5" />
                </button>

                {linkUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      let href = linkUrl
                      if (!/^https?:\/\//i.test(href)) {
                        href = `https://${href}`
                      }
                      window.open(href, '_blank')
                    }}
                    title="Open link"
                    style={{
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      color: '#52525b',
                      padding: '4px',
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f4f4f5'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <ExternalLink className="size-3.5" />
                  </button>
                )}

                {editor.isActive('link') && (
                  <button
                    type="button"
                    onClick={() => {
                      editor.chain().focus().unsetLink().run()
                      setShowLinkPopover(false)
                    }}
                    title="Remove link"
                    style={{
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      color: '#ef4444',
                      padding: '4px',
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#fef2f2'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>

          <ToolbarButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
              <path d="M3.5 5H9a4 4 0 0 1 0 8H5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M3.5 2.5L1 5l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </ToolbarButton>
          <div>
            <ToolbarButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <path d="M12.5 5H7a4 4 0 0 0 0 8h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M12.5 2.5L15 5l-2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </ToolbarButton>
          </div>
        </div>


        {/* Group 6: History */}
        <div className="tiptap-toolbar-group history-group" ref={historyPopoverRef}>
          <button
            type="button"
            onClick={() => {
              setShowHistoryPopover(!showHistoryPopover)
            }}
            className="border-none! bg-transparent text-sm font-semibold cursor-pointer h-full flex items-center transition-colors duration-150 py-2 text-[#52525b] hover:text-[#2563eb]"
          >
            History
          </button>

          {showHistoryPopover && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              zIndex: 99,
              width: '320px',
              background: 'white',
              border: '1px solid rgba(0,0,0,0.1)',
              borderRadius: '12px',
              boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#18181b' }}>Version History</span>
                {history.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Clear all version history?')) {
                        onClearHistory()
                      }
                    }}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: '#a1a1aa',
                      fontSize: '11px',
                      cursor: 'pointer',
                      padding: '2px 6px',
                      borderRadius: '4px',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                    onMouseLeave={(e) => e.currentTarget.style.color = '#a1a1aa'}
                  >
                    Clear All
                  </button>
                )}
              </div>

              <div style={{
                height: '1px',
                background: '#e4e4e7',
                margin: '2px 0',
              }} />

              <div style={{
                maxHeight: '220px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}>
                {history.length === 0 ? (
                  <div style={{
                    padding: '16px 8px',
                    textAlign: 'center',
                    fontSize: '12px',
                    color: '#a1a1aa',
                    lineHeight: '1.4',
                  }}>
                    No saved drafts yet.<br />Drafts are saved automatically as you edit.
                  </div>
                ) : (
                  [...history].reverse().map((snapshot, index) => {
                    const isCurrent = editor && editor.getHTML() === snapshot.html
                    const timeStr = new Date(snapshot.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                    const dateStr = new Date(snapshot.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })

                    return (
                      <div
                        key={snapshot.id}
                        onClick={() => {
                          onRestore(snapshot.html)
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          border: isCurrent ? '1px solid #bfdbfe' : '1px solid transparent',
                          transition: 'background 0.1s',
                        }}
                        onMouseEnter={(e) => {
                          if (!isCurrent) e.currentTarget.style.background = '#f4f4f5'
                        }}
                        onMouseLeave={(e) => {
                          if (!isCurrent) e.currentTarget.style.background = 'transparent'
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0, flex: 1 }}>
                          <span style={{
                            fontSize: '12px',
                            fontWeight: '500',
                            color: isCurrent ? '#1d4ed8' : '#18181b',
                          }}>
                            Version {history.length - index} {isCurrent && '(Current)'}
                          </span>
                          <span style={{ fontSize: '10px', color: '#71717a' }}>
                            {dateStr} at {timeStr}
                          </span>
                        </div>
                        <span style={{ fontSize: '10px', color: '#a1a1aa', flexShrink: 0 }}>
                          {snapshot.wordCount} words
                        </span>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Word count ───────────────────────────────────────────────────────────────

function WordCount({ editor }) {
  if (!editor) return null
  const text = editor.getText()
  const words = text.trim() ? text.trim().split(/\s+/).length : 0
  const chars = text.length
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'flex-end',
      padding: '6px 14px',
      fontSize: '11px',
      color: '#a1a1aa',
      borderTop: '1px solid rgba(0,0,0,0.06)',
      background: '#fafafa',
      borderRadius: '0 0 12px 12px',
    }}>
      {words.toLocaleString()} words · {chars.toLocaleString()} characters
    </div>
  )
}

// ─── Main TiptapEditor component ─────────────────────────────────────────────

/**
 * Props:
 *   initialHtml   string — pre-populated HTML from AI output
 *   onUpdate      (html: string) => void — fires on every change
 *   autoSaveMs    number — debounce for onUpdate (default 2000)
 */
const TiptapEditor = forwardRef(function TiptapEditor({ initialHtml = '', onUpdate, autoSaveMs = 2000 }, ref) {
  const saveTimerRef = useRef(null)
  const [, setSelectionTick] = useState(0)
  const [history, setHistory] = useState<any[]>([])
  const saveSnapshotRef = useRef<(html: string) => void>(() => { })

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      HeadingMark,
      Table.configure({ resizable: false }),
      TableRow,
      TableCell,
      TableHeader,
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: 'https',
      }),
      Image.configure({
        allowBase64: true,
      }),
    ],
    content: initialHtml,
    editorProps: {
      attributes: {
        class: 'tiptap-editor-content',
        spellcheck: 'true',
      },
    },
    onUpdate: ({ editor }) => {
      setSelectionTick(t => t + 1)
      const html = editor.getHTML()
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        if (onUpdate) onUpdate(html)
        saveSnapshotRef.current(html)
      }, autoSaveMs)
    },
    onSelectionUpdate: () => {
      setSelectionTick(t => t + 1)
    },
  })

  const saveSnapshot = useCallback((html: string) => {
    if (!html || !editor) return
    const text = editor.getText()
    const words = text.trim() ? text.trim().split(/\s+/).length : 0
    const chars = text.length

    setHistory(prev => {
      if (prev.length > 0 && prev[prev.length - 1].html === html) {
        return prev
      }

      const now = Date.now()
      const updated = [...prev]
      const lastSnapshot = updated[updated.length - 1]
      if (lastSnapshot && now - lastSnapshot.timestamp < 30000) {
        updated[updated.length - 1] = {
          ...lastSnapshot,
          html,
          wordCount: words,
          charCount: chars,
          timestamp: now,
        }
      } else {
        updated.push({
          id: Math.random().toString(36).substring(2, 9),
          timestamp: now,
          html,
          wordCount: words,
          charCount: chars,
        })
      }

      const trimmed = updated.slice(-15)
      if (typeof window !== 'undefined') {
        localStorage.setItem('3rdshift-editor-history', JSON.stringify(trimmed))
      }
      return trimmed
    })
  }, [editor])

  saveSnapshotRef.current = saveSnapshot

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('3rdshift-editor-history')
      if (saved) {
        try {
          setHistory(JSON.parse(saved))
        } catch (e) {
          console.error('Failed to parse editor history', e)
        }
      } else if (initialHtml) {
        const text = editor ? editor.getText() : ''
        const words = text.trim() ? text.trim().split(/\s+/).length : 0
        const chars = text.length
        const initialSnapshot = {
          id: Math.random().toString(36).substring(2, 9),
          timestamp: Date.now(),
          html: initialHtml,
          wordCount: words,
          charCount: chars,
        }
        setHistory([initialSnapshot])
        localStorage.setItem('3rdshift-editor-history', JSON.stringify([initialSnapshot]))
      }
    }
  }, [initialHtml, editor])

  const handleRestore = (html: string) => {
    if (editor) {
      editor.commands.setContent(html, false)
      saveSnapshot(html)
    }
  }

  const handleClearHistory = () => {
    setHistory([])
    if (typeof window !== 'undefined') {
      localStorage.removeItem('3rdshift-editor-history')
    }
  }

  // When initialHtml changes (task loads), update content
  useEffect(() => {
    if (editor && initialHtml && editor.getHTML() !== initialHtml) {
      editor.commands.setContent(initialHtml, false)
    }
  }, [initialHtml]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  // Expose getHTML/getText/setContent for Copy, Download, Send To, and Humanize toggle
  useImperativeHandle(ref, () => ({
    getHTML: () => editor ? editor.getHTML() : '',
    getText: () => editor ? editor.getText() : '',
    setContent: (html) => {
      if (editor) editor.commands.setContent(html, false)
    },
  }), [editor])

  return (
    <div style={{
      background: 'white',
      overflow: 'hidden',
    }}>
      <Toolbar
        editor={editor}
        history={history}
        onRestore={handleRestore}
        onClearHistory={handleClearHistory}
      />
      <EditorContent editor={editor} />
      {/* <WordCount editor={editor} /> */}
      {/* Hidden input so parent can read HTML */}
      <style>{`
        .tiptap-tb-btn {
          text-transform: uppercase;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
          border-radius: 6px;
          color: #52525b;
          cursor: pointer;
          font-weight: 600;
          font-size: 14px;
          transition: all 0.15s ease;
          border: none;
          background: transparent;
          outline: none;
          flex-shrink: 0;
        }
        .tiptap-tb-btn:disabled {
          cursor: not-allowed;
          opacity: 0.4;
        }
        .tiptap-tb-btn:not(:disabled):hover {
          background: #f4f4f5;
          color: #18181b;
        }
        .tiptap-tb-btn.active {
          color: #2563eb;
          font-weight: 750;
        }
        .tiptap-toolbar-container {
          display: flex;
          max-width: fit-content;
          background: white;
          margin-bottom: 16px;
          border-radius: 8px;
          border: 1px solid #e4e7ec;
          overflow: auto;
          scrollbar-width:none !important;
          }
          .tiptap-toolbar-row {
            display: flex;
            width: 100%;
            box-sizing: border-box;
        }
        .tiptap-toolbar-row:last-child {
          border-bottom: 0;
        }
        .tiptap-toolbar-group {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 40px;
          padding: 0 8px;
          gap: 8px;
          box-sizing: border-box;
          flex: 1;
          border-right: 1px solid #e4e7ec;
        }
        .tiptap-toolbar-row > .tiptap-toolbar-group:first-child {
          border-right: 1px solid #e4e7ec;
        }
        .tiptap-toolbar-group.history-group {
          position: relative;
        }
        @media (min-width: 640px) {
          .tiptap-toolbar-container {
            display: flex;
            flex-direction: row;
            flex-wrap: nowrap;
            align-items: center;
            height: 42px;
            overflow: visible;
            scrollbar-width:none !important;
          }
          .tiptap-toolbar-row {
            display: contents;
          }
          .tiptap-toolbar-group {
            border-right: 1px solid #e4e7ec !important;
            border-bottom: 0 !important;
            border-left: 0 !important;
            height: 100%;
            padding: 0 10px;
            gap: 8px;
            flex: none;
          }
        }
        .tiptap-editor-content {
          min-height: 300px;
          outline: none;
          font-size: 15px;
          line-height: 1.75;
          color: #3f3f46;
          font-family: inherit;
        }
        .tiptap-editor-content pre {
          background-color: #ffffff;
          border: 1px solid #e4e7ec;
          border-radius: 8px;
          padding: 16px;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 14px;
          line-height: 1.6;
          color: #18181b;
          overflow-x: auto;
          margin: 16px 0;
          white-space: pre;
        }
        .tiptap-editor-content pre code {
          background: transparent;
          padding: 0;
          border: none;
          border-radius: 0;
          font-size: 14px;
          color: inherit;
          font-family: inherit;
          white-space: pre;
        }
        .tiptap-editor-content code:not(pre code) {
          background-color: #f4f4f5;
          color: #18181b;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 13px;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        }
        .tiptap-editor-content a {
          color: #2563eb;
          text-decoration: underline;
          cursor: pointer;
        }
        .tiptap-editor-content a:hover {
          color: #175cd3;
        }
        .tiptap-editor-content img {
          max-width: 100%;
          height: auto;
          max-height: 400px;
          border-radius: 8px;
          margin: 12px 0;
          display: block;
        }
        .tiptap-editor-content h1,
        .tiptap-editor-content .tiptap-inline-h1,
        .tiptap-inline-h1 {
          font-size: 26px;
          font-weight: 800;
          color: #111113;
          margin: 24px 0 12px;
          line-height: 1.3;
          letter-spacing: -0.02em;
        }
        .tiptap-editor-content h2,
        .tiptap-editor-content .tiptap-inline-h2,
        .tiptap-inline-h2 {
          font-size: 21px;
          font-weight: 700;
          color: #111113;
          margin: 20px 0 10px;
          line-height: 1.3;
        }
        .tiptap-editor-content h3,
        .tiptap-editor-content .tiptap-inline-h3,
        .tiptap-inline-h3 {
          font-size: 18px;
          font-weight: 700;
          color: #111113;
          margin: 16px 0 8px;
          line-height: 1.3;
        }
        .tiptap-editor-content ul {
          list-style-type: disc;
          padding-left: 24px;
          margin-bottom: 14px;
        }
        .tiptap-editor-content ol {
          list-style-type: decimal;
          padding-left: 24px;
          margin-bottom: 14px;
        }
        .tiptap-editor-content li {
          margin-bottom: 4px;
        }
        .tiptap-editor-content strong {
          font-weight: 700;
          color: #111113;
        }
        .tiptap-editor-content hr {
          border: none;
          border-top: 1px solid #e4e4e7;
          margin: 16px 0;
        }
        .tiptap-editor-content table {
          display: block;
          overflow-x: auto;
          border-collapse: collapse;
          width: 100%;
          margin: 10px 0 16px;
          font-size: 14px;
        }
        .tiptap-editor-content th {
          background: #1d4ed8;
          color: #fff;
          font-weight: 600;
          padding: 7px 12px;
          text-align: left;
          font-size: 13px;
          white-space: nowrap;
        }
        .tiptap-editor-content td {
          padding: 6px 12px;
          border-bottom: 1px solid #e4e7ec;
          color: #3f3f46;
        }
        .tiptap-editor-content tr:nth-child(even) td {
          background: #f8fafc;
        }
        .tiptap-editor-content .ProseMirror-focused {
          outline: none !important;
        }
        .tiptap-editor-content > .ProseMirror {
          outline: none !important;
        }
        .ProseMirror:focus {
          outline: none !important;
        }
        .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #a1a1aa;
          pointer-events: none;
          height: 0;
        }
      `}</style>
    </div>
  )
})

export default TiptapEditor
