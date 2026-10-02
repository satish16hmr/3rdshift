import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '70+ AI Team Members Ready to Work | 3rdShift',
  description: 'Hire from 70+ specialized AI team members. Replace $2,000+/mo in freelancer spend. No interviews. Start instantly.',
  openGraph: {
    title: '70+ AI Team Members Ready to Work | 3rdShift',
    description: 'Hire from 70+ specialized AI team members. Replace $2,000+/mo in freelancer spend. No interviews. Start instantly.',
    images: ['/logo-og.png'],
  },
};

export default function WorkersLayout({ children }: { children: React.ReactNode }) {
  return children;
}
