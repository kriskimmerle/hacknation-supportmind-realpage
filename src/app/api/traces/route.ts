import { NextResponse } from "next/server";

import fs from "node:fs";
import path from "node:path";

import { projectDataPath } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const ticketNumber = (url.searchParams.get("ticketNumber") || "").trim();
  const limit = Number(url.searchParams.get("limit") || "8") || 8;
  if (!ticketNumber) return NextResponse.json({ error: "Missing ticketNumber" }, { status: 400 });

  const dir = projectDataPath("traces", ticketNumber);
  try {
    const files = walkJsonFiles(dir).sort((a, b) => b.mtimeMs - a.mtimeMs).slice(0, limit);
    const items = files.map((f) => {
      let data: unknown = null;
      try {
        data = JSON.parse(fs.readFileSync(f.fullPath, "utf-8"));
      } catch {
        data = null;
      }
      return {
        name: f.relPath,
        fullPath: f.fullPath,
        mtimeMs: f.mtimeMs,
        data,
      };
    });
    return NextResponse.json({ ticketNumber, dir, items });
  } catch {
    return NextResponse.json({ ticketNumber, dir, items: [] });
  }
}

function walkJsonFiles(root: string): Array<{ fullPath: string; relPath: string; mtimeMs: number }> {
  const out: Array<{ fullPath: string; relPath: string; mtimeMs: number }> = [];
  const visit = (dir: string) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const fp = path.join(dir, e.name);
      if (e.isDirectory()) {
        visit(fp);
      } else if (e.isFile() && e.name.endsWith(".json")) {
        const st = fs.statSync(fp);
        out.push({ fullPath: fp, relPath: fp.slice(root.length + 1), mtimeMs: st.mtimeMs });
      }
    }
  };
  if (!fs.existsSync(root)) return out;
  visit(root);
  return out;
}
