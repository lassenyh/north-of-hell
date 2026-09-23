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
        <h1>Redaktørinnlogging</h1>
        <p>Bruk e-post og passord for din inviterte redaktørkonto.</p>
        <label>
          E-post
          <input name="email" type="email" autoComplete="username" required />
        </label>
        <label>
          Passord
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </label>
        {state.error && <p role="alert">{state.error}</p>}
        <button disabled={pending}>
          {pending ? "Logger inn …" : "Logg inn"}
        </button>
      </form>
    </main>
  );
}
