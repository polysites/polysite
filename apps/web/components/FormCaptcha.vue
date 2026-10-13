<script setup lang="ts">
import type { useFormIntake } from "../composables/useFormIntake";

// The form's extra bot check, drawn inside every form (PolysiteFormFields). ALTCHA runs by
// itself in useFormIntake and only needs a status line here. Turnstile is Cloudflare's
// widget: this loads their script (only on a form that uses it), draws it, and hands the
// token to the form. It carries `poly-captcha*` class names and no look of its own.
const props = defineProps<{ intake: ReturnType<typeof useFormIntake> }>();
const t = useT();

interface TurnstileApi {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  reset: (id?: string) => void;
  remove: (id?: string) => void;
}

const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const el = ref<HTMLElement | null>(null);
const failed = ref(false);
let widgetId: string | undefined;

const provider = computed(() => props.intake.definition?.captcha?.provider);
const turnstileApi = () => (window as unknown as { turnstile?: TurnstileApi }).turnstile;

function loadTurnstile(): Promise<TurnstileApi> {
  const ready = turnstileApi();
  if (ready) return Promise.resolve(ready);
  return new Promise((resolve, reject) => {
    let tag = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT}"]`);
    if (!tag) {
      tag = document.createElement("script");
      tag.src = SCRIPT;
      tag.async = true;
      tag.defer = true;
      document.head.appendChild(tag);
    }
    tag.addEventListener("load", () => {
      const api = turnstileApi();
      if (api) resolve(api);
      else reject(new Error("Turnstile did not start"));
    });
    tag.addEventListener("error", () => reject(new Error("Turnstile could not be loaded")));
  });
}

onMounted(async () => {
  const captcha = props.intake.definition?.captcha;
  if (captcha?.provider !== "turnstile" || !el.value) return;
  try {
    const api = await loadTurnstile();
    widgetId = api.render(el.value, {
      sitekey: captcha.siteKey,
      callback: (token: string) => props.intake.setCaptchaToken(token),
      "expired-callback": () => props.intake.setCaptchaToken(""),
      "error-callback": () => props.intake.setCaptchaToken(""),
    });
  } catch {
    failed.value = true;
  }
});

// A refused submission reloads the form with a fresh token; the old Turnstile answer is spent.
watch(
  () => props.intake.definition?.token,
  () => {
    if (widgetId === undefined) return;
    props.intake.setCaptchaToken("");
    turnstileApi()?.reset(widgetId);
  },
);

onBeforeUnmount(() => {
  if (widgetId !== undefined) turnstileApi()?.remove(widgetId);
});
</script>

<template>
  <div v-if="provider === 'turnstile'" class="poly-captcha">
    <div ref="el"/>
    <p v-if="failed" class="poly-error" role="alert">{{ t("form.captcha.loadFailed", "The check couldn\u2019t load. Please reload the page and try again.") }}</p>
  </div>
  <p v-else-if="provider === 'altcha' && intake.captchaStatus === 'working'" class="poly-captcha-status" role="status">{{ t("form.captcha.checking", "Checking that you\u2019re not a robot\u2026") }}</p>
  <p v-else-if="provider === 'altcha' && intake.captchaStatus === 'failed'" class="poly-error poly-captcha-status" role="alert">
    {{ t("form.captcha.failed", "Your browser couldn\u2019t run the check. Please try a different browser.") }}
  </p>
</template>
