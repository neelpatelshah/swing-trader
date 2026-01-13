import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const asOf = searchParams.get("asOf");
  const limit = parseInt(searchParams.get("limit") || "50", 10);

  // TODO: Query scores from database
  return NextResponse.json({
    asOfDate: asOf || new Date().toISOString().split("T")[0],
    rows: [],
    _meta: { limit },
  });
}
