import { installSampleLibrary } from "@/lib/sample";

export async function POST() {
  const result = installSampleLibrary();
  return Response.json(result);
}
