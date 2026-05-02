import { forwardRef } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";

interface NavLinkCompatProps {
  to: string;
  className?: string;
  activeClassName?: string;
  children?: React.ReactNode;
  [key: string]: any;
}

const NavLink = forwardRef<HTMLAnchorElement, NavLinkCompatProps>(
  ({ className, activeClassName, to, children, ...props }, ref) => {
    const [location] = useLocation();
    const isActive = location === to || (to !== "/" && location.startsWith(to));
    return (
      <Link
        ref={ref}
        to={to}
        className={cn(className, isActive && activeClassName)}
        {...props}
      >
        {children}
      </Link>
    );
  },
);

NavLink.displayName = "NavLink";

export { NavLink };
