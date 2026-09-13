import { useEffect, useRef, useState } from "react";
import { bindThisGlass, getGlassFrame } from "@/lib/foyer/glass";
import type { Frame } from "@/lib/foyer/types";
import { TechSheet } from "@/components/foyer/tech/TechSheet";
import { DoorSign } from "./DoorSign";
import { FullscreenButton } from "./FullscreenButton";
import { PairingScreen } from "./PairingScreen";
import { SignShell } from "./SignShell";
import { WelcomeSign } from "./WelcomeSign";

const TOKEN_KEY = (id: string) => `foyer.token.${id}`;

function paint(frame: Frame) {
  if (frame.template === "welcome") return <WelcomeSign frame={frame} />;
  return <DoorSign frame={frame} />;
}

export function Player({ displayId }: { displayId: string }) {
  const [frame, setFrame] = useState<Frame | null>(null);
  const [tech, setTech] = useState(false);
  const [hint, setHint] = useState("");
  const gen = useRef(0);
  const root = useRef<HTMLDivElement>(null);

  async function load() {
    const n = ++gen.current;
    try {
      const token = localStorage.getItem(TOKEN_KEY(displayId)) ?? undefined;
      const result = await getGlassFrame({ data: { displayId, token } });
      if (n !== gen.current) return;
      if (!result.ok && result.status === 404) {
        setHint("missing");
        return;
      }
      if ("pickupToken" in result && result.pickupToken) {
        localStorage.setItem(TOKEN_KEY(displayId), result.pickupToken);
      }
      if (result.frame) setFrame(result.frame);
      if (
        result.ok &&
        result.frame?.openGlass &&
        result.frame.template !== "welcome" &&
        !token &&
        !("pickupToken" in result && result.pickupToken)
      ) {
        const bound = await bindThisGlass({ data: { displayId } });
        if (bound.ok) localStorage.setItem(TOKEN_KEY(displayId), bound.token);
      }
    } catch {
      if (n !== gen.current) return;
      setHint("offline");
    }
  }

  useEffect(() => {
    void load();
    if (tech) return;
    const timer = window.setInterval(() => void load(), 4000);
    document.body.style.overflow = "hidden";
    void navigator.wakeLock?.request("screen").catch(() => undefined);
    return () => {
      window.clearInterval(timer);
      document.body.style.overflow = "";
    };
  }, [displayId, tech]);

  if (!frame) {
    return (
      <div className="sign-root flex min-h-dvh items-center justify-center" data-palette="linen">
        <p className="text-muted">
          {hint === "offline" ? "Could not reach Foyer." : hint === "missing" ? "This plate is not on the board." : "Preparing the glass…"}
        </p>
      </div>
    );
  }

  return (
    <div ref={root} className={`plate-root relative h-dvh min-h-dvh overflow-hidden${tech ? " is-tech" : ""}`}>
      {!frame.pairing.bound ? (
        <PairingScreen frame={frame} />
      ) : (
        <SignShell frame={frame} onTechHold={() => setTech(true)}>
          {paint(frame)}
        </SignShell>
      )}
      {tech && frame.pairing.bound ? (
        <TechSheet
          key={frame.displayId}
          frame={frame}
          onClose={() => setTech(false)}
          onSaved={() => {
            setHint("saved");
            void load();
          }}
        />
      ) : null}
      {frame.template !== "welcome" ? <FullscreenButton target={root} /> : null}
    </div>
  );
}
