import { installSampleLibrary } from "@/lib/sample";

export async function POST() {
  const result = await installSampleLibrary();
  return Response.json(result);
}
