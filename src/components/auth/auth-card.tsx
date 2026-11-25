export function AuthCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-app px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-mark.svg" alt="" width={44} height={44} className="size-11 rounded-xl" />
          <span className="font-display text-2xl tracking-tight text-foreground">Bid Builder</span>
        </div>
        <section className="rounded-3xl border border-border bg-white/80 p-6 shadow-sm">
          <h1 className="font-display text-2xl text-foreground">{title}</h1>
          {description ? <div className="mt-1 text-sm text-muted-foreground">{description}</div> : null}
          <div className="mt-5">{children}</div>
        </section>
      </div>
    </main>
  );
}
