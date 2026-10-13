import Image from "next/image";
import type { ComponentType } from "react";
import { Logo } from "@/components/ui/logo";
import { FacebookIcon, InstagramIcon, TwitterIcon } from "@/components/ui/social-icons";
import { footer, type SocialId } from "@/content/footer";
import { FooterLinks } from "./footer-links";

const socialIcons: Record<SocialId, ComponentType<{ className?: string }>> = {
  twitter: TwitterIcon,
  instagram: InstagramIcon,
  facebook: FacebookIcon,
};

const SOCIAL_TARGET = "flex size-11 items-center justify-center";

/** Site footer. Mounted once in the root layout. */
export function Footer() {
  const { backedBy } = footer;
  const year = new Date().getFullYear();

  return (
    <footer data-nav-theme="brand" className="relative overflow-hidden bg-brand text-white">
      <div aria-hidden="true">
        <div className="grain" />
        <div className="footer-light" />
        <div className="footer-specks" />
      </div>

      <div className="site-container relative flex flex-col gap-12 pt-12 pb-16 lg:flex-row lg:justify-between lg:pt-[4.125rem] lg:pb-24">
        <div>
          <Logo className="h-12 w-auto lg:h-16" />
          <p className="mt-8 max-w-[27rem] text-[0.9375rem] leading-normal text-pretty">{footer.description}</p>
          <p className="mt-6 text-[0.8125rem] font-medium">{backedBy.label}</p>
          <Image
            src={backedBy.logo.src}
            alt={backedBy.logo.alt}
            width={backedBy.logo.width}
            height={backedBy.logo.height}
            className="mt-2 h-[3.375rem] w-auto"
          />
        </div>

        <FooterLinks />
      </div>

      <div className="relative border-t border-white/14">
        <div className="site-container flex flex-col-reverse items-center gap-2 py-5 sm:min-h-18 sm:flex-row sm:justify-between sm:py-0">
          <p className="text-[0.9375rem]">{footer.copyright(year)}</p>
          <ul className="-mx-2.5 flex">
            {footer.socials.map((social) => {
              const Icon = socialIcons[social.id];

              return (
                <li key={social.id}>
                  {social.href ? (
                    <a
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={social.label}
                      className={SOCIAL_TARGET}
                    >
                      <Icon className="size-6" />
                    </a>
                  ) : (
                    <span className={SOCIAL_TARGET}>
                      <Icon className="size-6" />
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </footer>
  );
}
