import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ChevronDown,
  CarFront,
  Plus,
  Star,
  Trash2,
} from "lucide-react";
import { Modal, Notice } from "./shared";
import { format } from "./api";
import {
  CONNECTORS,
  customError,
  planningDefaults,
  preferencesError,
  remainingRange,
  specFor,
  type CustomEV,
  type EVSpec,
  type Garage,
  type Preferences,
  type SavedEV,
} from "./vehicles";

export function VehicleArt() {
  return (
    <svg
      viewBox="0 0 240 112"
      className="ev-art"
      role="img"
      aria-label="Neutral EV illustration, original artwork by EV Network"
    >
      <ellipse cx="120" cy="96" rx="100" ry="7" fill="#101b21" />
      <path
        d="M27 76 40 58 73 52 99 27h63l32 27 27 8 6 22H24Z"
        fill="#68c4b5"
        stroke="#b2e6de"
        strokeWidth="2"
      />
      <path d="m83 51 23-19h21v19Zm52-19h23l24 19h-47Z" fill="#18313d" />
      <path
        d="M34 68h18M204 66h13M70 63h14M144 63h14"
        stroke="#eefbf7"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle
        cx="66"
        cy="84"
        r="16"
        fill="#17242e"
        stroke="#93b1b4"
        strokeWidth="3"
      />
      <circle
        cx="185"
        cy="84"
        r="16"
        fill="#17242e"
        stroke="#93b1b4"
        strokeWidth="3"
      />
      <circle cx="66" cy="84" r="7" fill="#b9cbd0" />
      <circle cx="185" cy="84" r="7" fill="#b9cbd0" />
    </svg>
  );
}
export function VehicleSummary({
  spec,
  preferences,
  onChange,
}: {
  spec: EVSpec;
  preferences: Preferences;
  onChange?: () => void;
}) {
  return (
    <div className="ev-summary">
      <div className="ev-summary-main">
        <VehicleArt />
        <div>
          <small>{spec.manufacturer}</small>
          <strong>{spec.model}</strong>
          <span>{spec.variant}</span>
          <small>
            {spec.battery_capacity_kwh} kWh · {spec.connector_types.join(" / ")}
          </small>
        </div>
        {onChange && (
          <button aria-label="Change vehicle" onClick={onChange}>
            <ChevronDown size={18} />
          </button>
        )}
      </div>
      <div className="ev-range">
        <span>
          <strong>{format(remainingRange(spec, preferences), 0)} km</strong>{" "}
          Estimated to reserve
        </span>
        <small>
          {spec.certified_range_km
            ? `${spec.certified_range_km} km certified · ${spec.range_standard}`
            : "Certified range unavailable for custom profiles"}
        </small>
        <small>
          {spec.edition}
          {spec.source && (
            <>
              {" "}
              ·{" "}
              <a
                href={spec.source.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Manufacturer source
              </a>
            </>
          )}
        </small>
      </div>
    </div>
  );
}
export default function VehicleSelector({
  catalog,
  garage,
  onSave,
  onSelect,
  onDefault,
  onRemove,
  onClose,
  error,
  loading,
}: {
  catalog: EVSpec[];
  garage: Garage;
  onSave: (v: SavedEV) => void;
  onSelect: (id: string) => void;
  onDefault: (id: string) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
  error?: string;
  loading: boolean;
}) {
  const [tab, setTab] = useState<"catalog" | "custom">("catalog");
  const [query, setQuery] = useState("");
  const [maker, setMaker] = useState("");
  const [model, setModel] = useState("");
  const [variant, setVariant] = useState("");
  const [step, setStep] = useState(1);
  const selectorRef = useRef<HTMLDivElement>(null);
  const validationRef = useRef<HTMLDivElement>(null);
  const [prefs, setPrefs] = useState<Preferences>({ ...planningDefaults });
  const [validation, setValidation] = useState("");
  useEffect(() => {
    selectorRef.current?.closest(".modal")?.scrollTo({ top: 0 });
  }, [step]);
  useEffect(() => {
    if (validation) validationRef.current?.scrollIntoView({ block: "nearest" });
  }, [validation]);
  const [custom, setCustom] = useState({
    name: "",
    capacity: "",
    ac: "",
    dc: "",
    connectors: [] as string[],
  });
  const filtered = catalog.filter((v) =>
    `${v.manufacturer} ${v.model} ${v.variant} ${v.battery_capacity_kwh}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const selected = catalog.find((v) => v.id === variant);
  const customSpec: CustomEV = {
    name: custom.name.trim(),
    battery_capacity_kwh: custom.capacity.trim()
      ? Number(custom.capacity)
      : NaN,
    connector_types: custom.connectors,
    max_ac_charge_kw: custom.ac.trim() ? Number(custom.ac) : null,
    max_dc_charge_kw: custom.dc.trim() ? Number(custom.dc) : null,
  };
  const candidate: SavedEV = {
    id: tab === "catalog" ? variant : "custom-preview",
    ...(tab === "catalog" ? { catalog_id: variant } : { custom: customSpec }),
    preferences: prefs,
  };
  const spec = specFor(candidate, catalog);
  const selectStep = () => {
    const err =
      tab === "custom"
        ? customError(customSpec)
        : !selected
          ? "Select a manufacturer, model and variant."
          : null;
    setValidation(err || "");
    if (!err) setStep(2);
  };
  const save = () => {
    const err = preferencesError(prefs);
    setValidation(err || "");
    if (!err && spec) {
      onSave({
        ...candidate,
        id: tab === "custom" ? `custom-${crypto.randomUUID()}` : variant,
        preferences: { ...prefs, capacity_kwh: spec.battery_capacity_kwh },
      });
      onClose();
    }
  };
  return (
    <Modal title="Select your EV" onClose={onClose}>
      <div className="ev-selector" ref={selectorRef}>
        <p className="ev-selector-lead">
          A plan that fits your car.
          <small>
            Select your exact battery edition, then set your starting charge.
          </small>
        </p>
        {step === 1 && !!garage.vehicles.length && (
          <details className="ev-garage" open>
            <summary>
              <CarFront size={17} /> Your saved vehicles{" "}
              <span>{garage.vehicles.length}</span>
            </summary>
            {garage.vehicles.map((v) => {
              const s = specFor(v, catalog);
              return (
                <div className="ev-saved" key={v.id}>
                  <button
                    disabled={!s}
                    onClick={() => {
                      onSelect(v.id);
                      onClose();
                    }}
                  >
                    <strong>
                      {s
                        ? `${s.manufacturer} ${s.model}`
                        : "Catalogue edition unavailable"}
                    </strong>
                    <small>
                      {s?.variant} {s ? `· ${s.battery_capacity_kwh} kWh` : ""}
                      {garage.defaultId === v.id ? " · Default" : ""}
                    </small>
                  </button>
                  <button
                    onClick={() => onDefault(v.id)}
                    disabled={!s || garage.defaultId === v.id}
                    aria-label={`Make ${s?.model} ${s?.variant} default`}
                  >
                    <Star size={15} />
                  </button>
                  <button
                    onClick={() => onRemove(v.id)}
                    aria-label={`Remove ${s?.model || "vehicle"} ${s?.variant || ""}`}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              );
            })}
          </details>
        )}
        <div className="ev-steps">
          <span className={step === 1 ? "active" : ""}>1 · Choose vehicle</span>
          <span className={step === 2 ? "active" : ""}>
            2 · Confirm & personalise
          </span>
        </div>
        {step === 1 ? (
          <>
            <div className="finder-tabs">
              <button
                className={tab === "catalog" ? "active" : ""}
                onClick={() => {
                  setTab("catalog");
                  setValidation("");
                }}
              >
                Manufacturer catalogue
              </button>
              <button
                className={tab === "custom" ? "active" : ""}
                onClick={() => {
                  setTab("custom");
                  setValidation("");
                }}
              >
                <Plus size={14} /> Custom EV
              </button>
            </div>
            {tab === "catalog" ? (
              <>
                {loading && (
                  <p role="status">Loading verified specifications…</p>
                )}
                {error && (
                  <Notice error>
                    {error} You can still create a custom EV.
                  </Notice>
                )}
                <label className="ev-field">
                  Search manufacturers, models or variants
                  <input
                    type="search"
                    placeholder="Try MG, Tiago or 52.9"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setMaker("");
                      setModel("");
                      setVariant("");
                    }}
                  />
                </label>
                <div className="ev-selection-fields">
                  <label className="ev-field">
                    Manufacturer
                    <select
                      aria-label="Manufacturer"
                      value={maker}
                      onChange={(e) => {
                        setMaker(e.target.value);
                        setModel("");
                        setVariant("");
                      }}
                    >
                      <option value="">Choose manufacturer</option>
                      {[...new Set(filtered.map((v) => v.manufacturer))].map(
                        (m) => (
                          <option key={m}>{m}</option>
                        ),
                      )}
                    </select>
                  </label>
                  <label className="ev-field">
                    Model
                    <select
                      aria-label="Model"
                      disabled={!maker}
                      value={model}
                      onChange={(e) => {
                        setModel(e.target.value);
                        setVariant("");
                      }}
                    >
                      <option value="">Choose model</option>
                      {[
                        ...new Set(
                          filtered
                            .filter((v) => v.manufacturer === maker)
                            .map((v) => v.model),
                        ),
                      ].map((m) => (
                        <option key={m}>{m}</option>
                      ))}
                    </select>
                  </label>
                  <label className="ev-field">
                    Variant & battery
                    <select
                      aria-label="Variant & battery"
                      disabled={!model}
                      value={variant}
                      onChange={(e) => setVariant(e.target.value)}
                    >
                      <option value="">Choose variant</option>
                      {filtered
                        .filter(
                          (v) => v.manufacturer === maker && v.model === model,
                        )
                        .map((v) => (
                          <option value={v.id} key={v.id}>
                            {v.variant} · {v.battery_capacity_kwh} kWh
                          </option>
                        ))}
                    </select>
                  </label>
                </div>
                {!filtered.length && !loading && (
                  <p>
                    No matching editions. Clear your search or use a custom EV.
                  </p>
                )}
                <small className="ev-edition-note">
                  Verified 2025 brochure editions. Newer versions can differ;
                  check your own vehicle documentation.
                </small>
              </>
            ) : (
              <>
                <label className="ev-field">
                  Vehicle name
                  <input
                    maxLength={80}
                    value={custom.name}
                    onChange={(e) =>
                      setCustom({ ...custom, name: e.target.value })
                    }
                    placeholder="My EV"
                  />
                </label>
                <div className="ev-form-grid">
                  {[
                    ["capacity", "Battery capacity (kWh)"],
                    ["ac", "Maximum AC charging (kW)"],
                    ["dc", "Maximum DC charging (kW)"],
                  ].map(([key, label]) => (
                    <label key={key} className="ev-field">
                      {label}
                      <input
                        type="number"
                        min="0.01"
                        max={key === "capacity" ? 500 : 1000}
                        step="any"
                        placeholder={
                          key === "capacity"
                            ? "From your vehicle manual"
                            : "Leave blank if unknown"
                        }
                        value={custom[key as "capacity" | "ac" | "dc"]}
                        onChange={(e) =>
                          setCustom({ ...custom, [key]: e.target.value })
                        }
                      />
                    </label>
                  ))}
                </div>
                <p className="ev-hint">
                  kWh is stored energy. kW is charging power. Enter the car’s
                  AC/DC input limits, not the rating of your wall charger. Blank
                  limits stay unknown.
                </p>
                <fieldset className="ev-connectors">
                  <legend>Supported connector types</legend>
                  {CONNECTORS.map((c) => (
                    <label key={c}>
                      <input
                        type="checkbox"
                        checked={custom.connectors.includes(c)}
                        onChange={(e) =>
                          setCustom({
                            ...custom,
                            connectors: e.target.checked
                              ? [...custom.connectors, c]
                              : custom.connectors.filter((x) => x !== c),
                          })
                        }
                      />
                      {c}
                    </label>
                  ))}
                </fieldset>
                <p className="ev-hint">
                  List all connectors your vehicle accepts without an adapter.
                  CCS2 is a common DC connector; Type2 is AC. Use your manual to
                  confirm.
                </p>
              </>
            )}
            {selected && tab === "catalog" && (
              <VehicleSummary spec={selected} preferences={prefs} />
            )}
            <button className="finder-primary" onClick={selectStep}>
              Confirm vehicle <ArrowRight size={17} />
            </button>
          </>
        ) : (
          <>
            {spec && (
              <>
                <VehicleSummary spec={spec} preferences={prefs} />
                <p className="ev-edition-note">
                  {spec.edition} ·{" "}
                  {spec.source
                    ? `Verified ${spec.verified_on}`
                    : "Owner-entered, unverified specifications"}
                </p>
                <div className="ev-form-grid">
                  {[
                    ["initial_soc", "Current battery (%)", 0, 100],
                    ["reserve_soc", "Minimum arrival reserve (%)", 0, 99],
                    [
                      "consumption_kwh_100km",
                      "Consumption (kWh/100 km)",
                      0.1,
                      100,
                    ],
                  ].map(([key, label, min, max]) => (
                    <label className="ev-field" key={key}>
                      <span>{label}</span>
                      <input
                        type="number"
                        step="any"
                        min={min}
                        max={max}
                        value={
                          Number.isFinite(prefs[key as keyof Preferences])
                            ? prefs[key as keyof Preferences]
                            : ""
                        }
                        onChange={(e) =>
                          setPrefs({
                            ...prefs,
                            [key]:
                              e.target.value === ""
                                ? NaN
                                : Number(e.target.value),
                          })
                        }
                      />
                    </label>
                  ))}
                </div>
                <p className="ev-hint">
                  Consumption means energy used over 100 km. The starting value
                  of 16 is a planning assumption, not a manufacturer
                  specification. Adjust for speed, AC, load and your driving
                  history. Reserve is the battery you want left at arrival.
                </p>
                <p className="ev-hint">
                  Estimated range uses published pack capacity as a proxy
                  because usable capacity is unspecified. Battery age, weather
                  and road conditions can reduce it. Certified range comes from
                  controlled testing and is not guaranteed trip range.
                </p>
                <details className="ev-source">
                  <summary>Specifications & source</summary>
                  <p>
                    AC vehicle limit: {spec.max_ac_charge_kw ?? "Unknown"}
                    {spec.max_ac_charge_kw ? " kW" : ""} · DC vehicle limit:{" "}
                    {spec.max_dc_charge_kw ?? "Unknown"}
                    {spec.max_dc_charge_kw ? " kW" : ""}
                  </p>
                  <p>
                    {spec.charging_reference ||
                      "No manufacturer charging reference supplied."}
                  </p>
                  <p>
                    No full charging curve documented for this edition.
                    Reference windows are not extrapolated to a full session.
                  </p>
                  {spec.source && (
                    <a
                      href={spec.source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {spec.source.title}
                    </a>
                  )}
                  <p>{spec.notes}</p>
                  <small>
                    Neutral EV illustration · original artwork by EV Network.
                  </small>
                </details>
                <button className="finder-primary" onClick={save}>
                  Save & continue <ArrowRight size={17} />
                </button>
                <button
                  className="finder-clear-trip"
                  onClick={() => {
                    setStep(1);
                    setValidation("");
                  }}
                >
                  Back to vehicle choice
                </button>
              </>
            )}
          </>
        )}
        {validation && (
          <div ref={validationRef}>
            <Notice error>{validation}</Notice>
          </div>
        )}
        <small className="ev-privacy">
          Saved on this browser only. Use Your saved vehicles to switch, set a
          default or remove a vehicle.
        </small>
      </div>
    </Modal>
  );
}
