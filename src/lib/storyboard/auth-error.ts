export const STORYBOARD_AUTH_REQUIRED = "Sign in as an administrator to edit the storyboard.";

export function isStoryboardAuthError(message: string) {
  return message === STORYBOARD_AUTH_REQUIRED;
}
