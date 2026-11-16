"use client";

import { useState } from "react";
import { NumberInput } from "@/components/ui/number-input";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useStore } from "@/lib/store";
import type { CompanySettings } from "@/lib/types";

export default function SettingsPage() {
  const { data, ready } = useStore();
  if (!ready) return <div className="animate-pulse p-8 text-muted-foreground">Loading…</div>;
  return <SettingsForm company={data.company} />;
}

function SettingsForm({ company }: { company: CompanySettings }) {
  const { updateCompany, resetDemoData } = useStore();
  const [form, setForm] = useState(company);
  const [saved, setSaved] = useState(false);

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
            <NumberInput
              className="h-12 rounded-xl"
              value={form.defaultMarkup}
              onValueChange={(defaultMarkup) => setForm({ ...form, defaultMarkup })}
            />
          </div>
          <div className="space-y-2">
            <Label>Default tax %</Label>
            <NumberInput
              className="h-12 rounded-xl"
              value={form.defaultTax}
              onValueChange={(defaultTax) => setForm({ ...form, defaultTax })}
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
              if (
                window.confirm(
                  "Replace everything on this device with fresh test data? Your current customers, estimates and invoices here will be erased."
                )
              ) {
                resetDemoData();
                window.location.reload();
              }
            }}
          >
            Reset test data
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
