import { listDocuments } from "@/lib/db";

export async function GET() {
  return Response.json({ documents: listDocuments() });
}
