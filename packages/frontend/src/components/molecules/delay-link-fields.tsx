import { Label } from "@/components/atoms/label";
import { INPUT_CLASS } from "@/components/atoms/input";

export interface DelayLinkOption {
  id: string;
  label: string;
}

/** The records a delay can point at as its cause. Any list may be empty. */
export interface DelayLinkOptions {
  rfis?: DelayLinkOption[];
  changeRequests?: DelayLinkOption[];
  materialOrders?: DelayLinkOption[];
}

interface DelayLinkFieldsProps {
  links?: DelayLinkOptions;
  rfiId: string;
  changeRequestId: string;
  materialOrderId: string;
  onRfiChange: (id: string) => void;
  onChangeRequestChange: (id: string) => void;
  onMaterialOrderChange: (id: string) => void;
}

function LinkSelect({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: DelayLinkOption[];
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={INPUT_CLASS}>
        <option value="">Not linked</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

LinkSelect.displayName = "LinkSelect";

/**
 * The cause of a delay usually already exists as a record — an unanswered RFI,
 * an instructed change, a late order. Linking it is what makes the delay
 * arguable later, so the three pickers sit on the delay form itself.
 */
function DelayLinkFields({
  links,
  rfiId,
  changeRequestId,
  materialOrderId,
  onRfiChange,
  onChangeRequestChange,
  onMaterialOrderChange,
}: DelayLinkFieldsProps) {
  const rfis = links?.rfis ?? [];
  const changeRequests = links?.changeRequests ?? [];
  const materialOrders = links?.materialOrders ?? [];
  if (rfis.length === 0 && changeRequests.length === 0 && materialOrders.length === 0) return null;

  return (
    <fieldset className="flex flex-col gap-3 rounded-lg border border-line-hair p-3">
      <legend className="px-1 text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">
        Caused by (optional)
      </legend>
      {rfis.length > 0 ? (
        <LinkSelect id="delay-link-rfi" label="RFI" value={rfiId} options={rfis} onChange={onRfiChange} />
      ) : null}
      {changeRequests.length > 0 ? (
        <LinkSelect
          id="delay-link-change"
          label="Change request"
          value={changeRequestId}
          options={changeRequests}
          onChange={onChangeRequestChange}
        />
      ) : null}
      {materialOrders.length > 0 ? (
        <LinkSelect
          id="delay-link-order"
          label="Material order"
          value={materialOrderId}
          options={materialOrders}
          onChange={onMaterialOrderChange}
        />
      ) : null}
    </fieldset>
  );
}

DelayLinkFields.displayName = "DelayLinkFields";

export { DelayLinkFields, type DelayLinkFieldsProps };
