import { forwardRef } from "react";
import type { Ofrenda } from "@/lib/ofrenda";
import { formatCount, longDate } from "@/lib/ofrenda";
import { Candle, Marigold, PapelPicado } from "./ornaments";

export type PartView = { text: string; source: "facts" | "model" | "writing" };

type Props = {
  ofrenda: Ofrenda;
  epitaph: PartView;
  remembrance: PartView;
  writtenBy: string;
  readOn: string;
};

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-[10.5px] font-medium uppercase tracking-[0.22em] text-dust">{children}</p>;
}

export const OfrendaCard = forwardRef<HTMLDivElement, Props>(function OfrendaCard(
  { ofrenda: o, epitaph, remembrance, writtenBy, readOn },
  ref
) {
  const alive = o.status === "alive";
  const tenders = o.tenders.length ? o.tenders.join(", ") + (o.tendersMore ? ", and others" : "") : "Unknown hands";
  return (
    <div ref={ref} data-card className="glow relative w-full overflow-hidden rounded-[28px] border border-hairline text-bone shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)]">
      <PapelPicado className="block h-auto w-full px-3 pt-0 opacity-90" />
      <div className="px-7 pb-8 pt-4 sm:px-10 sm:pb-10">
        <div className="text-center">
          <p className="text-[11px] font-medium uppercase tracking-[0.32em] text-marigold">
            {alive ? "Not yet" : "En memoria"}
          </p>
          <h2 className="mt-3 break-words font-serif text-[40px] leading-[1.05] tracking-[-0.01em] sm:text-[48px]">{o.name}</h2>
          <p className="mt-2 font-mono text-[12px] text-ash">{o.fullName}</p>
          <p className="mt-3 text-[13px] text-ash">
            {o.years}
            <span className="mx-2 text-dust">/</span>
            <span className={alive ? "text-[color:var(--jade)]" : "text-marigold"}>{o.statusLabel}</span>
          </p>
        </div>

        <p
          className={`mx-auto mt-7 max-w-[30ch] text-balance text-center font-serif text-[21px] italic leading-snug sm:text-[23px] ${
            epitaph.source === "writing" ? "text-bone/80" : ""
          }`}
        >
          {epitaph.text}
          {epitaph.source === "writing" && <span className="breathe ml-0.5 text-marigold">|</span>}
        </p>

        <div className="my-7 flex items-center justify-center gap-3" aria-hidden="true">
          <span className="h-px w-16 bg-hairline" />
          <Marigold size={22} />
          <span className="h-px w-16 bg-hairline" />
        </div>

        <div className="space-y-6">
          <section>
            <Label>{alive ? "What it gives us" : "What it gave us"}</Label>
            <p className={`mt-2 text-pretty text-[15px] leading-relaxed ${remembrance.source === "writing" ? "text-bone/80" : "text-bone/95"}`}>
              {remembrance.text}
              {remembrance.source === "writing" && <span className="breathe ml-0.5 text-marigold">|</span>}
            </p>
          </section>

          {o.lastWords && (
            <section>
              <Label>{alive ? "Latest words" : "Last words"}</Label>
              <p className="mt-2 break-words font-mono text-[13.5px] leading-relaxed text-bone">&ldquo;{o.lastWords.message}&rdquo;</p>
              <p className="mt-1 text-[12px] text-dust">
                {o.lastWords.author ? `${o.lastWords.author}, ` : ""}
                {longDate(o.lastWords.date)}
              </p>
            </section>
          )}

          <section>
            <Label>Tended by</Label>
            <p className="mt-2 break-words text-[14px] text-bone/95">{tenders}</p>
          </section>
        </div>

        <div className="mt-8 flex items-end justify-between gap-4 border-t border-hairline pt-5">
          <div className="text-[12px] leading-relaxed text-ash">
            <p>
              {formatCount(o.stars)} stars, {formatCount(o.forks)} forks
            </p>
            <p>{alive ? `Last touched ${o.quietFor} ago` : `Quiet for ${o.quietFor}`}</p>
          </div>
          <div className="flex shrink-0 items-end gap-1.5" aria-hidden="true">
            <Marigold size={18} className="mb-0.5 opacity-90" />
            <Candle lit className="h-11 w-6" />
            <Candle lit={!alive} className="h-8 w-5" />
            <Marigold size={14} className="mb-0.5 opacity-80" />
          </div>
        </div>
        <p className="mt-4 text-[10.5px] leading-relaxed text-dust">
          {writtenBy}. Facts read from GitHub on {readOn}. last-commit-ofrenda.vercel.app
        </p>
      </div>
    </div>
  );
});
