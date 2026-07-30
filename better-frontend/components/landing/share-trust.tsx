import { Reveal } from './reveal'

export function ShareTrust() {
  return (
    <section id="for-doctors" className="mx-auto max-w-6xl px-6 py-40">
      <div className="grid gap-20 md:grid-cols-2">
        <Reveal>
          <p
            data-reveal
            className="font-mono text-xs uppercase tracking-[0.25em] text-primary"
          >
            Sharing
          </p>
          <h2
            data-reveal
            className="mt-5 text-balance text-3xl font-semibold tracking-tight md:text-4xl"
          >
            A link is all anyone needs.
          </h2>
          <p
            data-reveal
            className="mt-6 max-w-md text-pretty leading-relaxed text-muted-foreground"
          >
            Create a share link with an expiry — seven days, say — and label it
            for whoever it&apos;s for. The recipient opens it in any browser and
            sees your prescription history, read-only. No password, no signup.
          </p>
          <div data-reveal className="mt-8 max-w-md">
            <div className="hairline mb-4" />
            <div className="flex items-baseline justify-between gap-4 font-mono text-xs">
              <span className="truncate text-muted-foreground">
                rxify.app/share/tk_9f2a…
              </span>
              <span className="shrink-0 text-primary">expires in 7 days</span>
            </div>
            <div className="mt-3 flex items-baseline justify-between gap-4 text-sm">
              <span className="font-medium">&ldquo;For Dr. Khalid&rdquo;</span>
              <span className="link-underline cursor-default font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                Revoke
              </span>
            </div>
          </div>
        </Reveal>

        <Reveal>
          <p
            data-reveal
            className="font-mono text-xs uppercase tracking-[0.25em] text-primary"
          >
            Privacy
          </p>
          <h2
            data-reveal
            className="mt-5 text-balance text-3xl font-semibold tracking-tight md:text-4xl"
          >
            Doctors see nothing until you say so.
          </h2>
          <p
            data-reveal
            className="mt-6 max-w-md text-pretty leading-relaxed text-muted-foreground"
          >
            Connections are explicit. You send a request; your doctor accepts
            it. Only then do they see your records — and only yours. Video
            consultations run peer-to-peer, so your call never passes through
            our servers.
          </p>
          <div data-reveal className="mt-8 max-w-md">
            <div className="hairline mb-4" />
            <dl className="flex flex-col gap-3 text-sm">
              {[
                ['No connection', 'Doctor sees nothing'],
                ['Request sent', 'Doctor sees a name, nothing more'],
                ['Accepted', 'Full visibility — scoped to you alone'],
              ].map(([state, access]) => (
                <div
                  key={state}
                  className="flex items-baseline justify-between gap-4"
                >
                  <dt className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                    {state}
                  </dt>
                  <dd className="text-right font-medium">{access}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
