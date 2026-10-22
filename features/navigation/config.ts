import type { NavigationItem } from "./types";

type NavigationKeySubItem = {
  key: string;
  href: string;
  icon?: string;
};

type NavigationKeyItem = {
  key: string;
  href: string;
  target?: "_blank";
  subItems?: NavigationKeySubItem[];
};

// These are the navigation keys for translation
export const marketingNavigationKeys: NavigationKeyItem[] = [
  {
    key: "idiom",
    href: "/idiom",
  },
  {
    key: "pricing",
    href: "/pricing",
  },
  {
    key: "contact",
    href: "/contact",
  },
  {
    key: "docs",
    href: "/docs",
    target: "_blank",
  },
];

export const appNavigationKeys: NavigationKeyItem[] = [
  {
    key: "dashboard",
    href: "/dashboard",
  },
  {
    key: "settings",
    href: "/settings",
  },
  {
    key: "profile",
    href: "/profile",
  },
];

// Legacy exports for compatibility
export const marketingNavigation: NavigationItem[] = [
  {
    title: "成语解释器",
    href: "/idiom",
  },
  {
    title: "Pricing",
    href: "/pricing",
  },
  {
    title: "Contact",
    href: "/contact",
  },
  {
    title: "Docs",
    href: "/docs",
    target: "_blank",
  },
];

export const appNavigation: NavigationItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
  },
  {
    title: "Settings",
    href: "/settings",
  },
  {
    title: "Profile",
    href: "/profile",
  },
];
