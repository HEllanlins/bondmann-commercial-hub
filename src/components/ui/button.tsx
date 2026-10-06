import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl text-sm font-semibold transition-all disabled:pointer-events-none disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary/90",
        glass: "glass-strong text-foreground hover:bg-card/85",
        signal: "bg-bond text-accent-foreground shadow-lg shadow-bond/25 hover:brightness-105",
        outline: "border border-border bg-transparent text-foreground hover:bg-secondary",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "text-steel hover:bg-secondary hover:text-foreground",
        link: "text-aqua underline-offset-4 hover:underline",
        destructive: "bg-destructive text-destructive-foreground hover:brightness-110",
      },
      size: {
        default: "h-11 px-4",
        sm: "h-9 rounded-xl px-3.5 text-[13px]",
        lg: "h-12 px-6 text-base",
        icon: "size-10",
      },
      block: { true: "w-full", false: "" },
    },
    defaultVariants: { variant: "default", size: "default", block: false },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, block, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, block }), className)}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button };
