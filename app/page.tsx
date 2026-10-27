"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowDownToLine, ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Bookmark, Check, CheckCheck, ChevronDown, CircleHelp, CloudSun, Compass, ExternalLink, Globe2, House, Leaf, LoaderCircle, MapPin, Menu, Plus, Radio, Search, ShieldCheck, SlidersHorizontal, Store, Sun, Video, Waves, X } from "lucide-react";

type Tool = "rent" | "weather" | "facilities" | "bili" | "read" | "feeds";
type View = "home" | "saved" | Tool;
type Result = { title: string; source: string; url: string; content: string; status: "success" | "error" };
type ResponseData = { query: string; results: Result[]; fetchedAt: string; videos?: {title:string;url:string;author:string;plays:string|number}[] };
const tools = [
  { id: "rent" as Tool, title: "房租检索", icon: House, desc: "找到住下来的可能", detail: "汇集豆瓣、安居客与贝壳的租房信息。", color: "clay", placeholder: "月租、一居室、带院子…", source: "豆瓣 · 安居客 · 贝壳" },
  { id: "weather" as Tool, title: "天气气候", icon: CloudSun, desc: "先看看那里的晴雨", detail: "查看未来 7 天天气，为日常生活做准备。", color: "ochre", placeholder: "城市名或中国天气网城市代码", source: "中国天气网" },
  { id: "facilities" as Tool, title: "生活设施", icon: Store, desc: "把生活半径看清楚", detail: "了解菜市场、医院、商超和公共交通。", color: "sage", placeholder: "菜市场、医院、超市、地铁…", source: "大众点评" },
  { id: "bili" as Tool, title: "实地体验", icon: Video, desc: "听听住过的人怎么说", detail: "从 B 站实地记录里，寻找真实生活细节。", color: "clay", placeholder: "旅居 房租，或你感兴趣的话题…", source: "哔哩哔哩" },
  { id: "read" as Tool, title: "网页阅读", icon: BookOpen, desc: "让好信息更容易读", detail: "粘贴网页链接，提取清晰可读的正文。", color: "cocoa", placeholder: "https://example.com/article", source: "Jina Reader · 网页直连" },
  { id: "feeds" as Tool, title: "本地资讯", icon: Radio, desc: "与当地的日常保持同步", detail: "读取 RSS / Atom，看看当地正在发生什么。", color: "sage", placeholder: "粘贴 RSS / Atom 订阅链接", source: "RSS / Atom" },
];
const cities = ["大理", "成都", "威海", "昆明", "丽江", "三亚", "北海", "厦门", "杭州", "西双版纳", "腾冲", "桂林", "海口", "青岛", "北京", "上海", "广州", "深圳"];
const destinations = [
  { city: "大理", desc: "苍山脚下，洱海边上。", image: "/images/dali-hero.png", style: "dali" },
  { city: "成都", desc: "一杯盖碗茶，一座慢城。", image: "/images/chengdu.png", style: "chengdu" },
  { city: "威海", desc: "海风会把心事吹远。", image: "/images/weihai.png", style: "weihai" },
];
const defaults: Record<Tool, string> = {rent:"月租",weather:"",facilities:"菜市场",bili:"旅居 生活体验",read:"",feeds:""};

export default function Home() {
  const [view, setView] = useState<View>("home");
  const [tool, setTool] = useState<Tool>("rent");
  const [city, setCity] = useState("大理");
  const [keyword, setKeyword] = useState("");
  const [url, setUrl] = useState("");
  const [district, setDistrict] = useState("");
  const [source, setSource] = useState("all");
  const [advanced, setAdvanced] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);
  const [cityFilter, setCityFilter] = useState("");
  const [guide, setGuide] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [savedCities, setSavedCities] = useState<string[]>([]);
  const [savedResults, setSavedResults] = useState<Result[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [data, setData] = useState<ResponseData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [expanded, setExpanded] = useState<string[]>([]);
  const [savedTab, setSavedTab] = useState("cities");
  const requestRef = useRef<AbortController | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const current = tools.find(t => t.id === tool)!;
  const count = savedCities.length + savedResults.length;

  useEffect(() => {
    try { const local = JSON.parse(localStorage.getItem("slowstay-library") || "{}"); setSavedCities(local.cities || []); setSavedResults(local.results || []); setHistory(local.history || []); } catch { /* A new local library starts empty. */ }
    return () => requestRef.current?.abort();
  }, []);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(""), 2800); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => { const close = (e:KeyboardEvent) => { if (e.key === "Escape") {setGuide(false);setCityOpen(false);setMobileNav(false);} }; window.addEventListener("keydown",close);return()=>window.removeEventListener("keydown",close); }, []);
  useEffect(() => {
    if (!guide && !cityOpen) return;
    const previous=document.activeElement as HTMLElement|null;
    const oldOverflow=document.body.style.overflow;document.body.style.overflow="hidden";
    const frame=requestAnimationFrame(()=>{const dialog=document.querySelector<HTMLElement>(".dialog");const first=dialog?.querySelector<HTMLElement>("input,button");first?.focus();});
    const trap=(event:KeyboardEvent)=>{if(event.key!=="Tab")return;const nodes=Array.from(document.querySelectorAll<HTMLElement>(".dialog button:not(:disabled),.dialog input,.dialog a[href]"));const first=nodes[0],last=nodes[nodes.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}};
    document.addEventListener("keydown",trap);
    return()=>{cancelAnimationFrame(frame);document.removeEventListener("keydown",trap);document.body.style.overflow=oldOverflow;previous?.focus();};
  },[guide,cityOpen]);
  const persist = (c: string[], r: Result[], h: string[]) => { try { localStorage.setItem("slowstay-library", JSON.stringify({cities:c,results:r,history:h})); } catch { setToast("当前浏览器无法保存收藏"); } };
  const toggleCity = (name: string) => { const next = savedCities.includes(name) ? savedCities.filter(x=>x!==name) : [...savedCities,name]; setSavedCities(next);persist(next,savedResults,history);setToast(next.includes(name) ? `已收藏${name}` : `已取消收藏${name}`); };
  const toggleResult = (result: Result) => { const exists=savedResults.some(r=>r.url===result.url);const next=exists?savedResults.filter(r=>r.url!==result.url):[...savedResults,result];setSavedResults(next);persist(savedCities,next,history);setToast(exists?"已取消收藏":"已存入我的收藏"); };
  const navigate = (next:View) => { requestRef.current?.abort();setLoading(false);setError("");setData(null);setView(next);setMobileNav(false);setAdvanced(false);if (next!=="home"&&next!=="saved") {setTool(next);setKeyword(defaults[next]);setSource("all");} window.scrollTo({top:0,behavior:"smooth"}); };
  const chooseCity = (name:string) => {setCity(name);setCityOpen(false);setCityFilter("");if(tool==="weather")setKeyword("");};
  const exploreCity = (name:string) => {chooseCity(name);navigate("rent");};
  async function research(event?:FormEvent) {
    event?.preventDefault();
    if ((tool==="read"||tool==="feeds")&&!/^https?:\/\//i.test(url.trim())) {setError("请输入完整的 http:// 或 https:// 链接");return;}
    if (!city.trim()&&tool!=="read"&&tool!=="feeds") {setError("请先选择或输入一个城市");return;}
    requestRef.current?.abort();const controller=new AbortController();requestRef.current=controller;
    setView(tool);setLoading(true);setError("");setData(null);setExpanded([]);
    const searchCity=tool==="weather"&&keyword.trim()?keyword.trim():city.trim();if(tool==="weather")setCity(searchCity);
    const h=[searchCity,...history.filter(x=>x!==searchCity)].slice(0,4);setHistory(h);persist(savedCities,savedResults,h);
    try {
      const params=new URLSearchParams({type:tool,city:searchCity,keyword:tool==="weather"?"":keyword.trim()||defaults[tool],district,source,url:url.trim(),limit:"8"});
      const response=await fetch(`/api/research?${params}`,{signal:controller.signal});const result=await response.json() as ResponseData & {error?:string};
      if(!response.ok)throw new Error(result.error||result.results?.[0]?.content||"暂时无法完成查询，请稍后重试。");
      setData(result);setTimeout(()=>panelRef.current?.scrollIntoView({behavior:"smooth",block:"start"}),80);
    }catch(e){if(e instanceof Error&&e.name!=="AbortError")setError(e.message||"网络连接失败，请稍后重试。");}
    finally{if(requestRef.current===controller)setLoading(false);}
  }
  const exportResults = () => {
    const results=view==="saved"?savedResults:data?.results||[];
    const content=`# 去小住 · ${view==="saved"?"我的收藏":data?.query||city}\n\n${results.map(r=>`## ${r.title}\n来源：${r.source}\n链接：${r.url}\n\n${r.content}`).join("\n\n---\n\n")}`;
    const blob=new Blob([content],{type:"text/markdown;charset=utf-8"});const link=document.createElement("a");link.href=URL.createObjectURL(blob);link.download=`去小住-${city}-调研资料.md`;link.click();URL.revokeObjectURL(link.href);setToast("调研资料已导出");
  };
  function renderCityButton() { return <button type="button" className="city-selector" onClick={()=>setCityOpen(true)} aria-label="选择目的地"><MapPin size={20}/><span><small>目的地</small><strong>{city}</strong></span><ChevronDown size={15}/></button>; }
  function renderSearchForm({hero=false}:{hero?:boolean}) { return <form className={`search-box ${hero?"hero-search":""}`} onSubmit={research}>
    {hero&&<div className="search-title"><strong>想去哪里小住？</strong></div>}
    <div className="search-main">
      {tool!=="read"&&tool!=="feeds"?renderCityButton():<div className="url-symbol"><Globe2 size={24}/></div>}
      <div className="search-input-wrap"><label htmlFor={hero?"home-query":"tool-query"}>{tool==="read"?"想读哪一篇？":tool==="feeds"?"订阅地址":tool==="weather"?"天气查询": "你想了解什么？"}</label>
      {tool==="read"||tool==="feeds"?<input id="tool-query" type="url" value={url} onChange={e=>setUrl(e.target.value)} placeholder={current.placeholder} required/>:<input id={hero?"home-query":"tool-query"} value={keyword} onChange={e=>setKeyword(e.target.value)} placeholder={current.placeholder} aria-label={current.placeholder}/>}</div>
      <button className="search-submit" disabled={loading} type="submit">{loading?<LoaderCircle size={18} className="spin"/>:<Search size={18}/>}<span>{loading?"正在检索":"开始探索"}</span><ArrowRight size={17}/></button>
    </div>
    <div className="search-bottom"><span className="search-caption">这次想看看</span><div className="search-chips">{tools.slice(0,4).map(t=><button key={t.id} type="button" aria-pressed={tool===t.id} className={tool===t.id?"selected":""} onClick={()=>{requestRef.current?.abort();setLoading(false);setTool(t.id);setSource("all");setKeyword("");if(!hero)setView(t.id);setData(null);setError("");}}><t.icon size={14}/>{t.id==="rent"?"房租":t.id==="weather"?"天气":t.id==="facilities"?"周边设施":"实地体验"}</button>)}</div>{!hero&&<button type="button" className="text-button advanced-toggle" aria-expanded={advanced} onClick={()=>setAdvanced(!advanced)}><SlidersHorizontal size={14}/>筛选</button>}</div>
    {advanced&&<div className="advanced-fields">{tool==="rent"&&<><label>信息来源<select value={source} onChange={e=>setSource(e.target.value)}><option value="all">全部来源</option><option value="豆瓣租房小组">豆瓣租房小组</option><option value="安居客">安居客</option><option value="贝壳/链家">贝壳 / 链家</option></select></label><label>片区（贝壳）<input value={district} onChange={e=>setDistrict(e.target.value)} placeholder="例如：高新区"/></label></>}{tool!=="rent"&&<p>当前来源：{current.source}。所有结果均来自公开信息。</p>}</div>}
  </form>; }
  function renderDestinationCard({d}:{d:typeof destinations[number]}) {return <article key={d.city} className={`destination-card ${d.style}`}><button className="destination-photo" onClick={()=>exploreCity(d.city)} aria-label={`探索${d.city}`} style={{backgroundImage:`url('${d.image}')`}}/><div className="destination-footer"><div className="destination-location"><strong>{d.city}</strong><p>{d.desc}</p></div></div><button className={`save-city ${savedCities.includes(d.city)?"is-saved":""}`} onClick={()=>toggleCity(d.city)} aria-label={`${savedCities.includes(d.city)?"取消收藏":"收藏"}${d.city}`} aria-pressed={savedCities.includes(d.city)}><Bookmark size={17} fill={savedCities.includes(d.city)?"currentColor":"none"}/></button></article>;}
  function renderResultCard({r,index}:{r:Result;index:number}) { const isOpen=expanded.includes(r.url);return <article key={`${r.url}-${index}`} className={`result-card ${r.status==="error"?"result-error":""}`}><div className="result-card-top"><span className="source-label"><span className={`source-dot ${r.status==="error"?"warning":""}`}/>{r.source}</span><span className="result-number">{String(index+1).padStart(2,"0")}</span></div><h3>{r.title}</h3>{r.status==="error"?<p className="error-body">{r.content}</p>:<div className={`result-content ${isOpen?"expanded":""}`}>{r.content}</div>}<div className="result-actions"><a href={r.url} target="_blank" rel="noopener noreferrer">打开来源<ExternalLink size={13}/></a><div>{r.status==="success"&&<><button className="text-button" onClick={()=>setExpanded(isOpen?expanded.filter(x=>x!==r.url):[...expanded,r.url])}>{isOpen?"收起正文":"展开正文"}<ChevronDown size={13}/></button><button className="result-save" onClick={()=>toggleResult(r)} aria-label="收藏结果"><Bookmark size={16} fill={savedResults.some(x=>x.url===r.url)?"currentColor":"none"}/></button></>}</div></div></article>;}

  return <div className="app-shell">
    {mobileNav&&<button className="nav-scrim" onClick={()=>setMobileNav(false)} aria-label="关闭导航"/>}
    <aside className={`sidebar ${mobileNav?"mobile-open":""}`}>
      <button className="brand" aria-label="去小住首页" onClick={()=>navigate("home")}><span className="brand-icon"><img src="/brand/quxiaozhu-mark.svg" width="48" height="48" alt="" draggable={false}/></span><span><strong>去小住</strong></span></button>
      <nav aria-label="主要导航"><button className={`nav-item ${view==="home"?"active":""}`} onClick={()=>navigate("home")}><Compass size={19}/><span>探索目的地</span>{view==="home"&&<span className="active-dot"/>}</button><p className="nav-label">旅居小助手</p>{tools.map(t=><button key={t.id} className={`nav-item ${view===t.id?"active":""}`} onClick={()=>navigate(t.id)}><t.icon size={18}/><span>{t.title}</span>{view===t.id&&<span className="active-dot"/>}</button>)}<div className="nav-divider"/><button className={`nav-item ${view==="saved"?"active":""}`} onClick={()=>navigate("saved")}><Bookmark size={18}/><span>我的收藏</span><span className="count-badge">{count.toString().padStart(2,"0")}</span></button></nav>
      {history.length>0&&<div className="recent"><p className="nav-label">最近探索</p>{history.slice(0,3).map(c=><button key={c} onClick={()=>exploreCity(c)}><span className="recent-dot"/>{c}<ArrowUpRight size={13}/></button>)}</div>}
      <div className="sidebar-bottom"><div className="slow-note"><Leaf size={21}/><p>不急着赶路，<br/>先找到喜欢的生活。</p></div><button className="guide-link" onClick={()=>{setMobileNav(false);setGuide(true);}}><CircleHelp size={17}/>使用指南<ArrowUpRight size={14}/></button><div className="sidebar-version"><span className="tiny-dot"/>中文旅居检索<span>v 1.0</span></div></div>
    </aside>
    <div className="main-shell"><header className="topbar">
      <div className="header-left"><button className="mobile-menu" onClick={()=>setMobileNav(true)} aria-label="打开导航" aria-expanded={mobileNav}><Menu size={22}/></button><button className="header-brand" aria-label="去小住首页" onClick={()=>navigate("home")}><span className="brand-icon"><img src="/brand/quxiaozhu-mark.svg" width="48" height="48" alt="" draggable={false}/></span><span><strong>去小住</strong></span></button></div>
      <nav className="desktop-nav" aria-label="顶部导航"><button className={view==="home"?"active":""} onClick={()=>navigate("home")}>发现好去处</button><button className={view!=="home"&&view!=="saved"?"active":""} onClick={()=>navigate("rent")}>旅居小助手</button><button className={view==="saved"?"active":""} onClick={()=>navigate("saved")}>我的心动清单{count>0&&<span>{count}</span>}</button></nav>
      <div className="header-actions"><button className="header-guide" onClick={()=>setGuide(true)}><Sun size={16}/>旅居小指南</button><button className="header-bookmark" onClick={()=>navigate("saved")} aria-label="查看收藏"><Bookmark size={19}/>{count>0&&<i/>}</button></div>
    </header>
      {view!=="home"&&view!=="saved"&&<nav className="tool-nav" aria-label="旅居工具">{tools.map(t=><button key={t.id} className={view===t.id?"active":""} onClick={()=>navigate(t.id)}><t.icon size={17}/>{t.title}</button>)}</nav>}
      <main className={`content ${view==="home"?"home-content":""}`}>
        {view==="home"?<>
          <section className="hero" aria-label="阳光民宿，慢生活灵感"><div className="hero-image"/><div className="hero-shade"/>
            <div className="hero-copy"><span className="destination-eyebrow"><Sun size={16}/>给自己，放一个小长假</span><h1>找个喜欢的地方，<br/><span>小住一下。</span></h1><p>先了解一座城，再住进喜欢的日常。</p><span className="hero-mood"><Waves size={18}/>慢一点，也很好。</span></div>
            <button className="hero-explore" onClick={()=>exploreCity("大理")}><span className="hero-place-icon"><MapPin size={21}/></span><span><small>下一站 · 大理</small><strong>把日子，过成喜欢的样子。</strong></span><span className="hero-place-arrow"><ArrowUpRight size={21}/></span></button>
            <span className="image-credit">AI 旅行氛围图</span>
          </section>
          {renderSearchForm({hero:true})}
          <div className="popular"><span>心动目的地</span>{["大理","成都","威海","昆明","厦门"].map(c=><button key={c} onClick={()=>{chooseCity(c);setToast(`目的地已切换为${c}，点击开始探索即可检索`);}}>{c}<ArrowUpRight size={12}/></button>)}</div>
          <section className="tools-section"><div className="section-heading"><h2>让出发，轻松一点。</h2><span className="section-subtitle">住得舒服，玩得自在</span></div><div className="tool-grid">{tools.map(t=><button key={t.id} className="tool-card" onClick={()=>navigate(t.id)}><span className={`tool-icon ${t.color}`}><t.icon size={30}/></span><h3>{t.title}</h3><p>{t.desc}</p></button>)}</div></section>
          <section className="destinations-section"><div className="section-heading"><h2>总有一处风景，让你想多住几天。</h2><button className="text-button" onClick={()=>setCityOpen(true)}>更多好去处<ArrowRight size={16}/></button></div><div className="destination-grid">{destinations.map(d=>renderDestinationCard({d}))}</div></section>
        </>:view==="saved"?<>
          <section className="page-intro"><p className="eyebrow">我的心动清单</p><h1>把喜欢的生活，先收藏起来。</h1><p>目的地与调研资料，留给下一次出发。收藏保存在当前浏览器。</p></section>
          <div className="saved-tabs"><button className={savedTab==="cities"?"active":""} onClick={()=>setSavedTab("cities")}>目的地 <span>{savedCities.length}</span></button><button className={savedTab==="results"?"active":""} onClick={()=>setSavedTab("results")}>调研资料 <span>{savedResults.length}</span></button>{savedTab==="results"&&savedResults.length>0&&<button className="text-button export-saved" onClick={exportResults}><ArrowDownToLine size={15}/>导出资料</button>}</div>
          {savedTab==="cities"?(savedCities.length?<div className="destination-grid saved-grid">{savedCities.map(c=>{const d=destinations.find(d=>d.city===c);return d?renderDestinationCard({d}):<article key={c} className="generic-city"><MapPin size={24}/><h3>{c}</h3><button onClick={()=>exploreCity(c)}>探索城市<ArrowRight size={16}/></button><button className="text-button" onClick={()=>toggleCity(c)}>取消收藏</button></article>;})}</div>:<div className="empty-state"><Bookmark size={35}/><h3>下一站，留给心动的地方。</h3><p>点击目的地卡片上的收藏图标，把喜欢的城市存到这里。</p><button className="primary-button" onClick={()=>navigate("home")}>去发现目的地<ArrowRight size={16}/></button></div>):savedResults.length?<div className="results-list">{savedResults.map((r,i)=>renderResultCard({r,index:i}))}</div>:<div className="empty-state"><BookOpen size={35}/><h3>好信息，值得留一份。</h3><p>完成一次检索后，就可以收藏感兴趣的结果。</p><button className="primary-button" onClick={()=>navigate("rent")}>开始检索<ArrowRight size={16}/></button></div>}
        </>:<>
          <button className="back-link" onClick={()=>navigate("home")}><ArrowLeft size={14}/>返回探索</button><section className="page-intro tool-intro"><div className={`tool-icon ${current.color}`}><current.icon size={25}/></div><p className="eyebrow">旅居小助手 · {city}</p><h1>{current.title}<span className="intro-dot">.</span></h1><p>{current.detail}</p></section>{renderSearchForm({})}
          <div className="tool-context"><span><ShieldCheck size={14}/>公开信息检索</span><span>信息来源：{current.source}</span><button onClick={()=>toggleCity(city)}><Bookmark size={13}/>{savedCities.includes(city)?`已收藏${city}`:`收藏${city}`}</button></div>
          <div ref={panelRef} className="results-panel" aria-live="polite">
            {loading?<div className="loading-state"><span className="loading-icon"><current.icon size={25}/><span/></span><h3>正在走近{tool==="read"||tool==="feeds"?"你关心的信息":city}的日常…</h3><p>正在读取公开来源，请稍等片刻。</p><button className="text-button" onClick={()=>{requestRef.current?.abort();setLoading(false);}}>取消检索</button><div className="skeletons">{[0,1,2].map(n=><div key={n}><i/><i/><i/></div>)}</div></div>:error?<div className="empty-state error-state"><Globe2 size={32}/><h3>这次检索没有完成</h3><p>{error}</p><button className="primary-button" onClick={()=>research()}>重新尝试<ArrowRight size={15}/></button></div>:data?<>
              <div className="results-heading"><div><h2>关于{data.query}的发现<span>{data.results.filter(r=>r.status==="success").length} 条结果</span></h2><p>检索于 {new Date(data.fetchedAt).toLocaleString("zh-CN",{timeZone:"Asia/Shanghai",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"})} · 内容以来源页面为准</p></div><button className="secondary-button" onClick={exportResults}><ArrowDownToLine size={15}/>导出资料</button></div>
              {data.videos&&data.videos.length>0&&<div className="video-results">{data.videos.map((v,i)=><article className="video-result" key={v.url}><a href={v.url} target="_blank" rel="noopener noreferrer"><span className="video-cover"><Video size={28}/><i>{String(i+1).padStart(2,"0")}</i></span><div><h3>{v.title}</h3><p>UP 主：{v.author} · 播放 {v.plays}</p><span>在哔哩哔哩观看<ArrowUpRight size={13}/></span></div></a><button className="video-save" onClick={()=>{const r=data.results.find(r=>r.url===v.url);if(r)toggleResult(r);}} aria-label={`收藏视频：${v.title}`}><Bookmark size={16} fill={savedResults.some(r=>r.url===v.url)?"currentColor":"none"}/></button></article>)}</div>}
              <div className="results-list">{data.results.filter(r=>r.status==="error"||!data.videos?.some(v=>v.url===r.url)).map((r,i)=>renderResultCard({r,index:i}))}</div>
              {data.results.length===0&&!data.videos?.length&&<div className="empty-state"><Search size={30}/><h3>还没有找到相关内容</h3><p>换个关键词或来源，再试一次。</p></div>}
              {data.results.some(r=>r.status==="error")&&<div className="source-notice"><CircleHelp size={17}/><p>部分来源暂时无法读取。你可以打开来源页面，或到实地体验中搜索相同话题。</p><button onClick={()=>{navigate("bili");setKeyword(`${city} ${keyword||"旅居"}`);}}>去实地体验<ArrowRight size={14}/></button></div>}
            </>:<div className="tool-start"><div className="tool-start-copy"><span className="small-label">从一个问题开始</span><h2>{tool==="rent"?"想住在哪里，想过怎样的日常？":tool==="weather"?"出发之前，先看看那里的天空。":tool==="facilities"?"菜市场、医院、地铁，生活需要的小事。":tool==="bili"?"让住过的人，带你先看一眼。":tool==="read"?"给一段有价值的文字，留一点时间。":"与一座城市的日常，保持联系。"}</h2><p>{tool==="rent"?"输入城市和租房偏好，我们会为你读取多个公开租房来源。":tool==="weather"?"支持常用旅居城市，也可以直接输入中国天气网城市代码。":tool==="facilities"?"按城市与关键词检索生活设施，帮助你了解周边配套。":tool==="bili"?"检索视频标题、UP 主与播放量，打开原视频了解更多。":tool==="read"?"粘贴文章链接，读取正文。暂不支持需要登录或付费的内容。":"粘贴你已有的 RSS / Atom 地址，获取最新条目与原文链接。"}</p>{tool!=="read"&&tool!=="feeds"&&<div className="suggestions"><span>试试这些</span>{(tool==="rent"?["月租","一居室","单间"]:tool==="facilities"?["菜市场","医院","超市"]:tool==="bili"?["旅居真实体验","租房避坑","一个月生活成本"]:["大理","成都","101290201"]).map(k=><button key={k} onClick={()=>{setKeyword(k);setToast("关键词已填入，点击开始探索即可检索");}}>{k}<Plus size={12}/></button>)}</div>}</div><div className="start-art"><current.icon size={68} strokeWidth={1}/><span/><i/></div></div>}
          </div>
          <div className="research-tips"><Leaf size={18}/><p>{tool==="rent"?"租金与房源信息具有时效性，请到来源页面核实，并在线下确认房源与合同。":tool==="weather"?"天气会随时变化，临近出发时记得再次查看。长期气候可结合当地气象资料了解。":"把信息作为了解城市的起点，也给亲自体验留一点空间。"}</p></div>
        </>}
        <footer className="footer"><span><img className="footer-brand-mark" src="/brand/quxiaozhu-mark.svg" width="32" height="28" alt=""/>去小住<span>目的地图片为 AI 氛围图</span></span><button onClick={()=>setGuide(true)}>关于去小住<ArrowUpRight size={12}/></button></footer>
      </main>
    </div>
    {toast&&<div role="status" className="toast"><CheckCheck size={17}/>{toast}</div>}
    {cityOpen&&<div className="modal-overlay" onClick={()=>setCityOpen(false)}><section className="city-dialog dialog" role="dialog" aria-modal="true" aria-labelledby="city-title" onClick={e=>e.stopPropagation()}><button className="close-dialog" onClick={()=>setCityOpen(false)} aria-label="关闭"><X size={20}/></button><p className="eyebrow">WHERE TO NEXT?</p><h2 id="city-title">想去哪里，住一阵？</h2><p>选一座城市，开始了解那里的生活。</p><form onSubmit={e=>{e.preventDefault();if(cityFilter.trim())chooseCity(cityFilter.trim());}}><Search size={18}/><input autoFocus value={cityFilter} onChange={e=>setCityFilter(e.target.value)} placeholder="搜索或输入城市名 / 天气城市代码"/><button type="submit" disabled={!cityFilter.trim()} aria-label="使用此城市"><ArrowRight size={18}/></button></form><span className="small-label">常用旅居城市</span><div className="city-grid">{cities.filter(c=>c.includes(cityFilter)).map(c=><button className={city===c?"selected":""} key={c} onClick={()=>chooseCity(c)}>{c}{city===c&&<Check size={14}/>}</button>)}</div>{cityFilter&&!cities.some(c=>c.includes(cityFilter))&&<button className="custom-city" onClick={()=>chooseCity(cityFilter.trim())}>使用「{cityFilter}」<ArrowRight size={16}/></button>}<p className="dialog-footnote">更多城市可直接输入。部分来源仅支持预设城市。</p></section></div>}
    {guide&&<div className="modal-overlay" onClick={()=>setGuide(false)}><section className="guide-dialog dialog" role="dialog" aria-modal="true" aria-labelledby="guide-title" onClick={e=>e.stopPropagation()}><button className="close-dialog" onClick={()=>setGuide(false)} aria-label="关闭"><X size={20}/></button><span className="guide-leaf"><Leaf size={27}/></span><p className="eyebrow">A LITTLE GUIDE TO SLOW LIVING</p><h2 id="guide-title">出发前，先走近当地的生活。</h2><p>去小住陪你了解一座城市的住处、天气和日常，把小住前的准备变得轻松一点。</p><div className="guide-steps">{[{n:"01",title:"先看体验，找到心动的片区",text:"搜索 B 站的实地视频，了解住过的人怎么说。",icon:Video},{n:"02",title:"再看日常，确认生活的细节",text:"查房租、天气与设施，把预算和生活半径想清楚。",icon:House},{n:"03",title:"收藏资料，也记得亲自确认",text:"保存有用的信息，打开来源页面核实最新情况。",icon:Bookmark}].map(s=><div key={s.n}><span>{s.n}</span><div><h3>{s.title}</h3><p>{s.text}</p></div><s.icon size={21}/></div>)}</div><div className="guide-details"><ShieldCheck size={18}/><p>通过公开网页与接口检索，无需平台账号。网站可能限流或要求验证，读取失败时会显示原因与来源链接。收藏保存在当前浏览器。</p></div><button className="primary-button" onClick={()=>{setGuide(false);navigate("bili");}}>从实地体验开始<ArrowRight size={17}/></button></section></div>}
  </div>;
}
