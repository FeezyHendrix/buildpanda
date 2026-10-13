import Link from "next/link";
import { footer } from "@/content/footer";

/** The footer's link columns. Each is its own navigation landmark. */
export function FooterLinks() {
  return (
    <div className="flex flex-col gap-10 sm:flex-row sm:gap-[6.875rem]">
      {footer.columns.map((column) => (
        <nav key={column.title} aria-label={column.title}>
          <h2 className="text-[1.0625rem] font-medium">{column.title}</h2>
          <ul className="mt-2">
            {column.links.map((link) => (
              <li key={link.label}>
                <Link
                  href={link.href}
                  className="inline-flex min-h-9 items-center text-[0.9375rem] text-white/75 underline-offset-4 hover:text-white hover:underline focus-visible:text-white"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ))}
    </div>
  );
}
