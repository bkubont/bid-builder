"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useStore } from "@/lib/store";
import type { Customer } from "@/lib/types";

export function CustomerForm({
  customer,
  onDone,
}: {
  customer?: Customer;
  onDone?: (customer: Customer) => void;
}) {
  const { upsertCustomer } = useStore();
  const [name, setName] = useState(customer?.name || "");
  const [email, setEmail] = useState(customer?.email || "");
  const [phone, setPhone] = useState(customer?.phone || "");
  const [address, setAddress] = useState(customer?.address || "");
  const [notes, setNotes] = useState(customer?.notes || "");
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) {
          setError("Name is required.");
          return;
        }
        const saved = upsertCustomer({
          id: customer?.id,
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          address: address.trim(),
          notes: notes.trim(),
        });
        onDone?.(saved);
      }}
    >
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          className="h-12 rounded-xl"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Customer or company"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            className="h-12 rounded-xl"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            className="h-12 rounded-xl"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="address">Address</Label>
        <Input
          id="address"
          className="h-12 rounded-xl"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          className="min-h-24 rounded-xl"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
      <Button
        type="submit"
        className="h-12 w-full rounded-xl bg-attention text-foreground hover:bg-attention/90 sm:w-auto"
      >
        {customer ? "Save customer" : "Add customer"}
      </Button>
    </form>
  );
}
