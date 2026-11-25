import Link from "next/link";
import { type VariantProps } from "class-variance-authority";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ButtonLink({
  href,
  className,
  variant = "default",
  size = "default",
  children,
  ...props
}: React.ComponentProps<typeof Link> &
  VariantProps<typeof buttonVariants> & {
    children: React.ReactNode;
  }) {
  return (
    <Link
      href={href}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    >
      {children}
    </Link>
  );
}
