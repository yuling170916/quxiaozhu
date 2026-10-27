// Run: node --experimental-strip-types app/api/research/selftest.mjs
import assert from "node:assert/strict";
import { blockedPage, fetchText, htmlText, isPublicAddress, parseFeed, publicUrl } from "./core.ts";

for (const value of ["file:///etc/passwd", "http://localhost", "http://localhost.example.local", "http://127.0.0.1", "http://2130706433", "http://0x7f000001", "http://[::1]", "http://user:pass@example.com", "https://example.com:8080", "http://metadata.google.internal"]) {
  assert.throws(() => publicUrl(value), value);
}
assert.equal(publicUrl("https://example.com/path#fragment").href, "https://example.com/path");
assert.equal(isPublicAddress("8.8.8.8"), true);
assert.equal(isPublicAddress("2606:4700:4700::1111"), true);
for (const address of ["127.0.0.1", "10.0.0.2", "172.31.1.1", "192.168.1.2", "169.254.169.254", "100.64.0.1", "::1", "::ffff:127.0.0.1", "fd00::1", "2001:db8::1"]) assert.equal(isPublicAddress(address), false, address);
assert.equal(htmlText("<style>hide</style><script>alert('x')</script><h1>大理 &amp; 旅居</h1><p>月租&nbsp; &#x4e00;千</p>"), "大理 & 旅居\n月租 一千");
assert.equal(htmlText("&lt;p&gt;订阅摘要&lt;/p&gt;"), "订阅摘要");
assert.equal(blockedPage("Title: Just a moment...\nWarning: This page is requiring CAPTCHA"), true);
assert.equal(blockedPage("<title>安全验证</title><p>拖动滑块</p>"), true);
assert.equal(blockedPage("Title: 大理生活\n天气晴，欢迎查看租房信息。"), false);
const rss = '<rss><channel><item><title><![CDATA[大理 &amp; 新闻]]></title><link>https://example.com/news</link><description><![CDATA[<p>这是摘要</p>]]></description></item></channel></rss>';
assert.deepEqual(parseFeed(rss, "https://example.com/feed", 6)[0], { title: "大理 & 新闻", source: "example.com", url: "https://example.com/news", content: "这是摘要", status: "success" });
const atom = '<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>本地公告</title><link rel="self" href="https://example.com/feed/1"/><link href="/post"/><summary>周末天气</summary></entry></feed>';
assert.equal(parseFeed(atom, "https://example.com/feed", 1)[0].url, "https://example.com/post");
assert.throws(() => parseFeed("<html>login</html>", "https://example.com", 6), /RSS/);
const originalFetch = globalThis.fetch;
try {
  globalThis.fetch = async () => Response.json({ Answer: [{ type: 1, data: "127.0.0.1" }] });
  await assert.rejects(() => fetchText("https://public-looking.example.com", { verifyDns: true }), /指向内网/);
  globalThis.fetch = async () => new Response(null, { status: 302, headers: { location: "http://127.0.0.1/secret" } });
  await assert.rejects(() => fetchText("https://example.com"), /公开网站/);
  globalThis.fetch = async () => new Response("restricted", { status: 403 });
  await assert.rejects(() => fetchText("https://example.com"), /限制自动读取/);
  globalThis.fetch = async () => new Response("<title>安全验证</title>", { headers: { "content-type": "text/html" } });
  await assert.rejects(() => fetchText("https://example.com"), /验证/);
  globalThis.fetch = async () => new Response("large", { headers: { "content-length": "9000000" } });
  await assert.rejects(() => fetchText("https://example.com"), /大小限制/);
  globalThis.fetch = async () => new Response("正常公开网页正文", { headers: { "content-type": "text/plain" } });
  assert.equal(await fetchText("https://example.com"), "正常公开网页正文");
} finally { globalThis.fetch = originalFetch; }
console.log("Research API self-check passed: URL safety, private addresses, HTML, challenge pages, RSS/Atom, redirects, HTTP failures, body limits.");
