import {
  PageHeaderSkeleton,
  CardGridSkeleton,
  Skeleton,
} from "@/components/ui/Skeleton";

// Default instant loading shell for every dashboard route that doesn't define
// its own. Shown immediately on client navigation while the page's data loads.
export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <CardGridSkeleton count={3} className="grid grid-cols-1 gap-4 sm:grid-cols-3" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
