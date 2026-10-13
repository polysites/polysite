# Themes

A Polysite theme is a [Nuxt layer](https://nuxt.com/docs/getting-started/layers)
that owns how a site *looks*: its header and footer, how every page block is
drawn, and any client-specific pages. The core app owns everything else: data
fetching, routing, SEO, caching and the infrastructure.

Themes are **picked per site at runtime**, not per deployment. Every theme
repository is extended into the same Nuxt build, and a request's site record
(`Site.theme`) decides which layout and which block components render. Two sites
on one installation can look different, header to footer, without a second
deployment.

## Start from the starter

`polysite-theme-starter` is the reference theme. It contains all nine page blocks,
a plain layout, and a small design-tokens stylesheet. Copy it to start your own
theme, change the CSS, and edit only the blocks you want to look different.

The Polysite Themes guide (in the `polysite-themes` repository) covers building a theme in full. In short:

1. Run `themes/scripts/new-theme.sh bakery "Bakery"`. It copies the starter and renames
   the layout, the components folder and the CSS class for you.
2. Restart the web and CMS containers.
3. Pick the new theme for a site under **Sites** in the admin.
4. Edit the layout, the blocks and the tokens. Optionally set a `parent` in `theme.json`
   so the theme keeps only the files it changes.

## How blocks are picked

For each block on a page, Polysite uses the first component it finds in this order:

1. the **site's theme**, as `components/<theme>/<Name>Block.vue`
2. that theme's **parent** (`"parent"` in `theme.json`), then its parent, and so on
3. the plain **core fallback**

Components are named by folder (`components/starter/HeroBlock.vue` is
`StarterHeroBlock`), so every theme can have its own version of a block even though
all installed themes share one build.

A theme can therefore be anything from a complete copy of the starter to a layout
plus a single overridden block that inherits the rest from its parent. The `acme` and
`bakery` examples in the Polysite Themes guide declare the starter as their parent; they
are examples there, not folders you get.

## Install

The `polysite-themes` repository is the `themes/` folder of a Polysite checkout. Client themes kept in their own repositories can sit beside it:

```bash
git clone git@github.com:polysites/polysite-themes.git themes
docker compose restart web cms
```

Polysite discovers any `themes/polysite-theme-<name>/` folder that contains
`layouts/<name>.vue`, so no config file needs editing. In the admin, a Super Admin
then opens **Sites**, picks a site, and chooses its **Theme** from a dropdown filled
from each theme's `theme.json` label.

## What is in a theme

```text
layouts/<name>.vue        site-wide chrome: header, navigation, footer
components/<name>/*.vue   the page blocks this theme draws
assets/css/<name>.css     design tokens, scoped to the theme's own class
nuxt.config.ts            loads the stylesheet into the app that extends the theme
theme.json                the admin dropdown label, and an optional parent
```

The layout is named after the theme, not Nuxt's `default.vue` convention, so several
themes can coexist in one build. Colors, fonts, navigation, footer and social links
come from the site's branding record, so editors change them in the admin and not in
code. Theme CSS is scoped to a class on the layout's root element, because a global
rule would restyle every site.

The web app styles with Tailwind CSS. A theme and a plugin's web part are separate git
repositories, which Tailwind would normally skip, so the web app lists every theme and plugin
layer it finds in a generated `assets/css/layer-sources.css` each time it starts. A utility class
used only in your theme works, but only after the web container has been restarted with the theme
in `themes/`.

## Slots the starter fills

Optional plugins put their parts into a theme through named slots, so a layout needs one line per
part. The starter layout places `<SiteSlot name="search" />` (the search box),
`<SiteSlot name="language-switcher" />` and `<SiteSlot name="share" />` (share buttons placed by
the theme). A slot draws nothing when its plugin is not installed or the site has not switched the
feature on, so a layout can include them all. See [Search](/guide/search),
[Share buttons](/guide/share-buttons) and [Languages](/guide/languages).

## Bundled and client themes

| Theme | What it is |
| --- | --- |
| `polysite-theme-starter` | The reference theme: every block, a plain layout, design tokens |
| your own theme | A theme made for one organization can live in its own repository and be mounted in `themes/` beside the starter |

The copy, names and imagery in the demos are fictional stand-ins.

## What is not possible yet

A theme can restyle and replace the blocks that exist. It can't yet add a **new kind
of block**, because every block also needs a definition in the CMS that editors use
to fill it in, and that isn't something a theme can ship today.

## Sharing and selling themes

You may share a theme you build free of charge. For now, themes can't be sold. See
section 8 of the [license](/guide/status#license).
