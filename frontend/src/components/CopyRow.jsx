import { useState } from "react";
import { copyText } from "../lib/copy";

export function CopyRow({ label, value }) {
  const [copied, setCopied] = useState(false);
  if (!value && value !== 0) return null;

  const display = String(value);
  const onCopy = async () => {
    const ok = await copyText(display);
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="copy-row">
      <span className="copy-label">{label}</span>
      <code className="copy-value" title={display}>
        {display}
      </code>
      <button type="button" className="btn-chip" onClick={onCopy}>
        {copied ? "복사됨" : "복사"}
      </button>
    </div>
  );
}
