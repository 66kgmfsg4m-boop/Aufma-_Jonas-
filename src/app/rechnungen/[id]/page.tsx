import { InvoiceHistoryView } from "@/components/invoices-view";

export default async function InvoiceHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <InvoiceHistoryView id={id} />;
}
