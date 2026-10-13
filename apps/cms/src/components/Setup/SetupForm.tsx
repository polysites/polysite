"use client";

import React, { useState } from "react";

type Errors = Partial<Record<string, string>>;

interface Props {
  adminRoute: string;
  themes: { label: string; value: string }[];
  requiresToken: boolean;
}

// Server-side rules live in setup/validate.ts; the checks here only save a round
// trip for the obvious mistakes, and the server's answer is always authoritative.
export function SetupForm({ adminRoute, themes, requiresToken }: Props) {
  const [values, setValues] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    siteName: "",
    domain: "",
    theme: themes.find((t) => t.value === "starter")?.value ?? themes[0]?.value ?? "",
    createHomePage: true,
    setupToken: "",
  });
  const [errors, setErrors] = useState<Errors>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (name: keyof typeof values, value: string | boolean) => {
    setValues((v) => ({ ...v, [name]: value }));
    setErrors((e) => ({ ...e, [name]: undefined }));
  };

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setMessage("");

    if (values.password !== values.confirmPassword) {
      setErrors({ confirmPassword: "The two passwords don't match." });
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrors(body.errors ?? {});
        setMessage(body.message ?? "Setup failed.");
        setBusy(false);
        return;
      }

      const login = await fetch("/api/users/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: values.email, password: values.password }),
      });
      // Setup worked either way; if the sign-in didn't, the normal login page takes over.
      window.location.assign(login.ok ? adminRoute : `${adminRoute}/login`);
    } catch {
      setMessage("Couldn't reach the server. Check your connection and try again.");
      setBusy(false);
    }
  }

  const field = (name: keyof typeof values, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, hint?: string) => (
    <div className="polysite-setup__field">
      <label htmlFor={`setup-${name}`}>{label}</label>
      <input
        id={`setup-${name}`}
        name={name}
        value={String(values[name])}
        onChange={(e) => set(name, e.target.value)}
        aria-invalid={Boolean(errors[name])}
        aria-describedby={errors[name] ? `setup-${name}-error` : hint ? `setup-${name}-hint` : undefined}
        required
        {...props}
      />
      {errors[name] ? (
        <p id={`setup-${name}-error`} className="polysite-setup__error">
          {errors[name]}
        </p>
      ) : hint ? (
        <p id={`setup-${name}-hint`} className="polysite-setup__hint">
          {hint}
        </p>
      ) : null}
    </div>
  );

  return (
    <form className="polysite-setup__form" onSubmit={submit} noValidate>
      <fieldset>
        <legend>1. Administrator account</legend>
        {field("email", "Email address", { type: "email", autoComplete: "email", autoFocus: true })}
        {field("password", "Password", { type: "password", autoComplete: "new-password" }, "At least 10 characters.")}
        {field("confirmPassword", "Confirm password", { type: "password", autoComplete: "new-password" })}
        <p className="polysite-setup__note">
          This account becomes the <strong>Super Admin</strong>: full access to every site, user, role and setting. You
          don&apos;t pick a role here. Create more users, and edit what each role can do, from <em>Users</em> and{" "}
          <em>Roles</em> after you sign in. Polysite has already created three roles to start from: Super Admin, Site
          Admin and Site User.
        </p>
      </fieldset>

      <fieldset>
        <legend>2. Your first site</legend>
        {field("siteName", "Site name", { autoComplete: "organization" })}
        {field(
          "domain",
          "Site domain",
          { placeholder: "news.example.org", autoComplete: "off", autoCapitalize: "none", spellCheck: false },
          "The address visitors use, without https://. Polysite shows this site on that domain.",
        )}
        <div className="polysite-setup__field">
          <label htmlFor="setup-theme">Theme</label>
          <select id="setup-theme" name="theme" value={values.theme} onChange={(e) => set("theme", e.target.value)}>
            {themes.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          {errors.theme ? <p className="polysite-setup__error">{errors.theme}</p> : null}
          <p className="polysite-setup__hint">Controls how the site looks. You can change it any time.</p>
        </div>
        <label className="polysite-setup__check">
          <input
            type="checkbox"
            checked={values.createHomePage}
            onChange={(e) => set("createHomePage", e.target.checked)}
          />
          Create a starter home page
        </label>
      </fieldset>

      {requiresToken ? (
        <fieldset>
          <legend>Setup token</legend>
          {field(
            "setupToken",
            "Token",
            { type: "password", autoComplete: "off" },
            "This server asks for a setup token (POLYSITE_SETUP_TOKEN in its environment) so only its owner can finish setup.",
          )}
        </fieldset>
      ) : null}

      {message ? (
        <p className="polysite-setup__error polysite-setup__message" role="alert">
          {message}
        </p>
      ) : null}

      <button type="submit" className="polysite-setup__submit" disabled={busy}>
        {busy ? "Setting up…" : "Set up Polysite"}
      </button>
    </form>
  );
}
