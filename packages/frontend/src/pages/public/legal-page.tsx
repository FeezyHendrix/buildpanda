import { Link } from "react-router-dom";
import logo from "@/assets/images/logo.svg";
import type { LegalDocument } from "@/lib/legal-content";

export function LegalPage({ doc }: { doc: LegalDocument }) {
  return (
    <div className="min-h-dvh bg-[#FCFCFD]">
      <header className="sticky top-0 z-10 border-b border-[#EDEDED] bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center">
            <img src={logo} alt="BuildPanda" className="h-8" />
          </Link>
          <Link
            to="/auth/sign-in"
            className="text-sm font-medium text-[#004DE7] hover:text-[#0041c4]"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">{doc.title}</h1>
        <p className="mt-2 text-sm text-gray-500">Last updated {doc.effectiveDate}</p>

        <div className="mt-8 space-y-4">
          {doc.intro.map((p, i) => (
            <p key={i} className="text-[15px] leading-relaxed text-gray-700">
              {p}
            </p>
          ))}
        </div>

        <div className="mt-10 space-y-10">
          {doc.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-lg font-semibold text-gray-900">{section.heading}</h2>
              <div className="mt-3 space-y-3">
                {section.body.map((p, i) => (
                  <p key={i} className="text-[15px] leading-relaxed text-gray-700">
                    {p}
                  </p>
                ))}
                {section.bullets ? (
                  <ul className="mt-2 space-y-2 pl-1">
                    {section.bullets.map((b, i) => (
                      <li key={i} className="flex gap-3 text-[15px] leading-relaxed text-gray-700">
                        <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[#004DE7]" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-14 flex flex-wrap gap-x-6 gap-y-2 border-t border-[#EDEDED] pt-6 text-sm">
          <Link to="/terms" className="text-gray-500 hover:text-gray-900">
            Terms of Service
          </Link>
          <Link to="/privacy" className="text-gray-500 hover:text-gray-900">
            Privacy Policy
          </Link>
          <Link to="/data-policy" className="text-gray-500 hover:text-gray-900">
            Data Policy
          </Link>
          <Link to="/" className="text-gray-500 hover:text-gray-900">
            Back to BuildPanda
          </Link>
        </div>
      </main>
    </div>
  );
}
