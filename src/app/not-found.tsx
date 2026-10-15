import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-20 text-center">
      <h1 className="text-2xl font-semibold">Not found</h1>
      <p className="mt-2 text-sm text-ink-2">That project or page isn&apos;t tracked here.</p>
      <Link href="/" className="mt-6 inline-block text-sm text-accent underline">
        All projects
      </Link>
    </div>
  );
}
