"use client";

import type { TextFieldClientProps } from "payload";

import { SelectInput, useField } from "@payloadcms/ui";
import React from "react";

type Option = { label: string; value: string };

// A one-choice menu for a list that depends on what is installed (the collections a notification can watch). Like ModuleSelect it
// is stored as plain text, never a Postgres enum: an enum would change whenever another plugin comes or goes. A value whose
// option has since disappeared is still shown, as its raw name.
export function SingleSelect({ field, path, options }: TextFieldClientProps & { options: Option[] }) {
  const { errorMessage, setValue, showError, value } = useField<string>({ path });
  const known = new Set(options.map((o) => o.value));
  const all = value && !known.has(value) ? [...options, { label: value, value }] : options;

  return (
    <SelectInput
      isClearable={false}
      label={field.label}
      name={field.name}
      onChange={(selected) => {
        const option = (Array.isArray(selected) ? selected[0] : selected) as Option | undefined;
        if (option) setValue(option.value);
      }}
      options={all}
      path={path}
      required={field.required}
      showError={showError}
      value={value}
      Error={showError ? <span className="field-error">{errorMessage}</span> : undefined}
    />
  );
}
