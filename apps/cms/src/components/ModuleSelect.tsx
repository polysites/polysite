"use client";

import type { TextFieldClientProps } from "payload";

import { SelectInput, useField } from "@payloadcms/ui";
import React from "react";

type Option = { label: string; value: string };

// A multi-choice menu for a list that depends on which plugins are installed (the modules a role may touch, the modules a
// site exposes). It can't be a Payload `select`: that becomes a Postgres enum, and an installed plugin would then have to
// add a value to a core table's type. The field is plain text, any list of strings is stored (a module whose plugin has
// been removed stays ticked, so putting the plugin back finds everything as it was), and this component supplies the menu.
// Same idea as ThemeSelect, for a list of values.
export function ModuleSelect({ field, path, options }: TextFieldClientProps & { options: Option[] }) {
  const { errorMessage, setValue, showError, value } = useField<string[]>({ path });
  const chosen = Array.isArray(value) ? value : [];
  // Values that have no option any more (their plugin is gone) are still shown, as their raw name, so they can be unticked.
  const known = new Set(options.map((o) => o.value));
  const allOptions = [...options, ...chosen.filter((v) => !known.has(v)).map((v) => ({ label: v, value: v }))];

  return (
    <SelectInput
      hasMany
      isClearable
      label={field.label}
      name={field.name}
      onChange={(selected) => {
        const list = (Array.isArray(selected) ? selected : selected ? [selected] : []) as Option[];
        setValue(list.map((o) => o.value));
      }}
      options={allOptions}
      path={path}
      showError={showError}
      value={chosen}
      Error={showError ? <span className="field-error">{errorMessage}</span> : undefined}
    />
  );
}
