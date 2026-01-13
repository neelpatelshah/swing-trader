import { NextResponse } from "next/server";

export async function GET() {
  // TODO: Query tickers from database
  return NextResponse.json({
    tickers: [],
  });
}
