import { isStoryboardAuthError } from "@/lib/storyboard/auth-error";

export function StoryboardErrorMessage({ message }: { message: string }) {
  if (!isStoryboardAuthError(message)) return <>{message}</>;
  return <span>Your administrator sign-in is no longer valid. <a className="sb-auth-recovery-link" href="/admin/login" target="_blank" rel="noopener noreferrer">Sign in again in a new tab</a>, then return here and retry. Keep this tab open to preserve your unsaved changes.</span>;
}
