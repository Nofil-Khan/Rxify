import { Reveal } from './reveal'

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
      <div className="font-mono text-[11px] uppercase tracking-widest text-slate-400">
        {label}
      </div>
      <div className="mt-2 text-base font-semibold text-slate-100">{value}</div>
    </div>
  )
}

const medications = [
  ['Amoxicillin', '500 mg', '3× daily', '7 days'],
  ['Ibuprofen', '400 mg', 'As needed', '5 days'],
  ['Omeprazole', '20 mg', '1× morning', '14 days'],
]

export function PrescriptionSpecimen() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-40">
      <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/80 shadow-[0_40px_120px_-40px_rgba(0,0,0,0.8)] ring-1 ring-white/10 backdrop-blur-xl">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-300 via-sky-400 to-blue-500" />
        <div className="relative px-8 py-10 md:px-12 md:py-14">
          <Reveal>
            <p
              data-reveal
              className="font-mono text-xs uppercase tracking-[0.25em] text-sky-300"
            >
              The extraction
            </p>
            <h2
              data-reveal
              className="mt-5 max-w-2xl text-balance text-4xl font-semibold tracking-tight text-slate-100 md:text-5xl"
            >
              One photo becomes this.
            </h2>
            <p
              data-reveal
              className="mt-6 max-w-xl text-pretty leading-relaxed text-slate-300"
            >
              A specimen of what Rxify returns from a single handwritten slip —
              every field structured, typed, and searchable.
            </p>
          </Reveal>

          <Reveal className="mt-14 max-w-3xl" stagger={0.08}>
            <div data-reveal className="flex flex-col gap-3 rounded-[1.75rem] border border-white/10 bg-white/5 p-5 md:flex-row md:items-center md:justify-between">
              <span className="font-mono text-[11px] uppercase tracking-widest text-slate-400">
                Extraction · RX-2481
              </span>
              <span className="font-mono text-[11px] uppercase tracking-widest text-cyan-300">
                Status: Done
              </span>
            </div>
            <div data-reveal className="hairline mt-6" />

            <div
              data-reveal
              className="mt-8 grid gap-4 md:grid-cols-4"
            >
              <Field label="Patient" value="Sana Ahmed" />
              <Field label="Prescriber" value="Dr. Iqbal Khalid" />
              <Field label="Clinic" value="City Care Medical" />
              <Field label="Diagnosis" value="Acute sinusitis" />
            </div>

            <div data-reveal className="mt-10 rounded-[1.75rem] border border-white/10 bg-white/5 p-6">
              <div className="grid grid-cols-[1.6fr_0.9fr_1fr_0.9fr] gap-4 font-mono text-[10px] uppercase tracking-widest text-slate-400">
                <span>Medication</span>
                <span>Dosage</span>
                <span>Frequency</span>
                <span>Duration</span>
              </div>
              <div className="hairline mt-3" />
              {medications.map(([name, dose, freq, dur]) => (
                <div key={name} className="grid grid-cols-[1.6fr_0.9fr_1fr_0.9fr] gap-4 py-4 text-sm text-slate-100">
                  <span className="font-semibold">{name}</span>
                  <span className="text-slate-300">{dose}</span>
                  <span className="text-slate-300">{freq}</span>
                  <span className="text-slate-300">{dur}</span>
                </div>
              ))}
            </div>

            <div
              data-reveal
              className="mt-8 grid gap-4 md:grid-cols-3"
            >
              <Field label="Follow-up" value="Aug 12, 2026" />
              <Field label="Raw OCR" value="Preserved as fallback" />
              <Field label="Medicine info" value="AI lookup available" />
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
