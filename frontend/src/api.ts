export async function request<T = any>(
  path: string,
  body?: unknown,
  method = body === undefined ? "GET" : "POST",
): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    method,
    headers:
      body instanceof FormData
        ? undefined
        : { "Content-Type": "application/json" },
    body:
      body === undefined
        ? undefined
        : body instanceof FormData
          ? body
          : JSON.stringify(body),
  });
  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: response.statusText }));
    throw new Error(
      typeof error.detail === "string"
        ? error.detail
        : Array.isArray(error.detail)
          ? error.detail
              .map((e: any) => `${e.loc.slice(1).join(".")}: ${e.msg}`)
              .join("; ")
          : "The request failed.",
    );
  }
  return response.json();
}
export function download(
  name: string,
  content: string,
  type = "application/json",
) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function csvCell(value: unknown): string {
  const raw =
    value == null
      ? ""
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);
  const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
}
export function exportData(
  name: string,
  records: any,
  audit: any,
  format: "json" | "csv",
) {
  if (format === "json")
    return download(
      `${name}.json`,
      JSON.stringify({ audit, results: records }, null, 2),
    );
  const rows = Array.isArray(records) ? records : [records];
  const keys = [
    ...new Set(rows.flatMap((row: any) => Object.keys(row))),
    "_analysis_audit",
  ];
  download(
    `${name}.csv`,
    [
      keys.map(csvCell).join(","),
      ...rows.map((row: any) =>
        keys
          .map((key) => csvCell(key === "_analysis_audit" ? audit : row[key]))
          .join(","),
      ),
    ].join("\n"),
    "text/csv",
  );
}
export const format = (value: unknown, digits = 1) =>
  typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString("en-IN", { maximumFractionDigits: digits })
    : "—";
