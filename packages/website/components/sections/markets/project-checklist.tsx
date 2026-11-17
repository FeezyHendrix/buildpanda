import { marketCopy } from "@/content/markets/copy";
import type { Language } from "@/content/markets/types";

export function ProjectChecklist({ language }: { language: Language }) {
  const copy = marketCopy[language];
  return (
    <div className="space-y-8 leading-relaxed">
      <section>
        <h2 className="text-2xl font-semibold">{copy.checklist}</h2>
        <p className="mt-3">{copy.checklistBody}</p>
        <p className="mt-3">{copy.permissionCheck}</p>
      </section>
      <section>
        <h2 className="text-2xl font-semibold">{copy.fit}</h2>
        <p className="mt-3">{copy.fitBody}</p>
      </section>
    </div>
  );
}
