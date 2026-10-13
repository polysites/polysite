"use client";

import type { TextFieldClientProps } from "payload";

import { SelectInput, useField } from "@payloadcms/ui";
import React from "react";

type Option = { label: string; value: string };

// The Sites.theme dropdown. Themes are discovered from the themes/ folder when
// the CMS starts, so this can't be a Payload `select` field: that becomes a
// Postgres enum, and adding a theme folder would then need a database
// migration. The field is plain text, validated against the discovered list
// on the server (collections/Sites.ts), and this component supplies the menu.
export function ThemeSelect({ field, path, options }: TextFieldClientProps & { options: Option[] }) {
  const { errorMessage, setValue, showError, value } = useField<string>({ path });

  return (
    <SelectInput
      isClearable={false}
      label={field.label}
      name={field.name}
      onChange={(selected) => {
        const option = (Array.isArray(selected) ? selected[0] : selected) as Option | undefined;
        if (option) setValue(option.value);
      }}
      options={options}
      path={path}
      required
      showError={showError}
      value={value}
      Error={showError ? <span className="field-error">{errorMessage}</span> : undefined}
    />
  );
}
