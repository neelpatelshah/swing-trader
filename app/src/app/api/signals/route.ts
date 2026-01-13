import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const asOf = searchParams.get("asOf");

  // TODO: Query latest signal from database
  return NextResponse.json({
    asOfDate: asOf || new Date().toISOString().split("T")[0],
    row: null,
  });
}
