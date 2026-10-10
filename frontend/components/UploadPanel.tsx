"use client";

import { useEffect, useRef, useState } from "react";
import { getBrokerAccounts, uploadT212Csv, type BrokerAccount } from "@/lib/api";

export default function UploadPanel({ onUploaded }: { onUploaded: () => void }) {
  const [accounts, setAccounts] = useState<BrokerAccount[]>([]);
  const [accountId, setAccountId] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getBrokerAccounts()
      .then((all) => {
        const t212 = all.filter((a) => a.broker === "T212"); // only T212 has an importer so far
        setAccounts(t212);
        if (t212.length > 0) setAccountId(t212[0].id);
      })
      .catch(() => setStatus({ kind: "err", text: "Could not load broker accounts." }))
      .finally(() => setLoaded(true));
  }, []);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // lets you pick the same file again later
    if (!file || !accountId) return;

    setBusy(true);
    setStatus(null);
    try {
      const res = await uploadT212Csv(accountId, file);
      setStatus({
        kind: "ok",
        text: `Imported ${res.imported_transactions} trades → ${res.positions} open positions.`,
      });
      onUploaded();
    } catch (err) {
      setStatus({ kind: "err", text: err instanceof Error ? err.message : "Upload failed." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 pt-5 border-t border-line md:pr-5">
      <div className="text-[0.72rem] text-ink-soft mb-2">Import</div>

      {loaded && accounts.length === 0 && !status && (
        <p className="text-[0.74rem] text-ink-soft leading-snug">
          No Trading 212 account found. Create one first (<code className="font-mono">./start.sh</code> seeds a
          test account).
        </p>
      )}

      {accounts.length > 1 && (
        <select
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          className="w-full mb-2 font-mono text-[0.78rem] bg-paper border border-line px-2 py-1.5 text-ink"
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.display_name || a.broker}
            </option>
          ))}
        </select>
      )}

      {accounts.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy || !accountId}
            className="w-full text-[0.82rem] px-3 py-2 border border-ink bg-paper-raised hover:bg-gold-soft hover:border-gold disabled:opacity-50 disabled:cursor-wait"
          >
            {busy ? "Importing…" : "Upload T212 export (.csv)"}
          </button>
          <input ref={inputRef} type="file" accept=".csv,text/csv" onChange={handleFile} className="hidden" />
          <p className="text-[0.74rem] text-ink-soft mt-2 leading-snug">
            The file replaces everything previously imported into this account, so upload your full history
            in one file.
          </p>
        </>
      )}

      {status && (
        <p className={`text-[0.78rem] mt-2 font-mono ${status.kind === "ok" ? "text-gain" : "text-loss"}`}>
          {status.text}
        </p>
      )}
    </div>
  );
}
