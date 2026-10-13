import { convertLexicalToHTMLAsync } from "@payloadcms/richtext-lexical/html-async";
import type { Endpoint, PayloadRequest } from "payload";

import { computeExpiry } from "../privacy/retention";
import { captchaSettings, checkCaptcha, isMisconfigured, publicCaptcha } from "./captcha";
import { clientAddress, checkToken, HONEYPOT_FIELD, issueToken, RateLimiter } from "./spam";
import { type FormField, inputFields, validateSubmission } from "./validateSubmission";

// The public face of the form builder: what a visitor's browser talks to.
//
//   GET  /api/form-intake/:id   the form's fields, plus a signed token
//   POST /api/form-intake/:id   a submission
//
// The form-builder plugin's own `form-submissions` create endpoint is closed to
// the public (see payload.config.ts), because it stores whatever it is sent.
// Everything a visitor can do goes through here instead: the form must belong to
// the site the visitor is on, the data is checked against the form's own fields,
// and the request has to pass the spam checks in ./spam.

const MAX_BODY_BYTES = 32 * 1024;
const limiter = new RateLimiter([
  { windowMs: 60_000, max: 8 },
  { windowMs: 60 * 60_000, max: 40 },
]);

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/** The hostname the visitor used, as the reverse proxy passes it on. */
function requestHost(req: PayloadRequest): string {
  const raw = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  return (raw.split(",")[0] ?? "").trim().toLowerCase().replace(/:\d+$/, "");
}

type LoadedForm = {
  id: string | number;
  title?: string;
  fields?: FormField[];
  submitButtonLabel?: string;
  confirmationType?: "message" | "redirect";
  confirmationMessage?: unknown;
  redirect?: { url?: string };
  privacy?: { purpose?: string; consentRequired?: boolean; consentLabel?: string; retentionDays?: number };
  protection?: { captcha?: string | null };
  site: { id: string | number; domain?: string; privacyPolicyUrl?: string; formProtection?: { turnstileSiteKey?: string | null; turnstileSecretKey?: string | null } };
};

const DEFAULT_CONSENT_LABEL = "I agree to how my information is used.";

/** The wording a visitor was shown, as plain text, kept with their submission as the record of what they agreed to. */
function consentStatement(form: LoadedForm): string {
  const p = form.privacy ?? {};
  return [
    p.purpose?.trim(),
    p.consentRequired ? `Checkbox: "${p.consentLabel || DEFAULT_CONSENT_LABEL}"` : "",
    form.site.privacyPolicyUrl ? `Privacy policy: ${form.site.privacyPolicyUrl}` : "",
    p.retentionDays ? `Kept for ${p.retentionDays} days.` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** The form for this request, or undefined when it doesn't exist or isn't this site's. */
async function loadForm(req: PayloadRequest): Promise<LoadedForm | undefined> {
  const id = req.routeParams?.id;
  if (typeof id !== "string" || !/^\d+$/.test(id)) return undefined;

  const form = (await req.payload
    .findByID({ collection: "forms", id, depth: 1, overrideAccess: true, context: { revealFormSecrets: true } })
    .catch(() => null)) as unknown as LoadedForm | null;
  const site = form?.site;
  if (!form || !site || typeof site !== "object" || !site.domain) return undefined;
  if (site.domain.toLowerCase() !== requestHost(req)) return undefined;
  return form;
}

async function richTextToHtml(data: unknown): Promise<string> {
  if (!data) return "";
  try {
    return await convertLexicalToHTMLAsync({ data: data as never, disableContainer: true });
  } catch {
    return "";
  }
}

function secret(): string {
  return process.env.PAYLOAD_SECRET || "";
}

export const formDefinitionEndpoint: Endpoint = {
  path: "/form-intake/:id",
  method: "get",
  handler: async (req) => {
    const form = await loadForm(req);
    if (!form) return json({ message: "Form not found." }, 404);

    const captcha = captchaSettings(form);
    if (isMisconfigured(captcha)) {
      req.payload.logger.error(`Form ${form.id} asks for Turnstile but its site has no keys (Sites -> Forms), so it is not shown`);
      return json({ message: "This form isn't available right now." }, 503);
    }

    const fields = [];
    for (const f of form.fields ?? []) {
      const field = f as FormField & { width?: number; defaultValue?: unknown; message?: unknown };
      if (field.blockType === "message") {
        fields.push({ blockType: "message", html: await richTextToHtml(field.message) });
      } else if (inputFields([field]).length > 0) {
        fields.push({
          blockType: field.blockType,
          name: field.name,
          label: field.label,
          required: Boolean(field.required),
          width: field.width,
          defaultValue: field.defaultValue,
          options: field.options?.map((o) => ({ label: o.label, value: o.value })),
          // Hidden fields: how the page should fill the value in. A fixed value never leaves the server.
          ...(field.blockType === "hidden" ? { source: field.source, param: field.source === "param" ? field.value : undefined } : {}),
        });
      }
    }

    return json({
      id: form.id,
      title: form.title,
      submitButtonLabel: form.submitButtonLabel || "Submit",
      fields,
      privacy: {
        purpose: form.privacy?.purpose?.trim() || "",
        consentRequired: Boolean(form.privacy?.consentRequired),
        consentLabel: form.privacy?.consentLabel?.trim() || DEFAULT_CONSENT_LABEL,
        retentionDays: form.privacy?.retentionDays || null,
        policyUrl: form.site.privacyPolicyUrl || "",
      },
      honeypot: HONEYPOT_FIELD,
      token: issueToken(secret(), form.id),
      captcha: publicCaptcha(captcha, secret(), form.id),
    });
  },
};

export const formSubmitEndpoint: Endpoint = {
  path: "/form-intake/:id",
  method: "post",
  handler: async (req) => {
    if (!limiter.allow(clientAddress(req.headers))) {
      return json({ message: "Too many attempts. Please wait a minute and try again." }, 429);
    }
    if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
      return json({ message: "That submission is too large." }, 413);
    }

    let body: Record<string, unknown>;
    try {
      body = ((await req.json?.()) ?? {}) as Record<string, unknown>;
    } catch {
      return json({ message: "That request couldn't be read." }, 400);
    }

    const form = await loadForm(req);
    if (!form) return json({ message: "Form not found." }, 404);

    // A filled honeypot is a bot. Answer as if it worked so it learns nothing.
    if (typeof body[HONEYPOT_FIELD] === "string" && body[HONEYPOT_FIELD]) return json({ ok: true, confirmationType: "message", message: "" });

    const token = checkToken(secret(), form.id, body.token);
    if (token === "too-fast") return json({ message: "Please take a moment and try again." }, 429);
    if (token !== "ok") return json({ message: "This form has expired. Reload the page and try again." }, 400);

    // The form's optional bot check (its Protection setting), before anything is read or stored.
    const captcha = captchaSettings(form);
    if (isMisconfigured(captcha)) return json({ message: "This form isn't available right now." }, 503);
    const outcome = await checkCaptcha(captcha, secret(), form.id, body.captcha);
    if (!outcome.ok) return json({ message: outcome.message, captcha: true }, outcome.status);

    const result = validateSubmission(form.fields, body.data);
    const consentGiven = body.consent === true;
    const errors = {
      ...(result.ok ? {} : result.errors),
      ...(form.privacy?.consentRequired && !consentGiven ? { consent: "Please tick the box to continue." } : {}),
    };
    if (Object.keys(errors).length > 0 || !result.ok) return json({ message: "Please fix the highlighted fields.", errors }, 422);

    const now = new Date();

    try {
      await req.payload.create({
        collection: "form-submissions",
        // `site` comes from the form, never from the visitor.
        data: {
          form: form.id,
          site: form.site.id,
          submissionData: result.rows,
          // What they were shown and whether they ticked the box, kept as the record of consent.
          consent: { given: consentGiven, statement: consentStatement(form), at: now.toISOString() },
          expiresAt: computeExpiry(now, form.privacy?.retentionDays),
        } as never,
        overrideAccess: true,
      });
    } catch (err) {
      req.payload.logger.error({ err, msg: "Saving a form submission failed" });
      return json({ message: "Something went wrong saving that. Please try again." }, 500);
    }

    if (form.confirmationType === "redirect" && form.redirect?.url) {
      return json({ ok: true, confirmationType: "redirect", redirect: form.redirect.url });
    }
    return json({ ok: true, confirmationType: "message", message: await richTextToHtml(form.confirmationMessage) });
  },
};
