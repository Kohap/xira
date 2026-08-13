"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import xiraLogoDark from "@/app/xira-logo-dark.png";
import xiraLogoLight from "@/app/xira-logo-light.png";

// Theme-aware mark: ivory duotone in dark mode, ink duotone in light mode.
export function LogoMark({ size = 32 }: { size?: number }) {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const update = () =>
      setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
    update();
    const mo = new MutationObserver(update);
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => mo.disconnect();
  }, []);

  return (
    <Image
      src={theme === "light" ? xiraLogoLight : xiraLogoDark}
      alt=""
      width={size}
      height={size}
      className="shrink-0 rounded-lg object-cover"
      style={{ width: size, height: size }}
    />
  );
}
