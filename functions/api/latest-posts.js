
const BLOGS = ["cyk2410", "sjykmk1031"];

function decode(value = "") {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function field(xml, tag) {
  const regex = new RegExp(
    `<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`,
    "i"
  );
  return decode(xml.match(regex)?.[1] || "");
}

function parseRSS(xml) {
  return [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)]
    .map((match) => {
      const item = match[1];
      const title = field(item, "title");
      const link = field(item, "link");
      const timestamp = Date.parse(field(item, "pubDate"));

      return {
        title,
        link,
        date: Number.isFinite(timestamp)
          ? new Date(timestamp).toISOString()
          : "",
        stamp: Number.isFinite(timestamp) ? timestamp : 0,
      };
    })
    .filter((post) => post.title && /^https?:\/\//.test(post.link));
}

export async function onRequestGet() {
  const warnings = [];

  const results = await Promise.all(
    BLOGS.map(async (id) => {
      try {
        const response = await fetch(
          `https://rss.blog.naver.com/${id}.xml`,
          {
            headers: {
              Accept: "application/rss+xml, application/xml, text/xml",
            },
            signal: AbortSignal.timeout(8500),
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const posts = parseRSS(await response.text());

        if (!posts.length) {
          throw new Error("RSS 항목 없음");
        }

        return posts;
      } catch (error) {
        warnings.push(`${id}: ${error.message}`);
        return [];
      }
    })
  );

  const posts = [
    ...new Map(
      results.flat().map((post) => [post.link, post])
    ).values(),
  ]
    .sort((a, b) => b.stamp - a.stamp)
    .slice(0, 6)
    .map(({ stamp, ...post }) => post);

  return new Response(JSON.stringify({ posts, warnings }), {
    status: posts.length ? 200 : 503,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=900",
    },
  });
}
