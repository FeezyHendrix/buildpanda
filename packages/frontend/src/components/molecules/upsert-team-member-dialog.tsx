import { useEffect, useState } from "react";
import { FormDrawer } from "./form-drawer";
import { Label } from "@/components/atoms/label";
import type { TeamMemberStatus } from "@/hooks/use-team";

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

const STATUSES: TeamMemberStatus[] = ["Active", "Inactive"];

const inputClass =
  "h-11 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-gray-900/10";

const EMPTY: UpsertTeamMemberValues = {
  name: "",
  role: "",
  company: "",
  email: "",
  phone: "",
  responsibilities: "",
  status: "Active",
};

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

  function update<K extends keyof UpsertTeamMemberValues>(
    key: K,
    value: UpsertTeamMemberValues[K],
  ): void {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  const isValid =
    values.name.trim().length > 0 && values.role.trim().length > 0;

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
      title={mode === "edit" ? "Edit team member" : "Add team member"}
      description={
        mode === "edit"
          ? "Update this person's role and contact details on the project."
          : "Add a person working on this project and their responsibilities."
      }
      submitLabel={mode === "edit" ? "Save changes" : "Add member"}
      submitDisabled={!isValid}
      submitting={isSubmitting}
      error={error ?? null}
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="team-name">Name</Label>
        <input
          id="team-name"
          value={values.name}
          onChange={(e) => update("name", e.target.value)}
          placeholder="e.g. Jane Adeyemi"
          maxLength={200}
          autoFocus
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="team-role">Role</Label>
        <input
          id="team-role"
          value={values.role}
          onChange={(e) => update("role", e.target.value)}
          placeholder="e.g. Site Engineer"
          maxLength={120}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="team-company">Company</Label>
        <input
          id="team-company"
          value={values.company}
          onChange={(e) => update("company", e.target.value)}
          placeholder="e.g. Adeyemi Builders Ltd"
          maxLength={200}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="team-email">Email</Label>
        <input
          id="team-email"
          type="email"
          value={values.email}
          onChange={(e) => update("email", e.target.value)}
          placeholder="e.g. jane@example.com"
          maxLength={320}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="team-phone">Phone</Label>
        <input
          id="team-phone"
          type="tel"
          value={values.phone}
          onChange={(e) => update("phone", e.target.value)}
          placeholder="e.g. +234 801 234 5678"
          maxLength={60}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="team-responsibilities">Responsibilities</Label>
        <textarea
          id="team-responsibilities"
          value={values.responsibilities}
          onChange={(e) => update("responsibilities", e.target.value)}
          placeholder="Describe what this person is responsible for on the project…"
          maxLength={2000}
          rows={4}
          className="rounded-lg bg-[#F6F6F6] px-3 py-2.5 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-gray-900/10"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="team-status">Status</Label>
        <select
          id="team-status"
          value={values.status}
          onChange={(e) => update("status", e.target.value as TeamMemberStatus)}
          className={inputClass}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
    </FormDrawer>
  );
}

export { UpsertTeamMemberDialog };
