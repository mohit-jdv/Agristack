import Link from "next/link";
import { isDemoMode } from "@/lib/config";
import { DemoDataBadge } from "./DemoDataBadge";

export function Navbar() {
  const demo = isDemoMode();

  return (
    <header className="border-b border-soil-100 bg-soil-50/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-leaf-600 text-sm font-bold text-white">
            AS
          </span>
          <span className="text-lg font-semibold tracking-tight text-soil-900">
            AgriStack
          </span>
          {demo && <DemoDataBadge label="Demo mode" />}
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-medium text-soil-600 sm:flex">
          <Link href="/dashboard" className="hover:text-leaf-700">
            Dashboard
          </Link>
          <Link href="/admin" className="hover:text-leaf-700">
            Admin
          </Link>
          <a href="#how-it-works" className="hover:text-leaf-700">
            How it works
          </a>
        </nav>
        <Link
          href="/dashboard"
          className="rounded-full bg-leaf-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-leaf-700"
        >
          Get started
        </Link>
      </div>
    </header>
  );
}