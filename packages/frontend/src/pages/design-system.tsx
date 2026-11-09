import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";

// ── Color swatches ─────────────────────────────────────────────────────────────

type Swatch = { label: string; bg: string; text?: string };

function ColorRow({ title, swatches }: { title: string; swatches: Swatch[] }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[#767676]">{title}</p>
      <div className="flex flex-wrap gap-2">
        {swatches.map((s) => (
          <div key={s.label} className="flex flex-col items-center gap-1">
            <div
              className="h-10 w-16 rounded-lg border border-black/10"
              style={{ background: s.bg }}
            />
            <span className="text-[10px] text-[#767676]">{s.label}</span>
            <span className="text-[10px] font-mono text-[#1E1E1E]">{s.bg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Typography specimen ────────────────────────────────────────────────────────

function TypeRow({ label, className, sample }: { label: string; className: string; sample: string }) {
  return (
    <div className="flex items-baseline gap-6 border-b border-[#F0F0F0] py-3 last:border-0">
      <span className="w-28 shrink-0 text-[11px] text-[#767676]">{label}</span>
      <span className={className}>{sample}</span>
    </div>
  );
}

// ── Section wrapper ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-5">
      <h2 className="border-b border-[#EBEBEB] pb-2 text-lg font-semibold text-[#1E1E1E]">{title}</h2>
      {children}
    </section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DesignSystemPage() {
  return (
    <div className="min-h-screen bg-white px-6 py-10 md:px-16">
      <div className="mx-auto max-w-4xl space-y-14">

        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold text-[#1E1E1E]">BuildPanda Design System</h1>
          <p className="mt-2 text-sm text-[#767676]">
            Temporary preview — colors, typography, buttons & badges per the official design spec.
          </p>
        </div>

        {/* ── Colors ─────────────────────────────────────────────────────────── */}
        <Section title="Colors">
          <div className="space-y-6">
            <ColorRow title="Primary" swatches={[
              { label: "50",  bg: "#E6EDFD" },
              { label: "100", bg: "#B0C8F8" },
              { label: "200", bg: "#8BACF1" },
              { label: "300", bg: "#5488EF" },
              { label: "400", bg: "#3371EE" },
              { label: "500 — brand", bg: "#004DE7" },
              { label: "Dark", bg: "#053DAB" },
              { label: "900", bg: "#002061" },
            ]} />

            <ColorRow title="Secondary" swatches={[
              { label: "Yellow", bg: "#FFE607" },
            ]} />

            <ColorRow title="Success (Green)" swatches={[
              { label: "50",  bg: "#F0FDF4" },
              { label: "100", bg: "#DCFCE7" },
              { label: "200", bg: "#BBF7D0" },
              { label: "300", bg: "#86EFAC" },
              { label: "400", bg: "#4ADE80" },
              { label: "500", bg: "#008236" },
            ]} />

            <ColorRow title="Error (Red)" swatches={[
              { label: "50",  bg: "#FEF2F2" },
              { label: "100", bg: "#FEE2E2" },
              { label: "200", bg: "#FECACA" },
              { label: "300", bg: "#FCA5A5" },
              { label: "400", bg: "#E7000B" },
              { label: "500", bg: "#C10007" },
            ]} />

            <ColorRow title="Warning (Amber)" swatches={[
              { label: "50",  bg: "#FFFBEB" },
              { label: "100", bg: "#FEF3C7" },
              { label: "200", bg: "#FDE68A" },
              { label: "300", bg: "#FCD34D" },
              { label: "400", bg: "#E17100" },
              { label: "500", bg: "#BB4D00" },
            ]} />

            <ColorRow title="Neutral (Gray)" swatches={[
              { label: "50",  bg: "#F5F5F5" },
              { label: "100", bg: "#EBEBEB" },
              { label: "200", bg: "#D6D6D6" },
              { label: "300", bg: "#B0B0B0" },
              { label: "400", bg: "#767676" },
              { label: "Text", bg: "#1E1E1E" },
            ]} />
          </div>
        </Section>

        {/* ── Typography ─────────────────────────────────────────────────────── */}
        <Section title="Typography">
          <div className="space-y-0">
            <TypeRow label="H1 · 72/80px" className="font-heading text-[72px] font-bold leading-[80px] tracking-[-0.02em] text-[#1E1E1E]" sample="Display" />
            <TypeRow label="H2 · 48/56px" className="font-heading text-[48px] font-bold leading-[56px] tracking-[-0.02em] text-[#1E1E1E]" sample="Heading One" />
            <TypeRow label="H3 · 36/44px" className="font-heading text-[36px] font-bold leading-[44px] tracking-[-0.02em] text-[#1E1E1E]" sample="Heading Two" />
            <TypeRow label="H4 · 24/32px" className="font-heading text-[24px] font-semibold leading-[32px] tracking-[-0.02em] text-[#1E1E1E]" sample="Heading Three" />
            <TypeRow label="H5 · 20/28px" className="font-heading text-[20px] font-semibold leading-[28px] tracking-[-0.02em] text-[#1E1E1E]" sample="Heading Four" />
            <TypeRow label="H6 · 16/24px" className="font-heading text-[16px] font-semibold leading-[24px] tracking-[-0.02em] text-[#1E1E1E]" sample="Heading Five" />
            <TypeRow label="Body L · 16/24" className="text-[16px] leading-[24px] text-[#1E1E1E]" sample="Body large — Inter regular for comfortable reading." />
            <TypeRow label="Body M · 14/20" className="text-[14px] leading-[20px] text-[#1E1E1E]" sample="Body medium — the default body size across the app." />
            <TypeRow label="Body S · 12/16" className="text-[12px] leading-[16px] text-[#1E1E1E]" sample="Body small — used for captions and helper text." />
            <TypeRow label="Caption · 10/14" className="text-[10px] leading-[14px] text-[#767676]" sample="Caption — metadata, timestamps, fine print." />
          </div>
        </Section>

        {/* ── Buttons ────────────────────────────────────────────────────────── */}
        <Section title="Buttons">
          <div className="space-y-6">
            {/* Sizes */}
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#767676]">Sizes</p>
              <div className="flex flex-wrap items-center gap-3">
                <Button size="sm">Small</Button>
                <Button size="md">Medium</Button>
                <Button size="lg">Large</Button>
              </div>
            </div>

            {/* All variants — idle */}
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#767676]">Variants</p>
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="primary">Primary</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="danger">Danger</Button>
                <Button variant="danger-outline">Danger Outline</Button>
              </div>
            </div>

            {/* Disabled */}
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#767676]">Disabled</p>
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="primary" disabled>Primary</Button>
                <Button variant="outline" disabled>Outline</Button>
                <Button variant="secondary" disabled>Secondary</Button>
                <Button variant="ghost" disabled>Ghost</Button>
                <Button variant="danger" disabled>Danger</Button>
                <Button variant="danger-outline" disabled>Danger Outline</Button>
              </div>
            </div>

            {/* Loading */}
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#767676]">Loading</p>
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="primary" loading>Primary</Button>
                <Button variant="outline" loading>Outline</Button>
                <Button variant="danger" loading>Danger</Button>
              </div>
            </div>
          </div>
        </Section>

        {/* ── Badges ─────────────────────────────────────────────────────────── */}
        <Section title="Badges">
          {/* Table header */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#EBEBEB]">
                  <th className="py-2 pr-4 text-xs font-semibold uppercase tracking-widest text-[#767676]">Tone</th>
                  <th className="py-2 pr-4 text-xs font-semibold uppercase tracking-widest text-[#767676]">Soft (default)</th>
                  <th className="py-2 pr-4 text-xs font-semibold uppercase tracking-widest text-[#767676]">Solid</th>
                  <th className="py-2 pr-4 text-xs font-semibold uppercase tracking-widest text-[#767676]">Outline</th>
                  <th className="py-2 pr-4 text-xs font-semibold uppercase tracking-widest text-[#767676]">Dot</th>
                  <th className="py-2 text-xs font-semibold uppercase tracking-widest text-[#767676]">Size md</th>
                </tr>
              </thead>
              <tbody>
                {(["neutral", "success", "warning", "danger", "info", "accent"] as const).map((tone) => (
                  <tr key={tone} className="border-b border-[#F5F5F5] last:border-0">
                    <td className="py-3 pr-4 text-xs capitalize text-[#767676]">{tone}</td>
                    <td className="py-3 pr-4"><Badge tone={tone} variant="soft">Label</Badge></td>
                    <td className="py-3 pr-4"><Badge tone={tone} variant="solid">Label</Badge></td>
                    <td className="py-3 pr-4"><Badge tone={tone} variant="outline">Label</Badge></td>
                    <td className="py-3 pr-4"><Badge tone={tone} dot>Label</Badge></td>
                    <td className="py-3"><Badge tone={tone} size="md">Label</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <p className="pb-10 text-center text-xs text-[#B0B0B0]">
          Temporary preview page — remove this route from App.tsx and delete{" "}
          <code className="rounded bg-[#F5F5F5] px-1">src/pages/design-system.tsx</code> when done.
        </p>
      </div>
    </div>
  );
}
