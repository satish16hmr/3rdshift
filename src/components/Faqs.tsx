import Image from 'next/image'

import { Container } from '@/src/components/Container'
import backgroundImage from '@/src/images/background-faqs.jpg'

const faqs = [
  [
    {
      question: 'What exactly are "AI workers"?',
      answer:
        'Specialized AI agents built for one specific job each. Ava writes blog posts. Sage writes cold emails. Zane runs competitor analysis. Structured output in 60 seconds.',
    },
    {
      question: 'How is this different from ChatGPT?',
      answer:
        'ChatGPT gives you a chat window. 3rdShift gives you 70+ trained workers with persistent memory of your brand. You get structured outputs, not raw text.',
    },
    {
      question: 'What are heavy credits?',
      answer:
        'Most tasks are light and unlimited. Heavy credits cover resource-intensive work like image generation, presentations, and video.',
    },
  ],
  [
    {
      question: 'What is Founding Member Launch Pricing?',
      answer:
        'Founding Member Launch Pricing is available for a limited time. Lock in lower rates while it lasts. Your rate stays locked as long as you remain subscribed.',
    },
    {
      question: 'Can I cancel anytime?',
      answer: 'Yes. No contracts, no cancellation fees. Cancel anytime.',
    },
    {
      question: 'Is my data safe?',
      answer:
        "Yes. Your data stays in your account. We don't sell or share your information.",
    },
  ],
  [
    {
      question: 'Do I need technical skills?',
      answer:
        "No. Log in, pick a worker, describe what you need, get the work. No API keys, no setup.",
    },
    {
      question: 'How fast are results?',
      answer:
        'Most tasks complete in 60 seconds or less. Heavy tasks like image generation may take a couple minutes.',
    },
    {
      question: 'What can I create?',
      answer:
        'Blog posts, email sequences, social content, lead lists, research reports, presentations, images, video scripts, and more.',
    },
  ],
]

export function Faqs() {
  return (
    <section
      id="faq"
      aria-labelledby="faq-title"
      className="relative overflow-hidden bg-slate-50 py-20 sm:py-32"
    >
      <Image
        className="absolute top-0 left-1/2 max-w-none translate-x-[-30%] -translate-y-1/4"
        src={backgroundImage}
        alt=""
        width={1558}
        height={946}
        unoptimized
      />
      <Container className="relative">
        <div className="mx-auto max-w-2xl lg:mx-0">
          <h2
            id="faq-title"
            className="font-display text-3xl tracking-tight text-slate-900 sm:text-4xl"
          >
            Frequently asked questions
          </h2>
          <p className="mt-4 text-lg tracking-tight text-slate-700">
            Can&rsquo;t find what you&rsquo;re looking for?{' '}
            <a href="/dashboard/help" className="text-blue-600 hover:underline">
              Visit our Help Center
            </a>
            .
          </p>
        </div>
        <ul
          role="list"
          className="mx-auto mt-16 grid max-w-2xl grid-cols-1 gap-8 lg:max-w-none lg:grid-cols-3"
        >
          {faqs.map((column, columnIndex) => (
            <li key={columnIndex}>
              <ul role="list" className="flex flex-col gap-y-8">
                {column.map((faq, faqIndex) => (
                  <li key={faqIndex}>
                    <h3 className="font-display text-lg/7 text-slate-900">
                      {faq.question}
                    </h3>
                    <p className="mt-4 text-sm text-slate-700">{faq.answer}</p>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  )
}
