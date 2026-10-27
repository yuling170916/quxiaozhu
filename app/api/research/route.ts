import { errorText, fetchText, htmlText, parseFeed, publicUrl, readPage, type ResearchResult } from "./core";

const CITY_PINYIN: Record<string, string> = {
  大理: "dali", 昆明: "km", 成都: "cd", 丽江: "lijiang", 三亚: "sanya", 北海: "beihai", 威海: "weihai", 海口: "haikou",
  杭州: "hz", 苏州: "su", 厦门: "xm", 青岛: "qd", 广州: "gz", 深圳: "sz", 重庆: "cq", 西安: "xa", 长沙: "cs", 武汉: "wh",
  南京: "nj", 天津: "tj", 上海: "sh", 北京: "bj", 贵阳: "gy", 桂林: "guilin", 珠海: "zh", 佛山: "fs", 东莞: "dg", 南宁: "nn",
  大理白族自治州: "dali", 腾冲: "tengchong", 西双版纳: "xishuangbanna", 建水: "jianshui", 伊春: "yichun", 鹤岗: "hegang",
};

const CITY_CODES: Record<string, string> = {
  大理: "101290201", 昆明: "101290101", 丽江: "101291401", 成都: "101270101", 三亚: "101310201", 北海: "101301301",
  威海: "101121301", 海口: "101310101", 杭州: "101210101", 苏州: "101190401", 厦门: "101230201", 青岛: "101120201",
  广州: "101280101", 深圳: "101280601", 重庆: "101040100", 西安: "101110101", 长沙: "101250101", 武汉: "101200101",
  南京: "101190101", 上海: "101020100", 北京: "101010100", 贵阳: "101260101", 桂林: "101300501", 珠海: "101280701",
  腾冲: "101290503", 西双版纳: "101291601",
};

type Entry = { source: string; url: string; title: string };
type Video = { title: string; url: string; author: string; plays: string | number };

const SOURCES: Record<string, string> = { douban: "豆瓣租房小组", anjuke: "安居客", ke: "贝壳/链家", dianping: "大众点评关键词", city: "大众点评城市页" };

function response(query: string, results: ResearchResult[], status = 200, videos?: Video[]) {
  return Response.json({ query, results, fetchedAt: new Date().toISOString(), ...(videos ? { videos } : {}) }, {
    status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}

async function readEntries(entries: Entry[]): Promise<ResearchResult[]> {
  const results: ResearchResult[] = [];
  // Preserve the original tool's source order and independent failure reporting.
  for (const entry of entries) {
    try { results.push({ ...entry, content: await readPage(entry.url), status: "success" }); }
    catch (error) { results.push({ ...entry, content: errorText(error), status: "error" }); }
  }
  return results;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const type = params.get("type") || "rent";
  const city = (params.get("city") || "大理").trim().slice(0, 60);
  const keyword = (params.get("keyword") || "").trim().slice(0, 160);
  const district = (params.get("district") || "").trim().slice(0, 100);
  const source = params.get("source") || "all";
  const inputUrl = (params.get("url") || "").trim();
  const requestedLimit = Number(params.get("limit") || 6);
  const limit = Number.isFinite(requestedLimit) ? Math.min(12, Math.max(1, Math.floor(requestedLimit))) : 6;
  const query = type === "read" || type === "feeds" ? inputUrl : [city, keyword].filter(Boolean).join(" ");
  try {
    if (!["rent", "weather", "facilities", "bili", "read", "feeds"].includes(type)) throw new Error("未知检索类型，请选择租房、天气、周边、视频、网页或 RSS。");
    if (["rent", "weather", "facilities", "bili"].includes(type) && !city) throw new Error("请先填写城市名称。");
    const pinyin = CITY_PINYIN[city] || (/^[a-z][a-z0-9-]{0,39}$/i.test(city) ? city : "");
    let entries: Entry[] = [];

    if (type === "rent") {
      entries = [
        { source: "豆瓣租房小组", title: `${city} · ${keyword || "租房信息"}`, url: `https://www.douban.com/group/search?cat=1019&q=${encodeURIComponent(query)}` },
        { source: "安居客", title: `${city}租房 · ${keyword || "全部房源"}`, url: `https://zu.anjuke.com/fangyuan/${encodeURIComponent(city)}/${keyword ? `${encodeURIComponent(keyword)}/` : ""}` },
      ];
      if (pinyin) entries.push({ source: "贝壳/链家", title: `${city}${district} · 租房`, url: `https://${pinyin}.zu.ke.com/zufang/${district ? `${encodeURIComponent(district)}/` : ""}` });
      const wanted = SOURCES[source] || source;
      if (source !== "all") entries = entries.filter((entry) => entry.source.includes(wanted));
      if (!entries.length) throw new Error("未识别该租房来源，可选：豆瓣租房小组、安居客、贝壳/链家。");
      const results = await readEntries(entries);
      if (!pinyin && (source === "all" || wanted === "贝壳/链家")) results.push({ title: `${city} · 租房`, source: "贝壳/链家", url: "https://www.ke.com/", content: "该城市暂无内置站点拼音映射，请使用城市拼音或打开贝壳网站选择城市。", status: "error" });
      return response(query, results);
    }

    if (type === "weather") {
      const code = CITY_CODES[city] || (/^\d{9}$/.test(city) ? city : "");
      if (!code) throw new Error(`暂未收录“${city}”的天气城市代码，可填写中国天气网的 9 位城市代码。`);
      return response(query, await readEntries([{ title: `${city} · 7 天天气预报`, source: "中国天气网", url: `http://www.weather.com.cn/weather/${code}.shtml` }]));
    }

    if (type === "facilities") {
      if (!pinyin) throw new Error("该城市暂无内置拼音映射，请使用城市拼音重试。");
      entries = [
        { source: "大众点评城市页", title: `${city} · 生活服务`, url: `https://www.dianping.com/${pinyin}/` },
        { source: "大众点评关键词", title: `${city} · ${keyword || "周边设施"}`, url: `https://www.dianping.com/${pinyin}/search/keyword/0_${encodeURIComponent(keyword || "菜市场")}` },
      ];
      if (source !== "all") entries = entries.filter((entry) => entry.source.includes(SOURCES[source] || source));
      if (!entries.length) throw new Error("未识别该设施来源，可选：大众点评城市页、大众点评关键词。");
      return response(query, await readEntries(entries));
    }

    if (type === "bili") {
      const searchQuery = query || `${city} 旅居`;
      const searchUrl = `https://search.bilibili.com/all?keyword=${encodeURIComponent(searchQuery)}`;
      try {
        const json = await fetchText(`https://api.bilibili.com/x/web-interface/search/all/v2?keyword=${encodeURIComponent(searchQuery)}&page=1`, { headers: { Referer: "https://www.bilibili.com/", Accept: "application/json" } });
        const data = JSON.parse(json) as { code: number; message?: string; data?: { result?: { result_type: string; data?: { title?: string; bvid?: string; author?: string; play?: string | number }[] }[] } };
        if (data.code !== 0) throw new Error(`B 站暂时限制公开搜索（${data.code}），可打开 B 站搜索查看。`);
        const videos: Video[] = (data.data?.result || []).filter((block) => block.result_type === "video").flatMap((block) => block.data || [])
          .filter((video) => /^BV[\da-z]+$/i.test(video.bvid || "")).slice(0, limit)
          .map((video) => ({ title: htmlText(video.title || "未命名视频"), url: `https://www.bilibili.com/video/${video.bvid}`, author: htmlText(video.author || ""), plays: video.play || 0 }));
        return response(searchQuery, videos.length ? videos.map((video) => ({ title: video.title, source: "哔哩哔哩", url: video.url, content: `UP 主：${video.author || "未知"} · 播放量：${video.plays}`, status: "success" })) : [{ title: "暂无相关视频", source: "哔哩哔哩", url: searchUrl, content: "这次检索未返回视频，可更换关键词或打开 B 站搜索。", status: "success" }], 200, videos);
      } catch (error) { return response(searchQuery, [{ title: "B 站视频检索", source: "哔哩哔哩", url: searchUrl, content: errorText(error), status: "error" }], 200, []); }
    }

    if (!inputUrl) throw new Error(type === "feeds" ? "请填写 RSS 或 Atom 订阅网址。" : "请填写要阅读的网页网址。");
    const url = publicUrl(inputUrl).toString();
    if (type === "read") {
      try { return response(query, [{ title: new URL(url).hostname, source: "网页正文", url, content: await readPage(url, true), status: "success" }]); }
      catch (error) { return response(query, [{ title: "网页阅读", source: new URL(url).hostname, url, content: errorText(error), status: "error" }]); }
    }
    try {
      const xml = await fetchText(url, { verifyDns: true });
      const results = parseFeed(xml, url, limit);
      return response(query, results.length ? results : [{ title: "订阅暂无更新", source: new URL(url).hostname, url, content: "该 RSS 或 Atom 源目前没有可显示的条目。", status: "success" }]);
    } catch (error) { return response(query, [{ title: "RSS 订阅读取", source: new URL(url).hostname, url, content: errorText(error), status: "error" }]); }
  } catch (error) {
    return response(query, [{ title: "请检查检索条件", source: "旅居检索", url: "", content: errorText(error), status: "error" }], 400);
  }
}
