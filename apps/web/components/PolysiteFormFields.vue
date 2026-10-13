<script setup lang="ts">
import type { useFormIntake } from "../composables/useFormIntake";

// The form itself, for every theme: fields, the hidden spam trap, errors, the
// button and the confirmation. It carries class names (`poly-form`, `poly-field`,
// `poly-error`, `poly-submit` ...) and no look of its own, so a theme styles it from
// its own block (the starter theme's blocks show how). All behaviour lives in
// useFormIntake; this only draws it.
const t = useT();
const props = defineProps<{
  intake: ReturnType<typeof useFormIntake>;
  /** Overrides the form's own button label. */
  submitLabel?: string;
}>();

// A local alias, so the inputs below can v-model into it without mutating a prop.
const form = computed(() => props.intake);
const uid = useId();
const idFor = (name?: string) => `${uid}-${name}`;
const label = (f: { label?: string; name?: string }) => f.label || f.name || "";
const describedBy = (name: string) => (form.value.errors[name] ? `${idFor(name)}-error` : undefined);
</script>

<!-- Each label is tied to its control with for/id (or wraps it); the lint rule that wants both adds nothing. -->
<!-- eslint-disable vuejs-accessibility/label-has-for -->
<template>
  <div v-if="form.done" class="poly-confirmation" role="status">
    <!-- eslint-disable-next-line vue/no-v-html -->
    <div v-if="form.confirmationHtml" v-html="form.confirmationHtml"/>
    <p v-else>{{ t("form.thanks", "Thank you. We\u2019ve received your details.") }}</p>
  </div>

  <p v-else-if="form.loadFailed" class="poly-error" role="alert">{{ t("form.loadFailed", "This form couldn\u2019t be loaded. Please try again later.") }}</p>

  <form v-else-if="form.definition" class="poly-form" @submit.prevent="form.submit()">
    <template v-for="(f, i) in form.definition.fields" :key="f.name ?? i">
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div v-if="f.blockType === 'message'" class="poly-message" v-html="f.html"/>

      <div v-else-if="f.name && f.blockType !== 'hidden'" class="poly-field" :class="`poly-field--${f.blockType}`" :style="f.width ? { '--poly-field-width': `${f.width}%` } : undefined">
        <label v-if="f.blockType === 'checkbox'" class="poly-check">
          <input v-model="form.values[f.name]" type="checkbox" :name="f.name" :required="f.required" :aria-invalid="Boolean(form.errors[f.name])">
          <span>{{ label(f) }}<span v-if="f.required" class="poly-required" aria-hidden="true"> *</span></span>
        </label>

        <template v-else>
          <label :for="idFor(f.name)" class="poly-label">
            {{ label(f) }}<span v-if="f.required" class="poly-required" aria-hidden="true"> *</span>
          </label>

          <textarea
            v-if="f.blockType === 'textarea'"
            :id="idFor(f.name)"
            v-model="form.values[f.name]"
            :name="f.name"
            :required="f.required"
            rows="4"
            :aria-invalid="Boolean(form.errors[f.name])"
            :aria-describedby="describedBy(f.name)"
          />

          <select
            v-else-if="f.blockType === 'select'"
            :id="idFor(f.name)"
            v-model="form.values[f.name]"
            :name="f.name"
            :required="f.required"
            :aria-invalid="Boolean(form.errors[f.name])"
            :aria-describedby="describedBy(f.name)"
          >
            <option value="" disabled>{{ t("form.choose", "Choose\u2026") }}</option>
            <option v-for="o in f.options" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>

          <div v-else-if="f.blockType === 'radio'" class="poly-radios" role="radiogroup" :aria-label="label(f)">
            <label v-for="o in f.options" :key="o.value" class="poly-check">
              <input v-model="form.values[f.name]" type="radio" :name="f.name" :value="o.value" :required="f.required">
              <span>{{ o.label }}</span>
            </label>
          </div>

          <input
            v-else
            :id="idFor(f.name)"
            v-model="form.values[f.name]"
            :name="f.name"
            :type="f.blockType === 'email' ? 'email' : f.blockType === 'number' ? 'number' : f.blockType === 'date' ? 'date' : 'text'"
            :autocomplete="f.blockType === 'email' ? 'email' : undefined"
            :required="f.required"
            :aria-invalid="Boolean(form.errors[f.name])"
            :aria-describedby="describedBy(f.name)"
          >
        </template>

        <p v-if="form.errors[f.name]" :id="`${idFor(f.name)}-error`" class="poly-error" role="alert">{{ form.errors[f.name] }}</p>
      </div>
    </template>

    <!-- Why this is collected, and the consent box when the form asks for one. -->
    <div v-if="form.definition.privacy.purpose || form.definition.privacy.consentRequired" class="poly-privacy">
      <p v-if="form.definition.privacy.purpose" class="poly-purpose">
        {{ form.definition.privacy.purpose }}
        <a v-if="form.definition.privacy.policyUrl" :href="form.definition.privacy.policyUrl" class="poly-policy-link" target="_blank" rel="noopener">Privacy policy</a>
      </p>
      <div v-if="form.definition.privacy.consentRequired" class="poly-field poly-consent">
        <label class="poly-check">
          <input v-model="form.consent" type="checkbox" name="consent" required :aria-invalid="Boolean(form.errors.consent)" :aria-describedby="describedBy('consent')">
          <span>{{ form.definition.privacy.consentLabel }}<span class="poly-required" aria-hidden="true"> *</span></span>
        </label>
        <p v-if="form.errors.consent" :id="`${idFor('consent')}-error`" class="poly-error" role="alert">{{ form.errors.consent }}</p>
      </div>
    </div>
    <p v-else-if="form.definition.privacy.policyUrl" class="poly-purpose">
      <a :href="form.definition.privacy.policyUrl" class="poly-policy-link" target="_blank" rel="noopener">Privacy policy</a>
    </p>

    <!-- The form's extra bot check, when it has one (the form's Protection setting). -->
    <FormCaptcha :intake="form"/>

    <!-- Spam trap: invisible to people, tempting to bots. Off-screen rather than display:none, which many bots skip. -->
    <div aria-hidden="true" style="position: absolute; left: -10000px; width: 1px; height: 1px; overflow: hidden">
      <label>Leave this field empty<input v-model="form.honeypot" type="text" :name="form.definition.honeypot" tabindex="-1" autocomplete="off"></label>
    </div>

    <p v-if="form.message" class="poly-error poly-form-message" role="alert">{{ form.message }}</p>

    <button type="submit" class="poly-submit" :disabled="form.submitting">
      {{ form.submitting ? "Sending…" : submitLabel || form.definition.submitButtonLabel }}
    </button>
  </form>
</template>
