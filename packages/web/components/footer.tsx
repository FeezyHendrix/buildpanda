import Image from "next/image";
import Link from "next/link";
import { site } from "@/lib/site";
import { Container } from "@/components/ui";
import { MailIcon, PhoneIcon } from "@/components/icons";
import { ConsentReset } from "@/components/consent";

const productLinks = [
  { label: "For contractors", href: "/for-contractors/" },
  { label: "For owners", href: "/for-owners/" },
];

const companyLinks = [
  { label: "Construction service", href: "/construction/" },
  { label: "About us", href: "/about/" },
  { label: "Book a consultation", href: "/talk-to-us/" },
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
              Construction management software for contractors, developers and
              project owners. We also manage construction projects, from planning
              to handover.
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
            {site.phones.map((phone) => (
              <a
                key={phone}
                href={`tel:${phone.replace(/\s+/g, "")}`}
                className="inline-flex items-center gap-2 text-sm text-white/70 hover:text-white"
              >
                <PhoneIcon className="h-4 w-4" />
                {phone}
              </a>
            ))}
          </div>
        </div>

        <div className="mt-12 border-t border-white/15 pt-6">
          <p className="max-w-3xl text-sm leading-relaxed text-white/60">
            BuildPanda records construction progress and payment. It is not a
            bank, an escrow agent or a payment institution, and does not hold or
            transfer funds.
          </p>
        </div>

        {/* Legal only: every nav link in here also sits in the columns
            above, and repeating them made the base of the page a wall. */}
        <div className="mt-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <p className="text-sm text-white/70">
            &copy; {new Date().getFullYear()} {site.name}. All rights reserved.
          </p>
          <ul className="flex flex-wrap items-center gap-5">
            <li>
              <Link
                href="/terms-of-service/"
                className="text-sm text-white/70 hover:text-white"
              >
                Terms
              </Link>
            </li>
            <li>
              <Link
                href="/privacy/"
                className="text-sm text-white/70 hover:text-white"
              >
                Privacy
              </Link>
            </li>
            <li>
              <Link
                href="/data-policy/"
                className="text-sm text-white/70 hover:text-white"
              >
                Data Policy
              </Link>
            </li>
            <li>
              {/* Only renders once a choice has been made, so there is always a
                  way back to it — which both the GDPR and the NDPR require. */}
              <ConsentReset />
            </li>
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
            <Link
              href={link.href}
              className="text-sm text-white/70 hover:text-white"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
