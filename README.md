# 冷战热斗 · 网页版

《冷战热斗》（Twilight Struggle）的浏览器双人对战实现：TypeScript 规则引擎 + React 前端 + Socket.IO 联机。

- 企划书：[docs/PROPOSAL.md](docs/PROPOSAL.md)
- 规则摘要：[docs/RULES.md](docs/RULES.md)
- 原版素材导入：[docs/ASSETS.md](docs/ASSETS.md)

> 《冷战热斗》© GMT Games。本私有仓库按项目所有者要求收录 TTS 中文模组的卡图、地图和标记图片；来源及校验记录见 [素材清单](docs/ASSET_INVENTORY.json)。

中文卡图 #1–110、地图和辅助素材已随仓库提交，克隆或拉取后无需另行导入。英文素材和原始模组缓存不在当前仓库文件中。

## 开发

需要 Node.js ≥ 22.12。

```bash
npm install
npm run dev      # 前端 http://127.0.0.1:5173，服务端 :3001
npm run check    # 类型检查 + lint + 测试 + 构建
```

## 结构

| 目录 | 内容 |
|---|---|
| `packages/shared` | 公共类型、Socket 协议 |
| `packages/game-core` | 纯函数规则引擎、地图与卡牌数据 |
| `apps/web` | React 前端 |
| `apps/server` | Socket.IO 服务端 |
| `tools` | TTS 素材导入脚本 |

## 进度

当前是 **M0 骨架**：数据模型、开局发牌、控制 / DEFCON / 政变等基础规则函数。里程碑见企划书第 7 节。
