import { useEffect, useState } from "react";

type FsDoc = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type FsEl = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

function activeFullscreen() {
  const doc = document as FsDoc;
  return Boolean(document.fullscreenElement || doc.webkitFullscreenElement);
}

function canFullscreen(node: HTMLElement | null) {
  const el = node as FsEl | null;
  return Boolean(el?.requestFullscreen || el?.webkitRequestFullscreen);
}

export function FullscreenButton({ target }: { target: React.RefObject<HTMLElement | null> }) {
  const [full, setFull] = useState(false);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    const sync = () => setFull(activeFullscreen());
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    sync();
    setSupported(canFullscreen(target.current) || canFullscreen(document.documentElement));
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
    };
  }, [target]);

  if (full || !supported) return null;

  return (
    <button
      type="button"
      className="absolute right-4 bottom-4 z-30 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium"
      style={{
        background: "color-mix(in oklab, var(--sign-fg) 10%, transparent)",
        color: "var(--sign-fg)",
      }}
      onClick={() => {
        const node = (target.current ?? document.documentElement) as FsEl;
        const req = node.requestFullscreen ?? node.webkitRequestFullscreen;
        if (!req) {
          setSupported(false);
          return;
        }
        void Promise.resolve(req.call(node)).catch(() => setSupported(false));
      }}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
        <path
          d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      Full screen
    </button>
  );
}
