<script setup lang="ts">
import type { Component } from "vue";
import HeroBlock from "./blocks/HeroBlock.vue";
import TextBlock from "./blocks/TextBlock.vue";
import FaqAccordionBlock from "./blocks/FaqAccordionBlock.vue";
import FeatureGridBlock from "./blocks/FeatureGridBlock.vue";
import FormEmbedBlock from "./blocks/FormEmbedBlock.vue";
import SignupFormBlock from "./blocks/SignupFormBlock.vue";
import LeaderSpotlightBlock from "./blocks/LeaderSpotlightBlock.vue";
import DonationTiersBlock from "./blocks/DonationTiersBlock.vue";
import CommitmentsGridBlock from "./blocks/CommitmentsGridBlock.vue";

// Maps a Payload `blocks` field's blockType discriminator to a Vue component,
// per site theme (see utils/resolveBlock.ts). The components imported here are
// the core's plain fallbacks, used only when neither the site's theme nor its
// parents supply the block. Keys must match the slugs in apps/cms/src/blocks/*.ts.
const fallbacks: Record<string, Component> = {
  hero: HeroBlock,
  textBlock: TextBlock,
  faqAccordion: FaqAccordionBlock,
  featureGrid: FeatureGridBlock,
  formEmbed: FormEmbedBlock,
  signupForm: SignupFormBlock,
  leaderSpotlight: LeaderSpotlightBlock,
  donationTiers: DonationTiersBlock,
  commitmentsGrid: CommitmentsGridBlock,
};

defineProps<{
  blocks: Array<{ id?: string; blockType: string; [key: string]: unknown }>;
}>();

// app.vue publishes the resolved site's theme once per request.
const theme = useState<string>("polysite-theme", () => "default");
const parents = useRuntimeConfig().public.themeParents as Record<string, string>;
const chain = computed(() => themeChain(theme.value, parents));
// Theme components are registered globally (nuxt.config `components.global`), so
// the app context is the registry; looking names up here avoids resolveComponent
// warning about every theme that doesn't override a given block.
const registry = getCurrentInstance()?.appContext.components as unknown as Record<string, Component | undefined>;
// Block types plugins registered (utils/blockTypes.ts); the core's own always win a clash of slugs.
const { $blockTypes } = useNuxtApp();
const names = { ...$blockTypes.names(), ...BLOCK_COMPONENT_NAMES };
const allFallbacks = { ...$blockTypes.fallbacks(), ...fallbacks };
const componentFor = (blockType: string) => resolveBlockComponent(blockType, chain.value, registry, allFallbacks, names);
</script>

<template>
  <template v-for="(block, i) in blocks" :key="block.id ?? i">
    <component :is="componentFor(block.blockType)" v-if="componentFor(block.blockType)" v-bind="block" />
    <p v-else class="block-unknown">Unknown block type: {{ block.blockType }}</p>
  </template>
</template>
