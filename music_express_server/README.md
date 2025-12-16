# Music Express Server

本目录下的服务是一个基于 Node.js + Express 的本地文件转换 API，使用同级目录中的 `ffmpeg.exe` 在离线环境中把单个 `.m4a` 或 `.ogg` 文件转成 `.mp3`。该服务供 `music_conver_index.html` 前端页面或其他自定义客户端调用。

## 功能亮点

- ✅ 集成 Windows 版 `ffmpeg.exe`，无需额外安装，开箱即用。
- ✅ 同时支持 M4A→MP3 与 OGG→MP3，输出统一使用 `libmp3lame`。
- ✅ 单文件 100 MB 限制，自动拒绝超限请求并清理临时文件。
- ✅ 接口接受原始 Base64 或 Data URL，响应直接返回 Base64，可在浏览器端生成下载链接。

## 环境要求

- Node.js ≥ 18（Express 5 依赖此运行时）
- npm（随 Node.js 一起安装）
- `ffmpeg.exe` 文件需与 `server.js` 位于同一级目录（仓库已内置，如需升级可直接替换）

## 快速开始

```bash
// 服务器端首次启动
cd music_express_server
npm install            # 首次安装依赖
npm start              # 或 node server.js

// 前端直接打开music_conver_index.html
```

默认监听 `http://localhost:3001`。若需修改端口，可编辑 `server.js` 顶部的 `PORT` 常量。

运行成功后，可以直接在浏览器中打开仓库根目录的 `music_conver_index.html`，该前端会向此服务发送请求。

## API 说明

### `GET /`

- 用途：健康检查
- 响应：`{ status: 'ok', message: '...' }`

### `POST /convert/m4a-to-mp3`
### `POST /convert/ogg-to-mp3`

| 字段      | 类型   | 说明                                                                 |
|-----------|--------|----------------------------------------------------------------------|
| `fileName`| string | 原始文件名，必须以 `.m4a` 或 `.ogg` 结尾，对应不同的接口             |
| `fileData`| string | Base64 字符串，可为纯 Base64 或 `data:audio/...;base64,` 形式的 Data URL |

- 请求体示例：

```json
{
  "fileName": "demo.m4a",
  "fileData": "data:audio/mp4;base64,AAAA..."
}
```

- 成功响应示例：

```json
{
  "success": true,
  "message": "转换成功",
  "fileName": "demo.mp3",
  "fileData": "SUQzAwAAAA..."
}
```

- 失败时会返回 `success: false` 与错误信息，并使用合适的 HTTP 状态码（例如 400 为参数错误、500 为 FFmpeg 失败或 `ffmpeg.exe` 缺失）。

## 文件与目录

- `tmp_uploads/`：上传文件的临时存储路径，服务启动时自动创建，用完即删。
- `tmp_outputs/`：FFmpeg 输出 MP3 的临时目录，读取后立即清理。
- `server.js`：核心服务代码，如需调整转码质量，可修改 `runFfmpeg` 中的参数（默认 `-qscale:a 2`）。

> ⚠️ 请勿手动删除临时目录或 `ffmpeg.exe`，以免导致运行失败。

## 常见问题

1. **提示未找到 ffmpeg.exe**：确认文件位于 `music_express_server/ffmpeg.exe` 并且未被系统隔离，必要时重新下载放置。
2. **浏览器无法请求**：确保服务已运行且端口未被占用，必要时关闭代理或防火墙。
3. **文件过大被拒绝**：服务端限制 100 MB，可先在本地裁剪或压缩音频后再上传。

完成转换后，前端会把 Base64 响应转成 Blob 并生成下载链接，全程在本地执行，不会上传到外网服务器。
