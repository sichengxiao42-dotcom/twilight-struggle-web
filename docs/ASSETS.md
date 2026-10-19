# 原版素材：来源与导入

> 卡图、地图版权属于 GMT Games。以下流程只用于**本地开发和私人测试**。导入结果放在被 gitignore 的目录里，不会进入仓库。

## 1. Steam 创意工坊上的 TTS 模组（2026-10 检索）

以下是 Tabletop Simulator 创意工坊搜索 “Twilight Struggle” 第 1 页的部分结果。订阅数、更新日期因为 Steam 限流没能取到，请自己打开页面确认。

| 模组 | 创意工坊 ID | 说明 |
|---|---|---|
| 冷戰熱鬥 Twilight Struggle [中文/CHT] | [667733815](https://steamcommunity.com/sharedfiles/filedetails/?id=667733815) | 繁体中文卡面，**首选** |
| Twilight Struggle: Turn Zero | [767970018](https://steamcommunity.com/sharedfiles/filedetails/?id=767970018) | 同一作者，零回合扩展 |
| Twilight Struggle - Deluxe Edition | [420342971](https://steamcommunity.com/sharedfiles/filedetails/?id=420342971) | 英文豪华版 |
| Twilight Struggle Deluxe - Better Counters | [636692156](https://steamcommunity.com/sharedfiles/filedetails/?id=636692156) | 英文，指示物更清晰 |
| Twilight Struggle Scripted(EN) | [3311714280](https://steamcommunity.com/sharedfiles/filedetails/?id=3311714280) | 带脚本 |
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
