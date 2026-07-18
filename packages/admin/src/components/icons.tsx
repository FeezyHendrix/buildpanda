import type { SVGProps } from "react";

function I(props: SVGProps<SVGSVGElement>) {
  return {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...props,
  };
}

export const DashboardIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...I(p)}>
    <rect x="3" y="3" width="7" height="9" rx="1.5" />
    <rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="12" width="7" height="9" rx="1.5" />
    <rect x="3" y="16" width="7" height="5" rx="1.5" />
  </svg>
);

export const UsersIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...I(p)}>
    <circle cx="9" cy="8" r="3" />
    <path d="M3 20a6 6 0 0 1 12 0" />
    <path d="M16 6a3 3 0 0 1 0 6M21 20a6 6 0 0 0-4-5.7" />
  </svg>
);

export const OrgIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...I(p)}>
    <path d="M3 21h18" />
    <path d="M5 21V5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v16" />
    <path d="M14 9h4a1 1 0 0 1 1 1v11" />
    <path d="M8 8h2M8 12h2M8 16h2" />
  </svg>
);

export const ProjectIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...I(p)}>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
  </svg>
);

export const SearchIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...I(p)}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

export const LogoutIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...I(p)}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="M16 17l5-5-5-5M21 12H9" />
  </svg>
);

export const ChevronLeftIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...I(p)}>
    <path d="M15 18l-6-6 6-6" />
  </svg>
);

export const TrashIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...I(p)}>
    <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
  </svg>
);

export const BanIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...I(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="m5.6 5.6 12.8 12.8" />
  </svg>
);

export const ShieldIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...I(p)}>
    <path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6Z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);

export const LeadsIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...I(p)}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

export const JobsIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...I(p)}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M3 9h18M8 14l2 2 4-4" />
  </svg>
);

export const GrowthIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...I(p)}>
    <path d="M3 17l6-6 4 4 8-8" />
    <path d="M17 3h4v4" />
  </svg>
);

export const EngagementIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...I(p)}>
    <path d="M22 12h-4l-3 8-4-16-3 8H4" />
  </svg>
);

export const AiOpsIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...I(p)}>
    <rect x="8" y="8" width="8" height="8" rx="1" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1" />
  </svg>
);

export const MaintenanceIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...I(p)}>
    <path d="M14.7 6.3a4 4 0 0 1-5.4 5.4L4 17v3h3l5.3-5.3a4 4 0 0 1 5.4-5.4l-2.5 2.5-2-2 2.5-2.5z" />
  </svg>
);

export const FlagIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...I(p)}>
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V4s-1 1-4 1-5-2-8-2-4 1-4 1z" />
    <line x1="4" y1="22" x2="4" y2="15" />
  </svg>
);
