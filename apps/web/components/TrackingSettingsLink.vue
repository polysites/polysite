<script setup lang="ts">
// Kept under this name so a theme's footer that already has <TrackingSettingsLink /> keeps working. It shows whatever
// a plugin has put in the "footer-links" slot (the analytics plugin puts "Cookie settings" there) and nothing when no
// plugin has, so it is safe to place on every site.
const { $siteSlots } = useNuxtApp();
</script>

<template>
  <span v-if="$siteSlots.has('footer-links')"><SiteSlot name="footer-links" /></span>
</template>
