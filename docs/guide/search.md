# Search

Visitors can search a site's published pages and posts. Search is an optional plugin (**search**); without it
nothing changes and sites simply have no search box. Its own README in the plugins repository is the full guide;
this page is what an administrator and a theme builder need.

## Turning search on for a site

In the sidebar, open **Administration → Site features → Site search**. It opens the settings of the site you are working in (use the site switcher to change site).

- **Switch search on.** Off by default. Turns on the results page at `/search` (or `/fr/search` on a site in
  several languages) and the search box in themes that include one.
- **Placeholder text.** What the empty box says. Leave empty for the standard words in the visitor's language.
- **Results per page.** 1 to 50.
- **What visitors can search.** Pages and every content type with public addresses, such as posts. Leave empty
  to search all of them.

## What visitors find

Only what is **live**: a page or post that has never been published, or has been unpublished, is never found,
and neither is anything from another site. Search matches **titles, addresses and the text inside a page or
post** (headings, paragraphs, FAQ answers, feature descriptions and so on, up to the first 50,000 characters).
Every word typed must appear somewhere, in any order, and part of a word matches ("budg" finds "budget").
Results are ranked by where the words are found: a title that is the search, starts with it or contains the
words comes first, then more words in the title, then in the address, then only in the text. Under each result
is the post's excerpt or the page's SEO description when it shows a searched word, otherwise the stretch of
the text around the words, with the words highlighted. Words in a draft, however recent, are never searched:
the text searched is that of the version visitors see.

New text is searchable as soon as the page or post is saved or published. **After upgrading from a version
that only searched titles and addresses**, the text of existing pages is added automatically in the
background when the CMS starts (a log line says how many entries). You can also rebuild it at any time with
**URL Manager → Site URLs → Reindex**.

On a site in several languages a search runs in the language of the address. A page with no text in that
language yet is searched, and shown, in the site's default language, the same way the page itself falls back.

Each address may search 30 times a minute; past that visitors are asked to wait a moment. The results page is
never cached and is hidden from search engines.

## For theme builders

Place the box with one slot:

```vue
<SiteSlot name="search" />
```

It draws nothing on a site that hasn't switched search on. The results page (`/search`) draws itself; style
both from the theme with the `poly-search-*` classes listed in the plugin's README. A page whose slug is
`search` is hidden by the results page.

## Adding the plugin to an install

Search keeps its settings in its own table (`search_settings`), created by the plugin's own migration when the CMS starts; it changes nothing in the core's tables. Removing the plugin keeps every site's settings.
