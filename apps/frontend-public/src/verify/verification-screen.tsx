import {
  FieldDescription,
  PageHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@heat/ui";
import { ShellContent } from "@heat/ui/shell";
import type { VerificationModel } from "./verification-view";

export function VerificationScreen({ model }: { model: VerificationModel }) {
  return (
    <ShellContent>
      <PageHeader title={model.heading} />
      <FieldDescription role={model.valid ? "status" : "alert"}>{model.note}</FieldDescription>
      <Table aria-label="Certificate details">
        <TableHeader>
          <TableRow>
            <TableHead>Detail</TableHead>
            <TableHead>Value</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {model.rows.map((row) => (
            <TableRow key={row.label}>
              <TableCell>{row.label}</TableCell>
              <TableCell>{row.value}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ShellContent>
  );
}
