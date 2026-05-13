import Scanner from "./Scanner";

export default function Page() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pb-12 pt-8 sm:pt-12">
      <header className="mb-8">
        <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">
          No Cruelty
        </div>
        <h1 className="mt-1 text-[28px] font-semibold leading-tight tracking-tight text-ink">
          Wie wurde dieses Tier behandelt?
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-muted">
          Foto vom Produkt oder Label-Auswahl. Bewertung kommt direkt aus den
          Datenbanken von unabhängigen Tierschutz-Quellen.
        </p>
      </header>
      <Scanner />
      <footer className="mt-auto pt-10 text-[11px] text-muted">
        Daten aktuell ausschliesslich von{" "}
        <a
          href="https://essenmitherz.ch/label-und-marken/"
          target="_blank"
          rel="noreferrer"
          className="text-ink underline decoration-line underline-offset-2"
        >
          Essen mit Herz
        </a>{" "}
        (Schweizer Tierschutz STS).
      </footer>
    </main>
  );
}
