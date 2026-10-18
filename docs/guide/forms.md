# Forms and sign-ups

Polysite collects sign-ups, petitions and messages through forms you build in the admin.
A visitor fills one in on the public site, and the answers are kept as that form's
**submissions** for the site's team to read.

## Build a form

1. In the admin, open **Forms** and create one.
2. Pick its **site**. A form belongs to exactly one site, and so do its submissions.
3. Add fields: text, email, text area, number, select, checkbox, state, country, and static
   text to show between fields.
4. Set the button label, and what happens after sending: show a **message**, or **redirect**
   to another page.
5. Optionally add **emails** to send when someone submits.

### Hidden fields

A **Hidden field** is a field visitors never see. The page fills it in, so each submission records
where it came from, with no cookies or tracking script. Add one in the builder and choose where
the value comes from:

- **The page the form is on**: its address, without anything after a `?`.
- **A value in the page address**: you name the parameter, like `utm_source`, `utm_campaign` or
  `ref`. A visitor who arrives from `…/join?utm_campaign=spring` is recorded as `spring`.
- **Where the visitor came from**: the referring page's address, without anything after a `?`.
- **A fixed value**: text you choose, like `spring-appeal`. Handy when the same form sits on several
  pages and you want to tell them apart.

Hidden fields get their own column in the CSV export, named after the field (or its heading in
exports). **A hidden field is not spam protection.** A visitor's browser can change what it sends,
so treat the value as a hint, not a fact. Only a fixed value is guaranteed, because the server
fills it in itself. Values over 500 characters are cut.

## Put it on a page

Two blocks show a form on a page. Pick the form in either one:

| Block | Use it for |
| --- | --- |
| **Form Embed** | A full form with a heading: contact forms, petitions, surveys |
| **Signup Form** | A compact box (for example email and postal code) with a heading and sub-heading |

A block with no form chosen shows nothing to visitors, so there is never a button that goes
nowhere.

Forms load in the visitor's browser when the page opens. Changing a form in the admin takes
effect straight away; there is nothing to republish.

## Read the answers

Each form's submissions are reached from the form itself, not from the sidebar:

- The **Forms** list has a **Submissions** column with the count for each form. Click it to
  read them.
- A form's own screen has a summary at the top (the last 7 days, the last 30 days and the
  total), a **View submissions** link and an **Export CSV** button.

Editors only see their own site's forms and submissions, and which roles can read submissions
is set under **Roles**.

### Submissions can't be changed or deleted by hand

A submission is the record of what a person sent and agreed to, so nobody can edit it, create
one or delete one in the admin, not even a Super Admin. They are removed only by the form's
**Delete after (days)** setting or by a [privacy request](/guide/privacy), and a form that
still holds submissions can't be deleted until those are gone. The **Roles** screen still
lists create, edit and delete for submissions, but they have no effect.

### Export to a spreadsheet

**Export CSV** downloads every submission of that form, one row each, with a column for each
field in the order the form lists them, the date and time sent (UTC), and whether and when the
person ticked the consent box. Fill in **From** and **To** to export only a date range. Anyone
who can read a form's submissions can export them, and only for the sites they belong to.
Each export is written to the server log with who ran it and how many rows.

An answer that starts with `=`, `+`, `-` or `@` is saved with a leading apostrophe, so a
spreadsheet shows it as text instead of running it as a formula.

Submissions hold personal information. Give the role that reads them only to people who need
it, and think about how long you keep what you collect.

## Petitions: one signature per person and a public count

Two settings on a form (under **Petition**) turn an ordinary form into a petition. Both are off by default, so a contact form behaves as before.

- **One signature per person.** With this set to *By email address*, someone who signs twice with the same address (capital letters and spaces don't matter) sees the normal thank-you message but is stored once and counted once. Nobody can use the form to find out whether a given person has signed. The form needs an email field. What is kept is a one-way hash of the address, scoped to this form (the address is already in the submission, so no second copy exists), and it is deleted with the submission. Two people submitting at the same instant can't both be stored: the database refuses the second.
- **Show the signature count publicly.** The site shows how many people have signed and, if you set a **Goal**, a progress bar toward it. **Starting number** is added to the count, for signatures collected before this form or elsewhere. The number is cached for ten seconds, so a page that thousands of people open at once costs the database one count every few seconds.

The count is the number of stored submissions plus the starting number. Submissions removed by a retention setting or a privacy request lower it; use the starting number if that matters.

## What is checked

Everything a visitor sends is checked on the server against the form you built, not just in
their browser:

- fields the form doesn't have are dropped, never stored;
- required fields, email addresses, numbers, dates and the options of a select are checked;
- values have a length limit (500 characters, 5,000 for a text area);
- the whole submission may not be larger than 64 KB (the proxy refuses a bigger body, even one sent in chunks).

The form must belong to the site the visitor is on. A visitor of one site can't send
anything to another site's form.

## Spam protection

Three light checks stop most automated spam without a CAPTCHA or a third-party service:

1. **A hidden trap field.** People never see it, bots fill it in. A submission that fills it
   looks like it worked and is thrown away.
2. **A signed, short-lived token** issued when the form loads. A bot that posts straight to
   the address has no token, and one that sends it instantly (faster than a person can type)
   is refused.
3. **A rate limit** per visitor address: 8 submissions a minute and 40 an hour.

This stops casual bots, not a determined attacker. For more, add a bot check to the form.

### A bot check on a form

Open the form and set **Protection → Bot check**:

| Choice | What visitors see | Notes |
| --- | --- | --- |
| **None** | Nothing | The three light checks above only |
| **ALTCHA** | Nothing, or a brief "Checking that you're not a robot" line | Built in, no third party. The visitor's browser solves a small puzzle in the background, about a second. Each puzzle is signed, belongs to one form, expires after 10 minutes and works once |
| **Cloudflare Turnstile** | Cloudflare's small widget, usually without a click | Stronger filtering. Cloudflare runs it, so it receives details about each visitor |

The check is made on the server before anything is saved. A submission that fails it is refused
with a plain message, and the form reloads with a fresh check.

**Turnstile keys are per site.** Create a Turnstile widget for the site's domain in the
Cloudflare dashboard, then open the site under **Sites → Forms** and enter the **site key**
(public) and **secret key**. The secret is stored encrypted and is shown only as bullets
afterwards; leave the bullets alone to keep it, or type a new one to replace it. A form set to
Turnstile on a site with no keys is **not shown** (visitors see "isn't available right now"),
and the server log says why. If Cloudflare can't be reached when someone submits, they are
asked to try again; nothing is let through unchecked.

::: warning Turnstile is a third party
Say in your privacy policy that visitors' details are shared with Cloudflare to protect forms.
ALTCHA avoids this. See [Privacy and consent](/guide/privacy).
:::

## Good to know

- **The limit is per server process.** That fits a single-server install, which is how
  Polysite runs. Behind several servers each keeps its own count.
- **Behind a CDN or load balancer,** the visitor's address must reach Polysite in
  `X-Forwarded-For`. Without it everyone looks like one visitor.
- **No duplicate check yet.** The same person can sign up twice.
- **Consent.** Forms can show a purpose and require a consent checkbox, and each submission
  keeps a record of what was shown. See [Privacy and consent](/guide/privacy).
- **Radio and date fields** exist in the form builder but are switched off in this install.
- **ALTCHA puzzles are remembered by the server process,** so a second server would need to share
  that list. Like the rate limit, it suits the single-server setup.
- **State and country** are plain text fields.

## For theme authors

A theme draws forms; Polysite does the rest. Use `useFormIntake` for behaviour and
`PolysiteFormFields` for the fields, then style the `poly-*` classes from your block. See
the Polysite Themes guide. Hidden fields draw nothing, and the bot check is drawn by
`PolysiteFormFields` itself (`poly-captcha` and `poly-captcha-status`), so a theme that uses it needs no
changes to support either.

To show a petition's count, render `<PolysiteSignatureCount v-if="intake.signatures" :count="intake.signatures.count" :goal="intake.signatures.goal" />`
above the fields (the block's `intake` is `useFormIntake()`). It carries the classes `poly-signatures`, `poly-signatures-count`,
`poly-signatures-bar` and `poly-signatures-fill` and no look of its own.
