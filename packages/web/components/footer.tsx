import Image from "next/image";
import Link from "next/link";
import { nav, site } from "@/lib/site";
import { Container } from "@/components/ui";
import { MailIcon, PhoneIcon } from "@/components/icons";

const productLinks = [
  { label: "Milestone payments", href: "/product/#payments" },
  { label: "Budget & finances", href: "/product/#budget" },
  { label: "Documents", href: "/product/#documents" },
  { label: "Inspections & monitoring", href: "/product/#inspections" },
];

const companyLinks = [
  { label: "Construction service", href: "/construction/" },
  { label: "About us", href: "/about/" },
  { label: "Book a consultation", href: "/#consultation" },
];

export function Footer() {
  return (
    <footer className="bg-ink text-white">
      <Container className="py-14">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="flex flex-col gap-4">
            <Image
              src="/logo.svg"
              alt="BuildPanda"
              width={132}
              height={36}
              className="h-8 w-auto brightness-0 invert"
            />
            <p className="max-w-xs text-sm leading-relaxed text-white/70">
              The construction management platform that takes you from inception
              to completion and handover, whether you build from Lagos or from
              the diaspora.
            </p>
          </div>

          <FooterColumn title="Product" links={productLinks} />
          <FooterColumn title="Company" links={companyLinks} />

          <div className="flex flex-col gap-4">
            <h4 className="text-sm font-semibold text-white">Get in touch</h4>
            <a
              href={`mailto:${site.email}`}
              className="inline-flex items-center gap-2 text-sm text-white/70 hover:text-white"
            >
              <MailIcon className="h-4 w-4" />
              {site.email}
            </a>
            <a
              href={`tel:${site.phoneDisplay.replace(/\s+/g, "")}`}
              className="inline-flex items-center gap-2 text-sm text-white/70 hover:text-white"
            >
              <PhoneIcon className="h-4 w-4" />
              {site.phoneDisplay}
            </a>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-white/15 pt-6 sm:flex-row sm:items-center">
          <p className="text-sm text-white/70">
            &copy; {new Date().getFullYear()} {site.name}. All rights reserved.
          </p>
          <ul className="flex flex-wrap items-center gap-5">
            {nav.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="text-sm text-white/70 hover:text-white">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <h4 className="text-sm font-semibold text-white">{title}</h4>
      <ul className="flex flex-col gap-3">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="text-sm text-white/70 hover:text-white">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
