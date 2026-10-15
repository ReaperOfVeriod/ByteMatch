import { Bone, PageSkeleton } from "@/components/skeleton";

/** A project page while it loads: breadcrumb, the summary with its bar, the unit map and the sidebar. */
export default function Loading() {
  return (
    <PageSkeleton>
      <Bone className="h-5 w-72" />
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 xl:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="grid min-w-0 gap-5">
          <div className="panel grid gap-4 p-6 sm:p-7">
            <Bone className="h-8 w-3/4" />
            <Bone className="h-4 w-40" />
            <Bone className="mt-2 h-4 w-full" />
            <Bone className="h-3 w-1/2" />
          </div>
          <div className="panel p-5 sm:p-6">
            <Bone className="h-[clamp(360px,calc(100vh-360px),720px)] w-full" />
          </div>
        </div>
        <div className="grid gap-4">
          <div className="panel grid gap-3 p-5">
            <Bone className="h-4 w-24" />
            <Bone className="h-24 w-full" />
          </div>
          <div className="panel grid gap-3 p-5">
            <Bone className="h-4 w-24" />
            <Bone className="h-40 w-full" />
          </div>
        </div>
      </div>
    </PageSkeleton>
  );
}
