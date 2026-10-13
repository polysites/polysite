import type { Endpoint } from "payload";

import { THEMES } from "../collections/Sites";
import { runSetup, SetupError } from "./runSetup";
import { validateSetup } from "./validate";

// POST /api/setup -- used only by the first-run page (components/Setup). It is
// public by necessity (nobody can sign in yet), so runSetup refuses as soon as
// any user exists, and an optional POLYSITE_SETUP_TOKEN guards a server that is
// reachable before its owner gets to the page.
export const setupEndpoint: Endpoint = {
  path: "/setup",
  method: "post",
  handler: async (req) => {
    let body: unknown;
    try {
      body = await req.json?.();
    } catch {
      return Response.json({ message: "That request couldn't be read." }, { status: 400 });
    }

    const result = validateSetup(
      body,
      THEMES.map((t) => t.value),
    );
    if (!result.ok) return Response.json({ message: "Please fix the highlighted fields.", errors: result.errors }, { status: 422 });

    try {
      await runSetup(req.payload, result.value);
      return Response.json({ ok: true });
    } catch (err) {
      if (err instanceof SetupError) return Response.json({ message: err.message }, { status: err.status });
      req.payload.logger.error({ err, msg: "First-run setup failed" });
      return Response.json({ message: "Setup failed. Check the server log." }, { status: 500 });
    }
  },
};
