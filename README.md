# CodeVault · 个人代码保存站

一个纯前端、零依赖的静态网站，用来集中保存代码片段。界面参考 [OI-Wiki](https://oi-wiki.org/) 的简洁文档风格：左侧分类导航、顶部搜索、主内容区代码卡片，桌面与移动端均可使用。

## 功能

- **三类代码管理**
  - 模板代码：名称、语言、说明、代码内容
  - 题目代码：标题、来源、思路备注、语言、代码内容
  - 其他 / 云剪贴板：快速粘贴、复制、临时文本管理
- **完整操作**：新增、编辑、删除、复制、查看、搜索、分类筛选、语言筛选、标签筛选与备注
- **数据存储**：使用浏览器 `localStorage` 保存 JSON，支持一键导出 / 导入 JSON 备份
- **代码高亮**：内置轻量语法高亮，覆盖 C/C++、Python、Java、JavaScript、Go、Rust、SQL 等常见语言
- **响应式布局**：桌面固定侧栏，移动端折叠为抽屉导航
- **快捷键**：`/` 聚焦搜索框，`Ctrl/⌘ + Enter` 在编辑器内保存，`Esc` 关闭弹窗

## 本地运行

直接双击 `index.html` 即可打开。若浏览器限制本地存储，可启动一个静态服务器：

```bash
# Python
python -m http.server 8000

# Node
npx serve .
```

然后访问 <http://localhost:8000>。

## 部署到 GitHub Pages

1. 将本目录内容推送到 GitHub 仓库
2. 进入仓库 **Settings → Pages**
3. Source 选择 **Deploy from a branch**，分支选择 `main`，目录选择 `/ (root)`
4. 保存后即可通过 `https://<用户名>.github.io/<仓库名>/` 访问

## 文件结构

```
.
├── index.html   # 页面结构
├── styles.css   # OI-Wiki 风格样式与响应式布局
├── app.js       # 应用逻辑：存储、CRUD、搜索筛选、高亮、导入导出
└── README.md    # 本说明
```

## 数据格式

导出的 JSON 结构如下：

```json
{
  "app": "CodeVault",
  "version": 1,
  "exportedAt": "2026-01-01T00:00:00.000Z",
  "items": [
    {
      "id": "id-xxxx",
      "type": "template | problem | clipboard",
      "name": "",
      "title": "",
      "source": "",
      "language": "cpp",
      "description": "",
      "notes": "",
      "code": "",
      "content": "",
      "tags": [],
      "createdAt": 0,
      "updatedAt": 0
    }
  ]
}
```

---

Made with 🐱 for code hoarders.
