import { PageSkeleton, RowsSkeleton, TabsSkeleton } from "@/components/ui/skeleton";

/** Studio placeholder: header with the authoring actions, the lessons/materials tabs and the rows. */
export default function StudioLoading() {
  return (
    <PageSkeleton icon action>
      <TabsSkeleton count={2} />
      <RowsSkeleton count={4} />
    </PageSkeleton>
  );
}
