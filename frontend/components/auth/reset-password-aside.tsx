import Link from "next/link";
import { LogoMark } from "@/components/brand/logo-mark";

/**
 * The left half of the reset-password screen specifically — not the shared
 * `AuthAside`'s run replay, which has nothing to do with the task on this page.
 *
 * The claim is about the mechanism this feature actually has, not a borrowed security
 * aphorism: the link is single-use, short-lived, and ends every other session the
 * moment it is spent. Stating that plainly is more CodeForge than a mood — the product's
 * whole position is that a result is a fact rather than a claim, and the same discipline
 * applies to what this panel says about itself.
 */
export function ResetPasswordAside() {
  return (
    <aside className="cf-invert cf-lift relative hidden flex-col justify-center overflow-hidden bg-bg px-10 py-9 lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-[52%] xl:w-[54%]">
      <div>
        <Link
          href="/"
          aria-label="CodeForge home"
          className="inline-flex w-fit items-center gap-[9px] transition-opacity hover:opacity-80"
        >
          <LogoMark className="h-6 w-6 rounded-[2px]" />
          <span className="font-display text-[16px] font-[600] tracking-[-0.03em] text-fg">
            codeforge
          </span>
        </Link>

        <h1 className="font-display mt-11 max-w-[17ch] text-[29px] font-[600] leading-[1.24] tracking-[-0.045em] text-fg">
          A reset link that still works twice isn&apos;t resetting anything.
        </h1>

        <p className="mt-6 font-mono text-[12.5px] leading-[1.6] text-fg-faint">
          single-use &middot; expires in 10 minutes &middot; ends every other session
        </p>
      </div>
    </aside>
  );
}
