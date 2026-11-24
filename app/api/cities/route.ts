import { searchCities } from "@/lib/cities";

export function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q") ?? "";
  if (query.length > 80) return Response.json([]);
  return Response.json(searchCities(query));
}
