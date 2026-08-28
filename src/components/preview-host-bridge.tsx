"use client";

/**
 * Mount once in the root layout so the Grok preview chrome can drive navigation.
 * Noops when the app is not embedded.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { installPreviewHostBridge } from "@/lib/preview-host-bridge";

const ROUTE_PATHS = [
  "/",
  "/dashboard",
  "/compare",
  "/admin",
  "/queue",
];

export function PreviewHostBridge() {
  const router = useRouter();

  useEffect(() => {
    return installPreviewHostBridge({
      navigate: (path) => {
        router.push(path);
      },
      getRoutePaths: () => ROUTE_PATHS,
    });
  }, [router]);

  return null;
}
