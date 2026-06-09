import { useEffect, useState } from "react";

const STORAGE_KEY = "mobile_fs_notice_shown";

function isMobile() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 767px)").matches || /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/**
 * On mobile, request fullscreen on the first user gesture and show
 * a one-time info dialog letting the user know how to exit fullscreen
 * (via the user menu).
 */
export function useMobileFullscreen() {
  const [noticeOpen, setNoticeOpen] = useState(false);

  useEffect(() => {
    if (!isMobile()) return;

    // Show the informational popup once per device.
    if (!localStorage.getItem(STORAGE_KEY)) {
      setNoticeOpen(true);
    }

    const requestFs = () => {
      if (document.fullscreenElement) return;
      const el = document.documentElement;
      if (el.requestFullscreen) {
        el.requestFullscreen().catch(() => {});
      }
    };

    const onFirstGesture = () => {
      requestFs();
      window.removeEventListener("touchstart", onFirstGesture);
      window.removeEventListener("click", onFirstGesture);
    };

    window.addEventListener("touchstart", onFirstGesture, { once: true });
    window.addEventListener("click", onFirstGesture, { once: true });

    return () => {
      window.removeEventListener("touchstart", onFirstGesture);
      window.removeEventListener("click", onFirstGesture);
    };
  }, []);

  const dismissNotice = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setNoticeOpen(false);
  };

  return { noticeOpen, dismissNotice };
}
