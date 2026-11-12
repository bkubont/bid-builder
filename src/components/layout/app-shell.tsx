"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  CalendarDays,
  FileText,
  LayoutDashboard,
  Menu,
  Receipt,
  Settings,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { InstallPrompt } from "@/components/layout/install-prompt";

const NAV = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/estimates", label: "Estimates", icon: FileText },
  { href: "/schedule", label: "Schedule", icon: CalendarDays },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/invoices", label: "Invoices", icon: Receipt },
  { href: "/pricebook", label: "Pricebook", icon: BookOpen },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <div className="min-h-dvh bg-app text-foreground">
      <div className="mx-auto flex min-h-dvh max-w-[1400px]">
        <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-white/10 bg-brand px-3 py-5 text-white lg:flex">
          <Brand light />
          <nav className="mt-8 flex flex-1 flex-col gap-1">
            {NAV.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-3 text-[15px] font-medium transition",
                    isActive(item.href)
                      ? "bg-attention text-attention-foreground"
                      : "text-white/80 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <Icon className="size-5 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <p className="px-3 text-xs text-white/45">
            Square This Up · tablet-first
          </p>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-card/90 px-4 py-3 backdrop-blur lg:hidden">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11"
                onClick={() => setOpen(true)}
                aria-label="Open menu"
              >
                <Menu className="size-6" />
              </Button>
              <Brand />
            </div>
            <ButtonLink
              href="/estimates/new"
              className="h-11 rounded-xl bg-attention px-4 text-attention-foreground hover:bg-attention/90"
            >
              New estimate
            </ButtonLink>
          </header>

          {open && (
            <div className="fixed inset-0 z-50 lg:hidden">
              <button
                type="button"
                className="absolute inset-0 bg-foreground/50"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
              />
              <div className="absolute inset-y-0 left-0 flex w-[min(20rem,88vw)] flex-col bg-brand p-4 text-white shadow-2xl">
                <div className="mb-6 flex items-center justify-between">
                  <Brand light />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-11 text-white hover:bg-white/10"
                    onClick={() => setOpen(false)}
                  >
                    <X className="size-6" />
                  </Button>
                </div>
                <nav className="flex flex-col gap-1">
                  {NAV.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex items-center gap-3 rounded-xl px-3 py-3.5 text-base font-medium",
                          isActive(item.href)
                            ? "bg-attention text-attention-foreground"
                            : "text-white/85 hover:bg-white/10"
                        )}
                      >
                        <Icon className="size-5" />
                        {item.label}
                      </Link>
                    );
                  })}
                </nav>
              </div>
            </div>
          )}

          <main className="flex-1 px-4 pb-28 pt-4 sm:px-6 sm:pt-6 lg:px-8 lg:pb-10">
            <InstallPrompt />
            {children}
          </main>

          <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur lg:hidden">
            <div className="mx-auto grid max-w-lg grid-cols-5 gap-1">
              {NAV.slice(0, 5).map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-semibold",
                      isActive(item.href) ? "text-brand" : "text-muted-foreground"
                    )}
                  >
                    <Icon className="size-5" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </nav>
        </div>
      </div>
    </div>
  );
}

function Brand({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/logo-mark.svg"
        alt="Square This Up"
        width={40}
        height={40}
        className="size-10 rounded-xl object-contain"
      />
      <span
        className={cn(
          "font-display text-lg tracking-tight sm:text-xl",
          light ? "text-white" : "text-foreground"
        )}
      >
        Bid Builder
      </span>
    </Link>
  );
}
