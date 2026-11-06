# 灯下 Lamplit —— 插件契约（所有实现者必读）

一个 DeepSeek Harness 的自有插件（Host + Client 两半），作用是**读书**：

- 聚合书架：本地导入（Markdown / TXT / PDF）+ 微信读书（用户自己的账号 cookie）+ 番茄小说（用户自己的账号 cookie）
- 沉浸式阅读界面：纸面主题、衬线排版、分页/滚动双模式、目录抽屉、隐藏式工具条、进度续读
- 数据落在本机 `~/.dsh/lamplit/`，不外传

包名 `dsh-lamplit`，目录 `/Users/abcerk/Desktop/lamplit`。

---

## 1. 文件所有权（禁止越界写）

| 文件 | 所有者 |
|---|---|
| `package.json`, `cordis.patch.yml`, `index.js`, `locale/*.json`, `icon.svg` | Lead |
| `lib/store.js`, `lib/api.js`, `lib/markdown.js`, `lib/txt.js`, `lib/http.js`, `lib/providers/*.js` | Lead |
| `lib/pdf-text.js`, `test/pdf.test.mjs` | teammate `pdf-extract` |
| `client.js` | teammate `reader-ui` |
| `SPEC.md` | Lead |

只能写自己名下的文件。需要改契约先让 Lead 改 SPEC.md。

---

## 2. 数据模型

### Block（正文块，Host 产出，Client 渲染）

```js
{ t: 'h', l: 1|2|3, x: '标题文字' }   // 标题，l=层级
{ t: 'p', x: '段落文字' }             // 正文段落
{ t: 'q', x: '引文' }                 // 引用块
{ t: 'li', x: '条目' }                // 列表项
{ t: 'code', x: '代码原文' }          // 代码块（保留换行）
{ t: 'hr' }                           // 分隔线
```

### Chapter（章）

```js
{ index: 0, title: '第一章 春', blocks: Block[], chars: 1834 }
```

### BookSummary（书架条目，Client 只拿这个）

```js
{
  id: 'bk_ab12cd34',
  title: '书名',
  author: '作者' | '',
  source: 'local' | 'weread' | 'fanqie',
  sourceId: '外部书 id' | null,
  format: 'md' | 'txt' | 'pdf' | 'online',
  chapterCount: 42,
  chars: 128000,
  addedAt: 1762300000000,
  lastOpenedAt: 1762300000000 | 0,
  finished: false,
  progress: { chapterIndex: 0, percent: 0, charsRead: 0, updatedAt: 0 }
}
```

### Settings

```js
{
  theme: 'paper' | 'sepia' | 'ink' | 'moss',  // 纸白 / 米黄 / 夜墨 / 护眼
  fontFamily: 'serif' | 'sans',
  fontSize: 19,        // 15..32
  lineHeight: 1.9,     // 1.4..2.4
  measure: 34,         // 每行字数 24..52（→ max-inline-size: <measure>em）
  mode: 'scroll' | 'paged',
  justify: true,
  chromeAutoHide: true
}
```

---

## 3. HTTP 契约（同源，全部 JSON，路径前缀 `/lamplit`）

所有响应：成功 `{ ok: true, ...payload }`；失败 `{ ok: false, error: '人话原因', code?: 'AUTH'|'NET'|'FORMAT'|'NOTFOUND'|'BADREQ' }`，HTTP 状态码 200/400/404/500 合理即可（Client 以 `ok` 为准）。

| Method | Path | Body | 响应 |
|---|---|---|---|
| GET | `/api/state` | — | `{ok, storage, settings, shelf: BookSummary[], providers: ProviderState[]}` |
| POST | `/api/settings` | `{patch: Partial<Settings>}` | `{ok, settings}` |
| POST | `/api/import` | `{name, dataBase64}` | `{ok, book: BookSummary, toc}` |
| POST | `/api/import-path` | `{path}` | `{ok, book, toc}` |
| GET | `/api/book/:id` | — | `{ok, book: BookSummary, toc: [{index,title,l,chars}]}` |
| GET | `/api/book/:id/chapter/:index` | — | `{ok, chapter: Chapter, prev: number\|null, next: number\|null, total: number}` |
| POST | `/api/progress` | `{bookId, chapterIndex, percent, seconds}` | `{ok, book: BookSummary}` |
| POST | `/api/book/:id/finished` | `{finished: boolean}` | `{ok, book}` |
| DELETE | `/api/book/:id` | — | `{ok}` |
| POST | `/api/provider/:id/login` | `{cookie}` | `{ok, provider: ProviderState}` |
| POST | `/api/provider/:id/logout` | — | `{ok, provider: ProviderState}` |
| POST | `/api/provider/:id/sync` | — | `{ok, provider, added, updated, shelf}` |
| GET | `/api/provider/:id/search?q=关键词` | — | `{ok, results: [{bookId, title, author, cover:null}]}` |
| GET | `/api/provider/:id/toc?bookId=xx` | — | `{ok, title, author, chapters: [{index,title,chapterId}]}` |
| POST | `/api/provider/:id/open` | `{bookId, title?, author?}` | `{ok, book, toc}` |

### ProviderState

```js
{ id: 'weread', label: '微信读书', connected: true, account: '昵称' | '', shelfCount: 12,
  lastSyncAt: 1762300000000, error: null | '上次同步失败原因' }
```

`id` 取值 `weread` | `fanqie`。

### 语义约定

- `POST /api/import`：`name` 是文件名（含扩展名），`dataBase64` 是纯 base64（不带 data: 前缀）。按扩展名分派：`.md/.markdown` → Markdown，`.txt` → 纯文本，`.pdf` → PDF。不支持的扩展名返回 `code:'FORMAT'`。
- 导入成功后 `book.progress.chapterIndex === 0`，`toc` 与 `GET /api/book/:id` 的 `toc` 同形。
- `POST /api/progress`：`percent` 是当前章内进度 0..1；Host 折算全书百分比并写入 `progress`。`seconds` 为本轮阅读秒数（可 0）。
- `provider/:id/login`：Host 用 cookie 打一次真实请求验证；成功即落盘并返回账号名（拿不到昵称就返回空串 + `connected:true`）。失败返回 `{ok:false, code:'AUTH', error:'cookie 已失效，请重新获取'}`。
- `provider/:id/sync`：拉取该账号书架，写成本地 `source:'weread'|'fanqie'` 的书（只存目录与元数据，正文在打开时缓存）。
- `provider/:id/open`：把该书的章节正文抓取并落成本地 chapter blocks，返回可读的 `book`。
- 未登录调用 provider 接口 → `{ok:false, code:'AUTH', error:'尚未连接微信读书'}`。

---

## 4. Client 契约（`client.js`）

**模块格式必须严格如下**（无 JSX，无打包，React 由 loader 提供）：

```js
window.__ModuleLoader__.load({
  id: 'dsh-lamplit',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    // ... 组件
    return {
      inject: ['slots', 'locale'],
      apply(ctx) { /* 注册 locale + 两个 slot */ },
    };
  },
});
```

注册：

```js
ctx.locale.register('lamplit', 'zh', { ... });   // 中文文案
ctx.locale.register('lamplit', 'en', { ... });   // 英文文案
const t = ctx.locale.bind('lamplit');

// 侧栏入口图标：只画字形，按钮由侧栏负责
ctx.slots.inject('sidebar.panellist', () => ctx.slots.register(
  { name: 'sidebar.panellist', id: 'lamplit', order: 30, label: () => t('title') },
  PanelIcon,
));

// 主面板页面
ctx.slots.inject('main', () => ctx.slots.register(
  { name: 'main', key: 'lamplit' },
  Page,
));
```

`PanelIcon` 收到 `{ size, active }`，返回一个 SVG（当前色用 `currentColor`）。
`Page` 收到标准 props（用不到就忽略）。

### 交互要求

1. **书架视图**：卡片/书脊列表，显示来源徽标（本地 / 微信读书 / 番茄小说）、进度环或进度条、继续阅读、删除；顶部有搜索过滤、导入按钮、来源筛选（全部/本地/微信/番茄）。
2. **导入**：隐藏 `<input type="file" accept=".md,.markdown,.txt,.pdf">`；书架区域支持整块拖拽高亮投放；读成 base64 后 `POST /api/import`；导入中显示进度态，失败显示 `error` 原文。
3. **来源面板**：微信读书 / 番茄小说两张卡——已连接显示账号 + 同步 + 断开；未连接显示 cookie 粘贴框 + 获取说明 + 连接按钮。同步失败显示原因。
4. **阅读器**（沉浸式）：
   - 正文限宽 `<measure>em`，居中，衬线/黑体可切。
   - 主题四套：纸白 / 米黄 / 夜墨 / 护眼，正文区用纸张色（这是阅读画布，允许字面色），工具条用 Harness 主题 token。
   - 顶部工具条：返回书架、书名/章名、目录、字号、设置；**2.5 秒无操作自动淡出**，鼠标移动/移到顶端再出现。
   - 底部：细进度条 + `第 x / n 章` + 章节百分比；点击可跳章。
   - 目录抽屉：左侧滑出，高亮当前章，点击跳转。
   - 设置面板：主题、字体、字号、行距、每行字数、分页/滚动、两端对齐。
   - 键盘：`←/→` 翻页或跳章、`j/k` 或 `Space` 滚动、`t` 目录、`s` 设置、`Esc` 返回书架。
   - 分页模式用 CSS 多列横向分栏（`column-width` + `translateX` 翻页），滚动模式用竖向滚动；两种模式都要正确记录与恢复进度。
   - 打开书时 `GET /api/book/:id/chapter/:i`，滚动/翻页到上次段落；离开或每 5 秒 `POST /api/progress`（节流）。
   - 章节末尾：`下一章` 按钮 + `本书读完` 标记。
5. **样式**：容器/控件用 `var(--dsw-alias-*)`；正文纸张色允许写死。所有 class 以 `pb-` 前缀，避免污染。全部通过 `<style>` React 元素注入（随组件卸载移除），不用外部 CSS 文件。
6. **空态**：书架为空时给一句引导 + 导入按钮 + 连接来源按钮，不能是空白。

### 不允许

- 不允许 `require` React 之外任何包，不允许 import Harness Client 包。
- 不允许操作 `document.body` 之外的全局 DOM、不允许改宿主样式。
- 不允许把 cookie 显示回 UI（只显示账号名）。
- 不允许 alert/confirm（用自身 UI）。

---

## 5. PDF 契约（`lib/pdf-text.js`）

```js
export function extractPdfText(buffer /* Uint8Array|Buffer */): {
  pages: Array<{ index: number, text: string }>,
  text: string,          // 全文，页之间用 \n\n 连接
  charCount: number,
  warnings: string[],    // 例如 ['no-text-layer'] 扫描版
}
```

要求：

- 纯 JS，只用 `node:zlib` 与内置 API，零依赖。
- 支持 FlateDecode 流、`Tj`/`TJ`/`'`/`"` 文本算子、`Td/TD/T*/TL/Tm` 的换行与间距判断、`ToUnicode` CMap（`beginbfchar`/`beginbfrange`）做 CID 字体映射；遇到无法解码的字形保持 `''` 而不是乱码。
- 中文 PDF 常见：内容流里的字符串是 hex `<...>` + CID，必须靠 ToUnicode 才能还原，务必处理。
- 完全无文本层（扫描件）时返回 `warnings` 含 `'no-text-layer'`，`text` 为空串，不抛错。
- 抛错只允许在「根本不是 PDF」时（`Error('not a pdf')`）。
- 附带 `test/pdf.test.mjs`：用 `node:test` + 自造 PDF（手写最小 PDF 字符串、Flate 压缩内容流、带 ToUnicode 的 CID 字体样例）验证；另可用 `cupsfilter`（macOS 自带）生成真实 PDF 做一次冒烟测试，缺失则跳过。

---

## 6. 第二轮增量（用户追加，契约以此为准）

### 6.1 书的形态

`BookSummary.format` 取值：

| format | 含义 | 阅读器怎么渲染 |
|---|---|---|
| `md` / `txt` | 文本导入 | 文本排版 |
| `epub` | EPUB 导入 | 文本排版 |
| `pdf` | **有文字层**的 PDF | 文本排版（可划词） |
| `pdf-scan` | **没有文字层**的 PDF（扫描/影印） | **页面渲染**：`<embed type="application/pdf" src="/lamplit/api/book/<id>/file">` |
| `online` | 微信读书 / 番茄 | 文本排版（懒加载章节） |

新增字段：`BookSummary.pages`（PDF 页数，其他为 0）、`BookSummary.notes`（该书笔记条数，`GET /api/state` 里给出）。

`pdf-scan` 的书 `chapterCount === 0`，**不要**去请求 `/chapter/0`；直接走 embed。

### 6.2 新增接口

| Method | Path | Body / Query | 响应 |
|---|---|---|---|
| GET | `/api/book/:id/file` | — | `application/pdf` 二进制，支持 Range |
| GET | `/api/notes?bookId=xx` | — | `{ok, notes:[Note]}`（不带 bookId 返回全部） |
| POST | `/api/notes` | `{bookId, chapterIndex, quote, note, mode}` | `{ok, note}` |
| DELETE | `/api/notes/:id` | — | `{ok}` |
| POST | `/api/ai/ask` | `{text, mode:'explain'\|'expand', bookTitle, contextTitle}` | `{ok, answer, provider, model}` |

`Note`：
```js
{ id:'nt_xxx', bookId, bookTitle, chapterIndex, chapterTitle, quote, note, mode, createdAt }
```

`GET /api/book/:id/chapter/:i` 的响应新增：
- `chapter.locked: boolean`（番茄付费章）
- `notes: Note[]`（该章已有笔记）

### 6.3 阅读器新增交互

**A. 影印 PDF**：`format === 'pdf-scan'` → 阅读区用 `<embed type="application/pdf" src={...}>`，`width/height: 100%`；
顶栏保留返回/书名；底部改一行小字「影印版 · 用页面自带的工具条缩放翻页」；不显示文本进度条；**不挂划词**。

**B. 划词 AI**：在正文容器内选中文字后，选区上方浮出工具条（fixed 定位，不能被正文容器裁剪）：
- 解释 / 补充 / 记笔记 / 复制
- 解释、补充 → `POST /api/ai/ask`，结果卡片（loading「在想…」、错误显示 `error`、可复制、可「存为笔记」）
- 记笔记 → 直接 `POST /api/notes`，mode `note`，quote=选中文字
- `pdf-scan` 的书不出现工具条

**C. 笔记抽屉**：顶栏「笔记」按钮 → 右侧抽屉，列出本书笔记（引文 + 笔记 + 章节 + 时间），点击跳到该章，可删除。
书架卡片显示 `book.notes` 条数（0 不显示）。

**D. 徽标**：书架/详情里 `pdf-scan` 标「影印」，`epub` 标「EPUB」，`online` 已有来源徽标。

### 6.4 界面升级（第三轮）新增接口

| Method | Path | 响应 |
|---|---|---|
| GET | `/api/quote` | `{ok, quote: null \| {text, bookId, bookTitle, author, chapterTitle}}` |
| GET | `/api/notes/export?bookId=` | `{ok, count, filename, markdown}` |
| GET | `/api/shelf/export` | `{ok, filename, markdown}` |

`GET /api/state` 的 `stats` 结构：

```js
{ seconds: 0, opened: 0, today: 0, week: 0, streak: 0, days: { '2026-11-06': 1200 } }
```

单位为秒；`today/week` 已取整；`streak` 是连续天数（今天没读也不算断）。

笔记 `POST /api/notes` 缺 `chapterTitle` 时 Host 会按 `chapterIndex` 自动补齐。
