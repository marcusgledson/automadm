import { useCallback, useEffect, useState } from "react";
import defaultHero from "@/assets/finance-hero.jpg";

const STORAGE_KEY = "custom_hero_image";
const EVENT = "hero-image-changed";

export function useHeroImage() {
  const [src, setSrc] = useState<string>(() => {
    if (typeof window === "undefined") return defaultHero;
    return localStorage.getItem(STORAGE_KEY) || defaultHero;
  });

  useEffect(() => {
    const onChange = () => {
      setSrc(localStorage.getItem(STORAGE_KEY) || defaultHero);
    };
    window.addEventListener(EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const setCustom = useCallback((dataUrl: string) => {
    localStorage.setItem(STORAGE_KEY, dataUrl);
    window.dispatchEvent(new Event(EVENT));
  }, []);

  const reset = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event(EVENT));
  }, []);

  const isCustom = src !== defaultHero;

  return { src, setCustom, reset, isCustom, defaultHero };
}
