import { useState } from "react";
import { Input, INPUT_CLASS } from "@/components/atoms/input";
import { Label } from "@/components/atoms/label";
import { FormDrawer } from "@/components/molecules/form-drawer";
import { useCreateLead } from "@/hooks/use-leads";
import { cn } from "@/lib/utils";

export function CreateLeadDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const create = useCreateLead();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [projectType, setProjectType] = useState("");
  const [message, setMessage] = useState("");

  const isValid = name.trim().length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  function reset() {
    setName("");
    setEmail("");
    setPhone("");
    setLocation("");
    setProjectType("");
    setMessage("");
  }

  function handleOpenChange(v: boolean) {
    if (!v) reset();
    onOpenChange(v);
  }

  async function handleSubmit() {
    if (!isValid) return;
    await create.mutateAsync({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim() || undefined,
      location: location.trim() || undefined,
      projectType: projectType.trim() || undefined,
      message: message.trim() || undefined,
    });
    handleOpenChange(false);
  }

  return (
    <FormDrawer
      open={open}
      onOpenChange={handleOpenChange}
      title="New lead"
      description="Add a prospect you spoke to off-platform. You can create a proposal for them later."
      submitLabel="Add lead"
      submitDisabled={!isValid}
      submitting={create.isPending}
      error={create.isError ? "Failed to create lead. Please try again." : null}
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="lead-name">Full name *</Label>
        <Input id="lead-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="lead-email">Email *</Label>
        <Input id="lead-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="client@example.com" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="lead-phone">Phone</Label>
        <Input id="lead-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+234 800 000 0000" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="lead-location">Location</Label>
        <Input id="lead-location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City, State" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="lead-project-type">Project type</Label>
        <Input id="lead-project-type" value={projectType} onChange={(e) => setProjectType(e.target.value)} placeholder="Residential, Commercial, …" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="lead-message">Notes</Label>
        <textarea
          id="lead-message"
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Anything you want to remember about this prospect…"
          className={cn(INPUT_CLASS, "h-auto min-h-24 py-3 resize-none")}
        />
      </div>
    </FormDrawer>
  );
}
