import { FileBarChart } from "lucide-react";
import { requireStaff } from "@/lib/dal";
import { PagePlaceholder } from "@/components/PagePlaceholder";

export default async function ReportsPage() {
  await requireStaff();
  return (
    <PagePlaceholder
      title="Reports"
      description="Custody register, idle assets, valuation, and CSV export."
      phase="Phase 5"
      icon={FileBarChart}
    />
  );
}
