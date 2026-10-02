export const metadata = {
  title: 'Privacy Policy — 3rdShift',
  description: 'Privacy Policy for 3rdShift, operated by Goat Labs LLC.',
}

const sections = [
  {
    title: '1. Introduction',
    body: 'This Privacy Policy describes how Goat Labs LLC ("3rdShift," "we," "us," or "our") collects, uses, and protects your information when you use the 3rdShift platform ("the Service").',
  },
  {
    title: '2. Information We Collect',
    body: 'Account information: name, email address, and password when you create an account. Payment information: processed securely through Stripe, a PCI-compliant payment processor. We do not store your credit card number. Usage data: task submissions, team member interactions, feature usage, and session data. Brand context: business information, writing preferences, and audience details you provide to personalize team member outputs. Team Chat data: messages exchanged with team members, preferences and memories stored per team member, and conversation history. Audio and video files uploaded for transcription, meeting notes, and dubbing. Generated audio files (voiceovers, sound effects, dubbed content). Technical data: IP address, browser type, device information, and cookies for analytics and session management.',
  },
  {
    title: '3. How We Use Your Information',
    body: 'To provide and operate the Service. To process payments and manage subscriptions. To personalize AI team member outputs using your brand context and preferences. To store Team Chat memories and preferences to improve future interactions. To communicate with you about your account, billing, and product updates. To improve the Service through aggregated, anonymized usage analytics. To detect and prevent fraud, abuse, or violations of our Terms.',
  },
  {
    title: '4. How Team Members Use Your Data',
    body: 'AI team members use your task inputs and stored brand context to generate outputs. Your Brand Profile (company name, industry, audience, tone) is shared across all team members on your account. Per-member preferences and memories are scoped to each individual team member and your account only. Your data is never shared with other users\' sessions. Team Chat memory: When you use Team Chat, your team members may store relevant preferences, brand details, and working style information to personalize future interactions. This memory is scoped to your account and each individual team member. You can view, delete, or modify stored memories at any time through the Memory panel in each team member\'s chat. You can also say "forget that" in any chat to remove a specific memory. We do not use your inputs, outputs, conversations, brand context, or any content you create through the Service to train, fine-tune, or improve AI models. Your content is processed in real-time to generate deliverables and is not retained for model training purposes.',
  },
  {
    title: '5. Data Sharing',
    body: 'We do not sell your personal information. We do not share your personal information for advertising purposes. We may share data with service providers who help us operate the Service, including: payment processors, cloud hosting and infrastructure providers, authentication services, AI service providers for task processing, and social media platforms you choose to connect. These providers process data only as needed to provide their services and are bound by their own privacy policies and data processing agreements. Third-party AI and service providers used to operate the Service include: Anthropic (AI text generation), OpenAI (AI image generation), ElevenLabs (audio processing including text-to-speech, speech-to-text, sound effects generation, and dubbing), RocketReach (professional contact data for lead generation), Serper (web search), Stripe (payments), Supabase (database and storage), and Vercel (hosting). We may disclose your information if required by law, legal process, or government request, or to protect the rights, safety, or property of Goat Labs LLC, our users, or the public.',
  },
  {
    title: '6. Third-Party Integrations',
    body: 'You may optionally connect 3rdShift to third-party platforms to send deliverables directly from your account. Currently supported integrations include: Google Drive, Notion, Mailchimp, WordPress, and Buffer. When you connect an integration, we store an access token for that service in your account to enable the connection. We only access the specific data needed to perform the action you request (e.g., saving a file to Google Drive or creating a Mailchimp campaign draft). We do not share your deliverables or personal data with these platforms beyond what you explicitly initiate. You can disconnect any integration at any time from your Settings page, and we will delete the stored access token. These third-party services have their own privacy policies: Google (policies.google.com/privacy), Notion (notion.so/privacy), Mailchimp (mailchimp.com/legal/privacy), WordPress (automattic.com/privacy), Buffer (buffer.com/legal/privacy). Social Media Publishing You may optionally connect your social media accounts to 3rdShift to publish content directly from the platform. Supported social media platforms include: LinkedIn, Facebook, Instagram, Pinterest, and TikTok. When you connect a social media account, we request only the permissions necessary to publish content on your behalf. Specifically, we may request permission to create and publish posts, access basic profile information (such as your name and account ID) to confirm the connection, and view page or account lists so you can select where to publish. We do not read, collect, store, or analyze your existing social media content, followers, messages, analytics, or any other data from your connected social media accounts beyond what is required to publish content you initiate through 3rdShift. We do not post to your social media accounts without your explicit action. Every post is initiated by you — either directly or through a workflow you configure. We store an OAuth access token and refresh token for each connected social media account to maintain the connection. These tokens are scoped to your account only and are not shared with other users or third parties. You can disconnect any social media account at any time from your Settings page. When you disconnect, we immediately delete the stored access and refresh tokens. We do not retain any access to your social media accounts after disconnection. Social media platforms have their own privacy policies: LinkedIn (linkedin.com/legal/privacy-policy), Meta/Facebook/Instagram (facebook.com/privacy/policy), Pinterest (policy.pinterest.com/privacy-policy), TikTok (tiktok.com/legal/privacy-policy).',
  },
  {
    title: '7. Audio and Video Data',
    body: 'When you use our transcription, meeting notes, or dubbing services, you may upload audio or video files to the Service. Here is how we handle that data: What we collect: We store the audio or video files you upload, and the outputs generated from them (transcripts, meeting notes, dubbed audio files, voiceover recordings, sound effects). How files are processed: Uploaded files are sent to our third-party audio processing provider (ElevenLabs) for transcription, text-to-speech, sound effect generation, or dubbing. ElevenLabs processes the files in accordance with their own privacy policy and data processing terms. We do not control how ElevenLabs handles data beyond what is specified in our agreement with them. How long files are stored: Uploaded files and generated outputs are stored in your account as long as the associated task exists. When you delete a task, the associated files are deleted. We do not retain copies of deleted files. Third-party voices: Meeting recordings and other uploaded audio may contain the voices of individuals other than the account holder. By uploading such recordings, you confirm that all participants have been informed of and consent to the recording being processed by an AI service. No training use: We do not use your uploaded audio or video files, or any generated outputs, to train, fine-tune, or improve AI models. Your files are processed solely to deliver the requested service to you. Children: The Service is not intended for users under 18. We do not knowingly process audio recordings of minors.',
  },
  {
    title: '8. Do Not Sell or Share My Personal Information',
    body: '3rdShift does not sell your personal information to third parties. We do not share your personal information for cross-context behavioral advertising. We do not and will not sell or share your data for any purpose beyond operating the Service. This applies to all users regardless of location.',
  },
  {
    title: '9. Data Retention',
    body: 'Account data is retained while your account is active. Text-based deliverables (articles, reports, lead lists, etc.) are retained in your account for as long as your account is active, accessible through the My Tasks section. Image deliverables and uploaded files are stored temporarily and may expire after 48 hours. We recommend downloading image deliverables promptly. Team Chat messages and memories are retained while your account is active. You can delete individual memories at any time through the Memory panel. If you delete your account, all personal data, task history, conversations, memories, and stored preferences are permanently deleted within 30 days, except where retention is required by law.',
  },
  {
    title: '10. Data Security',
    body: 'We use industry-standard security measures including encryption in transit (TLS), secure authentication, and access controls. No method of transmission or storage is 100% secure, and we cannot guarantee absolute security. In the event of a data breach affecting your personal information, we will notify you in accordance with applicable law.',
  },
  {
    title: '11. Cookies',
    body: 'We use essential cookies for authentication and session management. We may use analytics cookies to understand how the Service is used. You can control cookies through your browser settings.',
  },
  {
    title: '12. Your Rights',
    body: 'Depending on your jurisdiction, you may have the right to: access the personal data we hold about you, request correction of inaccurate data, request deletion of your data, object to or restrict processing, request data portability, and withdraw consent where applicable. You can delete your account and all associated data through the Settings section of your dashboard. You can delete individual Team Chat memories through the Memory panel. You can export deliverables at any time through the My Tasks section or Google Workspace integration. To exercise any other data rights, contact us through the Help & Support section in your dashboard.',
  },
  {
    title: '13. For Users in the European Economic Area',
    body: 'If you are located in the EEA, you have additional rights under the General Data Protection Regulation (GDPR). Our legal basis for processing your personal data is: contract performance (to provide the Service you subscribed to), legitimate interest (to improve the Service and prevent abuse), and consent (where required, such as for optional analytics). You have the right to access, correct, delete, restrict, or port your personal data. You also have the right to withdraw consent and to lodge a complaint with your local data protection authority. Data transfers: Your data may be transferred to and processed in the United States. We use industry-standard safeguards to protect your data during transfer. To exercise these rights, contact us through the Help & Support section in your dashboard.',
  },
  {
    title: '14. Children',
    body: 'The Service is not intended for users under 18 years of age. We do not knowingly collect data from children. If we discover that a user is under 18, we will delete their account and associated data.',
  },
  {
    title: '15. Changes to This Policy',
    body: 'We may update this Privacy Policy from time to time. We will notify users of material changes via email or in-product notification. Continued use of the Service after changes constitutes acceptance.',
  },
  {
    title: '16. Contact',
    body: 'Questions about this Privacy Policy? Contact us through the Help & Support section inside your 3rdShift dashboard.',
  },
]

export default function PrivacyPage() {
  return (
    <div className="legal-page pt-6! pb-9! md:pt-8! md:pb-12! lg:py-14!">
      <div className="legal-inner max-w-[991px]! mx-auto! px-6!">
        <p className="legal-date text-center! text-sm! md:text-base! font-semibold! text-blue-500! my-2!">Last updated: April 15, 2026</p>
        <h1 className="legal-title text-center! text-[30px]! sm:text-[33px]! md:text-[36px]! lg:text-[40px]! leading-10! sm:leading-12! md:leading-13! font-semibold! text-zinc-800! mb-9! sm:mb-12! md:mb-12!">Privacy Policy</h1>
        {sections.map((s) => (
          <div key={s.title} className="legal-section mb-0!">
            <h2 className="legal-section-title text-zinc-800! text-lg! sm:text-xl! font-semibold! mb-2! sm:mb-3! mt-7! sm:mt-9!">{s.title}</h2>
            <p className="legal-section-body text-neutral-500! text-sm! sm:text-base! font-normal!" style={{ whiteSpace: 'pre-line' }}>{s.body}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
