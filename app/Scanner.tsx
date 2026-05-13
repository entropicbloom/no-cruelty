"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { IdentifyResult, LookupMatch } from "@/lib/types";

type Mode = "camera" | "manual";


interface Catalog {
  productTypes: Record<string, { de: string; en: string; sources: string[] }>;
  labelsByProductType: Record<string, { label: string; tier: string; sourceId: string }[]>;
  sources: { id: string; name: string; url: string; region: string }[];
}

const PRODUCT_ICONS: Record<string, string> = {
  beef: "🐄",
  veal: "🐂",
  pork: "🐖",
  chicken: "🐓",
  eggs: "🥚",
  milk: "🥛",
  salmon: "🐟",
  tuna: "🐟",
  trout: "🐟",
  shrimp: "🦐",
};

export default function Scanner() {
  const [mode, setMode] = useState<Mode>("camera");
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<IdentifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetch("/api/catalog")
      .then((r) => r.json())
      .then(setCatalog)
      .catch(() => setError("Katalog konnte nicht geladen werden."));
  }, []);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const dataUrl = await fileToDataUrl(file);
      const resized = await resizeImage(dataUrl, 1280);
      setPreview(resized);
      const res = await fetch("/api/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: resized }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Fehler bei der Analyse");
      setResult(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function manualLookup(productType: string, label: string) {
    setBusy(true);
    setError(null);
    setResult(null);
    setPreview(null);
    try {
      const res = await fetch("/api/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productType, label }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Fehler");
      setResult(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <ModeToggle mode={mode} setMode={(m) => { setMode(m); setResult(null); setError(null); setPreview(null); }} />

      {mode === "camera" ? (
        <CameraPanel
          busy={busy}
          preview={preview}
          onPick={() => fileRef.current?.click()}
          onRetake={() => { setPreview(null); setResult(null); }}
        />
      ) : (
        <ManualPanel catalog={catalog} onPick={manualLookup} busy={busy} />
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = "";
        }}
      />

      {busy && <Loading mode={mode} />}
      {error && <ErrorPanel message={error} />}
      {result && <ResultPanel result={result} onUpdate={setResult} />}
    </div>
  );
}

function ResearchPanel({
  productType,
  label,
  onResult,
}: {
  productType: string;
  label: string;
  onResult: (r: IdentifyResult) => void;
}) {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setState("loading");
    setErr(null);
    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productType, label }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Recherche fehlgeschlagen");
      onResult(json as IdentifyResult);
      setState("idle");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setState("error");
    }
  }

  if (state === "loading") {
    return (
      <div className="rounded-2xl border border-line bg-white p-4 text-[13px] text-muted">
        Tiefenrecherche läuft… kann bis zu einer Minute dauern.
      </div>
    );
  }
  if (state === "error") {
    return (
      <div className="flex flex-col gap-2">
        <ErrorPanel message={err ?? "Fehler"} />
        <button onClick={run} className="rounded-full border border-line bg-white py-2.5 text-[13px] text-ink">
          Erneut versuchen
        </button>
      </div>
    );
  }
  return (
    <button
      onClick={run}
      className="rounded-full border border-line bg-white py-2.5 text-[13px] text-ink"
    >
      KI-Tiefenrecherche starten · Ergebnis wird für alle gespeichert
    </button>
  );
}

function ModeToggle({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  return (
    <div className="grid grid-cols-2 rounded-full border border-line bg-white p-1 text-[13px] font-medium">
      {(["camera", "manual"] as Mode[]).map((m) => (
        <button
          key={m}
          onClick={() => setMode(m)}
          className={`rounded-full py-2 transition-colors ${
            mode === m ? "bg-ink text-paper" : "text-muted hover:text-ink"
          }`}
        >
          {m === "camera" ? "Foto" : "Manuell"}
        </button>
      ))}
    </div>
  );
}

function CameraPanel({
  busy,
  preview,
  onPick,
  onRetake,
}: {
  busy: boolean;
  preview: string | null;
  onPick: () => void;
  onRetake: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {preview ? (
        <div className="overflow-hidden rounded-2xl border border-line bg-white">
          {}
          <img src={preview} alt="" className="aspect-[4/3] w-full object-cover" />
        </div>
      ) : (
        <div className="flex aspect-[4/3] items-center justify-center rounded-2xl border border-dashed border-line bg-white text-[13px] text-muted">
          Tipp: Label und Produktname gut sichtbar fotografieren.
        </div>
      )}
      <div className="flex gap-2">
        <button
          onClick={onPick}
          disabled={busy}
          className="flex-1 rounded-full bg-ink py-3 text-[15px] font-medium text-paper transition-opacity disabled:opacity-40"
        >
          {preview ? "Neues Foto" : "Foto aufnehmen"}
        </button>
        {preview && (
          <button
            onClick={onRetake}
            className="rounded-full border border-line bg-white px-4 text-[13px] text-muted"
          >
            Zurücksetzen
          </button>
        )}
      </div>
      <p className="text-[11px] leading-relaxed text-muted">
        Hinweis: Die Foto-Erkennung kann sich irren. Bei Zweifel auf «Manuell»
        wechseln.
      </p>
    </div>
  );
}

function ManualPanel({
  catalog,
  onPick,
  busy,
}: {
  catalog: Catalog | null;
  onPick: (productType: string, label: string) => void;
  busy: boolean;
}) {
  const [productType, setProductType] = useState<string | null>(null);
  const labels = useMemo(() => {
    if (!catalog || !productType) return [];
    const list = catalog.labelsByProductType[productType] ?? [];
    return [...list].sort((a, b) => a.label.localeCompare(b.label));
  }, [catalog, productType]);

  if (!catalog) {
    return <div className="rounded-2xl border border-line bg-white p-6 text-[13px] text-muted">Lade…</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
          1. Produkt
        </div>
        <div className="grid grid-cols-3 gap-2">
          {Object.entries(catalog.productTypes).map(([key, names]) => (
            <button
              key={key}
              onClick={() => setProductType(key)}
              className={`flex flex-col items-center gap-1 rounded-2xl border bg-white py-3 transition-colors ${
                productType === key ? "border-ink" : "border-line"
              }`}
            >
              <span className="text-2xl">{PRODUCT_ICONS[key] ?? "•"}</span>
              <span className="text-[12px] text-ink">{names.de}</span>
            </button>
          ))}
        </div>
      </div>

      {productType && (
        <div>
          <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
            2. Label oder Marke
          </div>
          <div className="grid grid-cols-2 gap-2">
            {labels.map(({ label, tier }) => (
              <button
                key={label}
                disabled={busy}
                onClick={() => onPick(productType, label)}
                className="flex items-center justify-between gap-2 rounded-xl border border-line bg-white px-3 py-2.5 text-left text-[13px] text-ink transition-colors hover:border-ink disabled:opacity-50"
              >
                <span className="truncate">{label}</span>
                <TierDot tier={tier} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TierDot({ tier }: { tier: string }) {
  const color =
    tier === "TOP" || tier === "EXCELLENT"
      ? "bg-top"
      : tier === "OK" || tier === "GOOD"
      ? "bg-ok"
      : tier === "UNCOOL" || tier === "POOR"
      ? "bg-uncool"
      : "bg-nogo";
  return <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${color}`} aria-hidden />;
}

function Loading({ mode }: { mode: Mode }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4 text-[13px] text-muted">
      {mode === "camera" ? "Bild wird analysiert…" : "Nachschlagen…"}
    </div>
  );
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4 text-[13px] text-nogo">
      {message}
    </div>
  );
}

function ResultPanel({
  result,
  onUpdate,
}: {
  result: IdentifyResult;
  onUpdate: (r: IdentifyResult) => void;
}) {
  if (result.matches.length === 0) {
    const labelGuess = result.detectedLabels[0];
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-5">
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
            Kein Treffer in den Datenquellen
          </div>
          <div className="text-[15px] text-ink">
            {result.productTypeDe
              ? `Erkannt als ${result.productTypeDe}, aber keine Label-Bewertung gefunden.`
              : "Kein tierisches Produkt erkannt, oder die Quellen decken es nicht ab."}
          </div>
          {result.detectedLabels.length > 0 && (
            <div className="text-[12px] text-muted">
              Erkannte Hinweise: {result.detectedLabels.join(", ")}
            </div>
          )}
          {result.notes && <div className="text-[12px] text-muted">{result.notes}</div>}
        </div>
        {/* KI-Tiefenrecherche temporär deaktiviert.
            Re-enable by uncommenting:
        {result.productType && labelGuess && (
          <ResearchPanel productType={result.productType} label={labelGuess} onResult={onUpdate} />
        )} */}
      </div>
    );
  }

  const [primary, ...others] = result.matches;
  return (
    <div className="flex flex-col gap-3">
      <MatchCard match={primary} primary productTypeDe={result.productTypeDe} />
      {others.length > 0 && (
        <details className="rounded-2xl border border-line bg-white p-4 text-[13px] text-muted">
          <summary className="cursor-pointer text-ink">
            {others.length === 1
              ? "1 weiterer Treffer"
              : `${others.length} weitere Treffer`}
          </summary>
          <div className="mt-3 flex flex-col gap-2">
            {others.map((m, i) => (
              <MatchCard key={i} match={m} productTypeDe={result.productTypeDe} compact />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function MatchCard({
  match,
  primary,
  compact,
  productTypeDe,
}: {
  match: LookupMatch;
  primary?: boolean;
  compact?: boolean;
  productTypeDe: string | null;
}) {
  const tierBg =
    match.tier.color === "green"
      ? "bg-top"
      : match.tier.color === "yellow"
      ? "bg-ok"
      : match.tier.color === "orange"
      ? "bg-uncool"
      : "bg-nogo";
  const steps = match.entry.metrics?.steps;
  return (
    <div
      className={`overflow-hidden rounded-2xl border border-line bg-white ${
        compact ? "" : "shadow-[0_1px_0_rgba(0,0,0,0.02)]"
      }`}
    >
      <div className={`${tierBg} px-5 py-4 text-paper`}>
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] opacity-80">
            {productTypeDe ?? match.entry.productType}
          </div>
          {match.source.aiGenerated && (
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.14em]">
              KI-Recherche
            </span>
          )}
        </div>
        <div className={`mt-0.5 font-semibold leading-tight ${primary ? "text-[26px]" : "text-[18px]"}`}>
          {match.tier.label}
        </div>
        <div className="mt-1 text-[12px] opacity-90">{match.tier.description}</div>
      </div>
      <div className="flex flex-col gap-1.5 px-5 py-4 text-[13px]">
        <div className="text-ink">
          <span className="text-muted">Label:</span> <span className="font-medium">{match.entry.label}</span>
        </div>
        {typeof steps === "number" && (
          <div className="text-ink">
            <span className="text-muted">Schritte zum Optimum:</span>{" "}
            <span className="font-medium">{steps}</span>{" "}
            <span className="text-muted">(weniger ist besser)</span>
          </div>
        )}
        {match.entry.notes && (
          <p className="mt-1 text-[12px] leading-relaxed text-ink">{match.entry.notes}</p>
        )}
        {match.entry.caveat && (
          <p className="text-[11px] italic text-muted">{match.entry.caveat}</p>
        )}
        {match.entry.citations && match.entry.citations.length > 0 && (
          <details className="mt-1 text-[11px] text-muted">
            <summary className="cursor-pointer">
              Recherche-Quellen ({match.entry.citations.length})
            </summary>
            <ul className="mt-1.5 flex flex-col gap-1">
              {match.entry.citations.map((c, i) => (
                <li key={i}>
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-ink underline decoration-line underline-offset-2"
                  >
                    {c.title}
                  </a>
                </li>
              ))}
            </ul>
          </details>
        )}
        <div className="mt-2 flex items-center justify-between gap-2 border-t border-line pt-2 text-[12px] text-muted">
          <span>
            Quelle:{" "}
            <a
              href={match.source.url}
              target="_blank"
              rel="noreferrer"
              className="text-ink underline decoration-line underline-offset-2"
            >
              {match.source.name}
            </a>
            {match.source.publisher ? ` · ${match.source.publisher}` : ""}
            {match.entry.investigatedAt && (
              <span> · {new Date(match.entry.investigatedAt).toLocaleDateString("de-CH")}</span>
            )}
          </span>
          {match.matchScore < 0.95 && <span title="Fuzzy match">≈</span>}
        </div>
      </div>
    </div>
  );
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function resizeImage(dataUrl: string, maxDim: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const { width, height } = img;
      const scale = Math.min(1, maxDim / Math.max(width, height));
      const w = Math.round(width * scale);
      const h = Math.round(height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas not available"));
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = dataUrl;
  });
}
