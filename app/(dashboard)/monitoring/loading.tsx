import { PageHeaderSkeleton, CardGridSkeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <CardGridSkeleton
        count={6}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      />
    </div>
  );
}
