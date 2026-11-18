import { useRef, useState } from "react";
import { router } from "@/navigation";
import { type TextInput } from "@/platform/browser";
import { Image } from "@/components/atoms/image";
import { Page } from "@/components/molecules/page";
import { Button, Field, Text } from "@/components/atoms";
import { PasswordField } from "@/components/atoms/password-field";
import { authClient } from "@/lib/auth-client";
import { writeCachedUser } from "@/lib/session-cache";
import logo from "@/assets/images/buildpanda-logo.png";
export default function SignIn() {
    const passwordInput = useRef<TextInput>(null);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const submitting = useRef(false);
    const canSubmit = email.trim().length > 0 && password.length > 0 && !loading;
    async function handleSubmit() {
        if (!canSubmit || submitting.current)
            return;
        submitting.current = true;
        setError(null);
        setLoading(true);
        try {
            const result = await authClient.signIn.email({ email: email.trim(), password });
            if (result.error || !result.data) {
                setError(result.error?.message ?? "Invalid email or password.");
                return;
            }
            const user = result.data.user;
            writeCachedUser({ id: user.id, name: user.name, email: user.email });
            router.replace("/");
        }
        catch {
            setError("Could not connect. Check your connection and try again.");
        }
        finally {
            submitting.current = false;
            setLoading(false);
        }
    }
    return (<Page title="Sign in" showSync={false} className="px-6">
        <div className="field-stack w-full max-w-[520px] self-center py-8">
          <Image source={logo} aria-label="BuildPanda" contentFit="contain" style={{ height: 40, width: 118 }}/>

          <div className="field-stack pt-8">
            <Text variant="heading" weight="bold" className="text-3xl">
              Welcome back
            </Text>
            <Text tone="secondary" className="pt-1 text-[15px]">
              Your project, from plans to progress.
            </Text>
          </div>

          {error ? (<div className="field-stack mt-6 rounded-xl bg-error-50 px-4 py-3" aria-live="polite">
              <Text tone="danger" className="text-sm">
                {error}
              </Text>
            </div>) : null}

          <div className="field-stack gap-5 pt-8">
            <Field label="Email address" value={email} onChangeText={setEmail} placeholder="you@example.com" autoCapitalize="none" autoCorrect={false} autoComplete="email" keyboardType="email-address" inputMode="email" returnKeyType="next" onSubmitEditing={() => passwordInput.current?.focus()}/>

            <PasswordField ref={passwordInput} label="Password" value={password} onChangeText={setPassword} placeholder="Enter your password" autoCapitalize="none" autoComplete="current-password" returnKeyType="go" onSubmitEditing={handleSubmit}/>

            <Button onPress={handleSubmit} disabled={!canSubmit} loading={loading}>
              Sign in
            </Button>
          </div>

          <Text tone="muted" className="pt-8 text-center text-xs leading-5">
            Field Tools accounts are created by your project manager. Ask them for an invite if you
            can&apos;t sign in.
          </Text>
        </div>
    </Page>);
}
