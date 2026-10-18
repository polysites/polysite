// The logic behind every form on the public site, kept out of the visual
// components so each theme can style forms however it likes and still get the
// same behaviour: load the form's fields from the CMS, check the answers, submit,
// and show what the CMS says back. See apps/cms/src/forms/endpoints.ts for the
// other half.
//
// The form is fetched in the browser, after the page loads, not baked into the
// cached page: editing a form in the admin takes effect immediately, and the
// signed spam-protection token it comes with is only worth anything fresh.

import type { AltchaChallenge } from "../utils/altchaSolver";

export interface IntakeOption {
  label?: string;
  value?: string;
}

export interface IntakeField {
  blockType: string;
  name?: string;
  label?: string;
  required?: boolean;
  width?: number;
  defaultValue?: unknown;
  options?: IntakeOption[];
  /** Only for `hidden` fields: where the page gets the value, and the parameter name to look for. */
  source?: string;
  param?: string;
  /** Only for `message` fields: trusted HTML produced by the CMS. */
  html?: string;
}

export interface IntakePrivacy {
  /** Why the information is collected, in plain words. Empty when the form has none. */
  purpose: string;
  consentRequired: boolean;
  consentLabel: string;
  retentionDays: number | null;
  /** The site's privacy policy, if it set one. */
  policyUrl: string;
}

interface IntakeDefinition {
  id: number | string;
  title?: string;
  submitButtonLabel: string;
  fields: IntakeField[];
  privacy: IntakePrivacy;
  honeypot: string;
  token: string;
  /** The form's extra bot check, if it has one. */
  captcha?: { provider: "altcha"; challenge: AltchaChallenge } | { provider: "turnstile"; siteKey: string } | null;
  /** Present when the form's owner chose to show how many people have signed. */
  signatures?: { goal: number | null } | null;
}

export interface SignatureCount {
  count: number;
  goal: number | null;
}

/** How often a page that is already open asks again. The server caches the number for 10 seconds, so this costs the database almost nothing. */
const SIGNATURE_REFRESH_MS = 30_000;

type FormRef = number | string | { id?: number | string } | null | undefined;

/** A block's `form` prop is an id, or a populated document, or nothing. */
export function formIdOf(form: FormRef): string | null {
  if (form && typeof form === "object") return form.id != null ? String(form.id) : null;
  return form != null && form !== "" ? String(form) : null;
}

export function useFormIntake(formProp: () => FormRef) {
  const api = useRuntimeConfig().public.apiBase as string;
  const t = useT();

  const definition = shallowRef<IntakeDefinition | null>(null);
  const values = reactive<Record<string, string | boolean>>({});
  const honeypot = ref("");
  const consent = ref(false);
  const errors = ref<Record<string, string>>({});
  const message = ref("");
  const confirmationHtml = ref("");
  const loadFailed = ref(false);
  const submitting = ref(false);
  const done = ref(false);
  const signatures = ref<SignatureCount | null>(null);
  let signatureTimer: ReturnType<typeof setInterval> | undefined;

  async function loadSignatures(id: string | number) {
    try {
      signatures.value = await $fetch<SignatureCount>(`${api}/form-intake/${id}/count`);
    } catch {
      // Keep the last number: a count that fails to refresh is better than an error on the page.
    }
  }

  // The form's bot check. ALTCHA is solved in the background as soon as the form loads;
  // Turnstile is drawn by FormCaptcha.vue, which hands the token over through setCaptchaToken.
  const captchaToken = ref("");
  const captchaStatus = ref<"none" | "working" | "ready" | "failed">("none");
  let solving: Promise<void> | null = null;

  function setCaptchaToken(token: string) {
    captchaToken.value = token;
    captchaStatus.value = token ? "ready" : "working";
  }

  function startCaptcha(def: IntakeDefinition) {
    captchaToken.value = "";
    solving = null;
    const captcha = def.captcha;
    if (captcha?.provider === "altcha") {
      captchaStatus.value = "working";
      solving = solveChallenge(captcha.challenge).then((answer) => {
        captchaToken.value = answer ?? "";
        captchaStatus.value = answer ? "ready" : "failed";
      });
    } else {
      captchaStatus.value = captcha ? "working" : "none";
    }
  }

  async function load() {
    const id = formIdOf(formProp());
    if (!id) return;
    try {
      const def = await $fetch<IntakeDefinition>(`${api}/form-intake/${id}`);
      for (const f of def.fields) {
        if (!f.name) continue;
        // Hidden fields are filled in by the page the form is on, every time the form loads.
        if (f.blockType === "hidden") {
          values[f.name] = hiddenValue(f.source, f.param, { origin: location.origin, pathname: location.pathname, search: location.search, referrer: document.referrer });
          continue;
        }
        // Keep anything the visitor already typed when the form is reloaded for a fresh token.
        if (!(f.name in values)) values[f.name] = f.blockType === "checkbox" ? Boolean(f.defaultValue) : f.defaultValue != null ? String(f.defaultValue) : "";
      }
      definition.value = def;
      startCaptcha(def);
      if (def.signatures) {
        void loadSignatures(def.id);
        signatureTimer ??= setInterval(() => void loadSignatures(def.id), SIGNATURE_REFRESH_MS);
      }
    } catch {
      loadFailed.value = true;
    }
  }

  // Browser only: during server rendering there is no form, just the block's heading.
  onMounted(load);
  onBeforeUnmount(() => {
    if (signatureTimer) clearInterval(signatureTimer);
  });

  async function submit() {
    const def = definition.value;
    if (!def || submitting.value) return;
    submitting.value = true;
    errors.value = {};
    message.value = "";
    try {
      if (def.captcha?.provider === "altcha" && solving) await solving;
      if (def.captcha && !captchaToken.value) {
        message.value =
          def.captcha.provider === "altcha"
            ? t("form.captcha.noBrowser", "We couldn't run the check in this browser. Please try a different browser.")
            : t("form.captcha.complete", "Please complete the check first.");
        return;
      }
      const res = await $fetch<{ ok: boolean; confirmationType: string; message?: string; redirect?: string }>(
        `${api}/form-intake/${def.id}`,
        { method: "POST", body: { data: { ...values }, consent: consent.value, token: def.token, captcha: captchaToken.value, [def.honeypot]: honeypot.value } },
      );
      // Tells any plugin that listens (analytics, say) that a form was sent: its id only, never what was typed.
      emitSiteEvent({ name: "form_submit", formId: def.id });
      if (res.confirmationType === "redirect" && res.redirect) {
        await navigateTo(res.redirect, { external: true });
        return;
      }
      confirmationHtml.value = res.message || "";
      done.value = true;
      if (def.signatures) void loadSignatures(def.id);
    } catch (err) {
      const data = (err as { data?: { message?: string; errors?: Record<string, string> } }).data;
      errors.value = data?.errors ?? {};
      message.value = data?.message ?? t("form.error", "Something went wrong. Please try again.");
      // A refused submission may have used up its token (too fast, expired): get a fresh one.
      if (!data?.errors) await load();
    } finally {
      submitting.value = false;
    }
  }

  // reactive(): a component receiving this as a prop reads plain values, no `.value`.
  return reactive({ definition, values, honeypot, consent, errors, message, confirmationHtml, loadFailed, submitting, done, submit, captchaStatus, setCaptchaToken, signatures });
}
