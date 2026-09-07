import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/atoms/button";
import { toast } from "@/lib/toast";
import { FormSection } from "@/components/atoms/form-section";
import { TextInput } from "@/components/atoms/text-input";
import { ReactSVG } from "react-svg";
import { icons2 } from "@/assets/icons2/icon2";
import { cn } from "@/lib/utils";
import { FormField } from "@/components";

export function AccountTab() {
  const { data: session } = authClient.useSession();
  const user = session?.user;

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  async function handleChangePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters long");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match");
      return;
    }

    setIsSubmitting(true);
    setPasswordError(null);
    try {
      const result = await authClient.changePassword({
        newPassword,
        currentPassword,
        revokeOtherSessions: false,
      });
      if (result.error) {
        setPasswordError(result.error.message || "Failed to change password");
      } else {
        toast("Password changed successfully", "success");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch (err) {
      setPasswordError("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <FormSection title="Your profile">
        <TextInput
          label="Name"
          placeholder="Enter your name"
          value={user?.name ?? ""}
          disabled
        />
        <TextInput
          label="Email"
          placeholder="Enter your email"
          value={user?.email ?? ""}
          disabled
        />
        <TextInput
          label="Phone Number"
          placeholder="Enter your mobile number"
          value={user?.phone ?? ""}
          disabled
        />

        <p className="flex items-center justify-center gap-2 text-caption-m text-grey-450">
          <ReactSVG src={icons2.attention} className="[&_svg]:size-[14px]" />
          To update your profile information or email address, please contact support.
        </p>
      </FormSection>
      <FormSection title="Change password" description='Ensure your account is using a long, random password to stay secure.'>
        <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
        <FormField
          label="Current Password"
          name="password"
          type="password"
          placeholder="Create a strong password"
          autoComplete="new-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
        />
        <FormField
          label="New Password"
          name="password"
          type="password"
          placeholder="Create a strong password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
        />
        <FormField
          label="Confirm Password"
          name="password"
          type="password"
          placeholder="Create a strong password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />

        {passwordError && (
          <p className="text-caption-l text-red-600">{passwordError}</p>
        )}

        <div className="flex justify-end rounded-b-xl">
          <Button
            size='lg'
            type="submit"
            loading={isSubmitting}
            disabled={!currentPassword || !newPassword || !confirmPassword}
            className={cn(
              isSubmitting
                ? "disabled:bg-primary-500 disabled:text-white disabled:opacity-100"
                : "disabled:bg-grey-50 disabled:text-black-500 disabled:opacity-100"
            )}
          >
            Update password
          </Button>
          </div>
        </form>
      </FormSection>
    </div>
  );
}
