"use client";

import { Button } from "@/components/ui/button";

export function OpenAgentButton(props: { label?: string; message?: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      className="h-11 px-6"
      onClick={() => {
        window.dispatchEvent(
          new CustomEvent("supportmind:chat", {
            detail: { message: props.message || "", autoSend: false },
          })
        );
      }}
    >
      {props.label || "Open Agent"}
    </Button>
  );
}
