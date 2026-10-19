# 网页部署准备

## 同一服务托管网页与联机

```bash
npm ci --include=dev
npm run check
npm run smoke:production
NODE_ENV=production PORT=3001 npm start
```

打开 `http://127.0.0.1:3001` 即为完整网页，Socket.IO 使用同一个地址，不需要另开 Vite。此命令也可从仓库根目录以外启动：静态目录根据程序文件的位置解析。`PORT` 由部署平台提供时无需手动指定，服务监听 `0.0.0.0`。

`npm run smoke:production` 会在临时端口启动真实生产构建，检查首页、JS / CSS、中文卡图、健康检查、前端深层路由，以及两个 WebSocket 客户端创建 / 加入房间；完成后自动关闭测试服务。它依赖已经存在的构建产物，不会上传或部署。

生产模式缺少网页构建时启动会直接失败，避免健康检查通过却只有空白页面。开发模式仍可使用 `npm run dev`。

## Render 配置

根目录 `render.yaml` 配置一个 Node Web Service：

- 使用仓库根目录作为项目目录，分支 `main`。
- 构建：`npm ci --include=dev && npm run check`。
- 启动：`npm start`；`NODE_ENV=production`。
- Node 大版本由 `.node-version` 指定为 24。
- 健康检查：`/health`。
- 一个实例，房间数据仍在该进程内存中。
- `autoDeployTrigger: off`：之后的代码上传不会自动发布。
- 当前最小 Web Service 配置为 `plan: free`；实际创建时仍以账户可用配置为准。

配置以 2026-10-19 实际读取的官方参考为依据，并通过当日下载的官方 JSON Schema 校验：

- https://render.com/docs/blueprint-spec.md
- https://render.com/docs/compute-plans.md
- https://render.com/docs/node-version.md
- https://render.com/schema/render.yaml.json

当前环境未安装 Render CLI，因此尚未运行平台验证。CLI 可用后，在仓库根目录执行：

```bash
render blueprints validate render.yaml
```

该命令仅验证配置，不会部署。JSON Schema 校验不等同于 Render 平台验证或实际构建验收。

## 真正上线之前

1. 解决 GitHub 连接对此仓库的写入授权；经过用户确认后上传代码和 `render.yaml`。
2. 确认远程分支确实包含这些改动，再由 Render 连接该仓库创建 Blueprint 或 Web Service。当前文档不提供假定已经可用的部署链接。
3. 在应用 Blueprint 前核对服务名，避免误修改同名现有服务。无需为当前单服务设置 `VITE_SERVER_URL`，客户端默认同源连接。
4. 触发部署后核对 `/health`、首页与资源，并用两台设备完成创建、加入和重连测试。

本次只准备和测试本地代码，没有创建 Render 服务、上传代码或变更现有部署。

## 当前边界

- 只支持早期战争前三回合，中晚期和完整终局尚未实现。
- 房间仍为内存存储，重新部署、服务重启或进程被停止都会丢失对局；客户端恢复令牌不能恢复服务端已丢失的房间。
- 不能直接增加多个实例分摊流量；在引入共享房间存储之前保持单实例。
- 浏览器视觉验收和两台实体设备的公网验收待做。

静态文件支持 HEAD、ETag 和资源缓存，前端路由可以刷新；不存在的 JS / 图片返回 404，不回退成 HTML。只允许访问网页构建目录，路径穿越、隐藏文件及指向外部文件的符号链接会被拒绝。
