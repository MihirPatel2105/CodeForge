import { cn } from "@/lib/utils";

/**
 * Six ring segments represent the five agents plus the sandbox. The return
 * arrow represents feedback, while the node represents the inspectable result.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn("shrink-0 text-accent", className)}
      role="img"
      aria-label="CodeForge"
    >
      <defs>
        <linearGradient id="codeforge-mark-gradient" x1="10" y1="8" x2="52" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3157e8" />
          <stop offset="0.52" stopColor="#4338ca" />
          <stop offset="1" stopColor="#5b32d6" />
        </linearGradient>
      </defs>
      <g
        fill="none"
        stroke="url(#codeforge-mark-gradient)"
        strokeWidth="9.5"
        strokeLinecap="butt"
      >
        <path d="M48.721 16.945A22.5 22.5 0 0 0 34.742 9.668" />
        <path d="M32.393 9.503A22.5 22.5 0 0 0 17.537 14.764" />
        <path d="M15.815 16.37A22.5 22.5 0 0 0 9.531 30.822" />
        <path d="M9.531 33.178A22.5 22.5 0 0 0 15.815 47.63" />
        <path d="M17.537 49.236A22.5 22.5 0 0 0 32.393 54.497" />
        <path d="M34.742 54.332A22.5 22.5 0 0 0 48.721 47.055" />
      </g>

      <path
        d="M35.75 27.2h-9.4v-4.7l-8.8 8.75a.8.8 0 0 0 0 1.1l8.8 8.75v-4.7h9.4Z"
        fill="url(#codeforge-mark-gradient)"
      />
      <circle cx="41.8" cy="31.8" r="6.2" fill="url(#codeforge-mark-gradient)" />
      <path
        d="M41.45 38.6c-1.55 5.25-5.55 7.8-11.4 7.8h-6.5c-3.4 0-5.75-1.95-6.7-4.85"
        fill="none"
        stroke="url(#codeforge-mark-gradient)"
        strokeWidth="6.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
