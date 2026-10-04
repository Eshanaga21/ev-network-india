import { createPortal } from "react-dom";
import {
  CircleHelp,
  Download,
  LoaderCircle,
  TriangleAlert,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { exportData, format } from "./api";
import { useUI } from "./store";
export function Tag({
  kind = "calculated",
  children,
}: {
  kind?: "observed" | "calculated" | "modeled";
  children?: ReactNode;
}) {
  return (
    <span className={`tag ${kind}`}>
      <span />
      {children ||
        {
          observed: "Observed source data",
          calculated: "Calculated graph result",
          modeled: "Model estimate",
        }[kind]}
    </span>
  );
}
export function Explain({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="explain explain-button" onClick={() => setOpen(true)}>
        <CircleHelp size={13} /> How is this calculated?
      </button>
      {open && (
        <Modal title={title} onClose={() => setOpen(false)}>
          <div className="explain-content">{children}</div>
        </Modal>
      )}
    </>
  );
}
export function Viva({ children }: { children: ReactNode }) {
  const enabled = useUI((s) => s.settings.viva);
  return enabled ? (
    <div className="viva">
      <span>VIVA NOTE</span>
      <p>{children}</p>
    </div>
  ) : null;
}
export function Notice({
  children,
  error = false,
}: {
  children: ReactNode;
  error?: boolean;
}) {
  return (
    <div
      className={`notice ${error ? "error" : ""}`}
      role={error ? "alert" : undefined}
    >
      <TriangleAlert size={15} />
      <span>{children}</span>
    </div>
  );
}
export function Loading({
  text = "Calculating from the active dataset…",
}: {
  text?: string;
}) {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={20} />
      {text}
    </div>
  );
}
export function ExportButtons({
  name,
  data,
  audit,
}: {
  name: string;
  data: any;
  audit: any;
}) {
  return (
    <div className="exports">
      <button
        className="quiet"
        onClick={() => exportData(name, data, audit, "csv")}
      >
        <Download size={13} /> CSV
      </button>
      <button
        className="quiet"
        onClick={() => exportData(name, data, audit, "json")}
      >
        <Download size={13} /> JSON
      </button>
    </div>
  );
}
export function Num({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="input-unit">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        {unit && <small>{unit}</small>}
      </div>
    </label>
  );
}
export function Metric({
  label,
  value,
  unit,
  kind = "calculated",
}: {
  label: string;
  value: any;
  unit?: string;
  kind?: "observed" | "calculated" | "modeled";
}) {
  const [explaining, setExplaining] = useState(false);
  const explanations: Record<string, string> = {
    "Imported stations":
      "Count of validated real source records remaining after the current filters. Rejected records and duplicate IDs are excluded. This is an imported footprint, not a national census.",
    "Geographic edges":
      "Number of undirected Haversine proximity edges produced by the current radius or k-nearest-neighbor settings. No fallback edges are added. These edges are not roads.",
    Components:
      "NetworkX connected components: groups in which each station can reach every other through the modeled edges. Isolated nodes count as components. This does not establish real driving reachability.",
    "Largest component":
      "100 × number of stations in the largest connected component / number of filtered stations. Empty graphs have no percentage. The value depends on filters and graph construction.",
    "Articulation points":
      "NetworkX articulation points: stations whose removal increases connected-component count. This measures topological dependence, not real reliability.",
    Bridges:
      "NetworkX bridges: edges whose removal increases connected-component count. Edges are geographic model links, not physical roads.",
  };
  return (
    <div className="metric">
      <span>{label}</span>
      <button
        className="metric-help"
        aria-label={`How is ${label.toLowerCase()} calculated?`}
        onClick={() => setExplaining(true)}
      >
        <CircleHelp size={12} />
      </button>
      {explaining && (
        <Modal title={label} onClose={() => setExplaining(false)}>
          <div className="explain-content">
            {explanations[label] ||
              "Calculated from the current filtered station graph using NetworkX. See the current graph settings and analysis audit for inputs; graph results are geographic model calculations rather than real-world reliability or road navigation."}
          </div>
        </Modal>
      )}
      <strong>
        {typeof value === "number" ? format(value) : value}
        <small>{unit}</small>
      </strong>
      <Tag kind={kind} />
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const el = dialog.current;
    const focusable = () =>
      Array.from(
        el?.querySelectorAll<HTMLElement>(
          'button:not([disabled]),input:not([disabled]),select:not([disabled]),a[href],[tabindex="0"]',
        ) || [],
      );
    focusable()[0]?.focus();
    const handle = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        closeRef.current();
      }
      if (event.key === "Tab") {
        const items = focusable(),
          first = items[0],
          last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    el?.addEventListener("keydown", handle);
    return () => {
      el?.removeEventListener("keydown", handle);
      previous?.focus();
    };
  }, []);
  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="modal"
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <header>
          <h2>{title}</h2>
          <button
            className="icon-button"
            aria-label="Close panel"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>
        {children}
      </section>
    </div>,
    document.body,
  );
}
export function Table({
  rows,
  columns,
  onRow,
}: {
  rows: any[];
  columns: { key: string; label: string; render?: (r: any) => ReactNode }[];
  onRow?: (r: any) => void;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.station_id || row.candidate_id || i}>
              {columns.map((c) => (
                <td key={c.key}>
                  {c.render ? (
                    c.render(row)
                  ) : c.key === "station_name" && onRow ? (
                    <button className="table-link" onClick={() => onRow(row)}>
                      {row[c.key]}
                    </button>
                  ) : typeof row[c.key] === "number" ? (
                    format(
                      row[c.key],
                      /centrality|pagerank/.test(c.key)
                        ? 6
                        : /latitude|longitude/.test(c.key)
                          ? 6
                          : 2,
                    )
                  ) : (
                    String(row[c.key] ?? "Not provided")
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && (
        <p className="muted empty-table">
          No results for the current data and filters.
        </p>
      )}
    </div>
  );
}
