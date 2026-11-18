export type SpinnerTone = 'brand' | 'current' | 'inverse';
export function Spinner({ size = 'md', tone = 'brand' }: {
    size?: 'xs' | 'sm' | 'md' | 'lg';
    tone?: SpinnerTone;
}) { return <span role="status" aria-label="Loading" className={`inline-block animate-spin rounded-full border-2 border-current border-r-transparent ${tone === 'brand' ? 'text-primary-500' : 'text-current'} ${size === 'sm' || size === 'xs' ? 'h-4 w-4' : size === 'lg' ? 'h-8 w-8' : 'h-6 w-6'}`}/>; }
export type SpinnerSize = "xs" | "sm" | "md" | "lg";
export type SpinnerProps = {
    size?: SpinnerSize;
    tone?: SpinnerTone;
};
