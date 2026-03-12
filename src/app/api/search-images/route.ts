import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { query, start } = await req.json();

    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "query is required" }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
    const cx = process.env.GOOGLE_SEARCH_CX;

    if (!apiKey || !cx) {
      return NextResponse.json(
        { error: "Google Search API not configured on server" },
        { status: 500 }
      );
    }

    const url = `https://customsearch.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(query)}&searchType=image&start=${start || 1}&num=10`;

    const res = await fetch(url);
    const text = await res.text();

    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { error: `Google API returned non-JSON (status ${res.status})` },
        { status: 500 }
      );
    }

    if (json.error) {
      return NextResponse.json({ error: json.error.message || "Search failed" }, { status: 500 });
    }

    const items = (json.items || []).map((item: any) => ({
      id: item.link,
      imageUrl: item.link,
      name: item.title,
      width: item.image?.width,
      height: item.image?.height,
      thumbnail: item.image?.thumbnailLink,
    }));

    return NextResponse.json({ items });
  } catch (err: any) {
    console.error("search-images route error:", err);
    return NextResponse.json({ error: err.message || "Search failed" }, { status: 500 });
  }
}
