# CodeVault · 个人代码保存站

一个纯前端、零依赖的静态网站，用来集中保存代码片段。界面参考 [OI-Wiki](https://oi-wiki.org/) 的简洁文档风格：左侧分类导航、顶部搜索、主内容区代码卡片，桌面与移动端均可使用。

## 功能

- **三类代码管理**
  - 模板代码：名称、语言、说明、代码内容
  - 题目代码：标题、来源、思路备注、语言、代码内容
  - 其他 / 云剪贴板：快速粘贴、复制、临时文本管理
- **完整操作**：新增、编辑、删除、复制、查看、搜索、分类筛选、语言筛选、标签筛选与备注
- **GitHub 云端存储**：数据以 JSON 存在私有 GitHub 仓库中，跨设备、跨地点同步；刷新、换电脑都能读到同一份数据
- **失败保护**：本地先落盘再写云端；写入失败时数据仍安全保存在本机，可随时重试，不会丢失
- **代码高亮**：内置轻量语法高亮，覆盖 C/C++、Python、Java、JavaScript、Go、Rust、SQL 等常见语言
- **访问密码保护**：打开站点需输入密码，支持界面内修改密码、手动锁定（见下方说明）
- **响应式布局**：桌面固定侧栏，移动端折叠为抽屉导航
- **快捷键**：`/` 聚焦搜索框，`Ctrl/⌘ + Enter` 在编辑器内保存，`Esc` 关闭弹窗

## 数据存储与同步

数据文件保存在**私有仓库** `XPHcsc/code-vault-data` 的 `codevault.json`（站点仓库 `code-vault` 只放前端文件，供 Pages 公开访问）。每次新增 / 编辑 / 删除都会：

1. 先把数据写入浏览器本地存储（`localStorage`）；
2. 再自动同步到 GitHub 仓库；
3. 若同步失败（网络问题、令牌失效等），顶部会出现提示条，数据仍保留在本机，可点「重试同步」或到同步设置里上传，绝不丢数据。

首次使用需配置 GitHub 令牌（只需一次，存于当前浏览器）：

1. 打开站点右上角「⋯」→ **GitHub 同步设置**；
2. 到 [Fine-grained token 创建页](https://github.com/settings/personal-access-tokens/new) 生成一个令牌：
   - Resource owner 选择仓库所属账号；
   - 只勾选数据仓库（`code-vault-data`）；
   - Permissions → Repository permissions → **Contents: Read and write**；
3. 把令牌粘贴到「访问令牌」框，点击 **保存令牌并连接**。

连接后会自动读取云端数据；换电脑或换浏览器时重新粘贴一次令牌即可读到同一份数据。也可用同步设置里的「从 GitHub 拉取」/「上传本地到 GitHub」手动处理多设备冲突。

> GitHub 免费账号的私有仓库不支持 GitHub Pages，因此拆成两个仓库：站点仓公开（仅前端文件），数据仓私有（仅数据文件，靠令牌读写）。仓库设为私有时数据不对外公开，Pages 站点本身仍可通过 `github.io` 域名访问，访问密码门禁负责守住页面。

## 访问密码

默认密码：`CodeVault2026`

- 每次打开页面都需要输入密码（**不提供免登录**，刷新或关闭后需重新输入）。
- 修改密码：右上角「⋯」菜单 → **修改访问密码**，输入当前密码与新密码即可。
- 锁定站点：右上角「⋯」菜单 → **锁定站点**，立即返回登录界面。
- 密码以**哈希**形式保存在浏览器 `localStorage`（`codevault_pwd_v1`），源码中不含明文；清空该键会恢复默认密码。

> ⚠️ 说明：这是**纯前端**密码门禁，能防止他人随手打开页面，但无法防御查看源码/清缓存等技术手段。请勿用它保护真正敏感的数据。如需强保护，请改用带服务端鉴权的方案或 Cloudflare Access。

## 本地运行

```bash
cd docs
python -m http.server 8000
```

然后访问 <http://localhost:8000>。因为要调用 GitHub API，建议通过 HTTP 服务器访问而非直接双击 `file://` 打开。

## 部署到 GitHub Pages

仓库结构：`docs/` 是站点根目录，`data/` 存放数据文件。

1. 进入仓库 **Settings → Pages**
2. Source 选择 **Deploy from a branch**，分支 `main`，目录选 **`/docs`**
3. 保存后通过 `https://<用户名>.github.io/<仓库名>/` 访问

## 文件结构

```
.
├── docs/
│   ├── index.html   # 页面结构
│   ├── styles.css   # OI-Wiki 风格样式与响应式布局
│   └── app.js       # 应用逻辑：CRUD、搜索筛选、高亮、GitHub 同步、导入导出
├── data/
│   └── codevault.json  # 数据初稿，推送到私有仓库 code-vault-data
└── README.md
```

`data/codevault.json` 会推送为私有仓库 `code-vault-data` 根目录下的 `codevault.json`。

## 数据格式

私有数据仓库 `code-vault-data` 中的 `codevault.json` 与导出的备份结构一致：

```json
{
  "app": "CodeVault",
  "version": 1,
  "updatedAt": "2026-01-01T00:00:00.000Z",
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
