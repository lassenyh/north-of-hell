"use client";
import { useActionState } from "react";
import { loginEditor } from "./actions";
import styles from "../editor.module.css";
export default function KeynoteLogin() {
  const [state, action, pending] = useActionState(loginEditor, { error: "" });
  return (
    <main className={styles.login}>
      <form action={action}>
        <p>North of Hell · Keynote</p>
        <h1>Editor sign in</h1>
        <p>Use the email and password for your invited editor account.</p>
        <label>
          Email
          <input name="email" type="email" autoComplete="username" required />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </label>
        {state.error && <p role="alert">{state.error}</p>}
        <button disabled={pending}>
          {pending ? "Signing in …" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
