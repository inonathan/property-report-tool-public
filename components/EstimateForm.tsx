"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Match = { id: string; full: string };
type Step = "address" | "details" | "processing" | "done" | "failed";

type Props = {
  embed?: boolean;
  source?: string;
  brandId?: string;
  privacyUrl: string;
  turnstileSiteKey?: string;
};

declare global {
  interface Window {
    __onTurnstile?: (t: string) => void;
  }
}

export default function EstimateForm({ embed = false, source, brandId, privacyUrl, turnstileSiteKey }: Props) {
  const router = useRouter();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  const [step, setStep] = useState<Step>("address");
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<Match[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [selected, setSelected] = useState<Match | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [badField, setBadField] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [privacy, setPrivacy] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [turnstile, setTurnstile] = useState("");
  const [token, setToken] = useState<string | null>(null);

  // debounced, and an older response never overwrites a newer one
  const reqId = useRef(0);
  useEffect(() => {
    if (selected || query.trim().length < 3) {
      setMatches([]);
      return;
    }
    const id = ++reqId.current;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/address?q=${encodeURIComponent(query)}${brandId ? `&brand=${encodeURIComponent(brandId)}` : ""}`);
        const data = (await res.json()) as { matches?: Match[] };
        if (id === reqId.current) {
          setMatches(data.matches ?? []);
          setActive(-1);
          setOpen(true);
        }
      } catch {
        if (id === reqId.current) setMatches([]);
      }
    }, 220);
    return () => clearTimeout(t);
  }, [query, selected, brandId]);

  const choose = useCallback((m: Match) => {
    setSelected(m);
    setQuery(m.full);
    setOpen(false);
    setError(null);
    setBadField(null);
  }, []);

  function onAddressKey(e: React.KeyboardEvent) {
    if (!open || matches.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % matches.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a <= 0 ? matches.length - 1 : a - 1));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      choose(matches[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  function goDetails(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) {
      if (matches.length > 0) {
        choose(matches[0]);
        setStep("details");
        return;
      }
      setBadField("address");
      setError("Please start typing your address and choose it from the list.");
      return;
    }
    setError(null);
    setStep("details");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setBusy(true);
    setError(null);
    setBadField(null);
    try {
      const res = await fetch("/api/estimate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          addressId: selected.id,
          name,
          email,
          phone,
          privacyAccepted: privacy,
          marketingConsent: marketing,
          source: source || (typeof document !== "undefined" ? document.referrer || window.location.href : undefined),
          brand: brandId,
          website: honeypot,
          turnstileToken: turnstile || undefined,
        }),
      });
      const data = (await res.json()) as { token?: string; error?: string; field?: string };
      if (!res.ok || !data.token) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setBadField(data.field ?? null);
        setBusy(false);
        return;
      }
      setToken(data.token);
      setStep("processing");
      await poll(data.token);
    } catch {
      setError("We couldn't reach the server. Please check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function poll(t: string) {
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      try {
        const res = await fetch(`/api/status?token=${encodeURIComponent(t)}`);
        const { status } = (await res.json()) as { status: string };
        if (status === "ready") {
          if (embed) setStep("done");
          else router.push(`/report/${t}`);
          return;
        }
        if (status === "failed") return setStep("failed");
      } catch {
        // network blip, try again
      }
    }
    // gave up waiting; the email will arrive when the report is done
    setStep("done");
  }

  // lets embed.js resize the iframe
  useEffect(() => {
    if (!embed || !rootRef.current) return;
    const send = () => window.parent?.postMessage({ type: "pr:height", height: document.documentElement.scrollHeight }, "*");
    const ro = new ResizeObserver(send);
    ro.observe(document.body);
    send();
    return () => ro.disconnect();
  }, [embed]);

  useEffect(() => {
    if (!turnstileSiteKey) return;
    window.__onTurnstile = (t) => setTurnstile(t);
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    s.async = true;
    document.head.appendChild(s);
    return () => {
      s.remove();
    };
  }, [turnstileSiteKey]);

  const cls = `ef${embed ? " embed" : ""}`;

  if (step === "processing")
    return (
      <div className={cls} ref={rootRef}>
        <div className="ef-card ef-status" role="status" aria-live="polite">
          <div className="spinner" aria-hidden="true" />
          <h2>Preparing your property report&hellip;</h2>
          <p>This usually takes a few seconds. We&rsquo;ll also email you a copy.</p>
        </div>
      </div>
    );

  if (step === "done")
    return (
      <div className={cls} ref={rootRef}>
        <div className="ef-card ef-status" role="status" aria-live="polite">
          <h2>Your report is ready</h2>
          <p style={{ marginBottom: 18 }}>We&rsquo;ve emailed you a secure link and a PDF copy.</p>
          {token && (
            <a className="ef-btn primary" style={{ display: "inline-block", padding: "15px 26px", textDecoration: "none" }} href={`/report/${token}`} target="_blank" rel="noopener">
              View my property report
            </a>
          )}
        </div>
      </div>
    );

  if (step === "failed")
    return (
      <div className={cls} ref={rootRef}>
        <div className="ef-card ef-status" role="alert">
          <h2>We couldn&rsquo;t complete your report automatically</h2>
          <p>Your request has been passed to our team and one of our agents will be in touch shortly.</p>
        </div>
      </div>
    );

  return (
    <div className={cls} ref={rootRef}>
      <div className="ef-card">
        {step === "address" ? (
          <form onSubmit={goDetails} noValidate>
            <div className="ef-row">
              <div className="ef-field">
                <label htmlFor="ef-address" className="sr-only">Property address</label>
                <input
                  id="ef-address"
                  className="ef-input"
                  type="text"
                  autoComplete="off"
                  placeholder="Start typing to find your address"
                  value={query}
                  aria-invalid={badField === "address"}
                  role="combobox"
                  aria-expanded={open && matches.length > 0}
                  aria-controls={listId}
                  aria-autocomplete="list"
                  aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setSelected(null);
                  }}
                  onKeyDown={onAddressKey}
                  onFocus={() => matches.length && setOpen(true)}
                  onBlur={() => setTimeout(() => setOpen(false), 150)}
                />
                {open && matches.length > 0 && (
                  <ul id={listId} className="ef-list" role="listbox">
                    {matches.map((m, i) => (
                      <li
                        key={m.id}
                        id={`${listId}-${i}`}
                        role="option"
                        aria-selected={i === active}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          choose(m);
                        }}
                      >
                        {m.full}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <button type="submit" className="ef-btn">Instant Property Estimate</button>
            </div>
            {error && <p className="ef-error" role="alert">{error}</p>}
          </form>
        ) : (
          <form onSubmit={submit} noValidate className="ef-pad">
            <div className="ef-selected">
              <span>{selected?.full}</span>
              <button type="button" className="ef-link" onClick={() => setStep("address")}>Change</button>
            </div>
            <p className="ef-fine" style={{ textAlign: "left", margin: "12px 0 0 4px" }}>Where should we send your report?</p>
            <div className="ef-grid">
              <div className="full">
                <label className="ef-label" htmlFor="ef-name">Full name</label>
                <input id="ef-name" className="ef-input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={badField === "name"} required />
              </div>
              <div>
                <label className="ef-label" htmlFor="ef-email">Email</label>
                <input id="ef-email" className="ef-input" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={badField === "email"} required />
              </div>
              <div>
                <label className="ef-label" htmlFor="ef-phone">Phone</label>
                <input id="ef-phone" className="ef-input" type="tel" autoComplete="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} aria-invalid={badField === "phone"} required />
              </div>
            </div>

            <div className="honeypot" aria-hidden="true">
              <label>Website<input tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} /></label>
            </div>

            <label className="ef-check">
              <input type="checkbox" checked={privacy} onChange={(e) => setPrivacy(e.target.checked)} />
              <span>
                I agree to my details being used to prepare and send this report and for an agent to contact me about it. See our{" "}
                <a href={privacyUrl} target="_blank" rel="noopener">privacy statement</a>.
              </span>
            </label>
            <label className="ef-check">
              <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} />
              <span>Optional: send me occasional property market updates. You can unsubscribe any time.</span>
            </label>

            {turnstileSiteKey && <div className="cf-turnstile" data-sitekey={turnstileSiteKey} data-callback="__onTurnstile" style={{ marginTop: 12 }} />}

            {error && <p className="ef-error" role="alert">{error}</p>}
            <button type="submit" className="ef-btn primary" style={{ width: "100%", padding: "16px", marginTop: 16 }} disabled={busy}>
              {busy ? "Sending…" : "Get my free report"}
            </button>
            <p className="ef-fine">Estimates are generated automatically and are not a valuation.</p>
          </form>
        )}
      </div>
    </div>
  );
}
