import { Reveal } from './reveal'

const features = [
  {
    label: 'OCR',
    title: 'Reads handwriting doctors gave up on',
    body: 'Vision AI extracts nine structured fields from a single photo — and keeps the raw text when a field is uncertain, so nothing is ever lost.',
  },
  {
    label: 'Vault',
    title: 'Every prescription, in one place',
    body: 'A searchable, filterable history of everything you have ever been prescribed. Detail views show the full extraction, field by field.',
  },
  {
    label: 'Share',
    title: 'Share with a link, not an account',
    body: 'Generate an expiring link — label it "For Dr. Khalid," send it to anyone. They see your history read-only, no signup. Revoke it instantly.',
  },
  {
    label: 'Connect',
    title: 'Doctors see nothing without consent',
    body: 'A doctor gets access to your records only after you send a request and they accept it — scoped strictly to you, and only you.',
  },
  {
    label: 'Care',
    title: 'Chat and HD video, built in',
    body: 'Message your connected doctor in-app, and join scheduled HD video calls — peer-to-peer, so your consultation never routes through a media server.',
  },
]

export function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-6 py-40">
      <Reveal>
        <p
          data-reveal
          className="font-mono text-xs uppercase tracking-[0.25em] text-primary"
        >
          Capabilities
        </p>
        <h2
          data-reveal
          className="mt-5 max-w-2xl text-balance text-4xl font-semibold tracking-tight md:text-5xl"
        >
          A complete system for your medical records.
        </h2>
      </Reveal>

      <div className="mt-20 flex flex-col">
        {features.map((f, i) => (
          <Reveal key={f.label}>
            <div data-reveal className="hairline" />
            <div
              data-reveal
              className="grid gap-4 py-12 md:grid-cols-[140px_1fr_1.2fr] md:gap-10"
            >
              <div className="flex items-start gap-3">
                <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="font-mono text-[11px] uppercase tracking-widest text-primary">
                  {f.label}
                </span>
              </div>
              <h3 className="text-balance text-2xl font-semibold tracking-tight">
                {f.title}
              </h3>
              <p className="max-w-md text-pretty leading-relaxed text-muted-foreground">
                {f.body}
              </p>
            </div>
          </Reveal>
        ))}
        <Reveal>
          <div data-reveal className="hairline" />
        </Reveal>
      </div>
    </section>
  )
}
