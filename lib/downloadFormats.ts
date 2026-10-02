export const getDownloadFormats = (s: string) => {
  const DOWNLOAD_FORMATS: Record<string, string[]> = {
    'customer-support-writer': ['docx', 'pdf', 'csv'],
    'data-cleaner': ['xlsx-cleaned', 'xlsx-changelog', 'pdf-report'],
    'lead-generator': ['csv'],
    'bookkeeping-summarizer': ['pdf', 'xlsx'],
    'kpi-dashboard-writer': ['pdf', 'docx', 'xlsx'],
    'spreadsheet-builder': ['xlsx'],
    'pitch-deck-writer': [],
    'customer-review-responder': [],
  }
  if (s in DOWNLOAD_FORMATS) return DOWNLOAD_FORMATS[s]
  return ['docx', 'pdf']
}

export const getCadeDownloadFormats = (outputFormatPref?: string) => {
  const csvPrefs = ['Cleaned CSV + change report', 'Match the original file format', 'CSV']
  const cleanedFmt = csvPrefs.includes(outputFormatPref || '') ? 'csv-cleaned' : 'xlsx-cleaned'
  return [cleanedFmt, 'xlsx-changelog', 'pdf-report']
}

export const FORMAT_LABELS: Record<string, string> = {
  docx: '📄 Download as Word (.docx)',
  pdf: '📋 Download as PDF',
  csv: '📊 Download as CSV',
  xlsx: '📈 Download as Excel (.xlsx)',
  pptx: '📽️ Download as PowerPoint',
  // Cade
  'xlsx-cleaned': '🧹 Cleaned Data (.xlsx)',
  'csv-cleaned': '🧹 Cleaned Data (.csv)',
  'xlsx-changelog': '📋 Change Log (.xlsx)',
  'pdf-report': '📄 Change Report (PDF)',
  txt: '📝 Plain Text (.txt)',
  // Media
  mp4: '🎥 Download Video (.mp4)',
  mp3: '🎵 Download Audio (.mp3)',
  png: '🖼️ Download Images (.png)',
}
