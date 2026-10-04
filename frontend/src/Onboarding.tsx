import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Check,
  Database,
  FileJson,
  Fingerprint,
  Globe2,
  Link,
  RefreshCw,
  ShieldCheck,
  Upload,
  Zap,
} from "lucide-react";
import { request } from "./api";
import { ExportButtons, Loading, Notice, Table } from "./shared";
const fields = [
  "station_id",
  "station_name",
  "latitude",
  "longitude",
  "city",
  "state",
  "country",
  "operator",
  "status",
  "availability",
  "connector_type",
  "num_chargers",
  "charging_power_kw",
  "address",
  "source_type",
];
export default function Onboarding() {
  const cache = useQueryClient(),
    input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null),
    [preview, setPreview] = useState<any>(null),
    [mapping, setMapping] = useState<Record<string, string>>({}),
    [drag, setDrag] = useState(false),
    [sourceName, setSourceName] = useState("User upload"),
    [sourceUrl, setSourceUrl] = useState(""),
    [deriveIds, setDeriveIds] = useState(false);
  const validate = useMutation({
    mutationFn: async ({
      selected,
      columns,
      derive = deriveIds,
    }: {
      selected: File;
      columns?: Record<string, string>;
      derive?: boolean;
    }) => {
      const body = new FormData();
      body.append("file", selected);
      body.append("mapping", JSON.stringify(columns || {}));
      body.append("source_name", sourceName);
      body.append("generate_missing_ids", String(derive));
      if (sourceUrl) body.append("source_url", sourceUrl);
      return request("import/preview", body);
    },
    onSuccess: (data) => {
      setPreview(data);
      setMapping(
        Object.fromEntries(
          Object.entries(data.metadata.mapping).map(([k, v]) => [k, v || ""]),
        ) as Record<string, string>,
      );
    },
  });
  const refresh = useMutation({
    mutationFn: () => request("import/refresh", {}),
    onSuccess: (data) => {
      setFile(null);
      setPreview(data);
      setMapping(
        Object.fromEntries(
          Object.entries(data.metadata.mapping).map(([k, v]) => [k, v || ""]),
        ) as Record<string, string>,
      );
    },
  });
  const commit = useMutation({
    mutationFn: () =>
      request("import/commit", { preview_id: preview.preview_id }),
    onSuccess: () => cache.invalidateQueries(),
  });
  const choose = (selected: File) => {
    setFile(selected);
    setPreview(null);
    validate.mutate({ selected });
  };
  const error = validate.error || refresh.error || commit.error;
  return (
    <div className="onboarding">
      <header className="onboard-header">
        <div className="brand">
          <div className="brand-icon">
            <Zap size={23} />
          </div>
          <div>
            EV NETWORK <span>INTELLIGENCE / INDIA</span>
          </div>
        </div>
        <span className="local-badge">
          <i /> LOCAL ANALYSIS WORKSPACE
        </span>
      </header>
      <main className="onboard-main">
        <div className="onboard-story">
          <div className="eyebrow">
            <span /> INFRASTRUCTURE, UNDERSTOOD.
          </div>
          <h1>
            A clearer view of
            <br />
            India's charging
            <br />
            <em>network.</em>
          </h1>
          <p>
            Turn real station records into explainable network intelligence.
            Explore connectivity, plan modeled trips, and find geographic gaps.
          </p>
          <div className="integrity-line">
            <ShieldCheck size={20} />
            <div>
              <strong>Real data. Transparent models.</strong>
              <span>No demo stations. No invented availability.</span>
            </div>
          </div>
          <div className="onboard-steps">
            <div>
              <span>01</span>
              <p>
                Load & validate<small>Your source, preserved.</small>
              </p>
            </div>
            <div>
              <span>02</span>
              <p>
                Build the graph<small>Geography, made explicit.</small>
              </p>
            </div>
            <div>
              <span>03</span>
              <p>
                Explore & explain<small>Every result, reproducible.</small>
              </p>
            </div>
          </div>
          <div className="onboard-note">
            <Fingerprint size={16} /> Immutable snapshots · Local storage ·
            Source-aware analysis
          </div>
        </div>
        <section className="import-card">
          <div className="card-kicker">
            <Database size={16} /> START WITH A VERIFIED SOURCE
          </div>
          <h2>Load Indian EV Station Data</h2>
          <p className="muted">
            Upload your CSV or JSON. Review the mapping and validation report
            before loading a snapshot.
          </p>
          <div
            className={`dropzone ${drag ? "drag" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              const selected = e.dataTransfer.files[0];
              if (selected) choose(selected);
            }}
          >
            <div className="upload-symbol">
              <Upload size={28} />
            </div>
            <strong>
              {file ? file.name : "Drop your station dataset here"}
            </strong>
            <span>CSV or JSON · up to 15 MB / 2,000 records</span>
            <button className="primary" onClick={() => input.current?.click()}>
              Choose a file <ArrowRight size={15} />
            </button>
            <input
              ref={input}
              type="file"
              accept=".csv,.json"
              hidden
              onChange={(e) => {
                if (e.target.files?.[0]) choose(e.target.files[0]);
              }}
            />
          </div>
          <div className="source-inputs">
            <label className="field">
              <span>Source name</span>
              <input
                value={sourceName}
                onChange={(e) => {
                  setSourceName(e.target.value);
                  setPreview(null);
                }}
                placeholder="Publisher or collection name"
              />
            </label>
            <label className="field">
              <span>Source URL (optional)</span>
              <input
                value={sourceUrl}
                onChange={(e) => {
                  setSourceUrl(e.target.value);
                  setPreview(null);
                }}
                placeholder="https://…"
              />
            </label>
          </div>
          <label className="field">
            <span>
              <input
                type="checkbox"
                checked={deriveIds}
                onChange={(e) => {
                  const derive = e.target.checked;
                  setDeriveIds(derive);
                  setPreview(null);
                  if (file)
                    validate.mutate({
                      selected: file,
                      columns: mapping,
                      derive,
                    });
                }}
              />{" "}
              Create internal record IDs when source IDs are missing
            </span>
            <small>
              Derived from source-row hashes. These are not publisher-issued
              station IDs. Exact repeated rows are removed.
            </small>
          </label>
          <div className="import-links">
            <a href="/api/schema" download>
              <FileJson size={15} /> Download empty schema
            </a>
            <button
              className="quiet"
              disabled={refresh.isPending}
              onClick={() => {
                setPreview(null);
                refresh.mutate();
              }}
            >
              <RefreshCw size={15} /> Refresh E-Amrit
            </button>
          </div>
          <div className="source-disclaimer">
            <Globe2 size={16} />
            <p>
              E-Amrit / NITI Aayog is an optional public source. A failed
              refresh leaves the workspace empty.{" "}
              <a
                href="https://e-amrit.niti.gov.in/getChargingStation"
                target="_blank"
                rel="noreferrer"
              >
                <Link size={11} /> Source endpoint
              </a>
            </p>
          </div>
          {(validate.isPending || refresh.isPending || commit.isPending) && (
            <Loading
              text={
                refresh.isPending
                  ? "Contacting the real E-Amrit source…"
                  : "Validating source records…"
              }
            />
          )}{" "}
          {error && <Notice error>{error.message}</Notice>}
          {preview && (
            <div className="validation">
              <div className="section-title">
                <h3>Review before import</h3>
                <span className="tag observed">Source observations</span>
              </div>
              {!!preview.metadata.derived_id_records && (
                <Notice>
                  {preview.metadata.derived_id_records} internal record keys are
                  derived from source rows; publisher station IDs were not
                  provided. Raw type codes are preserved without interpretation.
                </Notice>
              )}
              <div className="audit-counts">
                <div>
                  <strong>{preview.metadata.raw_records}</strong>
                  <span>Raw records</span>
                </div>
                <div>
                  <strong>{preview.metadata.valid_records}</strong>
                  <span>Valid stations</span>
                </div>
                <div>
                  <strong>{preview.metadata.rejected_records}</strong>
                  <span>Rejected</span>
                </div>
                <div>
                  <strong>{preview.metadata.duplicate_ids_removed}</strong>
                  <span>Repeated records</span>
                </div>
              </div>
              <details open>
                <summary>Column mapping</summary>
                <div className="mapping-grid">
                  {fields.map((field) => (
                    <label className="field" key={field}>
                      <span>{field}</span>
                      <select
                        disabled={!file}
                        value={mapping[field] || ""}
                        onChange={(e) => {
                          const updated = {
                            ...mapping,
                            [field]: e.target.value,
                          };
                          setMapping(updated);
                          setPreview(null);
                          if (file)
                            validate.mutate({
                              selected: file,
                              columns: updated,
                            });
                        }}
                      >
                        <option value="">Not provided</option>
                        {preview.metadata.columns.map((column: string) => (
                          <option key={column}>{column}</option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              </details>
              <details>
                <summary>Raw record preview</summary>
                <Table
                  rows={preview.preview}
                  columns={preview.metadata.columns.map((key: string) => ({
                    key,
                    label: key,
                  }))}
                />
              </details>
              <details>
                <summary>Missing fields & rejection audit</summary>
                <Table
                  rows={fields.map((field) => ({
                    field,
                    missing: preview.metadata.missing_fields[field],
                  }))}
                  columns={[
                    { key: "field", label: "Field" },
                    { key: "missing", label: "Missing in valid records" },
                  ]}
                />
                <Table
                  rows={[
                    ...preview.metadata.rejections,
                    ...preview.metadata.duplicates,
                    ...preview.metadata.warnings,
                  ]}
                  columns={[
                    { key: "row", label: "Source row" },
                    { key: "reason", label: "Reason" },
                  ]}
                />
              </details>
              <ExportButtons
                name="validation-audit"
                data={preview.metadata}
                audit={preview.metadata}
              />
              <Notice>
                Coordinates are range-checked against an India geographic
                envelope; this does not verify the physical station or the
                national boundary. Missing source fields remain null.
              </Notice>
              <button
                className="primary full"
                disabled={!preview.metadata.valid_records || commit.isPending}
                onClick={() => commit.mutate()}
              >
                <Check size={16} /> Import {preview.metadata.valid_records}{" "}
                validated stations
              </button>
            </div>
          )}
        </section>
      </main>
      <footer className="onboard-footer">
        <span>GRAPH THEORY + DATA SCIENCE + GEOSPATIAL ANALYTICS</span>
        <span>Observed data · Calculated results · Model estimates</span>
      </footer>
    </div>
  );
}
