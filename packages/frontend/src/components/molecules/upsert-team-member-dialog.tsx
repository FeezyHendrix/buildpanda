import { useEffect, useState } from "react";
import { Select } from "@/components/atoms/select";
import { TextInput } from "@/components/atoms/text-input";
import type { TeamMemberStatus } from "@/hooks/use-team";
import { FormDrawer } from "./form-drawer";

export interface UpsertTeamMemberValues {
  name: string;
  role: string;
  company: string;
  email: string;
  phone: string;
  responsibilities: string;
  status: TeamMemberStatus;
}

interface UpsertTeamMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initial?: UpsertTeamMemberValues;
  onSubmit: (values: UpsertTeamMemberValues) => void;
  isSubmitting?: boolean;
  error?: string | null;
}

const STATUS_OPTIONS: { value: TeamMemberStatus; label: string }[] = [
  { value: "Active", label: "Active" },
  { value: "Inactive", label: "Inactive" },
];

const EMPTY: UpsertTeamMemberValues = {
  name: "",
  role: "",
  company: "",
  email: "",
  phone: "",
  responsibilities: "",
  status: "Active",
};

const LABEL_CLASS = "text-[12px] font-semibold leading-[16px] text-[#1E1E1E]";
const FIELD_CLASS = "h-[45px] border border-[#EEEEEE] px-4 text-[14px] placeholder:text-[#A5A5A5]";
const GROUP_CLASS = "flex flex-col gap-[5px]";

/** Add or edit a contact: someone delivering the build who is listed for reference and gets no access. */
function UpsertTeamMemberDialog({
  open,
  onOpenChange,
  mode,
  initial,
  onSubmit,
  isSubmitting = false,
  error,
}: UpsertTeamMemberDialogProps) {
  const [values, setValues] = useState<UpsertTeamMemberValues>(EMPTY);

  useEffect(() => {
    if (open) {
      setValues(initial ?? EMPTY);
    }
  }, [open, initial]);

  function update<K extends keyof UpsertTeamMemberValues>(key: K, value: UpsertTeamMemberValues[K]): void {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  const isValid = values.name.trim().length > 0 && values.role.trim().length > 0;

  function handleSubmit(): void {
    if (!isValid) return;
    onSubmit({
      name: values.name.trim(),
      role: values.role.trim(),
      company: values.company.trim(),
      email: values.email.trim(),
      phone: values.phone.trim(),
      responsibilities: values.responsibilities.trim(),
      status: values.status,
    });
  }

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={mode === "edit" ? "Edit Contact" : "New Contact"}
      description={
        mode === "edit"
          ? "Update this person's role and contact details on the project."
          : "Add a person working on this project and their responsibilities."
      }
      submitLabel={mode === "edit" ? "Save Changes" : "Save Entry"}
      submitDisabled={!isValid}
      submitting={isSubmitting}
      error={error ?? null}
      onSubmit={handleSubmit}
      footerVariant="stacked"
      className="w-[min(430px,100vw)]"
      titleClassName="text-[20px] leading-[28px] tracking-normal"
      headerClassName="px-[24px] pb-[22px] pt-[40px]"
      bodyClassName="gap-[19px] px-[24px] py-0"
      footerClassName="gap-[3px] px-[24px] pb-[17px] pt-6 [&>button]:h-[46px]"
    >
      <div className={GROUP_CLASS}>
        <label htmlFor="team-name" className={LABEL_CLASS}>Name</label>
        <TextInput
          id="team-name"
          value={values.name}
          onChange={(v) => update("name", v)}
          placeholder="e.g. Jane Adeyemi"
          maxLength={200}
          autoFocus
          className={FIELD_CLASS}
        />
      </div>

      <div className={GROUP_CLASS}>
        <label htmlFor="team-role" className={LABEL_CLASS}>Role</label>
        <TextInput
          id="team-role"
          value={values.role}
          onChange={(v) => update("role", v)}
          placeholder="e.g. Site Engineer"
          maxLength={120}
          className={FIELD_CLASS}
        />
      </div>

      <div className={GROUP_CLASS}>
        <label htmlFor="team-company" className={LABEL_CLASS}>Company</label>
        <TextInput
          id="team-company"
          value={values.company}
          onChange={(v) => update("company", v)}
          placeholder="e.g. Adeyemi Builders Ltd"
          maxLength={200}
          className={FIELD_CLASS}
        />
      </div>

      <div className={GROUP_CLASS}>
        <label htmlFor="team-email" className={LABEL_CLASS}>Email</label>
        <TextInput
          id="team-email"
          type="email"
          value={values.email}
          onChange={(v) => update("email", v)}
          placeholder="e.g. jane@example.com"
          maxLength={320}
          className={FIELD_CLASS}
        />
      </div>

      <div className={GROUP_CLASS}>
        <label htmlFor="team-phone" className={LABEL_CLASS}>Phone</label>
        <TextInput
          id="team-phone"
          type="tel"
          value={values.phone}
          onChange={(v) => update("phone", v)}
          placeholder="e.g. +234 801 234 5678"
          maxLength={60}
          className={FIELD_CLASS}
        />
      </div>

      <div className={GROUP_CLASS}>
        <label htmlFor="team-responsibilities" className={LABEL_CLASS}>
          Responsibilities <span className="font-normal text-[#A5A5A5]">(optional)</span>
        </label>
        <textarea
          id="team-responsibilities"
          value={values.responsibilities}
          onChange={(e) => update("responsibilities", e.target.value)}
          placeholder="Describe what this person is responsible for on the project…"
          maxLength={2000}
          className="h-[132px] resize-none border border-[#EEEEEE] bg-white px-4 py-[14px] text-[14px] leading-5 text-[#1E1E1E] outline-none transition-colors placeholder:text-[#A5A5A5] focus:border-black-500"
        />
      </div>

      {mode === "edit" ? (
        <div className={GROUP_CLASS}>
          <label htmlFor="team-status" className={LABEL_CLASS}>Status</label>
          <Select
            id="team-status"
            options={STATUS_OPTIONS}
            value={values.status}
            onChange={(next) => update("status", (next ?? "Active") as TeamMemberStatus)}
            className="h-[45px] px-4 text-[14px]"
          />
        </div>
      ) : null}
    </FormDrawer>
  );
}

export { UpsertTeamMemberDialog };
