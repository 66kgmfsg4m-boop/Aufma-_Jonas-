import { searchParts } from "@/lib/db";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const result = searchParts({
    q: url.searchParams.get("q") ?? "",
    unit: url.searchParams.get("unit") ?? "",
    supplier: url.searchParams.get("supplier") ?? "",
    docType: url.searchParams.get("docType") ?? "",
  });
  return Response.json(result);
}
