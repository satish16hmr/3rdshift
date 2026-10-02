import '../dashboard-globals.css'

export const metadata = {
  title: '3rdShift — AI Workers On Demand',
  description: '70+ AI workers ready to work. No interviews. No managing. No waiting.',
  icons: {
    icon: [
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon.png', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: '3rdShift — AI Workers On Demand',
    description: '70+ AI workers ready to work. No interviews. No managing. No waiting.',
    images: ['/logo-og.png'],
  },
}

export default function DashboardRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="light" style={{ colorScheme: 'light' }}>
      <body className="light bg-white">
        {children}
      </body>
    </html>
  )
}
