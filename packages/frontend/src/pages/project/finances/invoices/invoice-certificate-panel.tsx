import { Spinner } from "@/components/atoms/spinner";
import { useInvoiceCertificate } from "@/hooks/use-invoices";
import { errorMessage } from "@/lib/api-error";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";

/**
 * The interim certificate a QS reads down: what was certified before, what
 * this certificate adds, where that leaves the cumulative position, and the
 * deductions the contract terms produce — retention, VAT and the advance
 * recovery line that starts from the certificate number the terms name.
 *
 * Every figure comes from `GET /invoices/:id/certificate`, seeded from the
 * contract terms. Nothing here is hand-typed and nothing is recomputed.
 */

interface InvoiceCertificatePanelProps {
  projectId: string;
  invoiceId: string;
  currency: string;
}

function CertificateLine({
  label,
  value,
  operator,
  emphasis,
  helper,
}: {
  label: string;
  value: string;
  operator?: "+" | "−" | "=";
  emphasis?: boolean;
  helper?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 py-3",
        emphasis
          ? "mt-1 border-t border-gray-900/10 pt-4"
          : "border-t border-line-hair first:border-t-0 first:pt-0",
      )}
    >
      <div className="flex items-start gap-3 text-sm">
        {operator ? (
          <span className="w-4 text-center font-semibold text-ink-muted">{operator}</span>
        ) : (
          <span className="w-4" aria-hidden="true" />
        )}
        <div>
          <span className={cn(emphasis ? "font-semibold text-ink" : "text-gray-600")}>{label}</span>
          {helper ? <p className="mt-0.5 text-xs text-ink-muted">{helper}</p> : null}
        </div>
      </div>
      <span
        className={cn(
          "whitespace-nowrap tabular-nums",
          emphasis ? "text-lg font-medium text-primary-500" : "text-sm font-medium text-ink",
        )}
      >
        {value}
      </span>
    </div>
  );
}

CertificateLine.displayName = "CertificateLine";

export function InvoiceCertificatePanel({ projectId, invoiceId, currency }: InvoiceCertificatePanelProps) {
  const { data: certificate, isPending, isError, error } = useInvoiceCertificate(projectId, invoiceId);
  const money = (value: number) => formatCurrency(value, currency);

  if (isPending) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="md" />
      </div>
    );
  }

  if (isError) {
    return (
      <p className="rounded-lg bg-surface-alt p-4 text-sm text-negative-600">
        {errorMessage(error, "Could not load the certificate structure.")}
      </p>
    );
  }

  if (!certificate) {
    return (
      <p className="rounded-lg bg-surface-alt p-4 text-sm text-ink-muted">
        This invoice is not an interim certificate against the contract, so it has no
        previous / this / cumulative structure.
      </p>
    );
  }

  return (
    <section>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-ink">
          Interim payment certificate {certificate.number}
        </h3>
        <p className="mt-1 text-xs text-ink-muted">
          Seeded from the contract terms — retention rate, VAT and the certificate the advance
          recovery starts from. Change the terms on the main contract, not here.
        </p>
      </div>

      <CertificateLine
        label="Previously certified"
        value={money(certificate.previousCertified)}
        helper="Gross value certified on earlier certificates"
      />
      <CertificateLine label="This certificate" operator="+" value={money(certificate.thisCertificate)} />
      <CertificateLine
        label="Cumulative certified"
        operator="="
        value={money(certificate.cumulative)}
        emphasis
      />
      <CertificateLine label="Retention" operator="−" value={money(certificate.retention)} />
      <CertificateLine
        label="Advance recovery"
        operator="−"
        value={money(certificate.advanceRecovery)}
        helper={
          certificate.advanceRecovery > 0
            ? "Recovered from this certificate under the contract terms"
            : "No recovery falls due on this certificate"
        }
      />
      <CertificateLine label="VAT" operator="+" value={money(certificate.vat)} />
      <CertificateLine label="Net payable" operator="=" value={money(certificate.netPayable)} emphasis />
    </section>
  );
}

InvoiceCertificatePanel.displayName = "InvoiceCertificatePanel";
