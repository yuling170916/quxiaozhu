import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title:"去小住 · 找个喜欢的地方，小住一下。",
  applicationName:"去小住",
  description:"找个喜欢的地方，小住一下。用去小住了解房租、天气、生活设施与实地体验，轻松准备下一段旅居生活。",
  icons:{icon:{url:"/brand/quxiaozhu-mark.svg?v=warm",type:"image/svg+xml"},shortcut:"/favicon.svg?v=quxiaozhu-warm"}
};
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="zh-CN"><body>{children}</body></html>;}
