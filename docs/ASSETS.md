# 原版素材：来源与导入

## 已实际取得的素材（2026-10-19）

**补查后已取得完整简体中文卡面。** 来源：[冷战热斗中文版，2793711137](https://steamcommunity.com/sharedfiles/filedetails/?id=2793711137)。已下载 57 个资源（55 个可解码图片、2 个其他文件）；一次中断的图集下载已单独重新下载完成。

- 简体中文卡面：#1–110 齐全，无缺号，四张约 9300 像素宽的 10×7 图集。#6、#103、#104、#110 已放大抽样检查；译文及所有事件效果尚未逐句校核。
- 中文地图：9182×5940，已查看；是模组提供的中文地图版本，不承诺与任何特定实体印刷版完全一致。
- 中文卡背、辅助图和模组标记图已下载；额外扩展图片也有下载，但本次完整度仅保证豪华版 #1–110。
- 当前 `assets/tts-manifest.json` 已切换为中文卡面。`assets/tts-manifest-en.json` 保留英文备份。
- 中文卡图图集位于 `apps/web/public/tts/zh-sheet-*.jpg`；原始副本及报告位于 `assets/downloads-zh/`、`assets/source/verified-inventory-zh.json`。
- 中文预览：`assets/source/verified-preview-zh.jpg`；英文与中文的来源、卡号映射及校验值均记在 [ASSET_INVENTORY.json](ASSET_INVENTORY.json)。

中文专用映射：图集 43 位置 0–34 → #1–35、位置 35 → #103；图集 42 位置 0–45 → #36–81；图集 48 位置 0–20 → #82–102；图集 46 位置 0–6 → #104–110。模组中的单独中国牌对象另有网格，本地网页使用图集 43 中的 #6，避免混入扩展卡。

### 英文备份与其他素材

来源：[Twilight Struggle Scripted(EN)，3311714280](https://steamcommunity.com/sharedfiles/filedetails/?id=3311714280)。模组文件已从 Steam 公开接口下载并解析，并非只找到创意工坊页面。

| 素材 | 本地验证结果 |
|---|---|
| 英文卡面 | 110 张，编号 1–110 无重复、无缺号，含中国牌及豪华版可选牌 |
| 卡面图集 | 早／中／晚三张，每张 3750×3676，10×7 网格 |
| 卡背 | 已下载，可解码 |
| 地图 | 6800×4400，可解码；模组定制地图，不声称是官方印刷地图扫描件 |
| 标记及辅助图 | 美苏影响力 1–8 的控制／非控制版本，VP、回合、军事行动、太空与事件标记，操作／计分辅助图；含模组自制图 |
| 图片文件合计 | 96 个，均通过图片解码校验；该数字包含图集、桌面等模组附属图片，不等于 96 张卡 |
| 模组辅助 PDF | 4 个，已下载并检查 PDF 文件头；未逐页审核内容 |
| 其他模组文件 | 6 个，含模型／音频等，不计入游戏美术完整度 |
| 官方规则 | [GMT 2015 PDF](https://www.gmtgames.com/nnts/TS_Rules-2015.pdf)，已另行下载；规则逐条复核尚未完成 |
| 旧繁体中文模组 667733815 | 本体已下载，Imgur 链接返回 HTTP 429；已通过上方 2793711137 补齐简体中文卡面 |

以上覆盖豪华版 110 张牌；不包含 Turn Zero、宣传扩展包或 20 周年版新增卡。

文件位置：

- `assets/source/`：模组原文件、解析后的 JSON、下载与校验报告、官方规则 PDF。
- `assets/downloads-en/`：106 个模组资源的本地副本。
- `assets/tts-manifest.json`：已按卡号映射的网页清单。
- `apps/web/public/tts/`：供本地网页加载的卡面图集、地图及标记物。
- `assets/source/verified-preview.jpg`：地图和 #6、#103、#110 卡面抽样预览。
- `assets/source/components-preview.jpg`：辅助图片一览。
- [ASSET_INVENTORY.json](ASSET_INVENTORY.json)：可提交的来源、卡号映射、尺寸及 SHA-256 校验清单，不含图片本体。

已有卡牌组件通过清单加载本地卡图，默认已切换为简体中文；地图和标记物仅已备齐，尚未接入交互棋盘。

### 导入脚本的限制

下方通用导入脚本依靠昵称中的数字识别卡号。已验证的英文模组昵称多为英文名称，中文模组昵称多为空，因此**直接运行通用脚本会覆盖正确清单并丢失映射**。当前清单使用该模组专用映射：

- 图集 63：位置 0–34 对应 #1–35；位置 35–38 对应 #103–106。
- 图集 66：位置 0–45 对应 #36–81；位置 46–47 对应 #107–108。
- 图集 65：位置 0–20 对应 #82–102；位置 21–22 对应 #109–110。

素材本体仍在 Git 忽略目录中；GitHub 上有核验清单，但其他协作者克隆仓库后不会自动得到这些图片。

> 卡图、地图版权属于 GMT Games。以下流程只用于**本地开发和私人测试**。导入结果放在被 gitignore 的目录里，不会进入仓库。

## 1. Steam 创意工坊上的 TTS 模组（2026-10 检索）

以下是 Tabletop Simulator 创意工坊搜索 “Twilight Struggle” 第 1 页的部分结果。订阅数、更新日期因为 Steam 限流没能取到，请自己打开页面确认。

| 模组 | 创意工坊 ID | 说明 |
|---|---|---|
| 冷戰熱鬥 Twilight Struggle [中文/CHT] | [667733815](https://steamcommunity.com/sharedfiles/filedetails/?id=667733815) | 模组已下载；图片目前返回 429，中文卡面未取得 |
| 冷战热斗中文版 | [2793711137](https://steamcommunity.com/sharedfiles/filedetails/?id=2793711137) | 已取得 #1–110 简体中文卡面及中文地图，本地默认素材来源 |
| Twilight Struggle: Turn Zero | [767970018](https://steamcommunity.com/sharedfiles/filedetails/?id=767970018) | 同一作者，零回合扩展 |
| Twilight Struggle - Deluxe Edition | [420342971](https://steamcommunity.com/sharedfiles/filedetails/?id=420342971) | 英文豪华版 |
| Twilight Struggle Deluxe - Better Counters | [636692156](https://steamcommunity.com/sharedfiles/filedetails/?id=636692156) | 英文，指示物更清晰 |
| Twilight Struggle Scripted(EN) | [3311714280](https://steamcommunity.com/sharedfiles/filedetails/?id=3311714280) | 已取得并校验 110 张英文卡面及地图、标记等 |
| Twilight Struggle Deluxe Edition with Turn Zero Expansion and Promo Packs | [2530023572](https://steamcommunity.com/sharedfiles/filedetails/?id=2530023572) | 含扩展和推广卡 |
| Twilight Struggle Deluxe - THE ULTIMATE COLLECTION | [3127792436](https://steamcommunity.com/sharedfiles/filedetails/?id=3127792436) | 合集 |

## 2. 导入步骤

1. 在 Steam 订阅上表中的模组，并在 Tabletop Simulator 里**打开一次**，让游戏把图片缓存到本地。
2. 找到模组存档 JSON：
   ```
   %USERPROFILE%\Documents\My Games\Tabletop Simulator\Mods\Workshop\<创意工坊ID>.json
   ```
3. 生成卡图索引（只记录远程地址，不下载）：
   ```bash
   npm run assets:import -- "C:/Users/<你>/Documents/My Games/Tabletop Simulator/Mods/Workshop/667733815.json"
   ```
   想离线使用就加 `--download`，雪碧图会保存到 `apps/web/public/tts/`。
4. 运行 `npm run dev`。前端检测到 `assets/tts-manifest.json` 后会自动显示原版卡图。

## 3. 工作原理

TTS 存档里每个牌堆都有 `CustomDeck`，记录雪碧图地址 `FaceURL` 和网格大小 `NumWidth × NumHeight`。每张牌的 `CardID = 牌堆ID × 100 + 序号`。脚本从卡牌昵称里提取卡号（例如 `#21 NATO`），建立“卡号 → 雪碧图格子”的映射。昵称里没有卡号的牌会列进 `unmatched`，需要人工补全。

不同模组的昵称格式不一样，第一次导入后请检查 `unmatched` 和匹配数量（应为 110 张左右）。
