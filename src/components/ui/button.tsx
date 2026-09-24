import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "@radix-ui/react-slot";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl text-sm font-semibold transition-all disabled:pointer-events-none disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-gradient-to-br from-aqua to-slateink text-primary-foreground shadow-lg shadow-aqua/25 hover:brightness-110",
        glass:
          "glass-strong text-foreground hover:bg-card/85",
        signal:
          "bg-bond text-accent-foreground shadow-lg shadow-bond/25 hover:brightness-105",
        outline: "border border-border bg-transparent text-foreground hover:bg-secondary",
        ghost: "text-steel hover:bg-secondary hover:text-foreground",
        danger: "bg-destructive text-destructive-foreground hover:brightness-110",
      },
      size: {
        sm: "h-9 px-3.5 text-[13px]",
        md: "h-11 px-4",
        lg: "h-12 px-6 text-base",
        icon: "size-10",
      },
      block: { true: "w-full", false: "" },
    },
    defaultVariants: { variant: "primary", size: "md", block: false },
  },
);

type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({ className, variant, size, block, asChild, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp className={cn(buttonVariants({ variant, size, block }), className)} {...props} />
  );
}
