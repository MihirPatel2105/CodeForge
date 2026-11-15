import type { Metadata } from "next";
import { LogoAssemble } from "@/components/brand/logo-assemble";
import { AssembleReplay } from "./replay";
import "./preview.css";

export const metadata: Metadata = {
  title: "Icon refinement preview · CodeForge",
  robots: { index: false, follow: false },
};

const maskOf = (src: string) => ({ maskImage: `url(${src})`, WebkitMaskImage: `url(${src})` });
const TILE_SIZES = [180, 64, 32, 16] as const;

function Compare({ ground }: { ground: "light" | "dark" }) {
  return (
    <div className="ip-compare" data-ground={ground}>
      <figure>
        <span className="ip-mark" style={maskOf("/brand/codeforge-icon-v5.svg")} />
        <figcaption>Current (v5)</figcaption>
      </figure>
      <figure>
        <span className="ip-mark" style={maskOf("/brand/icon-pro/icon-refined.svg")} />
        <figcaption>Refined</figcaption>
      </figure>
    </div>
  );
}

export default function IconProPreview() {
  return (
    <main className="ip-page">
      <header className="ip-head">
        <p className="ip-eyebrow">Design study · icon</p>
        <h1>A steadier mark</h1>
        <p>Three things, nothing applied yet: the slabs weighed evenly, the mark as an app tile, and a short assemble for loading.</p>
      </header>

      <section aria-labelledby="ip-refine">
        <h2 id="ip-refine">1 · Optical refinement</h2>
        <p className="ip-note">
          The bottom slab was the lightest of the four, so it read thinner than the top arm. Each slab
          below the average weight now grows part of the way toward it (the bottom slab by 4.75 units,
          the left one by 0.9), capped so no gap closes. Same mark, steadier rhythm.
        </p>
        <Compare ground="light" />
        <Compare ground="dark" />
      </section>

      <section aria-labelledby="ip-tile">
        <h2 id="ip-tile">2 · App tile</h2>
        <p className="ip-note">Ivory mark on the footer&apos;s near-black, 22.5% corner radius — for the favicon, home screen and app icon.</p>
        <div className="ip-tiles">
          <figure className="ip-tile-hero">
            {/* eslint-disable-next-line @next/next/no-img-element -- static preview asset at its true size */}
            <img src="/brand/icon-pro/app-tile-512.png" width={256} height={256} alt="CodeForge app tile" />
            <figcaption>512 (shown at 256)</figcaption>
          </figure>
          {TILE_SIZES.map((size) => (
            <figure key={size}>
              {/* eslint-disable-next-line @next/next/no-img-element -- true-size check */}
              <img src={`/brand/icon-pro/app-tile-${size}.png`} width={size} height={size} alt="" />
              <figcaption>{size}px</figcaption>
            </figure>
          ))}
        </div>
        <div className="ip-tab" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element -- favicon mock */}
          <img src="/brand/icon-pro/app-tile-32.png" width={16} height={16} alt="" />
          <span>CodeForge · Projects</span>
        </div>
      </section>

      <section aria-labelledby="ip-assemble">
        <h2 id="ip-assemble">3 · Assemble</h2>
        <p className="ip-note">
          The slabs slide in along the isometric axes, 90ms apart. Once on a page; looped while something
          loads. With &ldquo;reduce motion&rdquo; on, it is simply the finished mark.
        </p>
        <div className="ip-assemble">
          <AssembleReplay />
          <div className="ip-loading" role="status" aria-label="Loading">
            <LogoAssemble isLooping size={56} />
            <p>Getting things ready…</p>
          </div>
        </div>
      </section>
    </main>
  );
}
