import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/atoms/button";
import { Label } from "@/components/atoms/label";
import { toast } from "@/lib/toast";

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
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h3 className="text-base font-semibold text-gray-900">
            Your profile
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Your personal information and email address.
          </p>
        </div>
        <div className="flex flex-col gap-4 px-6 py-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="user-name">Name</Label>
              <input
                id="user-name"
                value={user?.name ?? ""}
                disabled
                className="h-10 rounded-lg border border-gray-300 bg-gray-50 px-3 text-sm text-gray-500 cursor-not-allowed"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="user-email">Email</Label>
              <input
                id="user-email"
                value={user?.email ?? ""}
                disabled
                className="h-10 rounded-lg border border-gray-300 bg-gray-50 px-3 text-sm text-gray-500 cursor-not-allowed"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="user-phone">Phone</Label>
              <input
                id="user-phone"
                value={user?.phone ?? ""}
                disabled
                className="h-10 rounded-lg border border-gray-300 bg-gray-50 px-3 text-sm text-gray-500 cursor-not-allowed"
              />
            </div>
          </div>
          <p className="text-xs text-gray-500">
            To update your profile information or email address, please contact support.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h3 className="text-base font-semibold text-gray-900">
            Change password
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Ensure your account is using a long, random password to stay secure.
          </p>
        </div>
        <form onSubmit={handleChangePassword}>
          <div className="flex flex-col gap-4 px-6 py-5">
            <div className="flex flex-col gap-1.5 sm:w-1/2">
              <Label htmlFor="current-password">Current password</Label>
              <input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary-600/20 focus-visible:border-primary-600"
              />
            </div>
            <div className="flex flex-col gap-1.5 sm:w-1/2">
              <Label htmlFor="new-password">New password</Label>
              <input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary-600/20 focus-visible:border-primary-600"
              />
            </div>
            <div className="flex flex-col gap-1.5 sm:w-1/2">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary-600/20 focus-visible:border-primary-600"
              />
            </div>
            {passwordError && (
              <p className="text-sm text-red-600">{passwordError}</p>
            )}
          </div>
          <div className="border-t border-gray-200 bg-gray-50 px-6 py-4 flex justify-end rounded-b-xl">
            <Button
              type="submit"
              loading={isSubmitting}
              disabled={!currentPassword || !newPassword || !confirmPassword}
            >
              Update password
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
