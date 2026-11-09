const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function ordinal(day: number): string {
  if (day % 100 >= 11 && day % 100 <= 13) return `${day}TH`;
  switch (day % 10) {
    case 1: return `${day}ST`;
    case 2: return `${day}ND`;
    case 3: return `${day}RD`;
    default: return `${day}TH`;
  }
}

/** "27TH JULY 2026" */
export function formatGreetingDate(date: Date): string {
  return `${ordinal(date.getDate())} ${MONTHS[date.getMonth()]!.toUpperCase()} ${date.getFullYear()}`;
}

export function greetingFor(date: Date): string {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function OverviewGreeting({ firstName, now = new Date() }: { firstName: string; now?: Date }) {
  return (
    <div>
      <p className="text-[13px] font-semibold leading-[18px] tracking-[0.2em] text-[#1E1E1E]">
        {formatGreetingDate(now)}
      </p>
      <h1 className="mt-[2px] text-[24px] font-medium leading-[30px] tracking-[-0.02em] text-[#A3A3A3]">
        {greetingFor(now)} <span className="font-semibold text-[#1E1E1E]">{firstName}</span>
      </h1>
    </div>
  );
}

OverviewGreeting.displayName = "OverviewGreeting";
