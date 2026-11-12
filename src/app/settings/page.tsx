"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useStore } from "@/lib/store";

export default function SettingsPage() {
  const { data, updateCompany, resetDemoData, ready } = useStore();
  const [form, setForm] = useState(data.company);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (ready) setForm(data.company);
  }, [ready, data.company]);

  if (!ready) return <div className="animate-pulse p-8 text-muted-foreground">Loading…</div>;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Company settings"
        description="Branding and defaults that appear on PDFs and new estimates."
      />

      <form
        className="space-y-4 rounded-3xl border border-border bg-white/70 p-4 sm:p-6"
        onSubmit={(e) => {
          e.preventDefault();
          updateCompany(form);
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        }}
      >
        <div className="space-y-2">
          <Label>Company name</Label>
          <Input
            className="h-12 rounded-xl"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              className="h-12 rounded-xl"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input
              className="h-12 rounded-xl"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Address</Label>
          <Input
            className="h-12 rounded-xl"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>License number</Label>
          <Input
            className="h-12 rounded-xl"
            value={form.licenseNumber}
            onChange={(e) => setForm({ ...form, licenseNumber: e.target.value })}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Default markup %</Label>
            <Input
              type="number"
              className="h-12 rounded-xl"
              value={form.defaultMarkup}
              onChange={(e) =>
                setForm({ ...form, defaultMarkup: Number(e.target.value) || 0 })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Default tax %</Label>
            <Input
              type="number"
              className="h-12 rounded-xl"
              value={form.defaultTax}
              onChange={(e) =>
                setForm({ ...form, defaultTax: Number(e.target.value) || 0 })
              }
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Terms</Label>
          <Textarea
            className="min-h-28 rounded-xl"
            value={form.terms}
            onChange={(e) => setForm({ ...form, terms: e.target.value })}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="submit"
            className="h-12 rounded-xl bg-attention text-foreground hover:bg-attention/90"
          >
            {saved ? "Saved" : "Save settings"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-12 rounded-xl"
            onClick={() => {
              if (confirm("Reset all local demo data?")) resetDemoData();
            }}
          >
            Reset demo data
          </Button>
        </div>
      </form>

      <section className="mt-6 rounded-3xl border border-border bg-white/50 p-5">
        <h2 className="font-display text-xl text-foreground">Install as an app</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Bid Builder ships as a Progressive Web App. On a tablet or phone, use your
          browser&apos;s &quot;Add to Home Screen&quot; / Install option for a
          full-screen app icon. Native store packaging can come later from this
          same web app.
        </p>
      </section>
    </div>
  );
}
