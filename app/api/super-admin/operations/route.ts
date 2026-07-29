import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth";
import { getOperationsBoardDataWithLookup } from "@/lib/operations";

export async function GET() {
  const auth = await requireApiRole("SUPER_ADMIN");

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const board = await getOperationsBoardDataWithLookup();

  return NextResponse.json({
    ok: true,
    board,
  });
}

