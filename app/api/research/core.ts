const TIMEOUT_MS = 10_000;
const MAX_BYTES = 1_500_000;
const MAX_CONTENT = 24_000;
const USER_AGENT = "Mozilla/5.0 (compatible; SlowStay/1.0; travel research)";

export type ResearchResult = {
  title: string;
  source: string;
  url: string;
  content: string;
  status: "success" | "error";
};

export function publicUrl(value: string): URL {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("请输入完整的 http 或 https 网址。"); }
  if (!/^https?:$/.test(url.protocol)) throw new Error("只支持 http 和 https 网址。");
  if (url.username || url.password) throw new Error("网址不能包含用户名或密码。");
  if (url.port && url.port !== "80" && url.port !== "443") throw new Error("只支持标准网页端口 80 和 443。");
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  // URL normalizes alternate IPv4 forms such as 2130706433 and 0x7f000001.
  if (!host.includes(".") || /[\[\]:]/.test(host) || /^[\d.]+$/.test(host) ||
      /(^|\.)(localhost|local|lan|internal|home|test|invalid|onion)$/.test(host)) {
    throw new Error("只允许公开网站域名，不支持本机、内网或 IP 地址。");
  }
  url.hostname = host;
  url.hash = "";
  return url;
}

export function isPublicAddress(address: string): boolean {
  if (address.includes(":")) {
    // Global unicast only; also exclude the documentation prefix.
    return /^[23][\da-f]{0,3}:/i.test(address) && !/^2001:db8:/i.test(address);
  }
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a, b, c] = parts;
  return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 0 || b === 168 || (b === 88 && c === 99))) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113));
}

export function htmlText(value: string): string {
  return decodeEntities(value)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<(script|style|noscript|svg)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<!--[^]*?-->/g, " ")
    .replace(/<(?:br|\/p|\/div|\/li|\/h[1-6]|\/section)\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[\t \r\f\v]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n").trim();
}

export function decodeEntities(value: string): string {
  const entities: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (whole, entity: string) => {
    if (entity.startsWith("#")) {
      const n = entity[1].toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : "";
    }
    return entities[entity.toLowerCase()] ?? whole;
  });
}

export function blockedPage(text: string): boolean {
  const sample = text.slice(0, 14_000).toLowerCase();
  return /requiring captcha|captcha verification|performing security verification|attention required![\s\S]*cloudflare|<title>\s*just a moment|title: just a moment|\/cdn-cgi\/challenge-platform\//.test(sample) ||
    /^title:\s*[^\n]*(?:安全验证|访问验证|验证中心|访问受限|验证码|登录|\blogin\b)/im.test(sample) ||
    /<title>[^<]*(?:安全验证|访问验证|验证中心|访问受限|验证码|登录|login)/i.test(sample) ||
    /(?:安全验证|请完成验证|拖动滑块|访问过于频繁|异常访问|访问被拒绝|请登录后|登录后查看更多|检测到有异常请求|请输入验证码|访问行为异常|验证后继续访问)/.test(sample) ||
    /warning:[^\n]*(?:403|429|forbidden)|target url returned error (?:403|429)/i.test(sample);
}

function decodeBody(bytes: Uint8Array, contentType: string): string {
  const sample = new TextDecoder().decode(bytes.slice(0, 4096));
  const charset = contentType.match(/charset\s*=\s*["']?([\w-]+)/i)?.[1] || sample.match(/charset\s*=\s*["']?([\w-]+)/i)?.[1];
  for (const encoding of [charset, "utf-8", "gb18030"]) {
    if (!encoding) continue;
    try { return new TextDecoder(encoding, { fatal: true }).decode(bytes); } catch { /* Try a compatible encoding. */ }
  }
  return new TextDecoder().decode(bytes);
}

async function responseText(response: Response, maxBytes: number): Promise<string> {
  if (Number(response.headers.get("content-length")) > maxBytes) throw new Error("网页内容超过读取大小限制。");
  if (!response.body) throw new Error("网站返回了空内容。");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new Error("网页内容超过读取大小限制。");
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return decodeBody(body, response.headers.get("content-type") || "");
}

async function ensurePublicHost(host: string): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const replies = await Promise.all(["A", "AAAA"].map(async (type) => {
      const response = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=${type}`, {
        headers: { Accept: "application/dns-json" }, signal: controller.signal, redirect: "error",
      });
      if (!response.ok) throw new Error("无法校验网站地址，请稍后重试。");
      const data = JSON.parse(await responseText(response, 100_000)) as { Answer?: { type: number; data: string }[] };
      return (data.Answer || []).filter((item) => item.type === 1 || item.type === 28).map((item) => item.data);
    }));
    const addresses = replies.flat();
    if (!addresses.length) throw new Error("未找到该网站的公开地址，请检查网址。");
    if (addresses.some((address) => !isPublicAddress(address))) throw new Error("网站地址指向内网或保留网络，无法读取。");
  } catch (error) {
    controller.abort();
    if (error instanceof Error && /^(无法校验|未找到|网站地址)/.test(error.message)) throw error;
    throw new Error("无法校验网站的公开地址，请稍后重试。");
  } finally { clearTimeout(timer); }
}

export async function fetchText(value: string, options: { headers?: Record<string, string>; verifyDns?: boolean } = {}): Promise<string> {
  let url = publicUrl(value);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    for (let hop = 0; hop <= 3; hop++) {
      if (options.verifyDns) await ensurePublicHost(url.hostname);
      const response = await fetch(url.toString(), {
        headers: { "User-Agent": USER_AGENT, Accept: "text/html,text/plain,application/xml,application/json;q=0.9,*/*;q=0.5", ...options.headers },
        signal: controller.signal,
        redirect: "manual",
      });
      if (response.status >= 300 && response.status < 400) {
        await response.body?.cancel();
        const location = response.headers.get("location");
        if (!location) throw new Error("网站重定向缺少目标地址。");
        url = publicUrl(new URL(location, url).toString());
        continue;
      }
      if (!response.ok) {
        await response.body?.cancel();
        if ([401, 403, 412, 429].includes(response.status)) throw new Error(`网站限制自动读取（HTTP ${response.status}），可打开来源页查看。`);
        throw new Error(`网站暂时无法访问（HTTP ${response.status}）。`);
      }
      const contentType = response.headers.get("content-type") || "";
      if (contentType && !/(text|json|xml|rss|atom)/i.test(contentType)) {
        await response.body?.cancel();
        throw new Error("该链接不是可读取的网页、文本或订阅源。");
      }
      const text = await responseText(response, MAX_BYTES);
      if (blockedPage(text)) throw new Error("网站返回了安全验证或登录页面，未获取到目标正文。可打开来源页查看。");
      return text;
    }
    throw new Error("网站重定向次数过多，已停止读取。");
  } catch (error) {
    if (controller.signal.aborted || (error instanceof Error && error.name === "AbortError")) throw new Error("读取超时，请稍后重试或打开来源页。");
    if (error instanceof Error && /fetch failed|network|failed to fetch/i.test(error.message)) throw new Error("暂时无法连接该网站，请稍后重试。");
    throw error;
  } finally { clearTimeout(timer); }
}

export async function readPage(value: string, untrustedUrl = false): Promise<string> {
  const url = publicUrl(value).toString();
  if (untrustedUrl) await ensurePublicHost(new URL(url).hostname);
  try {
    const text = await fetchText(`https://r.jina.ai/${url}`, { headers: { Accept: "text/plain" } });
    if (!text.trim() || /target url returned error (?:404|500|502|503)|warning:.*(?:404|500|502|503)/i.test(text)) throw new Error("目标网页暂无可读内容。");
    return text.slice(0, MAX_CONTENT);
  } catch {
    const text = await fetchText(url, { verifyDns: untrustedUrl });
    const clean = htmlText(text);
    if (clean.length < 40) throw new Error("网站未返回足够的可读正文，可能需要登录或由浏览器加载。");
    return clean.slice(0, MAX_CONTENT);
  }
}

export function errorText(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 300) : "读取失败，请稍后重试。";
}

function tag(block: string, name: string): string {
  return block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}\\s*>`, "i"))?.[1] || "";
}

export function parseFeed(xml: string, feedUrl: string, limit: number): ResearchResult[] {
  if (!/<(?:rss|feed|rdf:RDF)\b/i.test(xml)) throw new Error("该网址未返回 RSS 或 Atom 订阅内容。");
  const blocks = [...xml.matchAll(/<(item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/\1\s*>/gi)].slice(0, limit);
  return blocks.map((match) => {
    const block = match[2];
    const atomLink = [...block.matchAll(/<link\b([^>]*)\/?\s*>/gi)]
      .map((item) => item[1]).find((attributes) => !/\brel\s*=\s*["'](?:self|enclosure)["']/i.test(attributes));
    const href = atomLink?.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1] || tag(block, "link");
    let url = feedUrl;
    if (href.trim()) {
      try { url = publicUrl(new URL(decodeEntities(href.trim()), feedUrl).toString()).toString(); } catch { /* Keep the publicly validated feed URL for malformed links. */ }
    }
    return {
      title: htmlText(tag(block, "title")).slice(0, 250) || "未命名资讯",
      source: new URL(feedUrl).hostname,
      url,
      content: htmlText(tag(block, "description") || tag(block, "summary") || tag(block, "content") || tag(block, "content:encoded")).slice(0, 1600) || "该条目未提供摘要，可打开原文查看。",
      status: "success" as const,
    };
  });
}
