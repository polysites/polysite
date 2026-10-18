# Languages

A site can speak more than one language. Each language has its own address (`/fr/about`), a language switcher, and its own text, written in the same page or post next to the original. Languages are an optional plugin (**i18n**); without it every site is English only and nothing changes.

## Turning languages on for a site

Choose the site in the site switcher, then open **Administration → Site features → Site languages** (each site has its own page). Pick the languages the site offers and its **default language**: the language of addresses without a prefix, and the one shown when something isn't translated yet. Save.

From then on:

- editors on that site get a **language picker** at the top of the admin, and a **Languages** column in the page and post lists showing which languages have text (a faint, struck-through tag means a translation is missing);
- visitors can reach each language at its own address, and see a language switcher on themes that include one.

## Writing a translation

Open a page or post, choose the language at the top of the screen, and write. Anything you haven't translated yet shows the default language's text (in the editor too), so you can translate in stages. A required field is required in the default language only, so a first translation doesn't need every field copied across.

**Publishing publishes every language together.** Saving a draft saves it in the language you are working in; the versions tab holds every language.

What stays the same in every language: its pictures and links, and the order of its blocks. If a language needs a different layout, that isn't possible yet.

### A page's address in each language

Below the page's **Address** there is **Address in this language**. With French selected, typing `a-propos` makes the page `/fr/a-propos`; leaving it empty keeps `/fr/about`. Letters of any script work (`/ar/من-نحن`). The old address keeps working: visitors who arrive at `/fr/about` are sent on to `/fr/a-propos`, and if you later change the French address the old one is redirected too. The language switcher, the search-engine links and the sitemap all use each language's own address. News posts keep one address under every language for now, and links you typed inside text or menus stay as typed (a link to an old address is redirected).

## Putting a language live

A language can be written and checked before anyone can see it. On **Site languages**, tick it under **Preview only (not live yet)**: visitors get no pages, no switcher entry and no search-engine links for it, while editors keep writing in it. Open **Live Preview** with that language selected to see the page (the address it opens is a signed, temporary link that is never stored or indexed). Untick it to put the language live.

## Machine translation

If your administrator has set up a translation service and switched **Machine translation helper** on for the site, pages and posts get a **Translate** button: choose the language, press it, and the text of that page is translated from the default language and saved as a **draft**. What you already translated is never overwritten. The language is marked (`fr*`) as machine-translated, and **the page cannot be published until you have read it and chosen "Mark fr as reviewed"**. Only the text of that one page is sent to the service. Setting it up (provider, key) is in the plugin's README; privacy notes are in the privacy guide.

## Right-to-left languages

Arabic, Hebrew, Persian, Urdu and the other right-to-left languages turn the whole page around (`dir="rtl"`), on the core's own pages and on themes built the way the starter theme is. A theme that was written with left/right in its styles needs a small fix; the theme guide says how.

## What search engines see

On a site with several languages every translated page tells search engines about its other languages (`hreflang`, with an `x-default`), the sitemap lists each language of each page, and a page that has **no** text in a language but is opened under that language's address is marked `noindex` and left out of the sitemap, so there are no duplicate copies.

## The words themes and plugins add

Fixed words such as "Thank you" on a form, or "Older" and "Newer" in the news list, come from dictionaries. The i18n plugin includes French, Spanish and German for the core's words and the news section's; a theme can add more, or other languages (see the plugin's README for theme builders).

## Things to know

- Forms are translatable: the form builder's labels, messages and confirmation text have a field per language.
- Site-wide texts (tagline, menu and footer labels) are translated on the site's own screen, in the Branding tab, with the language picker.
- The error page (a 404, say) follows the address: `/fr/nothing` on a site that offers French is a French 404, with its home link back in French. With no dictionary for a language it shows English.
- Removing the plugin keeps every translation; sites simply go back to English only.
