"use client";

import { useEffect, useMemo, useState } from "react";
import { backupCodesText } from "../../lib/session/auth-copy";
import { encodeQr } from "../../lib/session/qr";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/field";
import { CopyIcon } from "../ui/icons";

/** The authenticator QR code, drawn here from the otpauth:// address (nothing leaves the browser). */
export function QrCode({ value }: { value: string }) {
  const modules = useMemo(() => {
    try {
      return encodeQr(value);
    } catch {
      return null;
    }
  }, [value]);
  if (!modules) return null;
  const quiet = 3;
  const size = modules.length + quiet * 2;
  const path = modules
    .flatMap((row, r) =>
      row.map((dark, c) => (dark ? `M${c + quiet} ${r + quiet}h1v1h-1z` : "")).filter(Boolean),
    )
    .join("");
  return (
    <svg
      role="img"
      aria-label="QR code to scan with your authenticator app"
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      className="size-[132px] shrink-0 rounded-lg border border-border-soft"
    >
      <rect width={size} height={size} fill="#fff" />
      <path d={path} fill="#090a0b" />
    </svg>
  );
}

/** Copy text with feedback; falls back silently when the clipboard is blocked. */
export function useCopy() {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);
  return {
    copied,
    copy: async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
      } catch {
        setCopied(false);
      }
    },
  };
}

/**
 * Step 3: the backup codes, shown once (Figma 8. save backup codes). Copy, download as .txt, and a
 * confirmation checkbox that unlocks "Go to dashboard". Leaving the page warns while unconfirmed,
 * because the server will not show the codes again.
 */
export function BackupCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const [saved, setSaved] = useState(false);
  const { copied, copy } = useCopy();

  useEffect(() => {
    if (saved) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saved]);

  function download() {
    const url = URL.createObjectURL(new Blob([backupCodesText(codes)], { type: "text/plain" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "matr-studio-admin-backup-codes.txt";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <ul className="m-0 grid list-none grid-cols-2 gap-x-6 gap-y-2 rounded-lg bg-bg-fill2 p-4 font-mono text-[14px] text-text leading-5">
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          variant="secondary"
          icon={<CopyIcon size={16} />}
          onClick={() => void copy(codes.join("\n"))}
        >
          {copied ? "Copied" : "Copy codes"}
        </Button>
        <Button variant="secondary" onClick={download}>
          Download .txt
        </Button>
      </div>
      <p role="status" aria-live="polite" className="sr-only">
        {copied ? "Backup codes copied" : ""}
      </p>
      <Checkbox
        label="I’ve saved my backup codes somewhere safe"
        checked={saved}
        onChange={(e) => setSaved(e.target.checked)}
      />
      <Button inactive={!saved} onClick={onDone}>
        Go to dashboard
      </Button>
    </>
  );
}
