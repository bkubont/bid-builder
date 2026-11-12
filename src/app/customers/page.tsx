"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { CustomerForm } from "@/components/customers/customer-form";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useStore } from "@/lib/store";
import type { Customer } from "@/lib/types";

export default function CustomersPage() {
  const { data, deleteCustomer, ready } = useStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | undefined>();

  if (!ready) return <Loading />;

  return (
    <div>
      <PageHeader
        title="Customers"
        description="Keep job contacts ready for estimates and invoices."
        actions={
          <Button
            className="h-11 rounded-xl bg-attention text-foreground hover:bg-attention/90"
            onClick={() => {
              setEditing(undefined);
              setOpen(true);
            }}
          >
            <Plus className="size-4" />
            Add customer
          </Button>
        }
      />

      {data.customers.length === 0 ? (
        <EmptyState
          title="No customers yet"
          description="Add a homeowner or property manager so you can attach them to bids."
          action={
            <Button
              className="h-11 rounded-xl bg-attention text-foreground hover:bg-attention/90"
              onClick={() => setOpen(true)}
            >
              Add first customer
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data.customers.map((customer) => (
            <article
              key={customer.id}
              className="flex flex-col rounded-3xl border border-border bg-white/70 p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-display text-xl text-foreground">{customer.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{customer.address || "No address"}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-10 text-rose-700"
                  onClick={() => deleteCustomer(customer.id)}
                  aria-label="Delete customer"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{customer.phone || "No phone"}</p>
              <p className="text-sm text-muted-foreground">{customer.email || "No email"}</p>
              {customer.notes ? (
                <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{customer.notes}</p>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 rounded-xl"
                  onClick={() => {
                    setEditing(customer);
                    setOpen(true);
                  }}
                >
                  Edit
                </Button>
                <ButtonLink
                  href={`/estimates/new?customer=${customer.id}`}
                  className="h-10 rounded-xl bg-brand text-brand-foreground hover:bg-brand/90"
                >
                  New estimate
                </ButtonLink>
              </div>
            </article>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-3xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              {editing ? "Edit customer" : "New customer"}
            </DialogTitle>
          </DialogHeader>
          <CustomerForm
            customer={editing}
            onDone={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Loading() {
  return <div className="animate-pulse rounded-3xl bg-white/50 p-10 text-muted-foreground">Loading…</div>;
}
