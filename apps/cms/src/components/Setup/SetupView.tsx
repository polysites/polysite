import type { AdminViewServerProps } from "payload";
import React from "react";

import { THEMES } from "../../collections/Sites";
import { Logo } from "../Brand/Logo";
import { SetupForm } from "./SetupForm";

// The first-run page. Payload routes every admin URL here while the database
// has no users (and only then), in place of its bare create-first-user form.
// Replaces it via admin.components.views.createFirstUser in payload.config.ts.
export function SetupView({ initPageResult }: AdminViewServerProps) {
  const adminRoute = initPageResult.req.payload.config.routes.admin;

  return (
    <div className="polysite-setup">
      <Logo />
      <h1>Welcome to Polysite</h1>
      <p className="polysite-setup__lead">
        Two quick steps and you&apos;re in: create the administrator account, then name your first site. You can change
        everything later in the admin.
      </p>
      <SetupForm
        adminRoute={adminRoute}
        themes={THEMES}
        requiresToken={Boolean(process.env.POLYSITE_SETUP_TOKEN)}
      />
    </div>
  );
}
