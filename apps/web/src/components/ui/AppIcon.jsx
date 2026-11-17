export default function AppIcon({ name, ...props }) {
  const shapes = {
    home: (
      <>
        <path d="m3 10 9-7 9 7v11H3Z" />
        <path d="M9 21v-8h6v8" />
      </>
    ),
    dashboard: (
      <>
        <rect x="3" y="3" width="7" height="18" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),
    income: <path d="M12 3v18m-6-6 6 6 6-6" />,
    expenses: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 10h18" />
      </>
    ),
    investments: <path d="m3 18 6-6 4 3 8-11m-6 0h6v6" />,
    chat: <path d="M3 3h18v14H8l-5 4Zm4 5h10M7 12h7" />,
    menu: <path d="M3 6h18M3 12h18M3 18h18" />,
    bell: (
      <>
        <path d="M5 17V9a7 7 0 0 1 14 0v8l2 2H3ZM9 22h6" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="7" r="4" />
        <path d="M4 21v-3a8 8 0 0 1 16 0v3Z" />
      </>
    ),
    attach: (
      <path d="M8 8v9a4 4 0 0 0 8 0V6a3 3 0 0 0-6 0v10a1 1 0 0 0 2 0V7" />
    ),
    send: <path d="M12 21V3m-7 7 7-7 7 7" />,
    search: (
      <>
        <circle cx="10" cy="10" r="7" />
        <path d="m16 16 5 5" />
      </>
    ),
    spark: <path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z" />,
    plus: <path d="M12 3v18M3 12h18" />,
    settings: (
      <>
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
  };
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {shapes[name] || shapes.chat}
    </svg>
  );
}
