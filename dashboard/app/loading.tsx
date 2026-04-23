"use client";

/**
 * Suspense fallback — arrow-key-driven Running Pikachu port.
 *
 * Original CodePen source pasted by Eric:
 *
 *   import React from "react";
 *   import ReactDOM from "react-dom";
 *   ...
 *   function move({ keyCode }) {
 *     switch (keyCode) {
 *       case 39: setPosition(p => p + 25); break;
 *       case 37: setPosition(p => p - 25); break;
 *     }
 *   }
 *   <div id="pikachu" style={{ transform: `translateX(${position}px)` }}>
 *     <img src={pikachu} />
 *   </div>
 *
 * Scoped to the content area — preserves top-nav + sidebar chrome.
 */

import Image from "next/image";
import { useEffect, useState } from "react";

export default function RootLoading() {
  const [position, setPosition] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.keyCode === 39) setPosition((p) => p + 25);
      else if (e.keyCode === 37) setPosition((p) => p - 25);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div
      data-testid="root-loading"
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label="Loading"
      className="cae-pikachu-loader relative w-full min-h-[calc(100vh-40px)] flex flex-col items-center justify-center gap-3 bg-[color:var(--bg)] overflow-hidden"
    >
      <h1 className="text-2xl font-semibold text-[color:var(--text)]">
        Running Pikachu
      </h1>
      <p className="text-sm text-[color:var(--text-muted)]">
        Use left and right arrow keys to move.
      </p>

      <div
        id="pikachu"
        className="mt-2 transition-transform duration-150 ease-out will-change-transform"
        style={{ transform: `translateX(${position}px)` }}
      >
        <Image
          src="/pikachu-loading.gif"
          alt="running pikachu"
          width={200}
          height={209}
          priority
          unoptimized
          className="block"
        />
      </div>

      <span id="loadingText" className="text-[color:var(--text)] text-base font-medium">
        Loading...
      </span>

    </div>
  );
}
