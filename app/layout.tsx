import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Blockly',
  description: 'Claude Penn Hackathon Project',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

