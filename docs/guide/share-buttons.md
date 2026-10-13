# Share buttons

A site can show buttons that share the page a visitor is on: Facebook, X, LinkedIn, WhatsApp, Telegram, Reddit,
email, "copy link" and the device's own share menu. Share buttons are an optional plugin (**share**); without it
nothing changes and sites simply have no buttons. Its own README in the plugins repository is the full guide;
this page is what an administrator and a theme builder need.

## Turning them on for a site

In the sidebar, open **Administration → Site features → Share buttons**. It opens the settings of the site you are working in (use the site switcher to change site).

- **Show share buttons on this site.** Off by default.
- **Buttons.** Which networks to offer, in the order they should appear. Choose at least one.
- **Look.** Icon and name, icons only, or names only. A floating bar always shows icons only.
- **Where.** Floating along the bottom of the page (the default), floating at the side (a bar along the bottom
  on narrower screens), or where the theme puts it. Floating works with every theme.
- **Show on.** The home page, pages, news and articles, and other content types that plugins add.
- **Message (optional).** Words that go in front of the page's title when someone shares. Write `{title}` to put
  the title somewhere else. On a site in several languages it is written per language.
- **X account (optional).** Added as "via @account" on X.

A change shows on the public site within a few seconds.

## Privacy

The buttons are plain links. The plugin adds no third-party script, tracking pixel or widget, sets no cookie,
and **requests nothing from any other website until a visitor clicks a button**. The icons are part of the page.
Each link opens the network's own share page in a new tab with `rel="noopener noreferrer"`. The address that is
shared has no tracking parameters and no fragment. Because nothing is loaded or stored, there is nothing to ask
visitors' consent for.

## What is shared

The page's own title and its canonical address on the site's own domain, in the visitor's language (`/fr/about`
on a French page). Both are read from the tags the page already writes for search engines, so they always match
what a search result or a social card shows. The links are in the HTML the server sends, so the buttons work
with JavaScript off; JavaScript only adds "Copy link" and the device's share menu.

## For theme builders

Place the buttons after the page's content with the plugin's slot:

```vue
<SiteSlot name="share" />
```

(or `<ShareButtons />`). They draw only when the site chose **where the theme puts it** and the kind of page is
ticked, so a theme that places them never gets a second, floating copy. Style them with the `poly-share-*`
classes, or the `--poly-share-bg`, `--poly-share-fg` and `--poly-share-radius` variables. Inline buttons take the
text colour of whatever they sit in, so they follow a theme's light and dark colours. Visitors' fixed words are
translated into French, Spanish and German.

## Adding the plugin to an install

Share keeps its settings in its own table (`share_settings`), created by the plugin's own migration when the CMS starts; it changes nothing in the core's tables. Removing the plugin keeps every site's settings.
