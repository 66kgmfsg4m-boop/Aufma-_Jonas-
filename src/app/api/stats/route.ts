import { libraryStats } from "@/lib/db";

export async function GET() {
  return Response.json(libraryStats());
}
