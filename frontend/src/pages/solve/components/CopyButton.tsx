import { useState } from "react";
import { Button } from "../../../components/ui";

interface CopyButtonProps {
  text: string;
  label?: string;
}

/** Small "Copy" button that flips to "Copied" for a beat after a successful copy. */
export function CopyButton({ text, label = "Copy" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleClick = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // Clipboard API unavailable/denied — silently ignore, button just won't flip.
    }
  };

  return (
    <Button type="button" variant="ghost" size="sm" onClick={handleClick} className="text-xs">
      {copied ? "Copied" : label}
    </Button>
  );
}
