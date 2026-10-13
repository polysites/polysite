import { describe, expect, it } from "vitest";

import { csvCell, csvLine, dateRange, exportColumns, exportFileName, headerRow, submissionRow } from "./export";

const fields = [
  { blockType: "email", name: "email", label: "Email address" },
  { blockType: "text", name: "postalCode", label: "Postal code" },
  { blockType: "message", label: "Just some words" },
  { blockType: "checkbox", name: "updates" },
];

describe("csvCell", () => {
  it("leaves plain text alone and quotes commas, quotes and line breaks", () => {
    expect(csvCell("plain")).toBe("plain");
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("two\nlines")).toBe('"two\nlines"');
    expect(csvCell(null)).toBe("");
    expect(csvCell(7)).toBe("7");
  });

  it("defuses spreadsheet formulas typed into a public form", () => {
    expect(csvCell("=HYPERLINK(\"http://evil\")")).toBe("\"'=HYPERLINK(\"\"http://evil\"\")\"");
    expect(csvCell("+1 555")).toBe("'+1 555");
    expect(csvCell("-2+3")).toBe("'-2+3");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvCell("\tcmd")).toBe("'\tcmd");
    expect(csvCell("a=b")).toBe("a=b");
  });

  it("joins a line with CRLF", () => {
    expect(csvLine(["a", "b,c"])).toBe('a,"b,c"\r\n');
  });
});

describe("columns and rows", () => {
  const columns = exportColumns(fields);

  it("has one column per input field, in the form's order, and skips display-only blocks", () => {
    expect(columns).toEqual([
      { name: "email", label: "Email address" },
      { name: "postalCode", label: "Postal code" },
      { name: "updates", label: "updates" },
    ]);
    expect(headerRow(columns)).toBe("Submitted at (UTC),Email address,Postal code,updates,Other answers,Consent given,Consent recorded at (UTC)\r\n");
  });

  it("fills each answer under its column, with consent at the end", () => {
    const row = submissionRow(columns, {
      createdAt: "2026-10-07T04:10:41.722Z",
      submissionData: [
        { field: "postalCode", value: "K1A 0B1" },
        { field: "email", value: "a@example.org" },
        { field: "updates", value: "true" },
      ],
      consent: { given: true, at: "2026-10-07T04:10:41.722Z" },
    });
    expect(row).toBe("2026-10-07T04:10:41.722Z,a@example.org,K1A 0B1,Yes,,Yes,2026-10-07T04:10:41.722Z\r\n");
  });

  it("keeps answers to a field that was later removed from the form", () => {
    const row = submissionRow(columns, { createdAt: "2026-10-07T00:00:00.000Z", submissionData: [{ field: "email", value: "a@example.org" }, { field: "oldField", value: "kept" }] });
    expect(row).toContain("oldField: kept");
    expect(row.startsWith("2026-10-07T00:00:00.000Z,a@example.org,,,oldField: kept,,")).toBe(true);
  });
});

describe("file name and date range", () => {
  it("makes a safe file name from the form's title", () => {
    expect(exportFileName("Join the movement!", new Date("2026-10-07T12:00:00Z"))).toBe("join-the-movement-submissions-2026-10-07.csv");
    expect(exportFileName("../../etc/passwd\"", new Date("2026-10-07T12:00:00Z"))).toBe("etc-passwd-submissions-2026-10-07.csv");
    expect(exportFileName(undefined, new Date("2026-10-07T12:00:00Z"))).toBe("form-submissions-2026-10-07.csv");
  });

  it("turns dates into whole-day UTC bounds and refuses nonsense", () => {
    expect(dateRange("2026-10-01", "2026-10-07")).toEqual({ gte: "2026-10-01T00:00:00.000Z", lte: "2026-10-07T23:59:59.999Z" });
    expect(dateRange(null, null)).toEqual({});
    expect(typeof dateRange("yesterday", null)).toBe("string");
    expect(typeof dateRange("2026-10-09", "2026-10-01")).toBe("string");
    expect(typeof dateRange(null, "2026-13-45")).toBe("string");
  });
});
