// @ts-nocheck
'use client'

// Test page — shows all upload component states for design review
// Remove this page after CD approval

import { useState } from 'react'

function UploadStateMock({ title, state, fileName, fileSize, progress, isVideo, errorMsg, acceptedLabel, maxMB }) {
  const icon = isVideo ? '🎬' : '📄'
  const label = isVideo ? 'Upload video or audio' : 'Upload file'
  const types = acceptedLabel || (isVideo ? 'MP4, MOV, WEBM, MP3, WAV, M4A' : 'CSV, XLS, XLSX, PDF, TXT, DOC, DOCX')
  const max = maxMB || (isVideo ? 500 : 50)

  return (
    <div style={{ marginBottom: 32 }}>
      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(17,17,19,0.35)', marginBottom: 8 }}>{title}</p>

      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <label style={{ fontSize: 13, fontWeight: 500, color: '#111113' }}>
            {label}
            <span style={{ marginLeft: 4, fontWeight: 400, color: 'rgba(17,17,19,0.4)' }}>(optional)</span>
          </label>
          {state === 'done' && (
            <button type="button" style={{ fontSize: 12, color: 'rgba(17,17,19,0.4)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
              Remove
            </button>
          )}
        </div>

        {/* Idle state */}
        {state === 'idle' && (
          <div style={{
            border: '1.5px dashed rgba(0,0,0,0.15)',
            borderRadius: 10,
            padding: '24px 16px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(0,0,0,0.015)',
            cursor: 'pointer',
          }}>
            <span style={{ fontSize: 22, lineHeight: 1 }}>{icon}</span>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 13, fontWeight: 500, color: '#111113', margin: 0 }}>
                Drop file here or <span style={{ color: '#2563eb' }}>browse</span>
              </p>
              <p style={{ fontSize: 12, color: 'rgba(17,17,19,0.4)', margin: '4px 0 0' }}>
                {types} · Max {max}MB
              </p>
            </div>
          </div>
        )}

        {/* Uploading state */}
        {state === 'uploading' && (
          <div style={{ border: '1.5px solid rgba(0,0,0,0.08)', borderRadius: 10, padding: '16px', background: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <span style={{ fontSize: 20 }}>{icon}</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#111113', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileName}</p>
                <p style={{ fontSize: 12, color: 'rgba(17,17,19,0.4)', margin: '2px 0 0' }}>{fileSize}</p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <p style={{ fontSize: 12, color: 'rgba(17,17,19,0.5)', margin: 0 }}>
                {isVideo ? 'Uploading & transcribing…' : 'Uploading & parsing…'}
              </p>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#111113', margin: 0 }}>{progress}%</p>
            </div>
            <div style={{ height: 4, width: '100%', borderRadius: 99, background: 'rgba(0,0,0,0.06)', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                borderRadius: 99,
                background: '#2563eb',
                width: `${progress}%`,
                boxShadow: '0 0 6px rgba(37,99,235,0.4)',
              }} />
            </div>
          </div>
        )}

        {/* Done state */}
        {state === 'done' && (
          <div style={{
            border: '1.5px solid rgba(16,185,129,0.25)',
            borderRadius: 10,
            padding: '14px 16px',
            background: 'rgba(16,185,129,0.04)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}>
            <span style={{ fontSize: 18 }}>✅</span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#111113', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileName}</p>
              <p style={{ fontSize: 12, color: '#059669', margin: '2px 0 0' }}>
                {isVideo ? 'Transcribed — content injected into task' : 'Parsed — content injected into task'}
              </p>
            </div>
          </div>
        )}

        {/* Error state */}
        {state === 'error' && (
          <>
            <div style={{
              border: '1.5px dashed rgba(239,68,68,0.5)',
              borderRadius: 10,
              padding: '24px 16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(239,68,68,0.02)',
              cursor: 'pointer',
            }}>
              <span style={{ fontSize: 22, lineHeight: 1 }}>{icon}</span>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: '#111113', margin: 0 }}>
                  Drop file here or <span style={{ color: '#2563eb' }}>browse</span>
                </p>
                <p style={{ fontSize: 12, color: 'rgba(17,17,19,0.4)', margin: '4px 0 0' }}>
                  {types} · Max {max}MB
                </p>
              </div>
            </div>
            <p style={{ fontSize: 12, color: '#ef4444', margin: '6px 0 0' }}>{errorMsg}</p>
          </>
        )}
      </div>
    </div>
  )
}

export default function UploadTestPage() {
  return (
    <div style={{ maxWidth: 560, margin: '48px auto', padding: '0 24px', fontFamily: 'Inter, sans-serif' }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111113', marginBottom: 4 }}>Upload Component — All States</h1>
      <p style={{ fontSize: 13, color: 'rgba(17,17,19,0.45)', marginBottom: 40 }}>Phase 5 design review · CD approval</p>

      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.08)', padding: '28px 28px 8px', marginBottom: 40 }}>
        <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#2563eb', marginBottom: 24 }}>VIDEO / AUDIO UPLOAD</p>
        <UploadStateMock title="1. Empty state (idle)" state="idle" isVideo={true} />
        <UploadStateMock title="2. Uploading — 62% (video)" state="uploading" isVideo={true} fileName="my-youtube-video.mp4" fileSize="128.4 MB" progress={62} />
        <UploadStateMock title="3. Complete — transcription done" state="done" isVideo={true} fileName="my-youtube-video.mp4" fileSize="128.4 MB" />
        <UploadStateMock title="4. Error — wrong file type" state="error" isVideo={true} errorMsg="Wrong file type. Accepted: MP4, MOV, WEBM, MP3, WAV, M4A" />
      </div>

      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.08)', padding: '28px 28px 8px' }}>
        <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#2563eb', marginBottom: 24 }}>DOCUMENT UPLOAD</p>
        <UploadStateMock title="5. Empty state (idle)" state="idle" isVideo={false} acceptedLabel="PDF, DOCX" />
        <UploadStateMock title="6. Uploading — 38% (document)" state="uploading" isVideo={false} fileName="resumes-batch-march.pdf" fileSize="2.1 MB" progress={38} />
        <UploadStateMock title="7. Complete — parsed" state="done" isVideo={false} fileName="resumes-batch-march.pdf" fileSize="2.1 MB" />
        <UploadStateMock title="8. Error — file too large" state="error" isVideo={false} errorMsg="File too large. Max 50MB" acceptedLabel="PDF, DOCX" />
      </div>
    </div>
  )
}
