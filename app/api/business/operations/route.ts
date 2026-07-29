import { NextResponse } from "next/server";
import { requireApiBusinessSession } from "@/lib/auth";
import { getOperationsBoardDataWithLookup } from "@/lib/operations";

export async function GET() {
  const auth = await requireApiBusinessSession();

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const board = await getOperationsBoardDataWithLookup(auth.session.businessId);

  return NextResponse.json({
    ok: true,
    board,
  });
}

