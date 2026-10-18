<script setup lang="ts">
// How many people have signed, with a progress bar when the form has a goal. Plain markup with class names (`poly-signatures`,
// `poly-signatures-bar`) and no look of its own, so a theme styles it like the form beside it. The number comes from
// useFormIntake (the form's `signatures`), which refreshes it while the page is open.
const t = useT();
const language = useSiteLanguage();
const props = defineProps<{ count: number; goal?: number | null }>();

const format = (n: number) => new Intl.NumberFormat(language.code.value).format(n);
const percent = computed(() => (props.goal ? Math.min(100, Math.floor((props.count / props.goal) * 100)) : null));
</script>

<template>
  <div class="poly-signatures">
    <p class="poly-signatures-count" aria-live="polite">
      <strong>{{ format(count) }}</strong>
      {{ t("form.signatures", "have signed") }}<template v-if="goal">
        &middot; {{ t("form.signaturesGoal", "goal {goal}", { goal: format(goal) }) }}</template>
    </p>
    <div
      v-if="percent !== null"
      class="poly-signatures-bar"
      role="progressbar"
      :aria-valuenow="percent"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-label="t('form.signaturesProgress', 'Progress toward the goal')"
    >
      <span class="poly-signatures-fill" :style="{ width: `${percent}%` }" />
    </div>
  </div>
</template>
