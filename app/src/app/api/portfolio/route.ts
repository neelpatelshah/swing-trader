import { NextResponse } from "next/server";

export async function GET() {
  // TODO: Query portfolio state from database
  return NextResponse.json({
    currentSymbol: null,
    entryDate: null,
    entryPrice: null,
    shares: null,
  });
}

export async function POST(request: Request) {
  const body = await request.json();

  // TODO: Update portfolio state in database
  return NextResponse.json({
    success: true,
    ...body,
  });
}
