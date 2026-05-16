# 推广素材

三张推广海报，全部用 HTML + CSS 写好，再用 headless Chrome 渲成 PNG。源码可改，重新出图只要重跑下面的命令。

## 现成产物

| 图 | 尺寸 | 用途 |
|---|---|---|
| [hero-banner.png](hero-banner.png) | 1920×1080 (16:9) | GitHub README 顶图、推特卡片、网站首屏 |
| [social-card.png](social-card.png) | 1200×1200 (1:1) | 微信公众号封面、Twitter 分享卡、朋友圈 |
| [xhs-portrait.png](xhs-portrait.png) | 1080×1440 (3:4) | 小红书、Pinterest、抖音封面 |

## 改完再出图

```bash
# 路径示意 — 把 chrome.exe 换成你本机的
CHROME="/c/Program Files/Google/Chrome/Application/chrome.exe"

"$CHROME" --headless=new --hide-scrollbars --disable-gpu \
  --window-size=1920,1080 \
  --screenshot=docs/marketing/hero-banner.png \
  "file:///E:/claudeapp/docs/marketing/hero-banner.html"

"$CHROME" --headless=new --hide-scrollbars --disable-gpu \
  --window-size=1200,1200 \
  --screenshot=docs/marketing/social-card.png \
  "file:///E:/claudeapp/docs/marketing/social-card.html"

"$CHROME" --headless=new --hide-scrollbars --disable-gpu \
  --window-size=1080,1440 \
  --screenshot=docs/marketing/xhs-portrait.png \
  "file:///E:/claudeapp/docs/marketing/xhs-portrait.html"
```

## 设计原则

- **深色科技风**：深蓝黑底 + 青蓝色光晕 + 一点电流紫，统一 `#050B1A → #0A1530` 背景渐变
- **中文字体优先级**：Inter → Segoe UI → PingFang SC → Microsoft YaHei UI（系统不缺字）
- **文字精确可控**：所有字面都是 HTML 文本，不会被图模糊化或拼错
- **可重现**：源 HTML 在 git 里，谁拉下来都能渲出一模一样的图
