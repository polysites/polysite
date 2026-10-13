# Privacy and consent

Polysite helps you collect personal information responsibly: say why you're asking, record
what people agreed to, keep it only as long as you need it, and find, export or delete it when
someone asks. It is designed around Canada's PIPEDA first, and the pieces are general enough to
support GDPR-style rules too.

::: warning This is a technical framework, not legal advice
Polysite gives you the tools. What the law requires of you depends on who you are, where your
visitors are and what you collect. Have a lawyer or privacy officer review your wording,
retention periods and procedures before you collect personal information from the public.
:::

## What Polysite collects, and what it doesn't

- **Form submissions.** Whatever your forms ask for, and nothing else. Fields a form doesn't
  define are thrown away on the server. Each submission is stored against one site.
- **No visitor tracking of its own.** The public site doesn't set cookies, and it doesn't
  store visitors' addresses with their submissions. Analytics is off until you add a
  tracking tool to a site.
- **Staff accounts.** Email, password (stored hashed) and role.

Things outside Polysite's own data that you should account for:

- **Server logs.** The web server and Docker keep logs that can include visitors' IP
  addresses, and the CMS's log can include staff email addresses (sign-in lines, email
  recipients). Decide how long you keep them.
- **Third-party requests.** The admin and the built-in error pages call no other site: their fonts (Lora and Inter, SIL Open Font
  License) are served from your own server, and the admin shows a plain placeholder avatar instead of fetching a Gravatar. A site
  that sets its own fonts is different: the Google Fonts address in a site's settings (Sites, Branding, `googleFontsUrl`) makes each
  visitor's browser contact Google, which is a feature of that site and yours to disclose. Leave the field empty, or host the font
  files yourself, to avoid it.
  A form set to the Cloudflare Turnstile bot check loads Cloudflare's script and shares details
  about the visitor with them; the built-in ALTCHA check does not.
  A plugin that loads tracking or advertising tools (the analytics plugin does) says in its README
  what it contacts and how consent is handled. Any script you paste into a site's custom JavaScript
  (chat widgets, other trackers) is yours to disclose and, where the law requires, to gate behind consent.
- **Plugin logs.** A plugin may keep logs of its own. The email plugin, for one, records each email it
  sends (recipient and subject, never the body) and deletes the entries after 90 days by default; its README
  says how to change that. The webhooks plugin sends only ids, titles and links (never what a visitor typed
  into a form) to the addresses an administrator adds, and keeps a delivery log for 30 days. Check what each
  plugin you install keeps.
- **Email.** If a form sends notification emails, those copies live in mailboxes Polysite
  doesn't control.

## Set up a site

Open the site under **Sites** and fill in the **Privacy** tab:

| Setting | What to put |
| --- | --- |
| **Privacy policy URL** | Your policy's address. Forms link to it. Use a full `https://` address or a path like `/privacy` |
| **Privacy contact email** | The person people write to about their information. PIPEDA expects an organization to name someone accountable; use the same address in your policy |

## Set up each form

In a form's **Privacy** group:

- **Purpose.** Say, in plain words, what you will use the information for and who sees it. It
  appears above the button. *"We'll use your email to send campaign updates. We never share it."*
- **Require consent checkbox.** Visitors must tick a box before they can send. Set its wording
  in **Consent label**.
- **Delete after (days).** Submissions are deleted automatically this long after they arrive.
  Leave it empty to keep them until a privacy request removes them. Keep information only as long as you
  need it.

### The record of consent

Every submission keeps what the person was shown and what they did: the purpose text, the
checkbox wording, the policy link, whether they ticked the box, and when. It is a snapshot, so
changing a form later doesn't rewrite what an earlier visitor agreed to. You can read it on the
submission, and it is included when you export a person's information.

## Automatic deletion

When a form has a retention period, each submission is stamped with the date it expires. A
cleanup runs shortly after the server starts and every few hours after, and deletes everything
past its date. It runs inside the CMS, which suits a single server. Deleting already-deleted
records is harmless, so running two copies is safe.

## When someone asks about their information

Log each request under **Privacy Requests** (in the Administration group). A request belongs to
one site and has a type, a received date, and a due date that defaults to 30 days later, the
usual deadline under PIPEDA. Check the rule that applies to you.

1. **Create the request.** Choose the site, the type (access, erasure, withdraw consent,
   correction or other), and enter the email address they used.
2. **Find.** *Find their information* searches that site's form submissions for the address and
   tells you how many it found and in which forms.
3. **Export.** *Download a copy* gives you a JSON file of their answers and the consent record.
   Read it, then send it to them by a secure route.
4. **Erase.** For an erasure or withdraw-consent request, *Delete their information* deletes the
   submissions. The request is marked completed, the email address is removed from it, and a
   one-way fingerprint is kept as proof (see below).
5. **Close it out** with a note of what you did. Don't paste their information into the note.

Only roles given the **Privacy Requests** module can do this, and only for sites they belong to.
The default **Site User** role doesn't have it, because deleting a person's data should be a
deliberate grant.

### What the search finds, and what it doesn't

It matches **form submissions on that site that contain the email address**. It won't find:

- something a person typed into a free-text box without their email beside it;
- information held outside Polysite: email inboxes, spreadsheets, an exported list;
- submissions on other sites (a request is per site, on purpose).

For anything beyond form submissions, handle it by hand and record that in the request's notes.

## Erasure and backups

Deleting a record doesn't remove it from backups taken earlier, and a restore would bring it
back. Two things handle this:

- **Keep backups no longer than you must.** The defaults keep daily backups for 7 days, Sundays
  for 4 weeks and monthly ones for 6 months (see [Backups and restore](/guide/backups)). Shorten
  them if your policy promises faster. Encrypt backups, especially off-site copies.
- **After any restore, re-apply the erasures.** Completed erasure requests keep a one-way
  fingerprint of the email (never the address itself). This command deletes anyone who asked to
  be erased since the backup was taken:

  ```bash
  docker compose exec cms npx payload run scripts/reapplyErasures.ts
  ```

## How this lines up with PIPEDA's principles

| Principle | What Polysite gives you | What you still have to do |
| --- | --- | --- |
| Accountability | A named privacy contact on each site, a register of requests | Appoint the person; write your policies |
| Identifying purposes | A purpose statement on each form | Write it clearly and keep it accurate |
| Consent | An optional required checkbox, and a stored record of what was shown and agreed | Decide when consent must be explicit; word it well |
| Limiting collection | Forms collect only the fields you define; extras are discarded | Ask only for what you need |
| Limiting use, disclosure and retention | Per-form automatic deletion | Choose the periods; don't reuse data for new purposes without fresh consent |
| Accuracy | Submissions are kept exactly as sent and can't be edited. To correct one, the person sends the form again and the old entry is erased through a privacy request | Respond to correction requests |
| Safeguards | Per-site access, role-based permissions, signed spam checks, encryption of backups on request | Strong passwords, HTTPS, keeping the system patched, encrypting backups |
| Openness | A policy link next to every form | Publish a clear policy |
| Individual access | Find and export tools, with a deadline tracker | Verify who is asking before you release anything |
| Challenging compliance | A contact address and a request register | Handle complaints, and tell people they can go to the regulator |

## If something goes wrong

If personal information is lost or accessed by the wrong person, write down what happened, when,
what information and how many people were involved. Under PIPEDA a breach that creates a real
risk of significant harm must be reported to the Privacy Commissioner and to the people
affected, and you must keep a record of every breach. Polysite doesn't automate that; keep your
own register and get advice quickly.

## Not covered yet

- **Consent for scripts you add yourself.** Polysite sets no cookies itself, and the analytics
  setting asks visitors where you configure it to. Any other script pasted into a site is yours
  to disclose and gate. There is no general cookie-preferences centre yet.
- **Self-hosted fonts for a site.** The admin and the error page self-host their fonts, but a site that picks its own fonts still loads them from Google unless you host the files yourself and leave the Google Fonts address empty.
- **Looking people up by name or phone number.** Only email is searched.
- **Staff account deletion** is done in the admin by a Super Admin.
- **Children's data, data residency and agreements with service providers** are for your
  policies, not the software.
