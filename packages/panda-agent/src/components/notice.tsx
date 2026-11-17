import { Button } from "@field-ui/button";

export function Notice({ title, children, retry }: { title: string; children: React.ReactNode; retry?: () => void }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-6" aria-live="polite">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-2 text-sm leading-6 text-ink-muted">{children}</div>
      {retry ? <Button variant="secondary" className="mt-4" onClick={retry}>Try again</Button> : null}
    </section>
  );
}

export function ErrorMessage({ error }: { error: Error | null }) {
  return error ? <p role="alert" className="mt-3 rounded-lg bg-error-50 p-3 text-sm text-error-600">{error.message}</p> : null;
}
