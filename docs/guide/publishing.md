# Drafts, history and publishing

Pages and posts are edited safely: you can change a live page without visitors seeing the change until you decide, go back to an earlier version, schedule a page to appear or disappear, and hand a draft to someone else to approve.

## Save a draft, or publish

Every page and post has two buttons:

- **Save draft** keeps your work without changing the live page. Visitors keep seeing the version that is live. You (and other editors) see your draft when you open the page.
- **Publish changes** puts what you see on the live site.

A new page starts as a draft and is not on the site at all until someone publishes it. **Unpublish** (in the menu next to *Publish changes*) takes a live page down; it stays in the admin as a draft.

Duplicating a page or post, or copying one to another site, always makes a **draft**, so a copy never goes live on its own.

## Version history

The **Versions** tab on a page or post lists every save: who made it, when, and whether it was a draft or a publish. Open two versions to compare them side by side, and press **Restore** on an older one to bring it back as your current draft (publish it when you are happy). Each page keeps its latest 25 versions.

## Schedule publishing

Open the menu next to *Publish changes* and choose **Schedule publish**. Pick a date and time to publish, or to unpublish. It happens by itself, even if nobody is signed in: the server checks for due items every 30 seconds. A scheduled change is made on behalf of the person who scheduled it, so it needs the same permission as doing it by hand.

## Ask someone to review

People who may edit but not publish use the **Review** setting in the sidebar:

1. Set it to **Ready for review** and add a note about what to look at.
2. Whoever can publish filters the list by *Review* to see what is waiting, then publishes it, or sets **Changes requested** with a note saying what to change. (Only someone who can publish can send a draft back.)
3. Publishing clears the marker.

It is a signpost, not a lock: it doesn't stop anyone else with edit access from changing the page.

## Who can do what

Publishing and unpublishing are two separate permissions on each role (see *Roles*). Someone without them can still create pages, save drafts and mark them ready for review; pressing **Publish changes** tells them they need someone who can. Saving an ordinary change to a page that is live counts as publishing, because it changes what visitors see, so it needs the publish permission too.

## For administrators

- **Upgrading an existing install:** the migration copies each page's and post's old draft/published setting into the new status, so everything that is live stays live. The first time the server starts afterwards it writes one first version for every page and post that has none (they would otherwise be missing from the admin lists). Nothing is removed: the old setting stays in the database, unused.
- Search and the sitemap always describe what is **live**. A page that has never been published appears in the index marked as a draft and is left out of the sitemap.
- A scheduled publish that fails (for example, the person who scheduled it has since lost the permission) is recorded in the server log and the page stays as it was.
