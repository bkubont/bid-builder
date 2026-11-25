"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { NumberInput } from "@/components/ui/number-input";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AccountSection } from "@/components/settings/account-section";
import { TeamSection } from "@/components/settings/team-section";
import { useSafe, useStore } from "@/lib/store";
import type { CompanySettings, LineCategory } from "@/lib/types";
import { describeTaxable } from "@/lib/types";
import { CATEGORIES } from "@/lib/trades";

export default function SettingsPage() {
  const { data, me } = useStore();
  const welcome = useSearchParams().get("welcome") === "1";
  const isOwner = me.role === "owner";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Settings"
        description="Company details for PDFs and new estimates, your team, and your login."
      />

      {welcome && isOwner ? (
        <section className="rounded-3xl border border-attention/40 bg-attention/15 p-4 sm:p-5">
          <h2 className="font-display text-xl text-foreground">You&apos;re set up</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-foreground">
            <li>Check your company details below.</li>
            <li>Load the test data at the bottom of this page to try things out.</li>
            <li>Invite your contractor in the Team section.</li>
          </ol>
        </section>
      ) : null}

      <CompanyForm key={JSON.stringify(data.company)} company={data.company} editable={isOwner} />
      {isOwner ? <TeamSection /> : null}
      <AccountSection />
      {isOwner ? <TestDataSection /> : null}

      <section className="rounded-3xl border border-border bg-white/50 p-5">
        <h2 className="font-display text-xl text-foreground">Install as an app</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          On a tablet or phone, use your browser&apos;s &quot;Add to Home Screen&quot; / Install option for a
          full-screen app icon. The latest data you opened stays viewable without signal; saving needs a
          connection.
        </p>
      </section>
    </div>
  );
}

function CompanyForm({ company, editable }: { company: CompanySettings; editable: boolean }) {
  const { updateCompany } = useStore();
  const safe = useSafe();
  const [form, setForm] = useState(company);
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="space-y-4 rounded-3xl border border-border bg-white/70 p-4 sm:p-6"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        await safe(() => updateCompany(form), "Company settings saved");
        setBusy(false);
      }}
    >
      <div>
        <h2 className="font-display text-xl text-foreground">Company</h2>
        {!editable ? (
          <p className="mt-1 text-sm text-muted-foreground">Only an Owner can change these.</p>
        ) : null}
      </div>
      <fieldset disabled={!editable || busy} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="co-name">Company name</Label>
          <Input
            id="co-name"
            className="h-12 rounded-xl"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="co-email">Email</Label>
            <Input
              id="co-email"
              type="email"
              className="h-12 rounded-xl"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="co-phone">Phone</Label>
            <Input
              id="co-phone"
              className="h-12 rounded-xl"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="co-address">Address</Label>
          <Input
            id="co-address"
            className="h-12 rounded-xl"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="co-license">License number</Label>
          <Input
            id="co-license"
            className="h-12 rounded-xl"
            value={form.licenseNumber}
            onChange={(e) => setForm({ ...form, licenseNumber: e.target.value })}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="co-markup">Default markup %</Label>
            <NumberInput
              id="co-markup"
              className="h-12 rounded-xl"
              value={form.defaultMarkup}
              onValueChange={(defaultMarkup) => setForm({ ...form, defaultMarkup })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="co-tax">Default tax %</Label>
            <NumberInput
              id="co-tax"
              className="h-12 rounded-xl"
              value={form.defaultTax}
              onValueChange={(defaultTax) => setForm({ ...form, defaultTax })}
            />
          </div>
        </div>
        <fieldset className="space-y-2 rounded-2xl border border-border p-3">
          <legend className="px-1 text-sm font-medium">Sales tax applies to</legend>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => {
              const on = form.taxableCategories.includes(c.value);
              return (
                <label
                  key={c.value}
                  className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-border bg-white px-3 has-[:checked]:border-brand has-[:checked]:bg-brand-muted"
                >
                  <input
                    type="checkbox"
                    className="size-4 accent-[var(--color-brand,#0504AA)]"
                    checked={on}
                    onChange={() =>
                      setForm({
                        ...form,
                        taxableCategories: on
                          ? form.taxableCategories.filter((x) => x !== c.value)
                          : ([...form.taxableCategories, c.value] as LineCategory[]),
                      })
                    }
                  />
                  {c.label}
                </label>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            New estimates tax {describeTaxable(form.taxableCategories)}. Estimates and invoices you&apos;ve
            already made keep the rule they were made with. Check the rules for your state with your accountant.
          </p>
        </fieldset>
        <div className="space-y-2 sm:max-w-xs">
          <Label htmlFor="co-deposit">Default deposit %</Label>
          <NumberInput
            id="co-deposit"
            className="h-12 rounded-xl"
            value={form.depositPercent}
            onValueChange={(depositPercent) => setForm({ ...form, depositPercent })}
          />
          <p className="text-xs text-muted-foreground">Suggested when you tap Request deposit on an estimate.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="co-terms">Terms</Label>
          <Textarea
            id="co-terms"
            className="min-h-28 rounded-xl"
            value={form.terms}
            onChange={(e) => setForm({ ...form, terms: e.target.value })}
          />
        </div>
        {editable ? (
          <Button
            type="submit"
            className="h-12 rounded-xl bg-attention text-foreground hover:bg-attention/90"
          >
            {busy ? "Saving…" : "Save company settings"}
          </Button>
        ) : null}
      </fieldset>
    </form>
  );
}

function TestDataSection() {
  const { replaceWithTestData } = useStore();
  const safe = useSafe();
  const [busy, setBusy] = useState(false);
  return (
    <section className="rounded-3xl border border-rose-200 bg-white/70 p-4 sm:p-6">
      <h2 className="font-display text-xl text-foreground">Test data</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Fill the account with fictional customers, a pricebook, estimates, invoices and a schedule for
        trying things out. This <strong>replaces</strong> all customers, pricebook items, estimates,
        invoices and schedule blocks for everyone on the account. Company settings and logins stay.
      </p>
      <Button
        type="button"
        variant="outline"
        disabled={busy}
        className="mt-3 h-12 rounded-xl border-rose-300 text-rose-800 hover:bg-rose-50"
        onClick={async () => {
          const typed = window.prompt(
            'This erases all customers, estimates, invoices, pricebook items and schedule blocks on this account. Type REPLACE to continue.'
          );
          if (typed?.trim().toUpperCase() !== "REPLACE") return;
          setBusy(true);
          await safe(() => replaceWithTestData(), "Test data loaded");
          setBusy(false);
        }}
      >
        {busy ? "Loading…" : "Replace everything with test data"}
      </Button>
    </section>
  );
}
