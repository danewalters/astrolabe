import { cva, type VariantProps } from "class-variance-authority";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { ComponentProps } from "react";

const buttonVariants = cva("button", {
  variants: { variant: { primary: "button-primary", secondary: "button-secondary", quiet: "button-quiet" } },
  defaultVariants: { variant: "secondary" },
});

export function Button({ className, variant, type = "button", ...props }: ComponentProps<"button"> & VariantProps<typeof buttonVariants>) {
  return <button type={type} className={twMerge(clsx(buttonVariants({ variant }), className))} {...props} />;
}
