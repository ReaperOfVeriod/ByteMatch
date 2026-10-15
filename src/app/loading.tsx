import { Bone, PageSkeleton } from "@/components/skeleton";

/** Any page while it loads: a heading, a line of text and a few panels. */
export default function Loading() {
  return (
    <PageSkeleton>
      <div className="grid max-w-2xl gap-3">
        <Bone className="h-8 w-64" />
        <Bone className="h-4 w-full" />
        <Bone className="h-4 w-4/5" />
      </div>
      <div className="panel grid gap-3 p-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <Bone key={i} className="h-12 w-full" />
        ))}
      </div>
    </PageSkeleton>
  );
}
