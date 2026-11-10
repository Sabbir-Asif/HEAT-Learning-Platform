import { FieldDescription, PageHeader } from "@heat/ui";
import { EnrollWizard } from "@/enroll/enroll-wizard";

export default function Page() {
  return (
    <>
      <PageHeader title="Enroll" />
      <FieldDescription>Step 1 of 2: your academic details.</FieldDescription>
      <EnrollWizard />
    </>
  );
}
