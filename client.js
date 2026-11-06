/**
 * 灯下 Lamplit — Client half.
 *
 * 一个书架 + 一个阅读器。纯浏览器 ES2020，只有 `react` 可用：
 * 没有 JSX、没有打包、没有第二个依赖。所有样式通过 <style> 元素随组件注入，
 * 所有文案走 ctx.locale，所有数据走 /lamplit/api/*。
 */
window.__ModuleLoader__.load({
  id: 'dsh-lamplit',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } = React;

    const NS = 'lamplit';
    const API = '/lamplit/api';
    const FILE_ACCEPT = '.md,.markdown,.txt,.pdf';
    const CHROME_IDLE_MS = 2500;
    const FLUSH_MS = 5000;

    const SERIF = '"Songti SC", "Source Han Serif SC", "Noto Serif CJK SC", "STSong", "Iowan Old Style", Georgia, "Times New Roman", serif';
    const SANS = '-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif';

    const THEMES = ['paper', 'sepia', 'ink', 'moss'];
    const DEFAULT_SETTINGS = {
      theme: 'paper',
      fontFamily: 'serif',
      fontSize: 19,
      lineHeight: 1.9,
      measure: 34,
      mode: 'scroll',
      justify: true,
      chromeAutoHide: true,
    };

    /* ------------------------------------------------------------------ */
    /* 文案                                                                */
    /* ------------------------------------------------------------------ */

    const ZH = {
      'app.title': '灯下',
      'nav.sources': '来源',
      'nav.import': '导入',
      'nav.importFile': '选择文件…',
      'nav.importPath': '从本机路径导入…',
      'nav.importPathHint': '/Users/me/books/春夜.md',
      'nav.importPathGo': '导入',
      'nav.clear': '清除',

      'filter.all': '全部',
      'filter.local': '本地',
      'filter.weread': '微信读书',
      'filter.fanqie': '番茄小说',
      'shelf.sourceAll': '全部来源',
      'shelf.sourceEmptyTitle': '这个来源还没有书',
      'shelf.sourceEmptyHint': '连上账号，或者同步一次，书就会出现在这里。',
      'shelf.connectSources': '管理来源',
      'shelf.finished': '读完',
      'shelf.emptyTitle': '书架还空着',
      'shelf.emptyBody': '把 Markdown、TXT 或 PDF 拖进这里，或者先连上你的微信读书、番茄小说。',
      'shelf.noMatch': '没有匹配的书',
      'shelf.noMatchHint': '换个关键词，或者把筛选拨回「全部」。',
      'shelf.dropTitle': '松手导入',
      'shelf.dropHint': '一次一本，按扩展名自动分派',
      'shelf.importing': '正在导入 {name}…',
      'shelf.imported': '已导入《{title}》',
      'shelf.errorTitle': '书架没读出来',
      'shelf.retry': '重试',
      'shelf.remove': '移除',

      'source.title': '来源',
      'source.subtitle': '登录一次，之后同步都由本机完成',
      'source.connected': '已连接',
      'source.disconnected': '未连接',
      'source.account': '账号',
      'source.anonymous': '（没拿到昵称）',
      'source.books': '书架 {n} 本',
      'source.lastSync': '上次同步 {time}',
      'source.never': '还没同步过',
      'source.cookieLabel': '粘贴 cookie',
      'source.cookiePlaceholder': '把请求头里的整条 Cookie 粘贴到这里',
      'source.cookieHelp': '只写进本机 ~/.dsh/lamplit，不显示回界面，也不外传。',
      'source.wereadHow': '浏览器打开 weread.qq.com 并登录 → 开发者工具 → Network 里挑一个请求 → 复制请求头中的整条 Cookie。',
      'source.fanqieHow': '浏览器打开 fanqienovel.com 并登录 → 开发者工具 → Network 里挑一个请求 → 复制请求头中的整条 Cookie。',
      'source.connect': '连接',
      'source.qrLogin': '用微信扫码登录',
      'source.qrHint': '打开微信 → 扫一扫 → 手机上确认。扫完这里会自动把书架同步下来。',
      'source.qrWaiting': '等待扫码…',
      'source.qrSyncing': '已登录，正在导入书架 {n} 本…',
      'source.qrDone': '登录成功，已同步 {n} 本',
      'source.qrRefresh': '换一张二维码',
      'source.qrFailed': '二维码过期了，点「换一张」重新来。',
      'source.otherWays': '其他方式：粘贴 Cookie',
      'source.addByLink': '粘贴番茄书籍链接',
      'source.addByLinkPlaceholder': 'https://fanqienovel.com/page/…',
      'source.add': '添加',
      'source.added': '已加入书架',
      'source.addHint': '目录会同步；正文受平台字体加密限制。',
      'source.advanced': '高级：连接账号（可选）',
      'source.connecting': '正在验证…',
      'source.sync': '同步书架',
      'source.syncing': '同步中…',
      'source.syncResult': '同步完成：新增 {added} 本，更新 {updated} 本',
      'source.disconnect': '断开',
      'source.disconnecting': '断开中…',
      'source.searchLabel': '找书并加入书架',
      'source.searchPlaceholder': '书名或作者',
      'source.searchEmpty': '没搜到',
      'source.open': '加入',
      'source.openning': '抓取中…',
      'source.close': '关闭',
      'source.errorPrefix': '出错了：',

      'reader.back': '书架',
      'reader.toc': '目录',
      'reader.fontSize': '字号',
      'reader.settings': '设置',
      'reader.chapterCount': '第 {i} / {n} 章',
      'reader.next': '下一章',
      'reader.prev': '上一章',
      'reader.end': '本章完',
      'reader.markFinished': '本书读完',
      'reader.finished': '已读完',
      'reader.loading': '正在翻页…',
      'reader.chapterError': '这一章没打开',
      'reader.chapterMissing': '这一章还是空的',
      'reader.retry': '重试',
      'reader.theme': '纸张',
      'reader.themePaper': '纸白',
      'reader.themeSepia': '米黄',
      'reader.themeInk': '夜墨',
      'reader.themeMoss': '护眼',
      'reader.typeface': '字体',
      'reader.serif': '衬线',
      'reader.sans': '黑体',
      'reader.size': '字号',
      'reader.leading': '行距',
      'reader.measure': '每行字数',
      'reader.layout': '翻页方式',
      'reader.paged': '分页',
      'reader.scroll': '滚动',
      'reader.justify': '两端对齐',
      'reader.autohide': '工具条自动隐藏',
      'reader.on': '开',
      'reader.off': '关',
      'reader.percent': '{n}%',
      'reader.pageLabel': '{i} / {n} 页',
      'reader.jump': '点这里跳章',
      'reader.contents': '共 {n} 章',
      'toast.failed': '{error}',
      'toast.finished': '已标记读完',
      'toast.unfinished': '已取消读完标记',
      'toast.removed': '已移除《{title}》',
      'toast.providerConnected': '已连接 {label}',
      'toast.providerDisconnected': '已断开 {label}',

      'shelf.scanBadge': '影印',
      'shelf.epubBadge': 'EPUB',

      'reader.notes': '笔记',
      'reader.scanHint': '影印版 · 缩放与翻页用它自带的工具条',

      'select.explain': '解释',
      'select.expand': '补充',
      'select.note': '记笔记',
      'select.copy': '复制',
      'select.copied': '已复制',
      'select.copyFailed': '复制没成功，手动选一下吧',

      'ai.explainTitle': '这段在说什么',
      'ai.expandTitle': '背景与出处',
      'ai.thinking': '在想…',
      'ai.errorTitle': '这次没问出来',
      'ai.saveNote': '存为笔记',
      'ai.saved': '已存为笔记',
      'ai.close': '关闭',

      'notes.title': '笔记',
      'notes.loading': '正在取笔记…',
      'notes.error': '笔记没读出来',
      'notes.empty': '这本书还没有笔记。选中正文，点「记笔记」就会落在这里。',
      'notes.delete': '删除',
      'notes.quoteOnly': '（只存了引文）',
      'notes.deleted': '笔记已删',
      'notes.saved': '已记下这段',

      'nav.back': '返回',
      'shelf.continue': '继续阅读',
      'shelf.reread': '再读一遍',
      'shelf.markFinished': '标记读完',
      'shelf.unfinish': '取消读完',
      'shelf.menu': '更多',
      'shelf.chapterWithTitle': '第 {n} 章 · {title}',
      'shelf.chapterOnly': '第 {n} 章',
      'shelf.readPercent': '已读 {n}%',
      'shelf.percent': '{n}%',

      'duration.minutes': '{n} 分',
      'duration.hours': '{n} 小时',
      'duration.hoursMinutes': '{hours} 小时 {minutes} 分',

      'rail.week': '本周阅读',
      'rail.streak': '连续 {n} 天',
      'rail.recentNotes': '最近笔记',
      'rail.noNotes': '还没有笔记',
      'rail.noteMeta': '{book} · 第 {n} 章',
      'rail.allNotes': '全部笔记',
      'rail.stats': '统计',
      'rail.exportShelf': '导出书单',

      'notes.scopeAll': '全部',
      'notes.scopeBook': '本书',
      'notes.search': '搜引文或笔记',
      'notes.count': '{n} 条',
      'notes.expand': '查看全文',
      'notes.meta': '第 {n} 章 · {time}',
      'notes.openPage': '在笔记页查看',

      'stats.streakValue': '{n} 天',
      'stats.booksValue': '{n} 本',
      'stats.footer': '笔记 {n} 条 · 书架 {books} 本',

      'view.shelf': '书架',
      'view.notes': '笔记',
      'view.stats': '统计',
      'view.label': '视图',

      'nav.searchShelf': '搜书名、作者',
      'shelf.greetMorning': '早上好',
      'shelf.greetNoon': '中午好',
      'shelf.greetAfternoon': '下午好',
      'shelf.greetEvening': '晚上好',
      'shelf.greetNight': '夜里好',

      'filter.reading': '在读',
      'filter.finished': '读完',
      'sort.recent': '最近阅读',
      'sort.added': '加入时间',
      'sort.title': '书名',
      'density.grid': '网格',
      'density.list': '列表',

      'stats.today': '今日',
      'stats.thisWeek': '本周',
      'stats.total': '总计',
      'stats.streak': '连续阅读',
      'stats.finished': '读完',
      'stats.notes': '笔记',
      'stats.minutes': '分钟',
      'stats.hours': '小时',
      'stats.daysUnit': '天',
      'stats.booksUnit': '本',
      'stats.itemsUnit': '条',
      'stats.goal': '今日目标',
      'stats.chartTitle': '最近七天',
      'stats.chartHint': '按天累计',
      'stats.empty': '还没有阅读记录，翻开一页就有了。',
      'stats.barTitle': '{day} · {minutes} 分钟',
      'notes.deleteConfirm': '确认删除',
      'notes.exportBook': '导出',
      'notes.exportAll': '导出全部',
      'notes.copy': '复制',
      'notes.jump': '跳到这一章',
      'notes.untitled': '未命名',

      'toast.exported': '已导出 {name}',
      'toast.copied': '已复制',
    };

    const EN = {
      'app.title': 'Lamplit',
      'nav.sources': 'Sources',
      'nav.import': 'Import',
      'nav.importFile': 'Choose a file…',
      'nav.importPath': 'Import from a path…',
      'nav.importPathHint': '/Users/me/books/spring.md',
      'nav.importPathGo': 'Import',
      'nav.clear': 'Clear',

      'filter.all': 'All',
      'filter.local': 'Local',
      'shelf.sourceAll': 'All sources',
      'shelf.sourceEmptyTitle': 'Nothing from this source yet',
      'shelf.sourceEmptyHint': 'Connect the account, or run a sync once, and the books land here.',
      'shelf.connectSources': 'Manage sources',
      'filter.weread': 'WeRead',
      'filter.fanqie': 'Fanqie',
      'shelf.finished': 'Finished',
      'shelf.emptyTitle': 'Nothing on the shelf yet',
      'shelf.emptyBody': 'Drop a Markdown, TXT or PDF file here, or connect WeRead and Fanqie first.',
      'shelf.noMatch': 'No book matches',
      'shelf.noMatchHint': 'Try another keyword, or switch the filter back to All.',
      'shelf.dropTitle': 'Drop to import',
      'shelf.dropHint': 'One file at a time, dispatched by extension',
      'shelf.importing': 'Importing {name}…',
      'shelf.imported': 'Imported “{title}”',
      'shelf.errorTitle': 'The shelf did not load',
      'shelf.retry': 'Retry',
      'shelf.remove': 'Remove',

      'source.title': 'Sources',
      'source.subtitle': 'Sign in once — every sync stays on this machine',
      'source.connected': 'Connected',
      'source.disconnected': 'Not connected',
      'source.account': 'Account',
      'source.anonymous': '(no nickname returned)',
      'source.books': '{n} books',
      'source.lastSync': 'Last synced {time}',
      'source.never': 'Never synced',
      'source.cookieLabel': 'Paste cookie',
      'source.cookiePlaceholder': 'Paste the whole Cookie header here',
      'source.cookieHelp': 'Stored only in ~/.dsh/lamplit on this machine, never shown back, never sent anywhere else.',
      'source.wereadHow': 'Open weread.qq.com in a browser and sign in → DevTools → pick a request in Network → copy the whole Cookie request header.',
      'source.fanqieHow': 'Open fanqienovel.com in a browser and sign in → DevTools → pick a request in Network → copy the whole Cookie request header.',
      'source.connect': 'Connect',
      'source.qrLogin': 'Sign in with WeChat QR',
      'source.qrHint': 'Open WeChat → Scan → confirm on your phone. The shelf syncs by itself afterwards.',
      'source.qrWaiting': 'Waiting for the scan…',
      'source.qrSyncing': 'Signed in — importing {n} books…',
      'source.qrDone': 'Signed in — {n} books synced',
      'source.qrRefresh': 'New QR code',
      'source.qrFailed': 'The QR code expired. Tap “New QR code”.',
      'source.otherWays': 'Other way: paste a cookie',
      'source.addByLink': 'Paste a Fanqie book link',
      'source.addByLinkPlaceholder': 'https://fanqienovel.com/page/…',
      'source.add': 'Add',
      'source.added': 'Added to your shelf',
      'source.addHint': 'The table of contents syncs; the text is font-obfuscated by the platform.',
      'source.advanced': 'Advanced: connect an account (optional)',
      'source.connecting': 'Verifying…',
      'source.sync': 'Sync shelf',
      'source.syncing': 'Syncing…',
      'source.syncResult': 'Synced: {added} added, {updated} updated',
      'source.disconnect': 'Disconnect',
      'source.disconnecting': 'Disconnecting…',
      'source.searchLabel': 'Find a book and add it',
      'source.searchPlaceholder': 'Title or author',
      'source.searchEmpty': 'Nothing found',
      'source.open': 'Add',
      'source.openning': 'Fetching…',
      'source.close': 'Close',
      'source.errorPrefix': 'Something went wrong: ',

      'reader.back': 'Shelf',
      'reader.toc': 'Contents',
      'reader.fontSize': 'Size',
      'reader.settings': 'Settings',
      'reader.chapterCount': 'Chapter {i} / {n}',
      'reader.next': 'Next chapter',
      'reader.prev': 'Previous chapter',
      'reader.end': 'End of chapter',
      'reader.markFinished': 'Mark as finished',
      'reader.finished': 'Finished',
      'reader.loading': 'Turning the page…',
      'reader.chapterError': 'This chapter did not open',
      'reader.chapterMissing': 'This chapter is empty',
      'reader.retry': 'Retry',
      'reader.theme': 'Paper',
      'reader.themePaper': 'Paper',
      'reader.themeSepia': 'Sepia',
      'reader.themeInk': 'Night ink',
      'reader.themeMoss': 'Moss',
      'reader.typeface': 'Typeface',
      'reader.serif': 'Serif',
      'reader.sans': 'Sans',
      'reader.size': 'Size',
      'reader.leading': 'Leading',
      'reader.measure': 'Characters per line',
      'reader.layout': 'Layout',
      'reader.paged': 'Paged',
      'reader.scroll': 'Scroll',
      'reader.justify': 'Justify',
      'reader.autohide': 'Auto-hide toolbar',
      'reader.on': 'On',
      'reader.off': 'Off',
      'reader.percent': '{n}%',
      'reader.pageLabel': '{i} / {n} pages',
      'reader.jump': 'Click to jump chapters',
      'reader.contents': '{n} chapters',
      'toast.failed': '{error}',
      'toast.finished': 'Marked as finished',
      'toast.unfinished': 'Finished mark removed',
      'toast.removed': 'Removed “{title}”',
      'toast.providerConnected': 'Connected to {label}',
      'toast.providerDisconnected': 'Disconnected from {label}',

      'shelf.scanBadge': 'Scan',
      'shelf.epubBadge': 'EPUB',

      'reader.notes': 'Notes',
      'reader.scanHint': 'Scanned edition · zoom and turn pages with its own toolbar',

      'select.explain': 'Explain',
      'select.expand': 'Context',
      'select.note': 'Note',
      'select.copy': 'Copy',
      'select.copied': 'Copied',
      'select.copyFailed': 'Copy did not work — select it manually',

      'ai.explainTitle': 'What this passage says',
      'ai.expandTitle': 'Background and sources',
      'ai.thinking': 'Thinking…',
      'ai.errorTitle': 'No answer this time',
      'ai.saveNote': 'Save as note',
      'ai.saved': 'Saved to notes',
      'ai.close': 'Close',

      'notes.title': 'Notes',
      'notes.loading': 'Loading notes…',
      'notes.error': 'Notes did not load',
      'notes.empty': 'No notes for this book yet. Select text and tap “Note” to keep it here.',
      'notes.delete': 'Delete',
      'notes.quoteOnly': '(quote only)',
      'notes.deleted': 'Note deleted',
      'notes.saved': 'Saved this passage',

      'nav.back': 'Back',
      'shelf.continue': 'Continue',
      'shelf.reread': 'Read again',
      'shelf.markFinished': 'Mark as finished',
      'shelf.unfinish': 'Mark unread',
      'shelf.menu': 'More',
      'shelf.chapterWithTitle': 'Chapter {n} · {title}',
      'shelf.chapterOnly': 'Chapter {n}',
      'shelf.readPercent': '{n}% read',
      'shelf.percent': '{n}%',

      'duration.minutes': '{n} min',
      'duration.hours': '{n} h',
      'duration.hoursMinutes': '{hours} h {minutes} min',

      'rail.week': 'This week',
      'rail.streak': '{n}-day streak',
      'rail.recentNotes': 'Recent notes',
      'rail.noNotes': 'No notes yet',
      'rail.noteMeta': '{book} · Chapter {n}',
      'rail.allNotes': 'All notes',
      'rail.stats': 'Stats',
      'rail.exportShelf': 'Export shelf',

      'notes.scopeAll': 'All',
      'notes.scopeBook': 'This book',
      'notes.search': 'Search quotes and notes',
      'notes.count': '{n}',
      'notes.expand': 'Show more',
      'notes.meta': 'Chapter {n} · {time}',
      'notes.openPage': 'Open in notes',

      'stats.streakValue': '{n} days',
      'stats.booksValue': '{n} books',
      'stats.footer': '{n} notes · {books} books',

      'view.shelf': 'Shelf',
      'view.notes': 'Notes',
      'view.stats': 'Stats',
      'view.label': 'Views',

      'nav.searchShelf': 'Search title or author',
      'shelf.greetMorning': 'Good morning',
      'shelf.greetNoon': 'Good noon',
      'shelf.greetAfternoon': 'Good afternoon',
      'shelf.greetEvening': 'Good evening',
      'shelf.greetNight': 'Late night',

      'filter.reading': 'Reading',
      'filter.finished': 'Finished',
      'sort.recent': 'Recently read',
      'sort.added': 'Date added',
      'sort.title': 'Title',
      'density.grid': 'Grid',
      'density.list': 'List',

      'stats.today': 'Today',
      'stats.thisWeek': 'This week',
      'stats.total': 'All time',
      'stats.streak': 'Day streak',
      'stats.finished': 'Finished',
      'stats.notes': 'Notes',
      'stats.minutes': 'min',
      'stats.hours': 'h',
      'stats.daysUnit': 'd',
      'stats.booksUnit': 'books',
      'stats.itemsUnit': 'notes',
      'stats.goal': 'Daily goal',
      'stats.chartTitle': 'Last seven days',
      'stats.chartHint': 'Minutes per day',
      'stats.empty': 'No reading recorded yet. One page changes that.',
      'stats.barTitle': '{day} · {minutes} min',
      'notes.deleteConfirm': 'Confirm',
      'notes.exportBook': 'Export',
      'notes.exportAll': 'Export all',
      'notes.copy': 'Copy',
      'notes.jump': 'Jump to this chapter',
      'notes.untitled': 'Untitled',

      'toast.exported': 'Exported {name}',
      'toast.copied': 'Copied',
    };

    /* ------------------------------------------------------------------ */
    /* 样式                                                                */
    /* ------------------------------------------------------------------ */

    const CSS = [
      /* ---------- 基底 ---------- */
      '.pb-root{position:relative;height:100%;min-height:0;display:flex;flex-direction:column;overflow:hidden;',
      'background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);',
      'font-family:var(--dsw-font-family,-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif);',
      'font-size:13px;line-height:1.5;box-sizing:border-box;padding-top:var(--pb-frame-pad,0px);',
      '--pb-line:var(--dsw-alias-border-l1);--pb-line-strong:var(--dsw-alias-border-l2);',
      '--pb-accent:var(--dsw-alias-brand-primary);--pb-mute:var(--dsw-alias-label-tertiary);',
      '--pb-cover-shadow:0 1px 3px rgba(0,0,0,.12);--pb-r-btn:8px;--pb-r-card:8px;--pb-r-chip:999px;',
      '-webkit-font-smoothing:antialiased}',
      '[data-platform="darwin"] .pb-root{--pb-frame-pad:var(--dsh-frame-top-clearance,0px)}',
      '.pb-root *,.pb-root *::before,.pb-root *::after{box-sizing:border-box}',
      '.pb-num{font-variant-numeric:tabular-nums}',

      /* ---------- 控件 ---------- */
      '.pb-btn{border:1px solid var(--pb-line-strong);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);',
      'border-radius:8px;height:32px;padding:0 12px;font:inherit;font-size:13px;line-height:1;cursor:pointer;',
      'display:inline-flex;align-items:center;gap:6px;white-space:nowrap;transition:background .15s ease,border-color .15s ease,color .15s ease}',
      '.pb-btn:hover{background:var(--dsw-alias-interactive-bg-hover)}',
      '.pb-btn:disabled{opacity:.45;cursor:default}',
      '.pb-btn-primary{background:var(--dsw-alias-button-primary-fill);border-color:transparent;color:var(--dsw-alias-label-primary-foreground)}',
      '.pb-btn-primary:hover{background:var(--dsw-alias-button-primary-hover)}',
      '.pb-btn-quiet{background:transparent;border-color:transparent;color:var(--dsw-alias-label-secondary);padding:0 8px}',
      '.pb-btn-quiet:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}',
      '.pb-iconbtn{width:32px;height:32px;padding:0;justify-content:center;border-radius:8px;border:1px solid transparent;',
      'background:transparent;color:var(--dsw-alias-label-secondary);display:inline-flex;align-items:center;cursor:pointer;font:inherit}',
      '.pb-iconbtn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}',
      '.pb-iconbtn[data-on="1"]{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}',
      '.pb-btn:focus-visible,.pb-iconbtn:focus-visible,.pb-tab:focus-visible,.pb-book:focus-visible,.pb-scope:focus-visible,',
      '.pb-textlink:focus-visible,.pb-more:focus-visible,.pb-note-del:focus-visible,.pb-book-menu:focus-visible,',
      '.pb-note-item:focus-within,.pb-sortbtn:focus-visible,.pb-pop-item:focus-visible,.pb-rail-note:focus-visible,',
      '.pb-continue:focus-visible,.pb-note-quote:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--pb-accent));outline-offset:2px}',
      '.pb-icon-btn{width:28px;height:28px;padding:0;justify-content:center;border-radius:8px;border:1px solid transparent;',
      'background:transparent;color:var(--dsw-alias-label-secondary);display:inline-flex;align-items:center;cursor:pointer}',
      '.pb-icon-btn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}',
      '.pb-icon-btn[data-on="1"]{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}',
      '.pb-input{height:32px;border:1px solid var(--pb-line-strong);border-radius:8px;background:var(--dsw-alias-bg-layer-2);',
      'color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;padding:0 10px;outline:none;min-width:0}',
      '.pb-input:focus{border-color:var(--pb-accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--pb-accent) 16%,transparent)}',
      '.pb-input::placeholder{color:var(--pb-mute)}',

      /* ---------- 顶栏 ---------- */
      '.pb-appbar{flex:none;height:56px;display:flex;align-items:center;padding:0 clamp(20px,3vw,40px);',
      'border-bottom:1px solid var(--pb-line);background:var(--dsw-alias-bg-base);position:relative;z-index:6}',
      '.pb-appbar-inner{width:100%;max-width:1120px;margin:0 auto;display:flex;align-items:center;gap:20px;min-width:0;height:100%}',
      '.pb-headline{display:flex;align-items:center;gap:20px;min-width:0;height:100%}',
      '.pb-wordmark{font-family:' + SERIF + ';font-size:13px;letter-spacing:.16em;color:var(--pb-mute);white-space:nowrap}',
      '.pb-wordmark-rule{width:1px;height:12px;background:var(--pb-line-strong);flex:none}',
      '.pb-headline h1{margin:0;font-size:20px;font-weight:600;line-height:1.4;white-space:nowrap;letter-spacing:.01em}',
      '.pb-back{width:24px;height:24px;flex:none;display:grid;place-items:center;border:0;background:none;color:var(--pb-mute);',
      'cursor:pointer;border-radius:4px;padding:0;margin-left:-4px}',
      '.pb-back:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}',
      '.pb-tabs{display:flex;align-items:center;gap:20px;height:100%}',
      '.pb-tab{position:relative;border:0;background:none;padding:0;height:100%;cursor:pointer;font:inherit;font-size:14px;',
      'color:var(--dsw-alias-label-secondary);display:inline-flex;align-items:center;gap:6px;transition:color .15s ease}',
      '.pb-tab:hover{color:var(--dsw-alias-label-primary)}',
      '.pb-tab[data-on="1"]{color:var(--pb-accent);font-weight:600}',
      '.pb-tab[data-on="1"]::after{content:"";position:absolute;left:0;right:0;bottom:16px;height:2px;border-radius:2px;background:var(--pb-accent)}',
      '.pb-tab i{font-style:normal;font-size:12px;font-weight:400;color:var(--pb-mute)}',
      '.pb-actions{margin-left:auto;display:flex;align-items:center;gap:6px;min-width:0}',
      '.pb-narrow-actions{display:flex;align-items:center;gap:2px}',
      '@media (min-width:1180px){.pb-narrow-actions{display:none}}',
      '.pb-search{position:relative;display:flex;align-items:center;flex:0 0 auto}',
      '.pb-search svg{position:absolute;left:10px;color:var(--pb-mute);pointer-events:none}',
      '.pb-search input{width:200px;height:32px;border:0;border-radius:8px;background:var(--dsw-alias-bg-layer-2);',
      'color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;padding:0 10px 0 30px;outline:none;transition:box-shadow .15s ease}',
      '.pb-search input:focus{box-shadow:0 0 0 2px color-mix(in srgb,var(--pb-accent) 40%,transparent)}',
      '.pb-search input::placeholder{color:var(--pb-mute)}',
      '.pb-sortbtn{height:32px;padding:0 8px;border:0;background:none;color:var(--dsw-alias-label-secondary);font:inherit;',
      'font-size:13px;cursor:pointer;display:inline-flex;align-items:center;gap:4px;border-radius:8px;white-space:nowrap}',
      '.pb-sortbtn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}',
      '.pb-pop{position:absolute;z-index:24;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--pb-line-strong);',
      'border-radius:8px;box-shadow:var(--dsw-elevation-panel);padding:4px;min-width:172px;animation:pb-rise .14s ease}',
      '@keyframes pb-rise{from{opacity:0;transform:translateY(-3px)}to{opacity:1;transform:none}}',
      '.pb-pop-item{display:flex;width:100%;align-items:center;gap:8px;height:30px;padding:0 9px;border:0;border-radius:4px;',
      'background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;cursor:pointer;text-align:left;white-space:nowrap}',
      '.pb-pop-item:hover{background:var(--dsw-alias-interactive-bg-hover)}',
      '.pb-pop-item[data-danger="1"]{color:var(--dsw-alias-state-error-primary)}',
      '.pb-pop-path{display:flex;gap:6px;padding:4px 4px 2px}',

      /* ---------- 骨架 ---------- */
      '.pb-stage{position:relative;flex:1;min-height:0;display:flex;flex-direction:column}',
      '.pb-view{position:relative;flex:1;min-height:0;display:flex;flex-direction:column}',
      '.pb-scroll{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;padding:24px 0 48px;scrollbar-color:var(--dsw-alias-scrollbar-bg-l2) transparent}',
      '.pb-shell{max-width:1120px;margin:0 auto;padding:0 clamp(20px,3vw,40px);display:flex;gap:32px;align-items:flex-start}',
      '.pb-main{flex:1;min-width:0}',

      /* ---------- 继续阅读 ---------- */
      '.pb-continue{display:flex;align-items:center;gap:20px;width:100%;min-height:128px;padding:0 8px;border:0;border-radius:8px;',
      'background:none;font:inherit;color:inherit;text-align:left;cursor:pointer;transition:background .15s ease}',
      '.pb-continue:hover{background:var(--dsw-alias-bg-layer-2)}',
      '.pb-continue-cover{width:96px;height:128px;flex:none;border-radius:4px;overflow:hidden;box-shadow:var(--pb-cover-shadow);position:relative}',
      '.pb-continue-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:5px}',
      '.pb-eyebrow{margin:0;font-size:12px;letter-spacing:.08em;color:var(--pb-mute)}',
      '.pb-continue-title{margin:0;font-size:18px;font-weight:600;line-height:1.4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.pb-continue-sub{margin:0;font-size:13px;color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.pb-progress-row{display:flex;align-items:center;gap:10px;max-width:420px;margin-top:3px}',
      '.pb-progress{flex:1;height:2px;border-radius:2px;background:var(--dsw-alias-border-l2);overflow:hidden}',
      '.pb-progress i{display:block;height:100%;background:var(--pb-accent);border-radius:2px;transition:width .3s ease}',
      '.pb-progress-label{font-size:12px;color:var(--pb-mute);font-variant-numeric:tabular-nums;flex:none}',
      '.pb-divider{height:1px;background:var(--pb-line);margin:4px 0 24px}',
      '.pb-qr{display:flex;flex-direction:column;align-items:center;gap:8px;padding:14px 0 6px}',
      '.pb-qr-art{width:176px;height:176px;padding:10px;border-radius:8px;background:#fff;border:1px solid var(--pb-line)}',
      '.pb-qr-art svg{width:100%;height:100%;display:block}',
      '.pb-qr-note{margin:0;font-size:12px;color:var(--pb-mute);text-align:center;line-height:1.5}',
      '.pb-btn-wide{width:100%;justify-content:center}',
      '.pb-prov-linkrow{display:flex;gap:6px;align-items:center}',
      '.pb-prov-linkrow .pb-input{flex:1;min-width:0}',
      '.pb-sourcebar{display:flex;align-items:center;gap:2px;flex-wrap:wrap;margin:0 0 14px}',
      '.pb-srcchip{height:28px;padding:0 10px;border:0;border-radius:8px;background:none;color:var(--dsw-alias-label-secondary);',
      'font:inherit;font-size:12px;display:inline-flex;align-items:center;gap:6px;cursor:pointer;transition:background .15s ease,color .15s ease}',
      '.pb-srcchip:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}',
      '.pb-srcchip[data-on="1"]{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-weight:600}',
      '.pb-srcchip i{font-style:normal;font-weight:400;color:var(--pb-mute);font-size:12px;font-variant-numeric:tabular-nums}',
      '.pb-srcdot{width:5px;height:5px;border-radius:50%;background:var(--pb-mute);opacity:.45}',
      '.pb-srcdot[data-on="1"]{background:var(--pb-accent);opacity:1}',

      /* ---------- 网格 ---------- */
      '.pb-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(132px,1fr));gap:28px 24px;margin:0;padding:0;list-style:none}',
      '.pb-grid[data-density="list"]{grid-template-columns:1fr;gap:14px}',
      '.pb-book{position:relative;display:flex;flex-direction:column;gap:8px;padding:0;border:0;background:none;',
      'font:inherit;color:inherit;text-align:left;cursor:pointer}',
      '.pb-book-cover{position:relative;width:100%;aspect-ratio:3/4;border-radius:4px;overflow:hidden;background:var(--dsw-alias-bg-layer-2);',
      'box-shadow:var(--pb-cover-shadow);transition:transform .18s ease}',
      '.pb-book:hover .pb-book-cover{transform:translateY(-2px)}',
      '.pb-book-body{display:flex;flex-direction:column;gap:4px;min-width:0}',
      '.pb-book-title{margin:0;font-size:13px;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;',
      'overflow:hidden;overflow-wrap:anywhere}',
      '.pb-book-meta{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--pb-mute);min-width:0;line-height:1.4}',
      '.pb-book-meta em{font-style:normal;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}',
      '.pb-book-pct{margin-left:auto;flex:none;font-variant-numeric:tabular-nums}',
      '.pb-done-dot{position:absolute;top:6px;right:6px;width:14px;height:14px;border-radius:50%;background:rgba(0,0,0,.42);',
      'border:2px solid #fff;display:grid;place-items:center;color:#fff;transition:opacity .15s ease}',
      '.pb-book:hover .pb-done-dot{opacity:0}',
      '.pb-book-menu{position:absolute;top:6px;right:6px;width:24px;height:24px;border:0;border-radius:4px;background:rgba(0,0,0,.45);',
      'color:#fff;display:grid;place-items:center;opacity:0;cursor:pointer;padding:0;transition:opacity .15s ease}',
      '.pb-book:hover .pb-book-menu,.pb-book-menu[data-open="1"]{opacity:1}',
      '.pb-cover-progress{position:absolute;left:0;right:0;bottom:0;height:2px;background:rgba(255,255,255,.24);opacity:0;transition:opacity .15s ease}',
      '.pb-cover-progress i{display:block;height:100%;background:rgba(255,255,255,.92)}',
      '.pb-book:hover .pb-cover-progress{opacity:1}',
      '.pb-grid[data-density="list"] .pb-book{flex-direction:row;align-items:center;gap:14px}',
      '.pb-grid[data-density="list"] .pb-book-cover{width:44px;height:59px;aspect-ratio:auto;flex:none}',
      '.pb-grid[data-density="list"] .pb-book-title{-webkit-line-clamp:1}',
      '.pb-grid[data-density="list"] .pb-book-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}',

      /* ---------- 封面 ---------- */
      '.pb-cover{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:14px 14px 26px;overflow:hidden}',
      '.pb-cover img{width:100%;height:100%;object-fit:cover;display:block}',
      '.pb-cover-frame{position:absolute;top:7px;right:7px;width:9px;height:9px;border-top:1px solid currentColor;',
      'border-right:1px solid currentColor;opacity:.3}',
      '.pb-cover-title{margin:0;font-family:' + SERIF + ';font-size:13px;line-height:1.1;letter-spacing:.06em;text-align:center;',
      'max-height:100%;overflow:hidden}',
      '.pb-cover-title[data-vertical="1"]{writing-mode:vertical-rl;text-orientation:upright;height:100%;white-space:nowrap;',
      'text-overflow:ellipsis;letter-spacing:.1em}',
      '.pb-cover-title[data-vertical="0"]{font-size:12px;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;',
      '-webkit-box-orient:vertical;overflow:hidden}',
      '.pb-cover-author{position:absolute;left:12px;right:12px;bottom:9px;font-size:10px;line-height:1.2;text-align:center;',
      'opacity:.7;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.pb-cover-spine{position:absolute;left:0;right:0;bottom:0;height:24px;background:linear-gradient(to top,rgba(0,0,0,.26),rgba(0,0,0,0))}',
      '.pb-cover-mini{padding:0}',
      '.pb-cover-mini .pb-cover-title,.pb-cover-mini .pb-cover-author,.pb-cover-mini .pb-cover-frame{display:none}',

      /* ---------- 右栏 ---------- */
      '.pb-rail{display:none;width:260px;flex:none;position:sticky;top:0}',
      '@media (min-width:1180px){.pb-rail{display:block}}',
      '.pb-rail-block{padding:0 0 18px;margin:0 0 18px;border-bottom:1px solid var(--pb-line)}',
      '.pb-rail-block:last-child{border-bottom:0}',
      '.pb-rail-label{margin:0 0 10px;font-size:12px;color:var(--pb-mute);letter-spacing:.04em}',
      '.pb-duration{font-size:22px;font-weight:600;line-height:1.3;font-variant-numeric:tabular-nums}',
      '.pb-bars{display:flex;align-items:flex-end;gap:8px;height:56px;margin:12px 0 8px}',
      '.pb-bar{width:10px;flex:none;border-radius:2px 2px 0 0;background:color-mix(in srgb,var(--pb-accent) 20%,transparent);min-height:2px}',
      '.pb-bar[data-today="1"]{background:var(--pb-accent)}',
      '.pb-rail-streak{margin:0;font-size:12px;color:var(--pb-mute);font-variant-numeric:tabular-nums}',
      '.pb-rail-note{display:block;width:100%;padding:8px 0;border:0;background:none;font:inherit;color:inherit;text-align:left;cursor:pointer}',
      '.pb-rail-note:hover .pb-rail-quote{color:var(--pb-accent)}',
      '.pb-rail-quote{margin:0;font-size:13px;line-height:1.5;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-primary)}',
      '.pb-rail-meta{margin:2px 0 0;font-size:12px;color:var(--pb-mute);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.pb-textlink{border:0;background:none;padding:0;color:var(--pb-accent);font:inherit;font-size:12px;cursor:pointer}',
      '.pb-textlink:hover{text-decoration:underline}',
      '.pb-rail-links{display:flex;gap:14px;align-items:center;margin-top:2px}',

      /* ---------- 笔记页 ---------- */
      '.pb-page{padding-bottom:48px}',
      '.pb-filterbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:0 0 16px}',
      '.pb-scope{height:28px;padding:0 10px;border:1px solid transparent;border-radius:8px;background:none;',
      'color:var(--dsw-alias-label-secondary);font:inherit;font-size:13px;cursor:pointer}',
      '.pb-scope:hover{color:var(--dsw-alias-label-primary)}',
      '.pb-scope[data-on="1"]{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}',
      '.pb-filterbar .pb-grow{flex:1}',
      '.pb-group{margin:0 0 28px}',
      '.pb-group-head{display:flex;align-items:center;gap:10px;padding:0 0 10px;border-bottom:1px solid var(--pb-line);margin-bottom:2px}',
      '.pb-group-cover{width:24px;height:32px;flex:none;border-radius:4px;overflow:hidden;position:relative;box-shadow:var(--pb-cover-shadow)}',
      '.pb-group-title{margin:0;font-size:15px;font-weight:600;line-height:1.4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.pb-group-count{font-size:12px;color:var(--pb-mute);flex:none;font-variant-numeric:tabular-nums}',
      '.pb-group-head .pb-grow{flex:1;min-width:0}',
      '.pb-note-item{display:flex;gap:12px;padding:14px 0;border-bottom:1px solid var(--pb-line)}',
      '.pb-note-item:hover{background:color-mix(in srgb,var(--dsw-alias-interactive-bg-hover) 55%,transparent)}',
      '.pb-note-rail{width:2px;flex:none;border-radius:1px;background:color-mix(in srgb,var(--pb-accent) 30%,transparent)}',
      '.pb-note-main{flex:1;min-width:0}',
      '.pb-note-quote{margin:0;font-size:15px;line-height:1.7;cursor:pointer;display:-webkit-box;-webkit-line-clamp:3;',
      '-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}',
      '.pb-note-quote[data-open="1"]{display:block;-webkit-line-clamp:unset;overflow:visible}',
      '.pb-note-quote:hover{color:var(--pb-accent)}',
      '.pb-note-text{margin:6px 0 0;font-size:14px;line-height:1.6;color:var(--dsw-alias-label-secondary);white-space:pre-wrap;overflow-wrap:anywhere}',
      '.pb-note-meta{margin:6px 0 0;font-size:12px;color:var(--pb-mute);font-variant-numeric:tabular-nums}',
      '.pb-more{border:0;background:none;padding:4px 0 0;color:var(--pb-accent);font:inherit;font-size:12px;cursor:pointer;display:block}',
      '.pb-note-del{border:0;background:none;color:var(--pb-mute);font:inherit;font-size:12px;cursor:pointer;',
      'padding:2px 6px;border-radius:4px;opacity:0;flex:none;height:22px;align-self:flex-start}',
      '.pb-note-item:hover .pb-note-del{opacity:1}',
      '.pb-note-del[data-armed="1"]{opacity:1;color:var(--dsw-alias-state-error-primary);background:var(--dsw-alias-interactive-bg-hover)}',

      /* ---------- 统计页 ---------- */
      '.pb-stat-row{display:flex;gap:clamp(24px,5vw,64px);flex-wrap:wrap;padding:4px 0 28px;align-items:flex-start}',
      '.pb-stat{display:flex;flex-direction:column;gap:2px}',
      '.pb-stat b{font-size:22px;font-weight:600;line-height:1.3;font-variant-numeric:tabular-nums}',
      '.pb-stat span{font-size:12px;color:var(--pb-mute)}',
      '.pb-stat-goal{margin-left:auto;display:flex;align-items:center;gap:10px}',
      '.pb-goal-ring{position:relative;color:var(--pb-accent)}',
      '.pb-goal-num{position:absolute;inset:0;display:grid;place-items:center;font-size:11px;font-weight:600;',
      'font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-primary)}',
      '.pb-goal-label{font-size:12px;color:var(--pb-mute)}',
      '.pb-chart{display:flex;align-items:flex-end;gap:12px;height:120px;margin:6px 0 0}',
      '.pb-chart-day{display:flex;flex-direction:column;align-items:center;gap:6px;min-width:16px;height:100%;justify-content:flex-end}',
      '.pb-chart-track{width:16px;display:flex;align-items:flex-end;flex:1}',
      '.pb-chart-bar{width:100%;border-radius:2px 2px 0 0;background:color-mix(in srgb,var(--pb-accent) 20%,transparent);min-height:2px}',
      '.pb-chart-day[data-today="1"] .pb-chart-bar{background:var(--pb-accent)}',
      '.pb-chart-day[data-zero="1"] .pb-chart-bar{background:var(--dsw-alias-bg-skeleton)}',
      '.pb-chart-label{font-size:12px;color:var(--pb-mute)}',
      '.pb-chart-day[data-today="1"] .pb-chart-label{color:var(--pb-accent);font-weight:600}',
      '.pb-page-foot{margin:24px 0 0;font-size:12px;color:var(--pb-mute);font-variant-numeric:tabular-nums}',

      /* ---------- 空态 / 加载 / 错误 ---------- */
      '.pb-empty{display:flex;flex-direction:column;align-items:center;gap:10px;padding:72px 20px;text-align:center}',
      '.pb-empty svg{color:var(--dsw-alias-border-l4)}',
      '.pb-empty h2{margin:0;font-size:15px;font-weight:600}',
      '.pb-empty p{margin:0;font-size:13px;line-height:1.6;color:var(--dsw-alias-label-secondary);max-width:40ch}',
      '.pb-empty-actions{display:flex;gap:8px;margin-top:6px;flex-wrap:wrap;justify-content:center}',
      '.pb-empty-note{padding:56px 20px;text-align:center;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:1.7}',
      '.pb-skel{height:196px;border-radius:4px;background:var(--dsw-alias-bg-layer-2);position:relative;overflow:hidden}',
      '.pb-skel::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent,var(--dsw-alias-bg-skeleton),transparent);',
      'animation:pb-shimmer 1.6s ease-in-out infinite}',
      '@keyframes pb-shimmer{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}',
      '.pb-error{display:flex;gap:10px;align-items:flex-start;padding:12px 14px;border-radius:8px;margin:0 0 16px;',
      'border:1px solid color-mix(in srgb,var(--dsw-alias-state-error-primary) 30%,transparent);',
      'background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 7%,transparent)}',
      '.pb-error h3{margin:0 0 3px;font-size:13px;font-weight:600}',
      '.pb-error p{margin:0;font-size:12px;color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere}',
      '.pb-error svg{color:var(--dsw-alias-state-error-primary);flex:none;margin-top:1px}',
      '.pb-spin{width:12px;height:12px;border-radius:50%;border:1.5px solid var(--dsw-alias-border-l3);',
      'border-top-color:var(--pb-accent);animation:pb-spin .7s linear infinite;flex:none}',
      '@keyframes pb-spin{to{transform:rotate(360deg)}}',
      '.pb-import-bar{display:flex;align-items:center;gap:8px;margin:0 0 14px;padding:8px 12px;border-radius:8px;',
      'background:var(--dsw-alias-bg-layer-2);font-size:12px;color:var(--dsw-alias-label-secondary)}',
      '.pb-drop{position:absolute;inset:8px;border-radius:8px;z-index:8;border:1.5px dashed var(--pb-accent);',
      'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;',
      'background:color-mix(in srgb,var(--dsw-alias-bg-base) 84%,transparent);pointer-events:none}',
      '.pb-drop strong{font-size:15px;font-weight:600}',
      '.pb-drop span{font-size:12px;color:var(--dsw-alias-label-secondary)}',

      /* ---------- 来源面板 ---------- */
      '.pb-scrim{position:absolute;inset:0;z-index:17;background:var(--dsw-alias-bg-mask-1);animation:pb-fade .16s ease}',
      '@keyframes pb-fade{from{opacity:0}to{opacity:1}}',
      '.pb-sheet{position:absolute;top:0;right:0;bottom:0;width:min(420px,100%);z-index:22;display:flex;flex-direction:column;',
      'background:var(--dsw-alias-bg-layer-1);border-left:1px solid var(--pb-line-strong);box-shadow:var(--dsw-elevation-panel);',
      'animation:pb-slide-in .2s cubic-bezier(.2,.7,.3,1)}',
      '@keyframes pb-slide-in{from{transform:translateX(20px);opacity:.5}to{transform:none;opacity:1}}',
      '.pb-sheet-head{display:flex;align-items:center;gap:10px;padding:16px 18px 12px;border-bottom:1px solid var(--pb-line)}',
      '.pb-sheet-head h2{margin:0;font-size:15px;font-weight:600}',
      '.pb-sheet-head p{margin:2px 0 0;font-size:12px;color:var(--pb-mute)}',
      '.pb-sheet-body{flex:1;min-height:0;overflow-y:auto;padding:14px 16px 26px;display:flex;flex-direction:column;gap:12px}',
      '.pb-prov{border:1px solid var(--pb-line);border-radius:8px;background:var(--dsw-alias-bg-layer-2);padding:14px}',
      '.pb-prov-head{display:flex;align-items:center;gap:8px;margin:0 0 4px}',
      '.pb-prov-head h3{margin:0;font-size:13px;font-weight:600;flex:1}',
      '.pb-dot{width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-state-idle-primary);flex:none}',
      '.pb-dot[data-on="1"]{background:var(--dsw-alias-state-success-primary)}',
      '.pb-prov-state{font-size:12px;color:var(--pb-mute)}',
      '.pb-prov-row{display:flex;align-items:baseline;gap:8px;font-size:12px;color:var(--dsw-alias-label-secondary);margin:6px 0 0}',
      '.pb-prov-row b{color:var(--dsw-alias-label-primary);font-weight:600;overflow-wrap:anywhere}',
      '.pb-prov-actions{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}',
      '.pb-prov-help{margin:10px 0 0;font-size:12px;line-height:1.6;color:var(--pb-mute)}',
      '.pb-prov-field{display:flex;flex-direction:column;gap:6px;margin-top:10px}',
      '.pb-prov-label{font-size:12px;color:var(--dsw-alias-label-secondary)}',
      '.pb-prov-search{display:flex;gap:6px;margin-top:12px}',
      '.pb-results{display:flex;flex-direction:column;gap:2px;margin:8px 0 0;padding:0;list-style:none;max-height:220px;overflow-y:auto}',
      '.pb-result{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:4px;font-size:12px}',
      '.pb-result:hover{background:var(--dsw-alias-interactive-bg-hover)}',
      '.pb-result-main{flex:1;min-width:0}',
      '.pb-result-title{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.pb-result-author{display:block;font-size:12px;color:var(--pb-mute)}',
      '.pb-note-msg{font-size:12px;color:var(--dsw-alias-state-error-primary);margin:8px 0 0;overflow-wrap:anywhere}',
      '.pb-toast{position:absolute;left:50%;bottom:18px;transform:translateX(-50%);z-index:30;padding:6px 12px;border-radius:8px;',
      'background:var(--dsw-alias-toast-bg);color:var(--dsw-alias-toast-label);font-size:12px;',
      'box-shadow:var(--dsw-elevation-panel);animation:pb-toast-in .18s ease;max-width:80%;text-align:center}',
      '@keyframes pb-toast-in{from{opacity:0;transform:translate(-50%,6px)}to{opacity:1;transform:translate(-50%,0)}}',

      '.pb-reader{position:absolute;inset:0;display:flex;flex-direction:column;overflow:hidden;',
      '--pb-paper:#fbfaf6;--pb-ink:#191713;--pb-font-size:19px;--pb-line-height:1.9;--pb-measure:34;',
      '--pb-font:' + SERIF + ';background:var(--pb-paper);color:var(--pb-ink);z-index:3}',
      '.pb-reader[data-theme="sepia"]{--pb-paper:#f2e5cc;--pb-ink:#3b2c1a}',
      '.pb-reader[data-theme="ink"]{--pb-paper:#15171b;--pb-ink:#cbc7bc}',
      '.pb-reader[data-theme="moss"]{--pb-paper:#e6ecdb;--pb-ink:#22301a}',
      '.pb-reader[data-font="sans"]{--pb-font:' + SANS + '}',
      '.pb-chrome{transition:opacity .32s ease,transform .32s ease}',
      '.pb-reader[data-chrome="0"] .pb-topbar{opacity:0;transform:translateY(-8px);pointer-events:none}',
      '.pb-reader[data-chrome="0"] .pb-footbar{opacity:0;pointer-events:none}',
      '.pb-topbar{position:absolute;top:0;left:0;right:0;z-index:12;display:flex;align-items:center;gap:10px;',
      'padding:9px clamp(12px,3vw,20px);background:color-mix(in srgb,var(--dsw-alias-bg-layer-1) 94%,transparent);',
      'border-bottom:1px solid var(--pb-line-strong);color:var(--dsw-alias-label-primary);backdrop-filter:blur(10px)}',
      '.pb-topbar-title{min-width:0;display:flex;flex-direction:column;gap:1px;flex:1}',
      '.pb-topbar-title b{font-family:' + SERIF + ';font-size:13.5px;font-weight:600;line-height:1.2;',
      'overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.pb-topbar-title span{font-size:11px;color:var(--pb-mute);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.pb-topbar-tools{display:flex;align-items:center;gap:2px;flex:none}',
      '.pb-icon-count{min-width:15px;height:15px;padding:0 4px;border-radius:var(--pb-r-chip);background:color-mix(in srgb,var(--pb-accent) 16%,transparent);',
      'color:var(--pb-accent);font-size:9.5px;line-height:15px;text-align:center;font-variant-numeric:tabular-nums;margin-left:-2px}',
      '.pb-scroll-paper{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;padding:74px 22px 128px;scrollbar-color:var(--dsw-alias-scrollbar-bg-l2) transparent}',
      '.pb-paged{flex:1;min-height:0;display:flex;justify-content:center;padding:74px clamp(16px,3vw,32px) 112px}',
      '.pb-paged-clip{position:relative;overflow:hidden;height:100%;width:min(calc(var(--pb-measure) * 1em),100%)}',
      '.pb-paged-clip[data-overflow="1"]{overflow-y:auto}',
      '.pb-columns{height:100%;width:100%;column-width:calc(var(--pb-measure) * 1em);column-gap:var(--pb-gap,72px);column-fill:auto;',
      'transition:transform .3s cubic-bezier(.22,.7,.28,1);will-change:transform}',
      '.pb-paged-clip[data-overflow="1"] .pb-columns{transform:none!important;height:auto;column-width:auto}',
      '.pb-prose{font-family:var(--pb-font);font-size:var(--pb-font-size);line-height:var(--pb-line-height);',
      'text-align:var(--pb-align,justify);overflow-wrap:break-word;hyphens:auto;max-inline-size:calc(var(--pb-measure) * 1em);margin-inline:auto}',
      '.pb-columns .pb-prose{max-inline-size:none;margin:0;text-align:var(--pb-align,justify)}',
      '.pb-p{text-indent:2em;margin:0 0 .82em}',
      '.pb-li{text-indent:0;margin:0 0 .5em;padding-left:1.4em;position:relative}',
      '.pb-li::before{content:"\\00B7";position:absolute;left:.5em;color:color-mix(in srgb,var(--pb-ink) 55%,var(--pb-paper))}',
      '.pb-h1,.pb-h2,.pb-h3{font-family:var(--pb-font);text-indent:0;font-weight:600;line-height:1.45;margin:1.7em 0 .8em;text-align:center;letter-spacing:.02em}',
      '.pb-h1{font-size:1.32em}.pb-h2{font-size:1.14em}.pb-h3{font-size:1.02em;text-align:start}',
      '.pb-prose>:first-child{margin-top:0}',
      '.pb-q{text-indent:0;margin:1em 0;padding:.1em 0 .1em 1.1em;border-left:2px solid color-mix(in srgb,var(--pb-ink) 22%,var(--pb-paper));',
      'font-style:italic;color:color-mix(in srgb,var(--pb-ink) 82%,var(--pb-paper))}',
      '.pb-pre{text-indent:0;margin:1em 0;padding:.7em .9em;border-radius:8px;overflow-x:auto;',
      'font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.78em;line-height:1.6;white-space:pre-wrap;word-break:break-word;',
      'background:color-mix(in srgb,var(--pb-ink) 7%,var(--pb-paper));color:color-mix(in srgb,var(--pb-ink) 92%,var(--pb-paper))}',
      '.pb-hr{border:0;height:1px;background:color-mix(in srgb,var(--pb-ink) 18%,var(--pb-paper));margin:1.6em 0}',
      '.pb-end{text-indent:0;color:color-mix(in srgb,var(--pb-ink) 50%,var(--pb-paper));text-align:center;font-size:.8em;',
      'letter-spacing:.3em;margin:2.4em 0 1.2em}',
      '.pb-end-actions{display:flex;gap:10px;justify-content:center;margin:0 0 2em;flex-wrap:wrap}',
      '.pb-end-actions .pb-btn{background:color-mix(in srgb,var(--pb-ink) 6%,var(--pb-paper));border-color:color-mix(in srgb,var(--pb-ink) 16%,var(--pb-paper));color:var(--pb-ink)}',
      '.pb-end-actions .pb-btn:hover{background:color-mix(in srgb,var(--pb-ink) 11%,var(--pb-paper))}',
      '.pb-end-actions .pb-btn-primary{background:var(--pb-ink);color:var(--pb-paper);border-color:transparent}',
      '.pb-chapter-loading{display:flex;align-items:center;justify-content:center;gap:8px;height:100%;color:var(--pb-mute);font-size:12.5px}',
      '.pb-chapter-error{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;height:100%;padding:24px;text-align:center}',
      '.pb-chapter-error p{margin:0;color:var(--dsw-alias-state-error-primary);font-size:12.5px;max-width:46ch;overflow-wrap:anywhere}',
      '.pb-footbar{position:absolute;left:0;right:0;bottom:0;z-index:12;padding:6px clamp(14px,3vw,22px) 8px;',
      'background:linear-gradient(to top,color-mix(in srgb,var(--dsw-alias-bg-layer-1) 96%,transparent),transparent);',
      'color:var(--dsw-alias-label-primary);backdrop-filter:blur(6px)}',
      '.pb-foot-track{position:relative;height:14px;display:flex;align-items:center;cursor:pointer}',
      '.pb-foot-rail{position:relative;height:2px;width:100%;border-radius:2px;background:var(--dsw-alias-border-l2);overflow:hidden}',
      '.pb-foot-rail i{display:block;height:100%;background:var(--dsw-alias-label-primary);border-radius:2px;transition:width .25s ease}',
      '.pb-foot-track:hover .pb-foot-rail{height:3px}',
      '.pb-foot-meta{display:flex;align-items:center;gap:8px;margin-top:2px;font-size:10.5px;color:var(--pb-mute);font-variant-numeric:tabular-nums}',
      '.pb-foot-meta .pb-grow{flex:1}',
      '.pb-foot-btn{border:0;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:10.5px;cursor:pointer;padding:2px 4px;border-radius:4px}',
      '.pb-foot-btn:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}',
      '.pb-foot-btn:disabled{opacity:.4;cursor:default}',
      '.pb-drawer{position:absolute;top:0;left:0;bottom:0;width:min(340px,86%);z-index:18;display:flex;flex-direction:column;',
      'background:color-mix(in srgb,var(--dsw-alias-bg-layer-1) 97%,transparent);border-right:1px solid var(--pb-line-strong);',
      'color:var(--dsw-alias-label-primary);backdrop-filter:blur(14px);box-shadow:var(--dsw-elevation-panel);',
      'animation:pb-drawer-in .22s cubic-bezier(.2,.7,.3,1)}',
      '@keyframes pb-drawer-in{from{transform:translateX(-16px);opacity:.4}to{transform:none;opacity:1}}',
      '.pb-drawer-head{padding:15px 16px 10px;border-bottom:1px solid var(--pb-line)}',
      '.pb-drawer-head b{display:block;font-family:' + SERIF + ';font-size:15px;font-weight:600;',
      'overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.pb-drawer-head span{font-size:11px;color:var(--pb-mute)}',
      '.pb-toc{flex:1;min-height:0;overflow-y:auto;padding:6px 8px 20px}',
      '.pb-toc-item{position:relative;display:flex;align-items:baseline;gap:8px;width:100%;text-align:left;border:0;background:transparent;',
      'color:var(--dsw-alias-label-secondary);font:inherit;font-size:12.5px;line-height:1.5;padding:7px 9px;border-radius:8px;cursor:pointer}',
      '.pb-toc-item:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}',
      '.pb-toc-item[data-on="1"]{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary);font-weight:500}',
      '.pb-toc-item[data-on="1"]::before{content:"";position:absolute;left:0;width:2px;height:14px;border-radius:2px;background:var(--pb-accent)}',
      '.pb-toc-item[data-read="1"]{color:var(--pb-mute)}',
      '.pb-toc-idx{width:22px;flex:none;font-variant-numeric:tabular-nums;color:var(--pb-mute);font-size:10.5px}',
      '.pb-toc-title{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',

      '.pb-settings{position:absolute;top:0;right:0;bottom:0;width:min(320px,88%);z-index:19;display:flex;flex-direction:column;',
      'background:color-mix(in srgb,var(--dsw-alias-bg-layer-1) 97%,transparent);border-left:1px solid var(--pb-line-strong);',
      'color:var(--dsw-alias-label-primary);backdrop-filter:blur(14px);box-shadow:var(--dsw-elevation-panel);animation:pb-slide-in .2s cubic-bezier(.2,.7,.3,1)}',
      '.pb-settings-body{flex:1;min-height:0;overflow-y:auto;padding:4px 16px 24px}',
      '.pb-set{padding:13px 0;border-bottom:1px solid var(--pb-line)}',
      '.pb-set:last-child{border-bottom:0}',
      '.pb-set-label{display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:12px;margin:0 0 9px}',
      '.pb-set-label span{color:var(--dsw-alias-label-secondary)}',
      '.pb-set-value{color:var(--pb-mute);font-variant-numeric:tabular-nums;font-size:11px}',
      '.pb-swatches{display:flex;gap:6px}',
      '.pb-swatch{flex:1;height:34px;border-radius:8px;border:1px solid var(--pb-line-strong);cursor:pointer;font:inherit;font-size:10px;',
      'display:grid;place-items:center;padding:0;position:relative;overflow:hidden}',
      '.pb-swatch[data-on="1"]{border-color:var(--pb-accent);box-shadow:inset 0 0 0 1px var(--pb-accent)}',
      '.pb-range{width:100%;height:18px;accent-color:var(--pb-accent);cursor:pointer;margin:0}',
      '.pb-switch{width:34px;height:20px;border-radius:var(--pb-r-chip);border:1px solid var(--pb-line-strong);background:var(--dsw-alias-bg-layer-3);',
      'position:relative;cursor:pointer;padding:0;transition:background .15s}',
      '.pb-switch i{position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:var(--dsw-alias-label-tertiary);transition:transform .16s,background .15s}',
      '.pb-switch[data-on="1"]{background:var(--dsw-alias-button-primary-fill);border-color:transparent}',
      '.pb-switch[data-on="1"] i{transform:translateX(14px);background:var(--dsw-alias-label-primary-foreground)}',
      '.pb-fontpop{position:absolute;top:50px;right:14px;z-index:20;padding:10px;display:flex;flex-direction:column;gap:8px;',
      'background:var(--dsw-alias-bg-layer-2);border:1px solid var(--pb-line-strong);border-radius:var(--pb-r-btn);',
      'box-shadow:var(--dsw-elevation-panel);color:var(--dsw-alias-label-primary);min-width:172px;animation:pb-rise .14s ease}',
      '.pb-fontpop-row{display:flex;align-items:center;gap:8px;justify-content:space-between}',
      '.pb-fontpop-row b{width:30px;text-align:center;font-variant-numeric:tabular-nums;font-size:12.5px}',
      '.pb-fontpop-sizes{display:flex;gap:4px}',
      '.pb-fontpop-sizes button{width:26px;height:24px;border-radius:8px;border:1px solid var(--pb-line-strong);',
      'background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:11px;cursor:pointer;padding:0}',
      '.pb-fontpop-sizes button[data-on="1"]{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}',

      /* ---------- 划词 / AI / 笔记抽屉 ---------- */
      '.pb-selectbar{position:fixed;z-index:60;display:flex;align-items:center;gap:2px;padding:4px;border-radius:var(--pb-r-btn);',
      'background:var(--dsw-alias-bg-layer-2);border:1px solid var(--pb-line-strong);box-shadow:var(--dsw-elevation-prominent);animation:pb-rise .14s ease}',
      '.pb-selectbar button{border:0;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;height:26px;padding:0 9px;',
      'border-radius:8px;cursor:pointer;white-space:nowrap}',
      '.pb-selectbar button:hover{background:var(--dsw-alias-interactive-bg-hover)}',
      '.pb-selectbar-sep{width:1px;height:14px;background:var(--pb-line-strong);margin:0 2px}',
      '.pb-ai{position:fixed;z-index:62;left:50%;transform:translateX(-50%);top:12vh;width:min(560px,calc(100vw - 32px));max-height:min(66vh,560px);',
      'display:flex;flex-direction:column;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--pb-line-strong);',
      'border-radius:var(--pb-r-card);box-shadow:var(--dsw-elevation-prominent);animation:pb-rise .16s ease;overflow:hidden}',
      '.pb-ai-head{display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid var(--pb-line)}',
      '.pb-ai-head b{font-size:12.5px;font-weight:600;flex:1}',
      '.pb-ai-quote{margin:0;padding:10px 14px;font-family:' + SERIF + ';font-size:12.5px;line-height:1.7;color:var(--dsw-alias-label-secondary);',
      'background:var(--dsw-alias-bg-layer-2);border-bottom:1px solid var(--pb-line);max-height:96px;overflow-y:auto;white-space:pre-wrap;overflow-wrap:anywhere}',
      '.pb-ai-body{flex:1;min-height:0;overflow-y:auto;padding:14px;font-size:13px;line-height:1.8;white-space:pre-wrap;',
      'overflow-wrap:anywhere;color:var(--dsw-alias-label-primary)}',
      '.pb-ai-foot{display:flex;gap:8px;justify-content:flex-end;padding:10px 14px;border-top:1px solid var(--pb-line)}',
      '.pb-ai-skel{display:flex;flex-direction:column;gap:8px}',
      '.pb-ai-skel i{display:block;height:10px;border-radius:4px;background:var(--dsw-alias-bg-skeleton);animation:pb-pulse 1.2s ease-in-out infinite}',
      '@keyframes pb-pulse{0%,100%{opacity:1}50%{opacity:.42}}',
      '.pb-ai-err{color:var(--dsw-alias-state-error-primary);font-size:12.5px;line-height:1.7;margin:0;overflow-wrap:anywhere}',
      '.pb-notes{position:absolute;top:0;right:0;bottom:0;width:min(360px,90%);z-index:19;display:flex;flex-direction:column;',
      'background:color-mix(in srgb,var(--dsw-alias-bg-layer-1) 97%,transparent);border-left:1px solid var(--pb-line-strong);',
      'color:var(--dsw-alias-label-primary);backdrop-filter:blur(14px);box-shadow:var(--dsw-elevation-panel);animation:pb-slide-in .2s cubic-bezier(.2,.7,.3,1)}',
      '.pb-note-list{flex:1;min-height:0;overflow-y:auto;padding:8px 12px 24px;display:flex;flex-direction:column;gap:8px}',
      '.pb-note{border:1px solid var(--pb-line);border-radius:var(--pb-r-btn);background:var(--dsw-alias-bg-layer-2);padding:10px 12px;display:flex;flex-direction:column;gap:6px}',
      '.pb-notes .pb-note-quote{margin:0;font-family:' + SERIF + ';font-size:12.5px;line-height:1.7;color:var(--dsw-alias-label-primary);white-space:pre-wrap;',
      'overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden;cursor:pointer}',
      '.pb-notes .pb-note-text{margin:0;font-size:12.5px;line-height:1.7;color:var(--dsw-alias-label-secondary);white-space:pre-wrap;overflow-wrap:anywhere}',
      '.pb-notes .pb-note-foot{display:flex;align-items:center;gap:8px;font-size:10.5px;color:var(--pb-mute)}',
      '.pb-note-foot .pb-grow{flex:1}',
      '.pb-note-empty{padding:32px 20px;text-align:center;color:var(--pb-mute);font-size:12.5px;line-height:1.8}',
      '.pb-drawer-foot{flex:none;padding:10px 16px 14px;border-top:1px solid var(--pb-line)}',

      /* ---------- 正文笔记标记 ---------- */
      '.pb-block{position:relative}',
      '.pb-block[data-mark="1"]{padding-inline-end:14px}',
      '.pb-block[data-mark="1"]::before{content:"";position:absolute;left:-1.15em;top:.5em;bottom:.5em;width:2px;border-radius:2px;',
      'background:color-mix(in srgb,var(--pb-ink) 16%,var(--pb-paper))}',
      '.pb-note-dot{position:absolute;right:-2px;top:.55em;width:7px;height:7px;padding:0;border-radius:50%;border:0;cursor:pointer;',
      'background:color-mix(in srgb,var(--pb-ink) 30%,var(--pb-paper));transition:transform .15s ease,background .15s ease}',
      '.pb-note-dot:hover{transform:scale(1.35);background:var(--pb-ink)}',
      '.pb-block[data-focus="1"]{border-radius:4px;background:color-mix(in srgb,var(--pb-ink) 6%,var(--pb-paper));',
      'box-shadow:0 0 0 6px color-mix(in srgb,var(--pb-ink) 6%,var(--pb-paper))}',

      /* ---------- 影印 ---------- */
      '.pb-scan{position:absolute;left:0;right:0;top:58px;bottom:44px;display:flex;background:var(--pb-paper)}',
      '.pb-scan-frame{width:100%;height:100%;border:0;background:var(--pb-paper)}',
      '.pb-footbar-scan{background:var(--pb-paper);border-top:1px solid color-mix(in srgb,var(--pb-ink) 12%,var(--pb-paper))}',
      '.pb-scan-hint{margin:0;font-size:11px;line-height:1.5;text-align:center;color:color-mix(in srgb,var(--pb-ink) 58%,var(--pb-paper))}',

      /* ---------- 平台适配 ---------- */
      '@media (max-width:900px){',
      '.pb-shell{gap:0}',
      '}',
      '@media (max-width:680px){',
      '.pb-appbar{padding:0 20px}',
      '.pb-headline{gap:14px}',
      '.pb-headline h1{font-size:18px}',
      '.pb-tabs{gap:14px}',
      '.pb-search input{width:128px}',
      '.pb-grid{grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:24px 16px}',
      '.pb-continue{gap:14px;padding:12px 6px}',
      '.pb-continue-cover{width:72px;height:96px}',
      '.pb-continue-title{font-size:15px}',
      '.pb-progress-row{max-width:none}',
      '.pb-stat-row{gap:20px}',
      '.pb-chart{gap:8px}',
      '.pb-scroll{padding:16px 0 40px}',
      '.pb-note-quote{font-size:14px}',
      '}',
      '@media (prefers-reduced-motion:reduce){',
      '.pb-root *,.pb-root *::before,.pb-root *::after{animation-duration:.001ms!important;transition-duration:.001ms!important}',
      '}',
    ].join('\n');

    /* ------------------------------------------------------------------ */
    /* HTTP                                                                */
    /* ------------------------------------------------------------------ */

    function AppError(message, code) {
      this.message = message;
      this.code = code || 'NET';
    }
    AppError.prototype = Object.create(Error.prototype);
    AppError.prototype.constructor = AppError;

    async function call(path, init) {
      const options = Object.assign({ credentials: 'same-origin' }, init || {});
      options.headers = Object.assign({ accept: 'application/json' }, options.headers || {});
      if (options.body !== undefined && options.body !== null) {
        options.headers['content-type'] = 'application/json';
      }
      let response;
      try {
        response = await fetch(API + path, options);
      } catch (error) {
        throw new AppError(String((error && error.message) || error), 'NET');
      }
      let payload = null;
      try {
        payload = await response.json();
      } catch (error) {
        throw new AppError('HTTP ' + response.status, 'NET');
      }
      if (!payload || payload.ok !== true) {
        const message = (payload && payload.error) || 'HTTP ' + response.status;
        throw new AppError(message, (payload && payload.code) || 'NET');
      }
      return payload;
    }

    function post(path, body) {
      return call(path, { method: 'POST', body: JSON.stringify(body || {}) });
    }

    function del(path) {
      return call(path, { method: 'DELETE' });
    }

    function errorText(error) {
      if (!error) return '';
      if (typeof error === 'string') return error;
      return String(error.message || error);
    }

    /* ------------------------------------------------------------------ */
    /* 工具                                                                */
    /* ------------------------------------------------------------------ */

    function clamp(value, min, max) {
      const n = Number(value);
      if (!Number.isFinite(n)) return min;
      return Math.min(max, Math.max(min, n));
    }

    function normalizeSettings(raw) {
      const source = raw && typeof raw === 'object' ? raw : {};
      return {
        theme: THEMES.indexOf(source.theme) >= 0 ? source.theme : DEFAULT_SETTINGS.theme,
        fontFamily: source.fontFamily === 'sans' ? 'sans' : 'serif',
        fontSize: clamp(source.fontSize, 15, 32) || DEFAULT_SETTINGS.fontSize,
        lineHeight: Math.round(clamp(source.lineHeight, 1.4, 2.4) * 10) / 10 || DEFAULT_SETTINGS.lineHeight,
        measure: Math.round(clamp(source.measure, 24, 52)) || DEFAULT_SETTINGS.measure,
        mode: source.mode === 'paged' ? 'paged' : 'scroll',
        justify: source.justify !== false,
        chromeAutoHide: source.chromeAutoHide !== false,
      };
    }

    /** 全书进度（0..100）。progress.percent 是章内比例，见 lib/store.js。 */
    function bookPercent(book) {
      if (!book) return 0;
      if (book.finished) return 100;
      const total = Math.max(1, Number(book.chapterCount) || 1);
      const progress = book.progress || {};
      const index = clamp(progress.chapterIndex || 0, 0, total - 1);
      const raw = Number(progress.percent) || 0;
      const inner = raw > 1 ? 0 : raw;
      return clamp(Math.round(((index + inner) / total) * 100), 0, 100);
    }

    function chapterInnerPercent(book) {
      const progress = (book && book.progress) || {};
      const raw = Number(progress.percent) || 0;
      return raw > 1 ? 0 : clamp(raw, 0, 1);
    }

    function fmtNumber(value) {
      const n = Number(value) || 0;
      try {
        return n.toLocaleString();
      } catch (error) {
        return String(n);
      }
    }

    function fmtTime(ts) {
      if (!ts) return '';
      try {
        const date = new Date(ts);
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
          ' ' + date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
      } catch (error) {
        return '';
      }
    }

    function sourceLabelKey(source) {
      if (source === 'weread') return 'filter.weread';
      if (source === 'fanqie') return 'filter.fanqie';
      return 'filter.local';
    }

    /** 书脊/书卡的强调色只从 token 里取，不写死颜色。 */
    /** prev/next 由 Host 给出，缺失时是 null；两种写法都要挡住。 */
    function hasPrev(chapter) {
      return !!(chapter && chapter.prev !== null && chapter.prev !== undefined);
    }

    function hasNext(chapter) {
      return !!(chapter && chapter.next !== null && chapter.next !== undefined);
    }

    /** 7 天柱状图用的日期键（本地时区）。 */
    function dayKeyOf(date) {
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return date.getFullYear() + '-' + month + '-' + day;
    }

    function lastSevenDays(map) {
      const days = [];
      const now = new Date();
      for (let offset = 6; offset >= 0; offset -= 1) {
        const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
        const key = dayKeyOf(date);
        days.push({
          key,
          label: date.toLocaleDateString(undefined, { weekday: 'short' }),
          seconds: Math.max(0, Number((map && map[key]) || 0)),
          isToday: offset === 0,
        });
      }
      return days;
    }

    function greetingKey(date) {
      const hour = date.getHours();
      if (hour < 5) return 'shelf.greetNight';
      if (hour < 11) return 'shelf.greetMorning';
      if (hour < 14) return 'shelf.greetNoon';
      if (hour < 18) return 'shelf.greetAfternoon';
      return 'shelf.greetEvening';
    }

    /** 下载走 Blob + 临时 <a download>：只在 body 上挂一帧，不读写宿主界面。 */
    function saveMarkdown(filename, markdown) {
      if (typeof document === 'undefined' || typeof Blob === 'function' === false || typeof URL === 'undefined') return false;
      if (typeof URL.createObjectURL !== 'function') return false;
      const blob = new Blob([String(markdown || '')], { type: 'text/markdown;charset=utf-8' });
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = href;
      anchor.download = filename || 'lamplit.md';
      anchor.rel = 'noopener';
      anchor.style.display = 'none';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      setTimeout(() => {
        try {
          URL.revokeObjectURL(href);
        } catch (error) {
          /* 已经回收就算了 */
        }
      }, 1500);
      return true;
    }

    async function copyToClipboard(text) {
      if (typeof navigator === 'undefined' || !navigator.clipboard || !navigator.clipboard.writeText) {
        throw new AppError('clipboard', 'NET');
      }
      await navigator.clipboard.writeText(String(text || ''));
    }

    function readFileAsBase64(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new AppError('file read failed', 'FORMAT'));
        reader.onload = () => {
          const result = String(reader.result || '');
          const comma = result.indexOf(',');
          resolve(comma >= 0 ? result.slice(comma + 1) : result);
        };
        reader.readAsDataURL(file);
      });
    }

    /* ------------------------------------------------------------------ */
    /* 图标（只画字形，颜色走 currentColor）                                 */
    /* ------------------------------------------------------------------ */

    function svg(props, children) {
      return h(
        'svg',
        Object.assign(
          {
            viewBox: '0 0 24 24',
            width: props.size || 16,
            height: props.size || 16,
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: 1.6,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            'aria-hidden': true,
            focusable: false,
            style: { display: 'block', flex: 'none' },
          },
          props,
        ),
        children,
      );
    }

    /** 侧栏图标：一盏灯压在摊开的书上。 */
    function PanelIcon(props) {
      const size = (props && props.size) || 24;
      const active = !!(props && props.active);
      const stroke = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round' };
      return h(
        'svg',
        {
          viewBox: '0 0 24 24',
          width: size,
          height: size,
          'aria-hidden': true,
          focusable: false,
          style: { display: 'block' },
        },
        h('path', Object.assign({ d: 'M12 2.6v2', strokeWidth: 1.5, opacity: 0.8 }, stroke)),
        h('path', Object.assign({ d: 'M8.4 4.8h7.2l-1.3 2.9H9.7z', strokeWidth: active ? 1.9 : 1.6 }, stroke)),
        h('path', Object.assign({ d: 'M10.2 10.4 9.1 12M13.8 10.4 14.9 12', strokeWidth: 1.3, opacity: 0.65 }, stroke)),
        h('path', Object.assign({
          d: 'M3.8 15.3c2.7-1.3 5.5-1.3 8.2 0 2.7-1.3 5.5-1.3 8.2 0v4.4c-2.7-1.3-5.5-1.3-8.2 0-2.7-1.3-5.5-1.3-8.2 0z',
          strokeWidth: active ? 1.9 : 1.5,
          opacity: active ? 1 : 0.92,
        }, stroke)),
        h('path', Object.assign({ d: 'M12 15.4v4.3', strokeWidth: 1.3, opacity: 0.7 }, stroke)),
      );
    }

    function Ring(props) {
      const size = props.size || 46;
      const stroke = props.stroke || 3;
      const radius = (size - stroke) / 2;
      const circ = 2 * Math.PI * radius;
      const value = clamp(props.value || 0, 0, 100);
      return h(
        'svg',
        { className: 'pb-ring', width: size, height: size, viewBox: '0 0 ' + size + ' ' + size, 'aria-hidden': true },
        h('circle', {
          cx: size / 2,
          cy: size / 2,
          r: radius,
          fill: 'none',
          stroke: 'currentColor',
          strokeOpacity: 0.16,
          strokeWidth: stroke,
        }),
        h('circle', {
          cx: size / 2,
          cy: size / 2,
          r: radius,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: stroke,
          strokeLinecap: 'round',
          strokeDasharray: (circ * value) / 100 + ' ' + circ,
          transform: 'rotate(-90 ' + size / 2 + ' ' + size / 2 + ')',
          style: { transition: 'stroke-dasharray .4s ease' },
        }),
      );
    }

    /* ------------------------------------------------------------------ */
    /* 顶栏 / 一级视图                                                       */
    /* ------------------------------------------------------------------ */

    /* ------------------------------------------------------------------ */
    /* 封面 / 时长                                                          */
    /* ------------------------------------------------------------------ */

    /** 六组低饱和纸色：只在生成封面上用（封面是画，不是容器）。 */
    const COVER_TONES = [
      { bg: '#efe9dc', ink: '#3a332a' },
      { bg: '#dde4da', ink: '#2f3a31' },
      { bg: '#dbe3ea', ink: '#2b3640' },
      { bg: '#ecdad0', ink: '#402f27' },
      { bg: '#e0e1e4', ink: '#2b2e33' },
      { bg: '#eee3d1', ink: '#3d3323' },
    ];

    function coverTone(title) {
      const text = String(title || '');
      let hash = 0;
      for (let index = 0; index < text.length; index += 1) hash = (hash * 31 + text.charCodeAt(index)) % 100003;
      return COVER_TONES[hash % COVER_TONES.length];
    }

    function isCJK(text) {
      return /[\u3040-\u30ff\u4e00-\u9fff]/.test(String(text || ''));
    }

    /** 竖排时按字数收字号：短书名用大一点的字，长书名缩到能排下。 */
    function coverFit(text) {
      const count = Math.min(Math.max(Array.from(String(text || '').trim()).length, 1), 8);
      return Math.max(10, Math.min(17, Math.round(136 / (count * 1.25))));
    }

    function coverTextSize(text) {
      const length = Array.from(String(text || '').trim()).length;
      if (length <= 10) return 13;
      if (length <= 18) return 12;
      return 11;
    }

    function coverTitle(text) {
      const chars = Array.from(String(text || '').trim());
      if (chars.length <= 8) return chars.join('');
      return chars.slice(0, 8).join('') + '…';
    }

    function formatDuration(seconds, t) {
      const total = Math.max(0, Math.round(Number(seconds) || 0));
      if (total < 60) return t('duration.minutes', { n: 0 });
      const minutes = Math.round(total / 60);
      const hours = Math.floor(minutes / 60);
      const rest = minutes % 60;
      if (hours === 0) return t('duration.minutes', { n: minutes });
      if (rest === 0) return t('duration.hours', { n: hours });
      return t('duration.hoursMinutes', { hours, minutes: rest });
    }

    function Cover(props) {
      const book = props.book || {};
      const variant = props.variant || 'grid';
      const [broken, setBroken] = useState(false);
      const source = book.cover;
      const useImage = typeof source === 'string' && source !== '' && !broken;
      const tone = coverTone(book.title);
      const title = String(book.title || '');
      const cjk = isCJK(title);
      const titleSize = cjk ? coverFit(title) : coverTextSize(title);

      return h(
        'div',
        {
          className: 'pb-cover' + (variant === 'mini' ? ' pb-cover-mini' : ''),
          'data-img': useImage ? '1' : '0',
          style: useImage ? undefined : { background: tone.bg, color: tone.ink },
        },
        useImage
          ? h('img', {
              src: source,
              alt: '',
              loading: 'lazy',
              referrerPolicy: 'no-referrer',
              onError: () => setBroken(true),
            })
          : [
              h('span', { key: 'frame', className: 'pb-cover-frame', 'aria-hidden': true }),
              h(
                'p',
                {
                  key: 'title',
                  className: 'pb-cover-title',
                  'data-vertical': cjk ? '1' : '0',
                  style: { fontSize: titleSize + 'px' },
                },
                cjk ? coverTitle(title) : title,
              ),
              book.author ? h('span', { key: 'author', className: 'pb-cover-author' }, book.author) : null,
              h('span', { key: 'spine', className: 'pb-cover-spine', 'aria-hidden': true }),
            ],
      );
    }

    /* ------------------------------------------------------------------ */
    /* 顶栏                                                                */
    /* ------------------------------------------------------------------ */

    function TopBar(props) {
      const { t } = props;
      const [sortOpen, setSortOpen] = useState(false);
      const [importOpen, setImportOpen] = useState(false);
      const [pathOpen, setPathOpen] = useState(false);
      const [path, setPath] = useState('');

      useEffect(() => {
        if (!sortOpen && !importOpen) return undefined;
        const onDown = (event) => {
          const node = event.target;
          if (node && typeof node.closest === 'function' && (node.closest('.pb-pop') || node.closest('.pb-menu-anchor'))) return;
          setSortOpen(false);
          setImportOpen(false);
        };
        window.addEventListener('mousedown', onDown, true);
        return () => window.removeEventListener('mousedown', onDown, true);
      }, [sortOpen, importOpen]);

      const title = props.view === 'notes' ? t('view.notes') : props.view === 'stats' ? t('view.stats') : t('view.shelf');

      const shelfActions = [
        h(
          'div',
          { className: 'pb-narrow-actions', key: 'narrow' },
          h(
            'button',
            { type: 'button', className: 'pb-iconbtn', onClick: props.onOpenNotes, title: t('view.notes'), 'aria-label': t('view.notes') },
            h(IconNote, { size: 15 }),
          ),
          h(
            'button',
            { type: 'button', className: 'pb-iconbtn', onClick: props.onOpenStats, title: t('view.stats'), 'aria-label': t('view.stats') },
            h(IconChart, { size: 15 }),
          ),
        ),
        h(
          'label',
          { className: 'pb-search', key: 'search' },
          h(IconSearch, { size: 13 }),
          h('input', {
            ref: props.searchRef,
            type: 'search',
            value: props.query,
            placeholder: t('nav.searchShelf'),
            'aria-label': t('nav.searchShelf'),
            onChange: (event) => props.onQuery(event.target.value),
          }),
        ),
        h(
          'button',
          {
            key: 'density',
            type: 'button',
            className: 'pb-iconbtn',
            onClick: () => props.onDensity(props.density === 'grid' ? 'list' : 'grid'),
            title: t(props.density === 'grid' ? 'density.list' : 'density.grid'),
            'aria-label': t(props.density === 'grid' ? 'density.list' : 'density.grid'),
          },
          props.density === 'grid' ? h(IconGrid, { size: 15 }) : h(IconRows, { size: 15 }),
        ),
        h(
          'div',
          { key: 'sort', className: 'pb-menu-anchor', style: { position: 'relative' } },
          h(
            'button',
            {
              type: 'button',
              className: 'pb-sortbtn',
              onClick: () => setSortOpen((open) => !open),
              'aria-expanded': sortOpen ? 'true' : 'false',
            },
            t('sort.' + props.sort),
            h(IconChevron, { size: 12 }),
          ),
          sortOpen
            ? h(
                'div',
                { className: 'pb-pop', style: { right: 0, top: 36 } },
                ['recent', 'added', 'title'].map((key) =>
                  h(
                    'button',
                    {
                      key,
                      type: 'button',
                      className: 'pb-pop-item',
                      'data-on': props.sort === key ? '1' : '0',
                      onClick: () => {
                        props.onSort(key);
                        setSortOpen(false);
                      },
                    },
                    t('sort.' + key),
                  ),
                ),
              )
            : null,
        ),
        h(
          'div',
          { key: 'import', className: 'pb-menu-anchor', style: { position: 'relative' } },
          h(
            'button',
            {
              type: 'button',
              className: 'pb-btn pb-btn-primary',
              onClick: () => setImportOpen((open) => !open),
              'aria-expanded': importOpen ? 'true' : 'false',
            },
            h(IconUpload, { size: 13 }),
            t('nav.import'),
          ),
          importOpen
            ? h(
                'div',
                { className: 'pb-pop', style: { right: 0, top: 38 } },
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'pb-pop-item',
                    onClick: () => {
                      setImportOpen(false);
                      props.onImport();
                    },
                  },
                  h(IconUpload, { size: 13 }),
                  t('nav.importFile'),
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'pb-pop-item',
                    onClick: () => setPathOpen((open) => !open),
                  },
                  h(IconFolder, { size: 13 }),
                  t('nav.importPath'),
                ),
                pathOpen
                  ? h(
                      'div',
                      { className: 'pb-pop-path' },
                      h('input', {
                        className: 'pb-input',
                        style: { flex: 1, width: 200 },
                        value: path,
                        placeholder: t('nav.importPathHint'),
                        'aria-label': t('nav.importPathHint'),
                        onChange: (event) => setPath(event.target.value),
                        onKeyDown: (event) => {
                          if (event.key === 'Enter') {
                            props.onImportPath(path);
                            setPath('');
                            setPathOpen(false);
                            setImportOpen(false);
                          }
                        },
                      }),
                      h(
                        'button',
                        {
                          type: 'button',
                          className: 'pb-btn',
                          onClick: () => {
                            props.onImportPath(path);
                            setPath('');
                            setPathOpen(false);
                            setImportOpen(false);
                          },
                        },
                        t('nav.importPathGo'),
                      ),
                    )
                  : null,
              )
            : null,
        ),
      ];

      shelfActions.unshift(
        h(
          'button',
          {
            key: 'sources',
            type: 'button',
            className: 'pb-btn pb-btn-quiet',
            onClick: props.onSources,
            title: t('source.title'),
          },
          t('source.title'),
        ),
      );

      const notesActions = [
        h(
          'button',
          { key: 'export', type: 'button', className: 'pb-btn pb-btn-quiet', onClick: props.onExportAll, disabled: props.counts.notes === 0 },
          t('notes.exportAll'),
        ),
        h(
          'button',
          { key: 'copy', type: 'button', className: 'pb-btn pb-btn-quiet', onClick: props.onCopy, disabled: props.counts.notes === 0 },
          t('notes.copy'),
        ),
      ];

      return h(
        'header',
        { className: 'pb-appbar' },
        h(
          'div',
          { className: 'pb-appbar-inner' },
          h(
            'div',
            { className: 'pb-headline' },
            props.view === 'shelf'
              ? null
              : h(
                  'button',
                  { type: 'button', className: 'pb-back', onClick: props.onBack, 'aria-label': t('nav.back'), title: t('nav.back') },
                  h(IconBack, { size: 14 }),
                ),
            h('span', { className: 'pb-wordmark' }, t('app.title')),
            h('span', { className: 'pb-wordmark-rule', 'aria-hidden': true }),
            h('h1', null, title),
            props.view === 'shelf'
              ? h(
                  'nav',
                  { className: 'pb-tabs', 'aria-label': t('view.label') },
                  ['all', 'reading', 'finished'].map((key) =>
                    h(
                      'button',
                      {
                        key,
                        type: 'button',
                        className: 'pb-tab',
                        'data-on': props.filter === key ? '1' : '0',
                        onClick: () => props.onFilter(key),
                      },
                      t('filter.' + key),
                      h('i', { className: 'pb-num' }, fmtNumber(props.counts[key] || 0)),
                    ),
                  ),
                )
              : null,
          ),
          h('div', { className: 'pb-actions' }, props.view === 'shelf' ? shelfActions : props.view === 'notes' ? notesActions : null),
        ),
      );
    }

    /* ------------------------------------------------------------------ */
    /* 继续阅读 / 书卡 / 空态                                                */
    /* ------------------------------------------------------------------ */

    function SourceBar(props) {
      const { t, counts, value, onPick, providers } = props;
      const connected = {};
      for (const provider of providers || []) connected[provider.id] = !!provider.connected;
      const items = [
        { key: 'all', label: t('shelf.sourceAll'), count: counts.all },
        { key: 'weread', label: t('filter.weread'), count: counts.weread, online: 'weread' },
        { key: 'fanqie', label: t('filter.fanqie'), count: counts.fanqie, online: 'fanqie' },
        { key: 'local', label: t('filter.local'), count: counts.local },
      ];
      return h(
        'div',
        { className: 'pb-sourcebar', role: 'group', 'aria-label': t('source.title') },
        items.map((item) =>
          h(
            'button',
            {
              key: item.key,
              type: 'button',
              className: 'pb-srcchip',
              'data-on': value === item.key ? '1' : '0',
              onClick: () => onPick(item.key, item.online),
            },
            item.online
              ? h('span', { className: 'pb-srcdot', 'data-on': connected[item.online] ? '1' : '0', 'aria-hidden': true })
              : null,
            item.label,
            h('i', { className: 'pb-num' }, fmtNumber(item.count)),
          ),
        ),
      );
    }

    function ContinueBar(props) {
      const { t, book } = props;
      const percent = bookPercent(book);
      const index = clamp(
        (book.progress && book.progress.chapterIndex) || 0,
        0,
        Math.max(0, (book.chapterCount || 1) - 1),
      );
      const chapter = props.chapterTitle
        ? t('shelf.chapterWithTitle', { n: index + 1, title: props.chapterTitle })
        : t('shelf.chapterOnly', { n: index + 1 });

      return h(
        'button',
        { type: 'button', className: 'pb-continue', onClick: () => props.onOpen(book) },
        h('div', { className: 'pb-continue-cover' }, h(Cover, { book, variant: 'bar' })),
        h(
          'div',
          { className: 'pb-continue-body' },
          h('p', { className: 'pb-eyebrow' }, t('shelf.continue')),
          h('h2', { className: 'pb-continue-title', title: book.title }, book.title),
          h('p', { className: 'pb-continue-sub' }, chapter),
          h(
            'div',
            { className: 'pb-progress-row' },
            h('div', { className: 'pb-progress' }, h('i', { style: { width: percent + '%' } })),
            h('span', { className: 'pb-progress-label' }, t('shelf.readPercent', { n: percent })),
          ),
        ),
        h('span', { className: 'pb-btn pb-btn-primary' }, t('shelf.continue')),
      );
    }

    function BookCard(props) {
      const { t, book } = props;
      const [menu, setMenu] = useState(false);
      const percent = bookPercent(book);
      const subtitle = book.author || t(sourceLabelKey(book.source));

      useEffect(() => {
        if (!menu) return undefined;
        const onDown = (event) => {
          const node = event.target;
          if (node && typeof node.closest === 'function' && node.closest('.pb-book')) return;
          setMenu(false);
        };
        window.addEventListener('mousedown', onDown, true);
        return () => window.removeEventListener('mousedown', onDown, true);
      }, [menu]);

      return h(
        'li',
        { style: { display: 'contents' } },
        h(
          'div',
          {
            className: 'pb-book',
            role: 'button',
            tabIndex: 0,
            'aria-label': book.title,
            onClick: () => props.onOpen(book),
            onKeyDown: (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                props.onOpen(book);
              }
            },
          },
          h(
            'div',
            { className: 'pb-book-cover' },
            h(Cover, { book, variant: 'grid' }),
            book.finished
              ? h('span', { className: 'pb-done-dot', 'aria-hidden': true }, h(IconCheck, { size: 8 }))
              : null,
            percent > 0 && !book.finished
              ? h('div', { className: 'pb-cover-progress', 'aria-hidden': true }, h('i', { style: { width: percent + '%' } }))
              : null,
          ),
          h(
            'div',
            { className: 'pb-book-body' },
            h('h3', { className: 'pb-book-title', title: book.title }, book.title),
            h(
              'p',
              { className: 'pb-book-meta' },
              h('em', null, subtitle),
              h(
                'span',
                { className: 'pb-book-pct pb-num' },
                book.finished ? t('shelf.finished') : t('shelf.percent', { n: percent }),
              ),
            ),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'pb-book-menu',
              'data-open': menu ? '1' : '0',
              'aria-label': t('shelf.menu'),
              title: t('shelf.menu'),
              onClick: (event) => {
                event.stopPropagation();
                setMenu((open) => !open);
              },
            },
            h(IconMore, { size: 14 }),
          ),
          menu
            ? h(
                'div',
                { className: 'pb-pop', style: { right: 0, top: 34 }, onClick: (event) => event.stopPropagation() },
                h(
                  'button',
                  { type: 'button', className: 'pb-pop-item', onClick: () => { setMenu(false); props.onOpen(book); } },
                  h(IconBook, { size: 13 }),
                  book.finished ? t('shelf.reread') : t('shelf.continue'),
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'pb-pop-item',
                    onClick: () => {
                      setMenu(false);
                      props.onFinish(book, !book.finished);
                    },
                  },
                  h(IconCheck, { size: 13 }),
                  book.finished ? t('shelf.unfinish') : t('shelf.markFinished'),
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'pb-pop-item',
                    'data-danger': '1',
                    onClick: () => {
                      setMenu(false);
                      props.onDelete(book);
                    },
                  },
                  h(IconTrash, { size: 13 }),
                  t('shelf.remove'),
                ),
              )
            : null,
        ),
      );
    }

    function EmptyShelf(props) {
      const t = props.t;
      return h(
        'div',
        { className: 'pb-empty' },
        h(
          'svg',
          { width: 44, height: 44, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.1, strokeLinejoin: 'round', 'aria-hidden': true },
          h('path', { d: 'M6 3.5h9.5L19 7v13.5H6z' }),
          h('path', { d: 'M9 12h6M9 15h4' }),
        ),
        h('h2', null, t('shelf.emptyTitle')),
        h('p', null, t('shelf.emptyBody')),
        h(
          'div',
          { className: 'pb-empty-actions' },
          h('button', { type: 'button', className: 'pb-btn pb-btn-primary', onClick: props.onImport }, h(IconUpload, { size: 13 }), t('nav.import')),
          h('button', { type: 'button', className: 'pb-btn', onClick: props.onSources }, t('nav.sources')),
        ),
      );
    }

    /* ------------------------------------------------------------------ */
    /* 右栏                                                                */
    /* ------------------------------------------------------------------ */

    function Rail(props) {
      const { t, stats } = props;
      const days = lastSevenDays(stats.days);
      const max = Math.max(1, days.reduce((top, day) => Math.max(top, day.seconds), 0));
      const recent = (props.notes || []).slice(0, 3);

      return h(
        'aside',
        { className: 'pb-rail' },
        h(
          'section',
          { className: 'pb-rail-block' },
          h('p', { className: 'pb-rail-label' }, t('rail.week')),
          h('p', { className: 'pb-duration' }, formatDuration(stats.week, t)),
          h(
            'div',
            { className: 'pb-bars', 'aria-hidden': true },
            days.map((day) =>
              h('span', {
                key: day.key,
                className: 'pb-bar',
                'data-today': day.isToday ? '1' : '0',
                style: { height: Math.max(3, Math.round((day.seconds / max) * 100)) + '%' },
              }),
            ),
          ),
          h('p', { className: 'pb-rail-streak' }, t('rail.streak', { n: Math.max(0, stats.streak || 0) })),
        ),
        h(
          'section',
          { className: 'pb-rail-block' },
          h('p', { className: 'pb-rail-label' }, t('rail.recentNotes')),
          recent.length === 0
            ? h('p', { className: 'pb-rail-meta' }, t('rail.noNotes'))
            : recent.map((note) =>
                h(
                  'button',
                  { key: String(note.id), type: 'button', className: 'pb-rail-note', onClick: () => props.onOpenNote(note) },
                  h('p', { className: 'pb-rail-quote' }, note.quote),
                  h(
                    'p',
                    { className: 'pb-rail-meta' },
                    t('rail.noteMeta', { book: note.bookTitle || t('notes.untitled'), n: (Number(note.chapterIndex) || 0) + 1 }),
                  ),
                ),
              ),
          h(
            'div',
            { className: 'pb-rail-links' },
            h('button', { type: 'button', className: 'pb-textlink', onClick: props.onAllNotes }, t('rail.allNotes') + ' →'),
            h('button', { type: 'button', className: 'pb-textlink', onClick: props.onStats }, t('rail.stats') + ' →'),
            h('button', { type: 'button', className: 'pb-textlink', onClick: props.onExportShelf }, t('rail.exportShelf')),
          ),
        ),
      );
    }

    /* ------------------------------------------------------------------ */
    /* 笔记页                                                              */
    /* ------------------------------------------------------------------ */

    function NoteEntry(props) {
      const { t, note } = props;
      const [open, setOpen] = useState(false);
      const [armed, setArmed] = useState(false);

      useEffect(() => {
        if (!armed) return undefined;
        const timer = setTimeout(() => setArmed(false), 3000);
        return () => clearTimeout(timer);
      }, [armed]);

      return h(
        'div',
        { className: 'pb-note-item' },
        h('span', { className: 'pb-note-rail', 'aria-hidden': true }),
        h(
          'div',
          { className: 'pb-note-main' },
          h(
            'p',
            {
              className: 'pb-note-quote',
              'data-open': open ? '1' : '0',
              onClick: () => props.onOpen(note),
              title: t('notes.jump'),
            },
            note.quote,
          ),
          open
            ? null
            : h(
                'button',
                { type: 'button', className: 'pb-more', onClick: () => setOpen(true) },
                t('notes.expand'),
              ),
          note.note ? h('p', { className: 'pb-note-text' }, note.note) : null,
          h(
            'p',
            { className: 'pb-note-meta' },
            t('notes.meta', { n: (Number(note.chapterIndex) || 0) + 1, time: fmtTime(note.createdAt) }),
          ),
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'pb-note-del',
            'data-armed': armed ? '1' : '0',
            onClick: () => {
              if (!armed) {
                setArmed(true);
                return;
              }
              setArmed(false);
              props.onDelete(note);
            },
            onBlur: () => setArmed(false),
            title: armed ? t('notes.deleteConfirm') : t('notes.delete'),
          },
          armed ? t('notes.deleteConfirm') : t('notes.delete'),
        ),
      );
    }

    function NotesPage(props) {
      const { t, notes, status, error } = props;

      const groups = useMemo(() => {
        const map = new Map();
        (notes || []).forEach((note) => {
          const key = note.bookId || 'unknown';
          if (!map.has(key)) {
            map.set(key, { id: key, title: note.bookTitle || t('notes.untitled'), notes: [] });
          }
          map.get(key).notes.push(note);
        });
        return Array.from(map.values());
      }, [notes, t]);

      if (status === 'loading') {
        return h(
          'section',
          { className: 'pb-view' },
          h(
            'div',
            { className: 'pb-scroll' },
            h('div', { className: 'pb-shell' }, h('div', { className: 'pb-main' }, [0, 1, 2].map((index) => h('div', { key: index, className: 'pb-skel', style: { height: 96, marginBottom: 12 } })))),
          ),
        );
      }

      if (status === 'error') {
        return h(
          'section',
          { className: 'pb-view' },
          h(
            'div',
            { className: 'pb-scroll' },
            h(
              'div',
              { className: 'pb-shell' },
              h(
                'div',
                { className: 'pb-main' },
                h(
                  'div',
                  { className: 'pb-error' },
                  h(IconAlert, { size: 16 }),
                  h(
                    'div',
                    null,
                    h('h3', null, t('notes.error')),
                    h('p', null, error),
                    h('button', { type: 'button', className: 'pb-btn', style: { marginTop: 8 }, onClick: props.onReload }, t('shelf.retry')),
                  ),
                ),
              ),
            ),
          ),
        );
      }

      return h(
        'section',
        { className: 'pb-view' },
        h(
          'div',
          { className: 'pb-scroll' },
          h(
            'div',
            { className: 'pb-shell' },
            h(
              'div',
              { className: 'pb-main' },
              h(
                'div',
                { className: 'pb-filterbar' },
                h(
                  'button',
                  { type: 'button', className: 'pb-scope', 'data-on': props.scope === 'all' ? '1' : '0', onClick: () => props.onScope('all') },
                  t('notes.scopeAll'),
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'pb-scope',
                    'data-on': props.scope === 'book' ? '1' : '0',
                    disabled: !props.scopeBookId,
                    onClick: () => props.onScope('book'),
                  },
                  t('notes.scopeBook'),
                ),
                h('span', { className: 'pb-grow' }),
                h('input', {
                  className: 'pb-input',
                  type: 'search',
                  value: props.query,
                  placeholder: t('notes.search'),
                  'aria-label': t('notes.search'),
                  onChange: (event) => props.onQuery(event.target.value),
                  style: { width: 220 },
                }),
              ),
              (notes || []).length === 0
                ? h('div', { className: 'pb-empty-note' }, t('notes.empty'))
                : groups.map((group) => {
                    const book = props.bookOf(group.id, group.title);
                    return h(
                      'section',
                      { className: 'pb-group', key: group.id },
                      h(
                        'div',
                        { className: 'pb-group-head' },
                        h('span', { className: 'pb-group-cover' }, h(Cover, { book, variant: 'mini' })),
                        h('h2', { className: 'pb-group-title', title: group.title }, group.title),
                        h('span', { className: 'pb-group-count' }, t('notes.count', { n: group.notes.length })),
                        h('span', { className: 'pb-grow' }),
                        h(
                          'button',
                          { type: 'button', className: 'pb-textlink', onClick: () => props.onExportBook(group.id) },
                          t('notes.exportBook'),
                        ),
                      ),
                      group.notes.map((note) =>
                        h(NoteEntry, { key: String(note.id), t, note, onOpen: props.onOpen, onDelete: props.onDelete }),
                      ),
                    );
                  }),
            ),
          ),
        ),
      );
    }

    /* ------------------------------------------------------------------ */
    /* 统计页                                                              */
    /* ------------------------------------------------------------------ */

    function StatsPage(props) {
      const { t, stats } = props;
      const days = useMemo(() => lastSevenDays(stats.days), [stats.days]);
      const max = Math.max(1, days.reduce((top, day) => Math.max(top, day.seconds), 0));
      const goal = clamp(Math.round(((stats.today || 0) / 1800) * 100), 0, 100);
      const cells = [
        { key: 'week', value: formatDuration(stats.week, t), label: t('stats.thisWeek') },
        { key: 'total', value: formatDuration(stats.seconds, t), label: t('stats.total') },
        { key: 'streak', value: t('stats.streakValue', { n: Math.max(0, stats.streak || 0) }), label: t('stats.streak') },
        { key: 'finished', value: t('stats.booksValue', { n: props.finishedCount || 0 }), label: t('stats.finished') },
      ];

      return h(
        'section',
        { className: 'pb-view' },
        h(
          'div',
          { className: 'pb-scroll' },
          h(
            'div',
            { className: 'pb-shell' },
            h(
              'div',
              { className: 'pb-main pb-page' },
              h(
                'div',
                { className: 'pb-stat-row' },
                cells.map((cell) =>
                  h('div', { className: 'pb-stat', key: cell.key }, h('b', null, cell.value), h('span', null, cell.label)),
                ),
                h(
                  'div',
                  { className: 'pb-stat-goal' },
                  h(
                    'div',
                    { className: 'pb-goal-ring' },
                    h(Ring, { value: goal, size: 56, stroke: 3 }),
                    h('span', { className: 'pb-goal-num pb-num' }, goal + '%'),
                  ),
                  h('span', { className: 'pb-goal-label' }, t('stats.goal')),
                ),
              ),
              h(
                'div',
                { className: 'pb-chart', role: 'img', 'aria-label': t('stats.chartTitle') },
                days.map((day) =>
                  h(
                    'div',
                    {
                      className: 'pb-chart-day',
                      key: day.key,
                      'data-today': day.isToday ? '1' : '0',
                      'data-zero': day.seconds === 0 ? '1' : '0',
                      title: t('stats.barTitle', { day: day.label, minutes: Math.round(day.seconds / 60) }),
                    },
                    h('div', { className: 'pb-chart-track' }, h('div', { className: 'pb-chart-bar', style: { height: Math.max(2, Math.round((day.seconds / max) * 100)) + '%' } })),
                    h('span', { className: 'pb-chart-label' }, day.label),
                  ),
                ),
              ),
              h(
                'p',
                { className: 'pb-page-foot' },
                t('stats.footer', { notes: props.noteCount || 0, books: props.bookCount || 0 }),
              ),
            ),
          ),
        ),
      );
    }

    function ProviderCard(props) {
      const { t, provider } = props;
      const isWeread = provider.id === 'weread';
      const [cookie, setCookie] = useState('');
      const [query, setQuery] = useState('');
      const [busy, setBusy] = useState('');
      const [error, setError] = useState('');
      const [results, setResults] = useState(null);
      const [advanced, setAdvanced] = useState(false);
      const [link, setLink] = useState('');
      const [qr, setQr] = useState(null);
      const [qrState, setQrState] = useState('');
      const [notice, setNotice] = useState('');

      const label = t(provider.id === 'weread' ? 'filter.weread' : 'filter.fanqie');
      const howKey = provider.id === 'weread' ? 'source.wereadHow' : 'source.fanqieHow';

      const run = async (kind, action) => {
        setBusy(kind);
        setError('');
        try {
          await action();
        } catch (err) {
          setError(errorText(err));
        } finally {
          setBusy('');
        }
      };

      const connect = () =>
        run('connect', async () => {
          const value = cookie.trim();
          if (value === '') return;
          await props.onConnect(provider.id, value);
          setCookie('');
          setNotice(t('source.connected'));
        });

      /* 扫码：起一张码，然后每 2 秒问一次状态；成功后宿主已经自动同步书架。 */
      const startQr = () =>
        run('qr', async () => {
          const res = await post('/provider/weread/qr-start');
          setQr({ uid: res.uid, svg: res.qrSvg });
          setQrState('waiting');
        });

      useEffect(() => {
        if (!qr) return undefined;
        let live = true;
        let timer = null;
        const tick = async () => {
          try {
            const res = await call('/provider/weread/qr-status?uid=' + encodeURIComponent(qr.uid));
            if (!live) return;
            if (res.status === 'syncing') {
              setQrState('syncing');
              setNotice(t('source.qrSyncing', { n: fmtNumber(res.added || 0) }));
              timer = setTimeout(tick, 1000);
              return;
            }
            if (res.status === 'done') {
              setQr(null);
              setQrState('done');
              setNotice(t('source.qrDone', { n: fmtNumber(res.added || 0) }));
              await props.onRefresh();
              if (props.onSay) props.onSay(t('source.qrDone', { n: fmtNumber(res.added || 0) }));
              if (props.onClose) props.onClose();
              return;
            }
            if (res.status === 'error' || res.ok === false) {
              setQr(null);
              setQrState('error');
              setError(res.error || t('source.qrFailed'));
              return;
            }
            timer = setTimeout(tick, 2000);
          } catch (err) {
            if (!live) return;
            timer = setTimeout(tick, 3000);
          }
        };
        timer = setTimeout(tick, 1200);
        return () => {
          live = false;
          if (timer) clearTimeout(timer);
        };
      }, [qr, props.onRefresh, t]);

      const search = () =>
        run('search', async () => {
          const q = query.trim();
          if (q === '') return;
          const res = await props.onSearch(provider.id, q);
          setResults(res.results || []);
        });

      const addByLink = () =>
        run('add', async () => {
          const value = link.trim();
          if (value === '') return;
          await props.onOpenResult(provider.id, { bookId: value });
          setLink('');
          setNotice(t('source.added'));
          await props.onRefresh();
        });

      const cookieField = h(
        'div',
        { className: 'pb-prov-field' },
        h('label', { className: 'pb-prov-label', htmlFor: 'pb-cookie-' + provider.id }, t('source.cookieLabel')),
        h('input', {
          id: 'pb-cookie-' + provider.id,
          className: 'pb-input',
          type: 'password',
          autoComplete: 'off',
          spellCheck: false,
          value: cookie,
          placeholder: t('source.cookiePlaceholder'),
          onChange: (event) => setCookie(event.target.value),
          onKeyDown: (event) => {
            if (event.key === 'Enter') connect();
          },
        }),
        h('span', { className: 'pb-prov-help', style: { margin: 0 } }, t('source.cookieHelp')),
        h('p', { className: 'pb-prov-help' }, t(howKey)),
        h(
          'div',
          { className: 'pb-prov-actions' },
          h(
            'button',
            {
              type: 'button',
              className: 'pb-btn',
              disabled: !!busy || cookie.trim() === '',
              onClick: connect,
            },
            busy === 'connect' ? t('source.connecting') : t('source.connect'),
          ),
        ),
      );

      const sheetBody = provider.connected
        ? h(
            'div',
            null,
            h('p', { className: 'pb-prov-row' }, t('source.account'), h('b', null, provider.account || t('source.anonymous'))),
            h('p', { className: 'pb-prov-row' }, t('source.books', { n: fmtNumber(provider.shelfCount) })),
            h(
              'p',
              { className: 'pb-prov-row' },
              provider.lastSyncAt ? t('source.lastSync', { time: fmtTime(provider.lastSyncAt) }) : t('source.never'),
            ),
            h(
              'div',
              { className: 'pb-prov-actions' },
              h(
                'button',
                {
                  type: 'button',
                  className: 'pb-btn',
                  disabled: !!busy,
                  onClick: () =>
                    run('sync', async () => {
                      await props.onSync(provider.id);
                      setResults(null);
                      await props.onRefresh();
                    }),
                },
                h(IconSync, { size: 14 }),
                busy === 'sync' ? t('source.syncing') : t('source.sync'),
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'pb-btn pb-btn-quiet',
                  disabled: !!busy,
                  onClick: () => run('logout', () => props.onDisconnect(provider.id)),
                },
                busy === 'logout' ? t('source.disconnecting') : t('source.disconnect'),
              ),
            ),
            provider.id === 'fanqie'
              ? h(
                  'div',
                  { className: 'pb-prov-field', style: { marginTop: 12 } },
                  h('label', { className: 'pb-prov-label', htmlFor: 'pb-link-' + provider.id }, t('source.addByLink')),
                  h(
                    'div',
                    { className: 'pb-prov-linkrow' },
                    h('input', {
                      id: 'pb-link-' + provider.id,
                      className: 'pb-input',
                      type: 'url',
                      value: link,
                      placeholder: t('source.addByLinkPlaceholder'),
                      onChange: (event) => setLink(event.target.value),
                      onKeyDown: (event) => {
                        if (event.key === 'Enter') addByLink();
                      },
                    }),
                    h('button', { type: 'button', className: 'pb-btn', disabled: !!busy || link.trim() === '', onClick: addByLink }, t('source.add')),
                  ),
                )
              : null,
            provider.id === 'weread'
              ? h(
                  'div',
                  { className: 'pb-prov-search' },
                  h('input', {
                    className: 'pb-input',
                    type: 'search',
                    value: query,
                    placeholder: t('source.searchPlaceholder'),
                    'aria-label': t('source.searchLabel'),
                    onChange: (event) => setQuery(event.target.value),
                    onKeyDown: (event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        search();
                      }
                    },
                  }),
                  h(
                    'button',
                    { type: 'button', className: 'pb-btn', disabled: !!busy, onClick: search },
                    busy === 'search' ? t('source.openning') : t('source.searchLabel'),
                  ),
                )
              : null,
            results
              ? results.length === 0
                ? h('p', { className: 'pb-prov-help' }, t('source.searchEmpty'))
                : h(
                    'ul',
                    { className: 'pb-results' },
                    results.map((item) =>
                      h(
                        'li',
                        { className: 'pb-result', key: String(item.bookId) },
                        h(
                          'span',
                          { className: 'pb-result-main' },
                          h('span', { className: 'pb-result-title' }, item.title),
                          h('span', { className: 'pb-result-author' }, item.author || ''),
                        ),
                        h(
                          'button',
                          {
                            type: 'button',
                            className: 'pb-btn',
                            onClick: () =>
                              run('open:' + item.bookId, () =>
                                props.onOpenResult(provider.id, item).then(() => {
                                  setResults(null);
                                  return props.onRefresh();
                                }),
                              ),
                          },
                          t('source.open'),
                        ),
                      ),
                    ),
                  )
              : null,
          )
        : isWeread
          ? h(
              'div',
              null,
              qr
                ? h(
                    'div',
                    { className: 'pb-qr' },
                    h('div', { className: 'pb-qr-art', dangerouslySetInnerHTML: { __html: qr.svg } }),
                    h(
                      'p',
                      { className: 'pb-qr-note' },
                      qrState === 'waiting' ? t('source.qrWaiting') : t('source.qrHint'),
                    ),
                    h(
                      'button',
                      { type: 'button', className: 'pb-btn pb-btn-quiet', disabled: !!busy, onClick: startQr },
                      t('source.qrRefresh'),
                    ),
                  )
                : h(
                    'div',
                    null,
                    h(
                      'button',
                      { type: 'button', className: 'pb-btn pb-btn-primary pb-btn-wide', disabled: !!busy, onClick: startQr },
                      busy === 'qr' ? t('source.connecting') : t('source.qrLogin'),
                    ),
                    h('p', { className: 'pb-prov-help' }, t('source.qrHint')),
                  ),
              h(
                'button',
                { type: 'button', className: 'pb-btn pb-btn-quiet', onClick: () => setAdvanced((open) => !open) },
                advanced ? '▾ ' + t('source.otherWays') : '▸ ' + t('source.otherWays'),
              ),
              advanced ? cookieField : null,
            )
          : h(
              'div',
              null,
              h(
                'div',
                { className: 'pb-prov-field' },
                h('label', { className: 'pb-prov-label', htmlFor: 'pb-link-' + provider.id }, t('source.addByLink')),
                h(
                  'div',
                  { className: 'pb-prov-linkrow' },
                  h('input', {
                    id: 'pb-link-' + provider.id,
                    className: 'pb-input',
                    type: 'url',
                    value: link,
                    placeholder: t('source.addByLinkPlaceholder'),
                    onChange: (event) => setLink(event.target.value),
                    onKeyDown: (event) => {
                      if (event.key === 'Enter') addByLink();
                    },
                  }),
                  h('button', { type: 'button', className: 'pb-btn pb-btn-primary', disabled: !!busy || link.trim() === '', onClick: addByLink }, t('source.add')),
                ),
                h('p', { className: 'pb-prov-help' }, t('source.addHint')),
              ),
              h(
                'button',
                { type: 'button', className: 'pb-btn pb-btn-quiet', onClick: () => setAdvanced((open) => !open) },
                advanced ? '▾ ' + t('source.advanced') : '▸ ' + t('source.advanced'),
              ),
              advanced ? cookieField : null,
            );

      return h(
        'section',
        { className: 'pb-prov' },
        h(
          'div',
          { className: 'pb-prov-head' },
          h('span', { className: 'pb-dot', 'data-on': provider.connected ? '1' : '0' }),
          h('h3', null, label),
          h('span', { className: 'pb-prov-state' }, t(provider.connected ? 'source.connected' : 'source.disconnected')),
        ),
        provider.error ? h('p', { className: 'pb-note-msg' }, t('source.errorPrefix') + provider.error) : null,
        notice ? h('p', { className: 'pb-prov-help' }, notice) : null,
        sheetBody,
        error ? h('p', { className: 'pb-note-msg' }, error) : null,
      );
    }

    function SourceSheet(props) {
      const { t, providers } = props;
      const list = Array.isArray(providers) && providers.length > 0
        ? providers
        : [
            { id: 'weread', connected: false, account: '', shelfCount: 0, lastSyncAt: 0, error: null },
            { id: 'fanqie', connected: false, account: '', shelfCount: 0, lastSyncAt: 0, error: null },
          ];
      return h(
        'div',
        { className: 'pb-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('source.title') },
        h(
          'div',
          { className: 'pb-sheet-head' },
          h('div', { style: { flex: 1, minWidth: 0 } }, h('h2', null, t('source.title')), h('p', null, t('source.subtitle'))),
          h(
            'button',
            { type: 'button', className: 'pb-btn pb-icon-btn', onClick: props.onClose, 'aria-label': t('source.close') },
            h(IconClose, { size: 15 }),
          ),
        ),
        h(
          'div',
          { className: 'pb-sheet-body' },
          list.map((provider) =>
            h(ProviderCard, {
              key: provider.id,
              t,
              provider,
              onConnect: props.onConnect,
              onDisconnect: props.onDisconnect,
              onSync: props.onSync,
              onSearch: props.onSearch,
              onOpenResult: props.onOpenResult,
              onRefresh: props.onRefresh,
              onSay: props.onSay,
              onClose: props.onClose,
            }),
          ),
        ),
      );
    }

    /* ------------------------------------------------------------------ */
    /* 阅读器                                                              */
    /* ------------------------------------------------------------------ */

    function blockElement(block, index) {
      const key = 'b' + index;
      if (!block || typeof block !== 'object') return null;
      const text = typeof block.x === 'string' ? block.x : '';
      switch (block.t) {
        case 'h': {
          const level = clamp(block.l || 2, 1, 3);
          return h('h' + (level + 2), { key, className: 'pb-h' + level }, text);
        }
        case 'q':
          return h('blockquote', { key, className: 'pb-q' }, text);
        case 'li':
          return h('p', { key, className: 'pb-li' }, text);
        case 'code':
          return h('pre', { key, className: 'pb-pre' }, h('code', null, text));
        case 'hr':
          return h('hr', { key, className: 'pb-hr' });
        default:
          return h('p', { key, className: 'pb-p' }, text);
      }
    }

    function TocDrawer(props) {
      const { t, toc, current, book } = props;
      return h(
        'div',
        { className: 'pb-drawer', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('reader.toc') },
        h(
          'div',
          { className: 'pb-drawer-head' },
          h('b', { title: book.title }, book.title),
          h('span', null, t('reader.contents', { n: fmtNumber(toc.length) })),
        ),
        h(
          'div',
          { className: 'pb-toc' },
          toc.map((entry) =>
            h(
              'button',
              {
                key: 'toc' + entry.index,
                type: 'button',
                className: 'pb-toc-item',
                'data-on': entry.index === current ? '1' : '0',
                'data-read': entry.index < current ? '1' : '0',
                onClick: () => props.onJump(entry.index),
                title: entry.title,
              },
              h('span', { className: 'pb-toc-idx' }, String(entry.index + 1).padStart(2, '0')),
              h('span', { className: 'pb-toc-title' }, entry.title || t('reader.chapterCount', { i: entry.index + 1, n: toc.length })),
            ),
          ),
        ),
      );
    }

    function SettingsPanel(props) {
      const { t, settings } = props;
      const set = props.onSettings;

      const row = (label, value, control) =>
        h(
          'div',
          { className: 'pb-set' },
          h('p', { className: 'pb-set-label' }, h('span', null, label), value ? h('span', { className: 'pb-set-value' }, value) : null),
          control,
        );

      const seg = (options, value, onChange) =>
        h(
          'div',
          { className: 'pb-seg', role: 'group' },
          options.map((option) =>
            h(
              'button',
              {
                key: option.value,
                type: 'button',
                'data-on': option.value === value ? '1' : '0',
                onClick: () => onChange(option.value),
              },
              option.label,
            ),
          ),
        );

      const toggle = (value, onChange) =>
        h(
          'button',
          {
            type: 'button',
            className: 'pb-switch',
            'data-on': value ? '1' : '0',
            role: 'switch',
            'aria-checked': value ? 'true' : 'false',
            onClick: () => onChange(!value),
          },
          h('i'),
        );

      return h(
        'aside',
        { className: 'pb-settings', role: 'dialog', 'aria-modal': 'false', 'aria-label': t('reader.settings') },
        h(
          'div',
          { className: 'pb-drawer-head', style: { display: 'flex', alignItems: 'center', gap: 8 } },
          h('b', { style: { flex: 1 } }, t('reader.settings')),
          h(
            'button',
            { type: 'button', className: 'pb-btn pb-icon-btn', onClick: props.onClose, 'aria-label': t('reader.back') },
            h(IconClose, { size: 15 }),
          ),
        ),
        h(
          'div',
          { className: 'pb-settings-body' },
          row(
            t('reader.theme'),
            null,
            h(
              'div',
              { className: 'pb-swatches' },
              THEMES.map((theme) =>
                h(
                  'button',
                  {
                    key: theme,
                    type: 'button',
                    className: 'pb-swatch',
                    'data-on': settings.theme === theme ? '1' : '0',
                    onClick: () => set({ theme }),
                    title: t('reader.theme' + theme.charAt(0).toUpperCase() + theme.slice(1)),
                    style: {
                      background:
                        theme === 'paper' ? '#fbfaf6' : theme === 'sepia' ? '#f2e5cc' : theme === 'ink' ? '#15171b' : '#e6ecdb',
                      color: theme === 'ink' ? '#cbc7bc' : '#3b2c1a',
                    },
                  },
                  t('reader.theme' + theme.charAt(0).toUpperCase() + theme.slice(1)),
                ),
              ),
            ),
          ),
          row(
            t('reader.typeface'),
            null,
            seg(
              [
                { value: 'serif', label: t('reader.serif') },
                { value: 'sans', label: t('reader.sans') },
              ],
              settings.fontFamily,
              (value) => set({ fontFamily: value }),
            ),
          ),
          row(
            t('reader.size'),
            settings.fontSize + ' px',
            h('input', {
              className: 'pb-range',
              type: 'range',
              min: 15,
              max: 32,
              step: 1,
              value: settings.fontSize,
              onChange: (event) => set({ fontSize: clamp(event.target.value, 15, 32) }),
              'aria-label': t('reader.size'),
            }),
          ),
          row(
            t('reader.leading'),
            settings.lineHeight.toFixed(1),
            h('input', {
              className: 'pb-range',
              type: 'range',
              min: 1.4,
              max: 2.4,
              step: 0.1,
              value: settings.lineHeight,
              onChange: (event) => set({ lineHeight: Math.round(clamp(event.target.value, 1.4, 2.4) * 10) / 10 }),
              'aria-label': t('reader.leading'),
            }),
          ),
          row(
            t('reader.measure'),
            String(settings.measure),
            h('input', {
              className: 'pb-range',
              type: 'range',
              min: 24,
              max: 52,
              step: 1,
              value: settings.measure,
              onChange: (event) => set({ measure: Math.round(clamp(event.target.value, 24, 52)) }),
              'aria-label': t('reader.measure'),
            }),
          ),
          row(
            t('reader.layout'),
            null,
            seg(
              [
                { value: 'scroll', label: t('reader.scroll') },
                { value: 'paged', label: t('reader.paged') },
              ],
              settings.mode,
              (value) => set({ mode: value }),
            ),
          ),
          row(
            t('reader.justify'),
            settings.justify ? t('reader.on') : t('reader.off'),
            toggle(settings.justify, (value) => set({ justify: value })),
          ),
          row(
            t('reader.autohide'),
            settings.chromeAutoHide ? t('reader.on') : t('reader.off'),
            toggle(settings.chromeAutoHide, (value) => set({ chromeAutoHide: value })),
          ),
        ),
      );
    }

    /** 影印 / EPUB 的格式徽标，和来源徽标并排但不抢主次。 */
    function formatBadge(t, format) {
      if (format === 'pdf-scan') {
        return h('span', { className: 'pb-badge pb-badge-format', 'data-format': 'scan' }, t('shelf.scanBadge'));
      }
      if (format === 'epub') {
        return h('span', { className: 'pb-badge pb-badge-format', 'data-format': 'epub' }, t('shelf.epubBadge'));
      }
      return null;
    }

    /* ------------------------------------------------------------------ */
    /* 划词工具条 / AI 卡片 / 笔记抽屉                                        */
    /* ------------------------------------------------------------------ */

    function SelectBar(props) {
      const { t, selection } = props;
      return h(
        'div',
        {
          className: 'pb-selectbar',
          role: 'toolbar',
          'aria-label': t('select.explain'),
          style: { left: selection.x + 'px', top: selection.y + 'px', width: selection.width + 'px', justifyContent: 'center' },
          onPointerDown: (event) => event.preventDefault(),
        },
        h('button', { type: 'button', onClick: () => props.onAsk('explain', selection.text) }, t('select.explain')),
        h('button', { type: 'button', onClick: () => props.onAsk('expand', selection.text) }, t('select.expand')),
        h('button', { type: 'button', onClick: () => props.onNote(selection.text) }, t('select.note')),
        h('span', { className: 'pb-selectbar-sep' }),
        h('button', { type: 'button', onClick: () => props.onCopy(selection.text) }, t('select.copy')),
      );
    }

    function AiCard(props) {
      const { t, ai } = props;
      const title = ai.mode === 'expand' ? t('ai.expandTitle') : t('ai.explainTitle');
      return h(
        'div',
        { className: 'pb-ai', role: 'dialog', 'aria-label': title, 'aria-busy': ai.status === 'loading' ? 'true' : 'false' },
        h(
          'div',
          { className: 'pb-ai-head' },
          h('b', null, title),
          h(
            'button',
            { type: 'button', className: 'pb-btn pb-icon-btn', onClick: props.onClose, 'aria-label': t('ai.close') },
            h(IconClose, { size: 15 }),
          ),
        ),
        h('p', { className: 'pb-ai-quote' }, ai.text),
        h(
          'div',
          { className: 'pb-ai-body' },
          ai.status === 'loading'
            ? h(
                'div',
                { className: 'pb-ai-skel' },
                h('span', { style: { fontSize: 12, color: 'var(--dsw-alias-label-tertiary)' } }, t('ai.thinking')),
                [92, 86, 97, 64, 78].map((width, index) =>
                  h('i', { key: 'skel' + index, style: { width: width + '%' } }),
                ),
              )
            : ai.status === 'error'
              ? h('p', { className: 'pb-ai-err' }, t('ai.errorTitle') + '：' + ai.error)
              : ai.answer,
        ),
        h(
          'div',
          { className: 'pb-ai-foot' },
          ai.status === 'ready'
            ? h('button', { type: 'button', className: 'pb-btn', onClick: props.onCopyAnswer }, t('select.copy'))
            : null,
          ai.status === 'ready'
            ? h('button', { type: 'button', className: 'pb-btn pb-btn-primary', onClick: props.onSaveAnswer }, t('ai.saveNote'))
            : null,
          h('button', { type: 'button', className: 'pb-btn', onClick: props.onClose }, t('ai.close')),
        ),
      );
    }

    function NoteDrawer(props) {
      const { t, notes, status, error } = props;
      const body = status === 'loading'
        ? h('div', { className: 'pb-note-empty' }, t('notes.loading'))
        : status === 'error'
          ? h(
              'div',
              { className: 'pb-note-empty' },
              h('p', { className: 'pb-ai-err' }, t('notes.error') + '：' + error),
              h(
                'button',
                { type: 'button', className: 'pb-btn', style: { marginTop: 12 }, onClick: props.onReload },
                t('shelf.retry'),
              ),
            )
          : notes.length === 0
            ? h('div', { className: 'pb-note-empty' }, t('notes.empty'))
            : h(
                'div',
                { className: 'pb-note-list' },
                notes.map((note) =>
                  h(
                    'article',
                    { key: String(note.id), className: 'pb-note' },
                    h(
                      'p',
                      {
                        className: 'pb-note-quote',
                        title: t('notes.jump'),
                        onClick: () => props.onJump(note),
                      },
                      note.quote,
                    ),
                    note.note
                      ? h('p', { className: 'pb-note-text' }, note.note)
                      : h('p', { className: 'pb-note-text', style: { opacity: 0.7 } }, t('notes.quoteOnly')),
                    h(
                      'div',
                      { className: 'pb-note-foot' },
                      h(
                        'span',
                        null,
                        [note.chapterTitle, fmtTime(note.createdAt)].filter(Boolean).join(' · '),
                      ),
                      h('span', { className: 'pb-grow' }),
                      h(
                        'button',
                        { type: 'button', className: 'pb-note-del', onClick: () => props.onDelete(note) },
                        t('notes.delete'),
                      ),
                    ),
                  ),
                ),
              );

      return h(
        'aside',
        { className: 'pb-notes', role: 'dialog', 'aria-label': t('notes.title') },
        h(
          'div',
          { className: 'pb-drawer-head', style: { display: 'flex', alignItems: 'center', gap: 8 } },
          h(
            'div',
            { style: { flex: 1, minWidth: 0 } },
            h('b', null, t('notes.title')),
            h('span', null, t('notes.count', { n: fmtNumber(notes.length) })),
          ),
          h(
            'button',
            { type: 'button', className: 'pb-btn pb-icon-btn', onClick: props.onClose, 'aria-label': t('ai.close') },
            h(IconClose, { size: 15 }),
          ),
        ),
        body,
        props.onOpenAll
          ? h(
              'div',
              { className: 'pb-drawer-foot' },
              h('button', { type: 'button', className: 'pb-textlink', onClick: props.onOpenAll }, t('notes.openPage') + ' →'),
            )
          : null,
      );
    }

    function Reader(props) {
      const { t, book } = props;
      const settings = props.settings;

      const startIndex = useRef(
        clamp((book.progress && book.progress.chapterIndex) || 0, 0, Math.max(0, (book.chapterCount || 1) - 1)),
      ).current;
      const startPercent = useRef(chapterInnerPercent(book)).current;

      const [meta, setMeta] = useState({ book, toc: [] });
      const [finished, setFinished] = useState(!!book.finished);
      const [chapter, setChapter] = useState(null);
      const [chapterIndex, setChapterIndex] = useState(startIndex);
      const [status, setStatus] = useState('loading');
      const [error, setError] = useState('');
      const [overlay, setOverlay] = useState(null);
      const [chrome, setChrome] = useState(true);
      const [page, setPage] = useState(0);
      const [layout, setLayout] = useState({ pages: 1, stride: 0 });
      const [scrollPercent, setScrollPercent] = useState(0);
      const [overflowFallback, setOverflowFallback] = useState(false);
      const [fontOpen, setFontOpen] = useState(false);

      const [selection, setSelection] = useState(null);
      const [ai, setAi] = useState(null);
      const [notes, setNotes] = useState([]);
      const [notesStatus, setNotesStatus] = useState('idle');
      const [notesError, setNotesError] = useState('');
      const contentRef = useRef(null);
      const [focusIndex, setFocusIndex] = useState(-1);
      const pendingFocus = useRef(props.focusQuote || '');

      /** 影印 PDF 不走文本排版：交给浏览器内建的 PDF 阅读器。 */
      const isScan = (book && book.format === 'pdf-scan') || (meta.book && meta.book.format === 'pdf-scan');

      const scrollRef = useRef(null);
      const clipRef = useRef(null);
      const colsRef = useRef(null);
      const restoreRef = useRef(startPercent > 0 ? startPercent : null);
      const overlayRef = useRef(null);
      const selectionRef = useRef(null);
      const aiRef = useRef(null);
      const chromeRef = useRef(true);
      const hideTimer = useRef(null);
      const rafRef = useRef(0);
      const stateRef = useRef({ chapterIndex: startIndex, percent: 0 });
      const sentRef = useRef({ chapterIndex: -1, percent: -1 });
      const tickRef = useRef(Date.now());
      const aliveRef = useRef(true);

      overlayRef.current = overlay;
      chromeRef.current = chrome;
      selectionRef.current = selection;
      aiRef.current = ai;

      /* ---------------- 数据 ---------------- */

      const loadChapter = useCallback(
        async (index, restore) => {
          setStatus('loading');
          setError('');
          try {
            const res = await call('/book/' + encodeURIComponent(book.id) + '/chapter/' + index);
            if (!aliveRef.current) return;
            if (restore !== null && restore !== undefined) restoreRef.current = restore;
            else restoreRef.current = 0;
            setChapter({ chapter: res.chapter, prev: res.prev, next: res.next, total: res.total });
            setSelection(null);
            setChapterIndex(index);
            setPage(0);
            setScrollPercent(0);
            setStatus('ready');
          } catch (err) {
            if (!aliveRef.current) return;
            setError(errorText(err));
            setStatus('error');
          }
        },
        [book.id],
      );

      useEffect(() => {
        setFinished(!!book.finished);
      }, [book.finished]);

      useEffect(() => {
        aliveRef.current = true;
        let cancelled = false;
        (async () => {
          try {
            const res = await call('/book/' + encodeURIComponent(book.id));
            if (cancelled || !aliveRef.current) return;
            setMeta({ book: res.book || book, toc: Array.isArray(res.toc) ? res.toc : [] });
            try {
              const noting = await call('/notes?bookId=' + encodeURIComponent(book.id));
              if (aliveRef.current && Array.isArray(noting.notes)) {
                setNotes(noting.notes);
                setNotesStatus('ready');
              }
            } catch (error) {
              /* 笔记读不出来不影响阅读 */
            }
            await loadChapter(startIndex, startPercent);
          } catch (err) {
            if (cancelled || !aliveRef.current) return;
            setError(errorText(err));
            setStatus('error');
          }
        })();
        return () => {
          cancelled = true;
          aliveRef.current = false;
        };
      }, [book.id]);

      /* ---------------- 进度上报 ---------------- */

      const flush = useCallback(
        async (force) => {
          const snapshot = stateRef.current;
          if (!snapshot || snapshot.chapterIndex === null) return;
          const sent = sentRef.current;
          const same =
            sent.chapterIndex === snapshot.chapterIndex && Math.abs(sent.percent - snapshot.percent) < 0.004;
          const now = Date.now();
          const seconds = Math.max(0, Math.min(600, Math.round((now - tickRef.current) / 1000)));
          if (same && seconds < FLUSH_MS / 1000 && !force) return;
          sentRef.current = { chapterIndex: snapshot.chapterIndex, percent: snapshot.percent };
          tickRef.current = now;
          try {
            const res = await post('/progress', {
              bookId: book.id,
              chapterIndex: snapshot.chapterIndex,
              percent: snapshot.percent,
              seconds,
            });
            if (res && res.book && aliveRef.current) props.onBookUpdated(res.book);
          } catch (err) {
            /* 网络抖动不打断阅读，下一轮再试 */
          }
        },
        [book.id, props.onBookUpdated],
      );

      useEffect(() => {
        const timer = setInterval(() => {
          flush(false);
        }, FLUSH_MS);
        return () => {
          clearInterval(timer);
          flush(true);
        };
      }, [flush]);

      /* ---------------- 百分比 ---------------- */

      const percent = settings.mode === 'paged'
        ? layout.pages > 1
          ? page / (layout.pages - 1)
          : 0
        : scrollPercent;

      stateRef.current = { chapterIndex, percent: clamp(percent, 0, 1) };

      /* ---------------- 分页测量 ---------------- */

      const chapterKey = chapter ? chapter.chapter.index : -1;

      const recompute = useCallback(() => {
        if (settings.mode !== 'paged') {
          setLayout({ pages: 1, stride: 0 });
          setOverflowFallback(false);
          return;
        }
        const clip = clipRef.current;
        const cols = colsRef.current;
        if (!clip || !cols) return;
        const computed = typeof getComputedStyle === 'function' ? getComputedStyle(cols) : null;
        const gap = computed ? parseFloat(computed.columnGap) || 0 : 0;
        const stride = clip.clientWidth + gap;
        const raw = cols.scrollWidth || 0;
        const pages = Math.max(1, Math.round((raw + gap) / (stride || 1)));
        const tall = cols.scrollHeight > clip.clientHeight + 6;
        setLayout({ pages, stride });
        setOverflowFallback(pages <= 1 && tall);
        setPage((current) => Math.min(current, pages - 1));
      }, [settings.mode, settings.fontSize, settings.lineHeight, settings.measure, settings.fontFamily, chapterKey]);

      useLayoutEffect(() => {
        recompute();
        const id = requestAnimationFrame(() => recompute());
        return () => cancelAnimationFrame(id);
      }, [recompute, chapterKey]);

      useEffect(() => {
        if (settings.mode !== 'paged' || typeof ResizeObserver === 'undefined') return undefined;
        const clip = clipRef.current;
        if (!clip) return undefined;
        const observer = new ResizeObserver(() => recompute());
        observer.observe(clip);
        return () => observer.disconnect();
      }, [settings.mode, recompute]);

      /* ---------------- 位置恢复 ---------------- */

      useEffect(() => {
        if (status !== 'ready') return;
        const wanted = restoreRef.current;
        if (wanted === null || wanted === undefined) return;
        if (settings.mode === 'paged') {
          // stride 为 0 说明这一帧还没量出栏宽，等下一次提交再恢复，
          // 否则会把「切到分页」的第一次渲染当成真实页数 1，进度被清零。
          if (layout.stride > 0) {
            setPage(Math.round(clamp(wanted, 0, 1) * (layout.pages - 1)));
            restoreRef.current = null;
          }
        } else {
          const el = scrollRef.current;
          if (el) {
            const max = el.scrollHeight - el.clientHeight;
            el.scrollTop = Math.round(clamp(wanted, 0, 1) * Math.max(0, max));
            setScrollPercent(clamp(wanted, 0, 1));
            restoreRef.current = null;
          }
        }
      }, [status, settings.mode, layout.pages, chapterKey]);

      /** 切换滚动/分页时先把当前位置记下来，换完布局再恢复，别让进度回到章首。 */
      const applySettings = useCallback(
        (patch) => {
          if (patch && patch.mode && patch.mode !== settings.mode) {
            restoreRef.current = settings.mode === 'paged'
              ? layout.pages > 1
                ? page / (layout.pages - 1)
                : 0
              : scrollPercent;
          }
          props.onSettings(patch);
        },
        [settings.mode, layout.pages, page, scrollPercent, props.onSettings],
      );

      const blocks = chapter && chapter.chapter && Array.isArray(chapter.chapter.blocks) ? chapter.chapter.blocks : [];

      /** 从笔记/今日一句进来时，把正文滚到那一句（只做一次）。 */
      useEffect(() => {
        if (status !== 'ready') return;
        const quote = pendingFocus.current;
        if (!quote) return;
        pendingFocus.current = '';
        const head = String(quote).trim().slice(0, 24);
        if (!head) return;
        for (let index = 0; index < blocks.length; index += 1) {
          const block = blocks[index];
          if (block && typeof block.x === 'string' && block.x.indexOf(head) >= 0) {
            setFocusIndex(index);
            break;
          }
        }
      }, [status, chapterKey, blocks]);

      const focusedOnce = useRef(-1);
      useEffect(() => {
        if (focusIndex < 0 || status !== 'ready' || focusedOnce.current === focusIndex) return;
        focusedOnce.current = focusIndex;
        const root = contentRef.current;
        const node = root && typeof root.querySelector === 'function' ? root.querySelector('[data-focus="1"]') : null;
        if (!node || typeof node.getBoundingClientRect !== 'function') return;
        if (settings.mode === 'paged') {
          const clip = clipRef.current;
          if (clip && layout.stride > 1) {
            const delta = node.getBoundingClientRect().left - clip.getBoundingClientRect().left;
            setPage(clamp(Math.round(delta / layout.stride), 0, Math.max(0, layout.pages - 1)));
          }
        } else {
          const scroller = scrollRef.current;
          if (scroller) {
            const top =
              node.getBoundingClientRect().top -
              scroller.getBoundingClientRect().top +
              scroller.scrollTop -
              scroller.clientHeight / 3;
            scroller.scrollTop = Math.max(0, top);
          }
        }
      }, [focusIndex, status, settings.mode, layout.stride, layout.pages, chapterKey]);

      /* ---------------- 工具条淡出 ---------------- */

      const poke = useCallback(() => {
        if (!chromeRef.current) setChrome(true);
        if (hideTimer.current) clearTimeout(hideTimer.current);
        if (!settings.chromeAutoHide || overlayRef.current) return;
        hideTimer.current = setTimeout(() => {
          if (!overlayRef.current) setChrome(false);
        }, CHROME_IDLE_MS);
      }, [settings.chromeAutoHide]);

      useEffect(() => {
        poke();
        return () => {
          if (hideTimer.current) clearTimeout(hideTimer.current);
        };
      }, [poke]);

      useEffect(() => {
        if (settings.chromeAutoHide) return undefined;
        if (hideTimer.current) clearTimeout(hideTimer.current);
        setChrome(true);
        return undefined;
      }, [settings.chromeAutoHide]);

      useEffect(() => {
        if (hideTimer.current) clearTimeout(hideTimer.current);
        if (overlayRef.current) {
          setChrome(true);
          setFontOpen(false);
        } else {
          poke();
        }
      }, [overlay, poke]);

      /* ---------------- 翻页 / 滚动动作 ---------------- */

      const turn = useCallback(
        (delta) => {
          if (settings.mode === 'paged') {
            const next = page + delta;
            if (next < 0) {
              if (hasPrev(chapter)) loadChapter(chapter.prev, 1);
              return;
            }
            if (next > layout.pages - 1) {
              if (hasNext(chapter)) loadChapter(chapter.next, 0);
              return;
            }
            setPage(next);
          } else {
            const el = scrollRef.current;
            if (!el) return;
            const step = Math.max(80, el.clientHeight - 120);
            el.scrollBy({ top: delta * step, behavior: 'smooth' });
          }
        },
        [settings.mode, layout.pages, page, chapter, loadChapter],
      );

      const scrollBy = useCallback((delta) => {
        const el = scrollRef.current;
        if (!el) return;
        el.scrollBy({ top: delta, behavior: 'smooth' });
      }, []);

      const jumpChapter = useCallback(
        (index) => {
          loadChapter(index, 0);
          setChrome(true);
        },
        [loadChapter],
      );

      const onScroll = useCallback(() => {
        if (rafRef.current) return;
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = 0;
          const el = scrollRef.current;
          if (!el) return;
          const max = el.scrollHeight - el.clientHeight;
          setSelection(null);
          setScrollPercent(max > 0 ? clamp(el.scrollTop / max, 0, 1) : 0);
        });
      }, []);

      /* ---------------- 划词 / AI / 笔记 ---------------- */

      const flash = useCallback(
        (message) => {
          if (props.onToast) props.onToast(message);
        },
        [props.onToast],
      );

      const copyText = useCallback(
        async (value) => {
          try {
            if (typeof navigator === 'undefined' || !navigator.clipboard || !navigator.clipboard.writeText) {
              throw new Error('no clipboard');
            }
            await navigator.clipboard.writeText(value);
            flash(t('select.copied'));
          } catch (error) {
            flash(t('select.copyFailed'));
          }
        },
        [flash, t],
      );

      const captureSelection = useCallback(() => {
        if (isScan || ai) return;
        const root = contentRef.current;
        const sel = typeof window !== 'undefined' && typeof window.getSelection === 'function' ? window.getSelection() : null;
        if (!root || !sel || sel.isCollapsed || sel.rangeCount === 0) {
          setSelection(null);
          return;
        }
        const text = String(sel).trim();
        if (text.length < 2) {
          setSelection(null);
          return;
        }
        const range = sel.getRangeAt(0);
        const node = range.commonAncestorContainer;
        const host = node && node.nodeType === 1 ? node : node && node.parentNode;
        if (!host || typeof root.contains !== 'function' || !root.contains(host)) {
          setSelection(null);
          return;
        }
        const rect = typeof range.getBoundingClientRect === 'function' ? range.getBoundingClientRect() : null;
        if (!rect || (!rect.width && !rect.height)) {
          setSelection(null);
          return;
        }
        const width = 272;
        const viewWidth = window.innerWidth || 1024;
        const left = clamp(rect.left + rect.width / 2 - width / 2, 8, Math.max(8, viewWidth - width - 8));
        const top = rect.top > 72 ? rect.top - 46 : rect.bottom + 12;
        setSelection({ text: text.slice(0, 1600), x: left, y: top, width });
      }, [isScan, ai]);

      const askAi = useCallback(
        async (mode, text) => {
          setSelection(null);
          setAi({ mode, text, status: 'loading', answer: '', error: '' });
          try {
            const res = await post('/ai/ask', {
              text,
              mode,
              bookId: book.id,
              chapterIndex,
              contextTitle: (chapter && chapter.chapter && chapter.chapter.title) || '',
            });
            if (!aliveRef.current) return;
            setAi({ mode, text, status: 'ready', answer: String(res.answer || ''), error: '' });
          } catch (error) {
            if (!aliveRef.current) return;
            setAi({ mode, text, status: 'error', answer: '', error: errorText(error) });
          }
        },
        [book.id, chapterIndex, chapter],
      );

      const sendNote = useCallback(
        async (quote, note, mode) => {
          const res = await post('/notes', {
            bookId: book.id,
            chapterIndex,
            quote,
            note: note || '',
            mode: mode || 'note',
          });
          if (props.onNotesChanged) props.onNotesChanged();
          return res.note;
        },
        [book.id, chapterIndex, props.onNotesChanged],
      );

      const noteSelection = useCallback(
        async (quote) => {
          setSelection(null);
          try {
            await sendNote(quote, '', 'note');
            flash(t('notes.saved'));
          } catch (error) {
            flash(errorText(error));
          }
        },
        [sendNote, flash, t],
      );

      const saveAnswer = useCallback(async () => {
        if (!ai) return;
        try {
          await sendNote(ai.text, ai.answer, ai.mode);
          flash(t('ai.saved'));
          setAi(null);
        } catch (error) {
          flash(errorText(error));
        }
      }, [ai, sendNote, flash, t]);

      const loadNotes = useCallback(async () => {
        setNotesStatus('loading');
        setNotesError('');
        try {
          const res = await call('/notes?bookId=' + encodeURIComponent(book.id));
          if (!aliveRef.current) return;
          setNotes(Array.isArray(res.notes) ? res.notes : []);
          setNotesStatus('ready');
        } catch (error) {
          if (!aliveRef.current) return;
          setNotesError(errorText(error));
          setNotesStatus('error');
        }
      }, [book.id]);

      const deleteNote = useCallback(
        async (note) => {
          try {
            await del('/notes/' + encodeURIComponent(note.id));
            if (!aliveRef.current) return;
            setNotes((list) => list.filter((item) => item.id !== note.id));
            flash(t('notes.deleted'));
            if (props.onNotesChanged) props.onNotesChanged();
          } catch (error) {
            flash(errorText(error));
          }
        },
        [flash, t, props.onNotesChanged],
      );

      const openNotes = useCallback(() => {
        setOverlay('notes');
        if (notesStatus !== 'ready') loadNotes();
      }, [notesStatus, loadNotes]);

      useEffect(() => {
        if (!selection) return undefined;
        const onDown = (event) => {
          const target = event.target;
          if (target && typeof target.closest === 'function' && target.closest('.pb-selectbar')) return;
          setSelection(null);
        };
        window.addEventListener('mousedown', onDown, true);
        return () => window.removeEventListener('mousedown', onDown, true);
      }, [selection]);

      /* ---------------- 键盘 ---------------- */

      useEffect(() => {
        const onKeyDown = (event) => {
          const target = event.target;
          const tag = target && target.tagName ? String(target.tagName).toLowerCase() : '';
          if (tag === 'input' || tag === 'textarea' || tag === 'select' || (target && target.isContentEditable)) return;
          if (event.metaKey || event.ctrlKey || event.altKey) return;

          if (isScan && ['ArrowLeft', 'ArrowRight', 'j', 'J', 'k', 'K', ' '].indexOf(event.key) >= 0) return;

          switch (event.key) {
            case 'ArrowLeft':
              event.preventDefault();
              if (settings.mode === 'paged') turn(-1);
              else if (hasPrev(chapter)) loadChapter(chapter.prev, 1);
              poke();
              break;
            case 'ArrowRight':
              event.preventDefault();
              if (settings.mode === 'paged') turn(1);
              else if (hasNext(chapter)) loadChapter(chapter.next, 0);
              poke();
              break;
            case 'j':
            case 'J':
              event.preventDefault();
              if (settings.mode === 'paged') turn(1);
              else scrollBy(140);
              poke();
              break;
            case 'k':
            case 'K':
              event.preventDefault();
              if (settings.mode === 'paged') turn(-1);
              else scrollBy(-140);
              poke();
              break;
            case ' ':
            case 'Spacebar':
              event.preventDefault();
              if (settings.mode === 'paged') turn(1);
              else {
                const box = scrollRef.current;
                const step = Math.round((box ? box.clientHeight : window.innerHeight) * 0.72);
                scrollBy(event.shiftKey ? -step : step);
              }
              poke();
              break;
            case 't':
            case 'T':
              event.preventDefault();
              setOverlay((current) => (current === 'toc' ? null : 'toc'));
              break;
            case 's':
            case 'S':
              event.preventDefault();
              setOverlay((current) => (current === 'settings' ? null : 'settings'));
              break;
            case 'Escape':
              event.preventDefault();
              if (aiRef.current) {
                setAi(null);
              } else if (selectionRef.current) {
                setSelection(null);
              } else if (overlayRef.current) {
                setOverlay(null);
                setFontOpen(false);
              } else {
                flush(true).then(() => props.onExit());
              }
              break;
            case 'n':
            case 'N':
              event.preventDefault();
              if (overlayRef.current === 'notes') setOverlay(null);
              else openNotes();
              break;
            default:
              break;
          }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
      }, [settings.mode, turn, scrollBy, loadChapter, chapter, flush, poke, props.onExit, isScan, openNotes]);

      /* ---------------- 渲染 ---------------- */


      const chapterNotes = useMemo(
        () => (notes || []).filter((note) => Number(note.chapterIndex) === chapterIndex),
        [notes, chapterIndex],
      );

      const noteMarks = useMemo(() => {
        const marks = new Set();
        if (blocks.length === 0 || chapterNotes.length === 0) return marks;
        chapterNotes.forEach((note) => {
          const head = String(note.quote || '').trim().slice(0, 16);
          if (!head) return;
          for (let index = 0; index < blocks.length; index += 1) {
            const block = blocks[index];
            if (block && typeof block.x === 'string' && block.x.indexOf(head) >= 0) {
              marks.add(index);
              break;
            }
          }
        });
        return marks;
      }, [blocks, chapterNotes]);

      const prose = useMemo(() => {
        if (!chapter || !chapter.chapter) return [];
        const nodes = blocks.map((block, index) => {
          const element = blockElement(block, index);
          if (!element) return null;
          const marked = noteMarks.has(index);
          const focused = focusIndex === index;
          if (!marked && !focused) return element;
          return h(
            'div',
            {
              key: 'wrap' + index,
              className: 'pb-block',
              'data-mark': marked ? '1' : '0',
              'data-focus': focused ? '1' : '0',
            },
            element,
            marked
              ? h('button', {
                  type: 'button',
                  className: 'pb-note-dot',
                  'aria-label': t('notes.jump'),
                  title: t('notes.jump'),
                  onClick: () => setOverlay('notes'),
                })
              : null,
          );
        });
        const end = h(
          'div',
          { className: 'pb-end-wrap', key: 'end' },
          h('p', { className: 'pb-end' }, t('reader.end')),
          h(
            'div',
            { className: 'pb-end-actions' },
            hasNext(chapter)
              ? h(
                  'button',
                  { type: 'button', className: 'pb-btn', onClick: () => loadChapter(chapter.next, 0) },
                  t('reader.next'),
                )
              : h(
                  'button',
                  {
                    type: 'button',
                    className: 'pb-btn' + (finished ? '' : ' pb-btn-primary'),
                    onClick: () => props.onToggleFinished(!finished),
                  },
                  h(IconCheck, { size: 14 }),
                  finished ? t('reader.finished') : t('reader.markFinished'),
                ),
          ),
        );
        return nodes.concat([end]);
      }, [chapter, blocks, noteMarks, focusIndex, meta.book, finished, t, loadChapter, props.onToggleFinished]);

      const toc = meta.toc || [];
      const total = Math.max(1, (chapter && chapter.total) || (meta.book.chapterCount || 1));
      const currentBook = meta.book || book;
      const overall = chapter ? clamp(Math.round(((chapterIndex + clamp(percent, 0, 1)) / Math.max(1, total)) * 100), 0, 100) : bookPercent(currentBook);
      const chapterTitle = chapter && chapter.chapter && chapter.chapter.title ? chapter.chapter.title : '';

      const readerStyle = {
        '--pb-font-size': settings.fontSize + 'px',
        '--pb-line-height': String(settings.lineHeight),
        '--pb-measure': String(settings.measure),
        '--pb-align': settings.justify ? 'justify' : 'start',
        '--pb-gap': settings.measure >= 40 ? '88px' : '72px',
      };

      const rootProps = {
        className: 'pb-reader',
        'data-theme': settings.theme,
        'data-font': settings.fontFamily,
        'data-chrome': chrome ? '1' : '0',
        style: readerStyle,
        onPointerMove: poke,
        onPointerDown: poke,
      };

      const topbar = h(
        'header',
        { className: 'pb-topbar pb-chrome' },
        h(
          'button',
          {
            type: 'button',
            className: 'pb-btn pb-btn-quiet',
            onClick: () => {
              flush(true).then(() => props.onExit());
            },
          },
          h(IconBack, { size: 15 }),
          t('reader.back'),
        ),
        h(
          'div',
          { className: 'pb-topbar-title' },
          h('b', { title: currentBook.title }, currentBook.title),
          h('span', { title: chapterTitle }, chapterTitle || t('reader.loading')),
        ),
        h(
          'div',
          { className: 'pb-topbar-tools' },
          h(
            'button',
            {
              type: 'button',
              className: 'pb-btn pb-icon-btn',
              'data-on': overlay === 'toc' ? '1' : '0',
              onClick: () => setOverlay(overlay === 'toc' ? null : 'toc'),
              title: t('reader.toc'),
              'aria-label': t('reader.toc'),
            },
            h(IconToc, { size: 16 }),
          ),
          isScan
            ? null
            : h(
                'div',
                { style: { position: 'relative' } },
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'pb-btn pb-icon-btn',
                    'data-on': fontOpen ? '1' : '0',
                    onClick: () => setFontOpen((open) => !open),
                    title: t('reader.fontSize'),
                    'aria-label': t('reader.fontSize'),
                  },
                  h(IconType, { size: 16 }),
                ),
                fontOpen
                  ? h(
                  'div',
                  { className: 'pb-fontpop', onPointerDown: (event) => event.stopPropagation() },
                  h(
                    'div',
                    { className: 'pb-fontpop-row' },
                    h('span', { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)' } }, t('reader.size')),
                    h(
                      'button',
                      {
                        type: 'button',
                        className: 'pb-btn pb-icon-btn',
                        onClick: () => applySettings({ fontSize: clamp(settings.fontSize - 1, 15, 32) }),
                        'aria-label': '-',
                      },
                      '−',
                    ),
                    h('b', null, settings.fontSize),
                    h(
                      'button',
                      {
                        type: 'button',
                        className: 'pb-btn pb-icon-btn',
                        onClick: () => applySettings({ fontSize: clamp(settings.fontSize + 1, 15, 32) }),
                        'aria-label': '+',
                      },
                      '+',
                    ),
                  ),
                  h(
                    'div',
                    { className: 'pb-fontpop-sizes' },
                    [16, 18, 20, 22, 24].map((size) =>
                      h(
                        'button',
                        {
                          key: size,
                          type: 'button',
                          'data-on': settings.fontSize === size ? '1' : '0',
                          onClick: () => applySettings({ fontSize: size }),
                        },
                        size,
                      ),
                    ),
                  ),
                )
              : null,
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'pb-btn pb-icon-btn',
              'data-on': overlay === 'notes' ? '1' : '0',
              onClick: () => (overlay === 'notes' ? setOverlay(null) : openNotes()),
              title: t('reader.notes'),
              'aria-label': t('reader.notes'),
            },
            h(IconNote, { size: 16 }),
            chapterNotes.length > 0 ? h('span', { className: 'pb-icon-count pb-num' }, chapterNotes.length) : null,
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'pb-btn pb-icon-btn',
              'data-on': overlay === 'settings' ? '1' : '0',
              onClick: () => setOverlay(overlay === 'settings' ? null : 'settings'),
              title: t('reader.settings'),
              'aria-label': t('reader.settings'),
            },
            h(IconSliders, { size: 16 }),
          ),
        ),
      );

      const footbar = isScan
        ? h(
            'footer',
            { className: 'pb-footbar pb-footbar-scan pb-chrome' },
            h('p', { className: 'pb-scan-hint' }, t('reader.scanHint')),
          )
        : h(
        'footer',
        { className: 'pb-footbar pb-chrome' },
        h(
          'div',
          {
            className: 'pb-foot-track',
            role: 'slider',
            tabIndex: 0,
            'aria-label': t('reader.jump'),
            'aria-valuenow': overall,
            'aria-valuemin': 0,
            'aria-valuemax': 100,
            title: t('reader.jump'),
            onClick: (event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              const ratio = clamp((event.clientX - rect.left) / Math.max(1, rect.width), 0, 1);
              const target = clamp(Math.floor(ratio * (total || 1)), 0, Math.max(0, (total || 1) - 1));
              if (total > 1 && target !== chapterIndex) jumpChapter(target);
            },
            onKeyDown: (event) => {
              if (event.key === 'ArrowLeft' && hasPrev(chapter)) jumpChapter(chapter.prev);
              if (event.key === 'ArrowRight' && hasNext(chapter)) jumpChapter(chapter.next);
            },
          },
          h('div', { className: 'pb-foot-rail' }, h('i', { style: { width: overall + '%' } })),
        ),
        h(
          'div',
          { className: 'pb-foot-meta' },
          h('span', null, t('reader.chapterCount', { i: Math.min(chapterIndex + 1, total), n: total })),
          h('span', { className: 'pb-grow' }),
          settings.mode === 'paged'
            ? h('span', null, t('reader.pageLabel', { i: Math.min(page + 1, layout.pages), n: layout.pages }))
            : null,
          h('span', null, t('reader.percent', { n: overall })),
          h('span', { className: 'pb-grow' }),
          h(
            'button',
            {
              type: 'button',
              className: 'pb-foot-btn',
              disabled: !hasPrev(chapter),
              onClick: () => hasPrev(chapter) && loadChapter(chapter.prev, 1),
            },
            t('reader.prev'),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'pb-foot-btn',
              disabled: !hasNext(chapter),
              onClick: () => hasNext(chapter) && loadChapter(chapter.next, 0),
            },
            t('reader.next'),
          ),
          chapter && !hasNext(chapter)
            ? h(
                'button',
                {
                  type: 'button',
                  className: 'pb-foot-btn',
                  onClick: () => props.onToggleFinished(!finished),
                },
                finished ? t('reader.finished') : t('reader.markFinished'),
              )
            : null,
        ),
      );

      let body = null;
      if (isScan) {
        body = h(
          'div',
          { className: 'pb-scan' },
          h('embed', {
            className: 'pb-scan-frame',
            type: 'application/pdf',
            src: '/lamplit/api/book/' + encodeURIComponent(book.id) + '/file',
            title: currentBook.title,
          }),
        );
      } else if (status === 'loading') {
        body = h(
          'div',
          { className: 'pb-chapter-loading' },
          h('span', { className: 'pb-spin' }),
          t('reader.loading'),
        );
      } else if (status === 'error') {
        body = h(
          'div',
          { className: 'pb-chapter-error' },
          h('p', null, t('reader.chapterError') + '：' + error),
          h(
            'button',
            { type: 'button', className: 'pb-btn', onClick: () => loadChapter(chapterIndex, null) },
            t('reader.retry'),
          ),
        );
      } else if (blocks.length === 0) {
        body = h(
          'div',
          { className: 'pb-chapter-error' },
          h('p', { style: { color: 'var(--dsw-alias-label-tertiary)' } }, t('reader.chapterMissing')),
        );
      } else if (settings.mode === 'paged') {
        body = h(
          'div',
          { className: 'pb-paged', ref: contentRef, onMouseUp: captureSelection, onTouchEnd: captureSelection },
          h(
            'div',
            { className: 'pb-paged-clip', ref: clipRef, 'data-overflow': overflowFallback ? '1' : '0' },
            h(
              'div',
              {
                className: 'pb-columns',
                ref: colsRef,
                style: { transform: overflowFallback ? 'none' : 'translate3d(' + -page * layout.stride + 'px,0,0)' },
              },
              h('div', { className: 'pb-prose' }, prose),
            ),
          ),
        );
      } else {
        body = h(
          'div',
          {
            className: 'pb-scroll-paper',
            ref: (node) => {
              scrollRef.current = node;
              contentRef.current = node;
            },
            onScroll: onScroll,
            onMouseUp: captureSelection,
            onTouchEnd: captureSelection,
          },
          h('div', { className: 'pb-prose' }, prose),
        );
      }

      return h(
        'div',
        rootProps,
        topbar,
        body,
        footbar,
        overlay === 'toc'
          ? [
              h('div', { key: 'scrim', className: 'pb-scrim', onClick: () => setOverlay(null) }),
              h(TocDrawer, {
                key: 'toc',
                t,
                toc,
                book: currentBook,
                current: chapterIndex,
                onJump: jumpChapter,
              }),
            ]
          : null,
        overlay === 'settings'
          ? [
              h('div', { key: 'scrim2', className: 'pb-scrim', onClick: () => setOverlay(null) }),
              h(SettingsPanel, {
                key: 'settings',
                t,
                settings,
                onSettings: applySettings,
                onClose: () => setOverlay(null),
              }),
            ]
          : null,
        overlay === 'notes'
          ? [
              h('div', { key: 'scrim3', className: 'pb-scrim', onClick: () => setOverlay(null) }),
              h(NoteDrawer, {
                key: 'notes',
                t,
                notes,
                status: notesStatus,
                error: notesError,
                onClose: () => setOverlay(null),
                onReload: loadNotes,
                onDelete: deleteNote,
                onOpenAll: props.onOpenNotes,
                onJump: (note) => {
                  setOverlay(null);
                  const index = Number(note.chapterIndex);
                  if (Number.isFinite(index) && index >= 0) {
                    pendingFocus.current = note.quote || '';
                    focusedOnce.current = -1;
                    loadChapter(index, 0);
                  }
                },
              }),
            ]
          : null,
        selection
          ? h(SelectBar, {
              key: 'selbar',
              t,
              selection,
              onAsk: askAi,
              onNote: noteSelection,
              onCopy: copyText,
            })
          : null,
        ai
          ? h(AiCard, {
              key: 'ai',
              t,
              ai,
              onClose: () => setAi(null),
              onCopyAnswer: () => copyText(ai.answer),
              onSaveAnswer: saveAnswer,
            })
          : null,
      );
    }

    const MemoReader = typeof React.memo === 'function' ? React.memo(Reader) : Reader;

    /* ------------------------------------------------------------------ */
    /* Page                                                                */
    /* ------------------------------------------------------------------ */

    function makePage(t) {
      return function LamplitPage(props) {
        const tr = (props && typeof props.t === 'function' && props.t) || t;

        const [boot, setBoot] = useState({ status: 'loading', error: '' });
        const [data, setData] = useState({ shelf: [], providers: [], stats: {}, storage: null });
        const [settings, setSettings] = useState(DEFAULT_SETTINGS);
        const [view, setView] = useState('shelf');
        const [filter, setFilter] = useState('all');
        const [sourceFilter, setSourceFilter] = useState('all');
        const [query, setQuery] = useState('');
        const [density, setDensity] = useState('grid');
        const [sort, setSort] = useState('recent');
        const [notes, setNotes] = useState([]);
        const [notesStatus, setNotesStatus] = useState('idle');
        const [notesError, setNotesError] = useState('');
        const [notesScope, setNotesScope] = useState('all');
        const [notesBookId, setNotesBookId] = useState('');
        const [notesQuery, setNotesQuery] = useState('');
        const [importing, setImporting] = useState(null);
        const [importError, setImportError] = useState('');
        const [sheet, setSheet] = useState(false);
        const [toast, setToast] = useState('');
        const [session, setSession] = useState(null);
        const [dragDepth, setDragDepth] = useState(0);
        const [busy, setBusy] = useState('');
        const [chapterTitle, setChapterTitle] = useState('');

        const fileRef = useRef(null);
        const searchRef = useRef(null);
        const toastTimer = useRef(null);
        const dragRef = useRef(0);
        const aliveRef = useRef(true);

        const say = useCallback((message) => {
          if (!message) return;
          setToast(message);
          if (toastTimer.current) clearTimeout(toastTimer.current);
          toastTimer.current = setTimeout(() => {
            if (aliveRef.current) setToast('');
          }, 2600);
        }, []);

        useEffect(() => {
          aliveRef.current = true;
          return () => {
            aliveRef.current = false;
            if (toastTimer.current) clearTimeout(toastTimer.current);
          };
        }, []);

        /* ---------------- 数据 ---------------- */

        const loadState = useCallback(async () => {
          setBoot((current) => ({ status: current.status === 'ready' ? 'ready' : 'loading', error: '' }));
          try {
            const res = await call('/state');
            if (!aliveRef.current) return;
            setData({
              shelf: Array.isArray(res.shelf) ? res.shelf : [],
              providers: Array.isArray(res.providers) ? res.providers : [],
              stats: res.stats && typeof res.stats === 'object' ? res.stats : {},
              storage: res.storage || null,
            });
            setSettings(normalizeSettings(res.settings));
            setBoot({ status: 'ready', error: '' });
          } catch (error) {
            if (!aliveRef.current) return;
            setBoot({ status: 'error', error: errorText(error) });
          }
        }, []);

        const loadNotes = useCallback(async () => {
          setNotesStatus((current) => (current === 'ready' ? current : 'loading'));
          setNotesError('');
          try {
            const res = await call('/notes');
            if (!aliveRef.current) return;
            const list = Array.isArray(res.notes) ? res.notes.slice() : [];
            list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            setNotes(list);
            setNotesStatus('ready');
          } catch (error) {
            if (!aliveRef.current) return;
            setNotesError(errorText(error));
            setNotesStatus('error');
          }
        }, []);

        useEffect(() => {
          loadState();
          loadNotes();
        }, [loadState, loadNotes]);

        const refreshAfterReading = useCallback(() => {
          loadState();
          loadNotes();
        }, [loadState, loadNotes]);

        const patchSettings = useCallback(
          async (patch) => {
            setSettings((current) => normalizeSettings(Object.assign({}, current, patch)));
            try {
              const res = await post('/settings', { patch });
              if (aliveRef.current && res && res.settings) setSettings(normalizeSettings(res.settings));
            } catch (error) {
              if (aliveRef.current) say(tr('toast.failed', { error: errorText(error) }));
            }
          },
          [say, tr],
        );

        const replaceBook = useCallback((book) => {
          if (!book) return;
          setData((current) => {
            const shelf = current.shelf.slice();
            const at = shelf.findIndex((item) => item.id === book.id);
            if (at >= 0) shelf[at] = book;
            else shelf.unshift(book);
            return Object.assign({}, current, { shelf });
          });
        }, []);

        /* ---------------- 导入 ---------------- */

        const importFile = useCallback(
          async (file) => {
            if (!file) return;
            setImporting({ name: file.name });
            setImportError('');
            try {
              const base64 = await readFileAsBase64(file);
              const res = await post('/import', { name: file.name, dataBase64: base64 });
              if (!aliveRef.current) return;
              await loadState();
              if (!aliveRef.current) return;
              say(tr('shelf.imported', { title: (res.book && res.book.title) || file.name }));
            } catch (error) {
              if (aliveRef.current) setImportError(errorText(error));
            } finally {
              if (aliveRef.current) setImporting(null);
            }
          },
          [loadState, say, tr],
        );

        const importPath = useCallback(
          async (value) => {
            const path = String(value || '').trim();
            if (path === '') return;
            setImporting({ name: path.split('/').pop() || path });
            setImportError('');
            try {
              const res = await post('/import-path', { path });
              if (!aliveRef.current) return;
              await loadState();
              if (!aliveRef.current) return;
              say(tr('shelf.imported', { title: (res.book && res.book.title) || path }));
            } catch (error) {
              if (aliveRef.current) setImportError(errorText(error));
            } finally {
              if (aliveRef.current) setImporting(null);
            }
          },
          [loadState, say, tr],
        );

        const onFileChange = (event) => {
          const file = event.target.files && event.target.files[0];
          event.target.value = '';
          if (file) importFile(file);
        };

        const onDragEnter = (event) => {
          if (!event.dataTransfer || Array.prototype.indexOf.call(event.dataTransfer.types || [], 'Files') < 0) return;
          event.preventDefault();
          dragRef.current += 1;
          setDragDepth(dragRef.current);
        };
        const onDragOver = (event) => {
          if (!event.dataTransfer || Array.prototype.indexOf.call(event.dataTransfer.types || [], 'Files') < 0) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = 'copy';
        };
        const onDragLeave = () => {
          dragRef.current = Math.max(0, dragRef.current - 1);
          setDragDepth(dragRef.current);
        };
        const onDrop = (event) => {
          if (!event.dataTransfer) return;
          event.preventDefault();
          dragRef.current = 0;
          setDragDepth(0);
          const file = event.dataTransfer.files && event.dataTransfer.files[0];
          if (file) importFile(file);
        };

        /* ---------------- 导出 / 复制 ---------------- */

        const exportPath = useCallback((kind, bookId) => {
          if (kind === 'shelf') return '/shelf/export';
          return '/notes/export' + (bookId ? '?bookId=' + encodeURIComponent(bookId) : '');
        }, []);

        const runExport = useCallback(
          async (kind, bookId) => {
            setBusy('export');
            try {
              const res = await call(exportPath(kind, bookId));
              saveMarkdown(res.filename, res.markdown);
              say(tr('toast.exported', { name: res.filename || '' }));
            } catch (error) {
              say(errorText(error));
            } finally {
              if (aliveRef.current) setBusy('');
            }
          },
          [exportPath, say, tr],
        );

        const runCopy = useCallback(
          async (kind, bookId) => {
            setBusy('copy');
            try {
              const res = await call(exportPath(kind, bookId));
              await copyToClipboard(res.markdown);
              say(tr('toast.copied'));
            } catch (error) {
              say(errorText(error));
            } finally {
              if (aliveRef.current) setBusy('');
            }
          },
          [exportPath, say, tr],
        );

        /* ---------------- 书 / 笔记 ---------------- */

        const openBook = useCallback((book) => {
          setSession({ book, focusQuote: '' });
        }, []);

        const resolveBook = useCallback(
          (bookId, chapterIndex, fallbackTitle) => {
            const found = data.shelf.find((item) => item.id === bookId);
            if (found) return found;
            const index = Math.max(0, Number(chapterIndex) || 0);
            return {
              id: bookId,
              title: fallbackTitle || '',
              author: '',
              source: 'local',
              sourceId: null,
              format: 'md',
              chapterCount: index + 1,
              chars: 0,
              addedAt: 0,
              lastOpenedAt: 0,
              finished: false,
              notes: 0,
              progress: { chapterIndex: index, percent: 0, charsRead: 0, updatedAt: 0 },
            };
          },
          [data.shelf],
        );

        const openFromNote = useCallback(
          (note) => {
            const book = resolveBook(note.bookId, note.chapterIndex, note.bookTitle);
            setSession({ book, focusQuote: note.quote || '' });
          },
          [resolveBook],
        );

        const removeBook = useCallback(
          async (book) => {
            try {
              await del('/book/' + encodeURIComponent(book.id));
              if (!aliveRef.current) return;
              setData((current) => Object.assign({}, current, { shelf: current.shelf.filter((item) => item.id !== book.id) }));
              say(tr('toast.removed', { title: book.title }));
            } catch (error) {
              if (aliveRef.current) say(tr('toast.failed', { error: errorText(error) }));
            }
          },
          [say, tr],
        );

        const toggleFinished = useCallback(
          async (book, finished) => {
            try {
              const res = await post('/book/' + encodeURIComponent(book.id) + '/finished', { finished });
              if (!aliveRef.current) return;
              if (res.book) replaceBook(res.book);
              say(tr(finished ? 'toast.finished' : 'toast.unfinished'));
            } catch (error) {
              if (aliveRef.current) say(tr('toast.failed', { error: errorText(error) }));
            }
          },
          [replaceBook, say, tr],
        );

        const removeNote = useCallback(
          async (note) => {
            try {
              await del('/notes/' + encodeURIComponent(note.id));
              if (!aliveRef.current) return;
              setNotes((list) => list.filter((item) => item.id !== note.id));
              say(tr('notes.deleted'));
              loadState();
            } catch (error) {
              if (aliveRef.current) say(errorText(error));
            }
          },
          [loadState, say, tr],
        );

        const onExitReader = useCallback(() => {
          setSession(null);
          refreshAfterReading();
        }, [refreshAfterReading]);

        const openNotesPage = useCallback((book) => {
          if (book && book.id) {
            setNotesScope('book');
            setNotesBookId(book.id);
          } else {
            setNotesScope('all');
          }
          setSession(null);
          setView('notes');
          refreshAfterReading();
        }, [refreshAfterReading]);

        /* ---------------- 来源 ---------------- */

        const connectProvider = useCallback(
          async (id, cookie) => {
            const res = await post('/provider/' + id + '/login', { cookie });
            if (!aliveRef.current) return;
            setData((current) =>
              Object.assign({}, current, {
                providers: current.providers.map((item) => (item.id === id ? res.provider : item)),
              }),
            );
            say(tr('toast.providerConnected', { label: tr(id === 'weread' ? 'filter.weread' : 'filter.fanqie') }));
          },
          [say, tr],
        );

        const disconnectProvider = useCallback(
          async (id) => {
            const res = await post('/provider/' + id + '/logout');
            if (!aliveRef.current) return;
            setData((current) =>
              Object.assign({}, current, {
                providers: current.providers.map((item) => (item.id === id ? res.provider : item)),
              }),
            );
            say(tr('toast.providerDisconnected', { label: tr(id === 'weread' ? 'filter.weread' : 'filter.fanqie') }));
          },
          [say, tr],
        );

        const syncProvider = useCallback(
          async (id) => {
            const res = await post('/provider/' + id + '/sync');
            if (!aliveRef.current) return;
            await loadState();
            if (!aliveRef.current) return;
            say(tr('source.syncResult', { added: fmtNumber(res.added), updated: fmtNumber(res.updated) }));
          },
          [loadState, say, tr],
        );

        const searchProvider = useCallback((id, q) => call('/provider/' + id + '/search?q=' + encodeURIComponent(q)), []);

        const openProviderBook = useCallback(
          async (id, item) => {
            const res = await post('/provider/' + id + '/open', {
              bookId: item.bookId,
              title: item.title,
              author: item.author,
            });
            if (!aliveRef.current) return;
            await loadState();
            if (!aliveRef.current) return;
            if (res.book) openBook(res.book);
          },
          [loadState, openBook],
        );

        /* ---------------- 派生 ---------------- */

        const shelf = data.shelf;
        const stats = data.stats || {};

        const counts = useMemo(() => {
          const finished = shelf.filter((book) => book.finished).length;
          const reading = shelf.filter((book) => {
            if (book.finished) return false;
            const progress = book.progress || {};
            return (book.lastOpenedAt || 0) > 0 || (progress.chapterIndex || 0) > 0 || (progress.percent || 0) > 0;
          }).length;
          return { all: shelf.length, reading, finished, notes: notes.length };
        }, [shelf, notes.length]);

        const sourceCounts = useMemo(() => {
          const counts = { all: shelf.length, weread: 0, fanqie: 0, local: 0 };
          for (const book of shelf) {
            if (book.source === 'weread') counts.weread += 1;
            else if (book.source === 'fanqie') counts.fanqie += 1;
            else counts.local += 1;
          }
          return counts;
        }, [shelf]);

        const filteredBooks = useMemo(() => {
          const needle = query.trim().toLowerCase();
          const list = shelf
            .filter((book) => {
              if (filter === 'finished') return !!book.finished;
              if (filter === 'reading') {
                if (book.finished) return false;
                const progress = book.progress || {};
                return (book.lastOpenedAt || 0) > 0 || (progress.chapterIndex || 0) > 0 || (progress.percent || 0) > 0;
              }
              return true;
            })
            .filter((book) => {
              if (sourceFilter === 'all') return true;
              if (sourceFilter === 'local') return book.source !== 'weread' && book.source !== 'fanqie';
              return book.source === sourceFilter;
            })
            .filter((book) => {
              if (needle === '') return true;
              return (
                String(book.title || '').toLowerCase().indexOf(needle) >= 0 ||
                String(book.author || '').toLowerCase().indexOf(needle) >= 0
              );
            });
          const sorted = list.slice();
          if (sort === 'title') sorted.sort((a, b) => String(a.title || '').localeCompare(String(b.title || '')));
          else if (sort === 'added') sorted.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
          else
            sorted.sort(
              (a, b) => Math.max(b.lastOpenedAt || 0, b.addedAt || 0) - Math.max(a.lastOpenedAt || 0, a.addedAt || 0),
            );
          return sorted;
        }, [shelf, filter, sourceFilter, query, sort]);

        const continueBook = useMemo(() => {
          const opened = shelf.filter((book) => !book.finished && (book.lastOpenedAt || 0) > 0);
          if (opened.length === 0) return null;
          return opened.slice().sort((a, b) => (b.lastOpenedAt || 0) - (a.lastOpenedAt || 0))[0];
        }, [shelf]);

        const continueKey = continueBook
          ? continueBook.id + ':' + String((continueBook.progress && continueBook.progress.chapterIndex) || 0)
          : '';

        useEffect(() => {
          setChapterTitle('');
          if (!continueBook) return undefined;
          let live = true;
          (async () => {
            try {
              const res = await call('/book/' + encodeURIComponent(continueBook.id));
              if (!live || !aliveRef.current) return;
              const index = clamp(
                (continueBook.progress && continueBook.progress.chapterIndex) || 0,
                0,
                Math.max(0, (res.toc || []).length - 1),
              );
              const entry = (res.toc || [])[index];
              if (entry && entry.title) setChapterTitle(entry.title);
            } catch (error) {
              /* 拿不到章名就只显示章号 */
            }
          })();
          return () => {
            live = false;
          };
        }, [continueKey]);

        const pageNotes = useMemo(() => {
          const scoped = notesScope === 'book' && notesBookId ? notes.filter((note) => note.bookId === notesBookId) : notes;
          const needle = notesQuery.trim().toLowerCase();
          if (needle === '') return scoped;
          return scoped.filter((note) => {
            const haystack = [note.quote, note.note, note.bookTitle, note.chapterTitle]
              .map((item) => String(item || '').toLowerCase())
              .join('\n');
            return haystack.indexOf(needle) >= 0;
          });
        }, [notes, notesScope, notesBookId, notesQuery]);

        const bookOf = useCallback(
          (bookId, title) => data.shelf.find((item) => item.id === bookId) || { id: bookId, title, author: '' },
          [data.shelf],
        );

        /* ---------------- 快捷键 ---------------- */

        useEffect(() => {
          const onKeyDown = (event) => {
            if (event.key !== 'Escape' || session) return;
            if (sheet) setSheet(false);
          };
          window.addEventListener('keydown', onKeyDown);
          return () => window.removeEventListener('keydown', onKeyDown);
        }, [session, sheet]);

        /* ---------------- 书架 ---------------- */

        const dragging = dragDepth > 0;

        const shelfBody =
          boot.status === 'loading'
            ? h(
                'ul',
                { className: 'pb-grid' },
                [0, 1, 2, 3, 4, 5, 6, 7].map((index) => h('div', { key: index, className: 'pb-skel' })),
              )
            : boot.status === 'error'
              ? h(
                  'div',
                  { className: 'pb-error' },
                  h(IconAlert, { size: 16 }),
                  h(
                    'div',
                    null,
                    h('h3', null, tr('shelf.errorTitle')),
                    h('p', null, boot.error),
                    h('button', { type: 'button', className: 'pb-btn', style: { marginTop: 8 }, onClick: loadState }, tr('shelf.retry')),
                  ),
                )
              : shelf.length === 0
                ? h(EmptyShelf, { t: tr, onImport: () => fileRef.current && fileRef.current.click(), onSources: () => setSheet(true) })
                : [
                    h(SourceBar, {
                      key: 'sources',
                      t: tr,
                      counts: sourceCounts,
                      value: sourceFilter,
                      providers: data.providers,
                      onPick: (key, online) => {
                        if (key === 'all' || !online) {
                          setSourceFilter(key);
                          return;
                        }
                        const provider = (data.providers || []).find((item) => item.id === online);
                        if (provider && provider.connected && sourceCounts[online] > 0) {
                          setSourceFilter(key);
                          return;
                        }
                        // 没连、或连了但还没同步出书：先让人去「来源」里处理。
                        setSourceFilter('all');
                        setSheet(true);
                      },
                    }),
                    continueBook
                      ? h(ContinueBar, {
                          key: 'continue',
                          t: tr,
                          book: continueBook,
                          chapterTitle,
                          onOpen: openBook,
                        })
                      : null,
                    continueBook ? h('div', { key: 'divider', className: 'pb-divider' }) : null,
                    filteredBooks.length === 0
                      ? h(
                          'div',
                          { key: 'nomatch', className: 'pb-empty' },
                          h('h2', null, sourceFilter === 'all' ? tr('shelf.noMatch') : tr('shelf.sourceEmptyTitle')),
                          h('p', null, sourceFilter === 'all' ? tr('shelf.noMatchHint') : tr('shelf.sourceEmptyHint')),
                          h(
                            'div',
                            { className: 'pb-empty-actions' },
                            sourceFilter === 'all'
                              ? h(
                                  'button',
                                  { type: 'button', className: 'pb-btn', onClick: () => { setQuery(''); setFilter('all'); } },
                                  tr('filter.all'),
                                )
                              : h(
                                  'button',
                                  {
                                    type: 'button',
                                    className: 'pb-btn pb-btn-primary',
                                    onClick: () => setSheet(true),
                                  },
                                  tr('shelf.connectSources'),
                                ),
                          ),
                        )
                      : h(
                          'ul',
                          { key: 'grid', className: 'pb-grid', 'data-density': density },
                          filteredBooks.map((book) =>
                            h(BookCard, {
                              key: book.id,
                              t: tr,
                              book,
                              onOpen: openBook,
                              onDelete: removeBook,
                              onFinish: toggleFinished,
                            }),
                          ),
                        ),
                  ];

        const shelfView = h(
          'section',
          {
            className: 'pb-view',
            onDragEnter: onDragEnter,
            onDragOver: onDragOver,
            onDragLeave: onDragLeave,
            onDrop: onDrop,
          },
          h(
            'div',
            { className: 'pb-scroll' },
            h(
              'div',
              { className: 'pb-shell' },
              h(
                'div',
                { className: 'pb-main' },
                importing
                  ? h(
                      'div',
                      { className: 'pb-import-bar' },
                      h('span', { className: 'pb-spin' }),
                      tr('shelf.importing', { name: importing.name }),
                    )
                  : null,
                importError
                  ? h(
                      'div',
                      { className: 'pb-error' },
                      h(IconAlert, { size: 16 }),
                      h(
                        'div',
                        null,
                        h('h3', null, tr('shelf.errorTitle')),
                        h('p', null, importError),
                        h(
                          'button',
                          { type: 'button', className: 'pb-btn pb-btn-quiet', style: { marginTop: 6, height: 22, padding: 0 }, onClick: () => setImportError('') },
                          tr('nav.clear'),
                        ),
                      ),
                    )
                  : null,
                shelfBody,
              ),
              h(Rail, {
                t: tr,
                stats,
                notes,
                onOpenNote: openFromNote,
                onAllNotes: () => openNotesPage(null),
                onStats: () => setView('stats'),
                onExportShelf: () => runExport('shelf'),
              }),
            ),
          ),
          dragging
            ? h('div', { className: 'pb-drop' }, h('strong', null, tr('shelf.dropTitle')), h('span', null, tr('shelf.dropHint')))
            : null,
        );

        return h(
          'div',
          { className: 'pb-root' },
          h('style', null, CSS),
          session
            ? null
            : h(TopBar, {
                t: tr,
                view,
                onBack: () => setView('shelf'),
                filter,
                onFilter: setFilter,
                counts,
                query,
                onQuery: setQuery,
                searchRef,
                density,
                onDensity: setDensity,
                sort,
                onSort: setSort,
                onImport: () => fileRef.current && fileRef.current.click(),
                onImportPath: importPath,
                onExportAll: () => runExport('notes'),
                onCopy: () => runCopy('notes'),
                onOpenNotes: () => openNotesPage(null),
                onOpenStats: () => setView('stats'),
                onSources: () => setSheet(true),
              }),
          h(
            'div',
            { className: 'pb-stage' },
            view === 'notes'
              ? h(NotesPage, {
                  t: tr,
                  notes: pageNotes,
                  status: notesStatus,
                  error: notesError,
                  scope: notesScope,
                  scopeBookId: notesBookId,
                  onScope: (scope) => setNotesScope(scope),
                  query: notesQuery,
                  onQuery: setNotesQuery,
                  onReload: loadNotes,
                  onOpen: openFromNote,
                  onDelete: removeNote,
                  onExportBook: (bookId) => runExport('notes', bookId),
                  bookOf,
                })
              : view === 'stats'
                ? h(StatsPage, {
                    t: tr,
                    stats,
                    finishedCount: counts.finished,
                    noteCount: counts.notes,
                    bookCount: counts.all,
                  })
                : shelfView,
            session
              ? h(MemoReader, {
                  t: tr,
                  book: session.book,
                  settings,
                  focusQuote: session.focusQuote,
                  onSettings: patchSettings,
                  onExit: onExitReader,
                  onBookUpdated: replaceBook,
                  onToggleFinished: () => {
                    if (session) toggleFinished(session.book, !session.book.finished);
                  },
                  onToast: say,
                  onNotesChanged: refreshAfterReading,
                  onOpenNotes: () => openNotesPage(session ? session.book : null),
                })
              : null,
            sheet
              ? [
                  h('div', { key: 'scrim', className: 'pb-scrim', onClick: () => setSheet(false) }),
                  h(SourceSheet, {
                    key: 'sheet',
                    t: tr,
                    onRefresh: loadState,
                    onSay: say,
                    providers: data.providers,
                    onClose: () => setSheet(false),
                    onConnect: connectProvider,
                    onDisconnect: disconnectProvider,
                    onSync: syncProvider,
                    onSearch: searchProvider,
                    onOpenResult: openProviderBook,
                  }),
                ]
              : null,
            toast ? h('div', { className: 'pb-toast', role: 'status', 'aria-live': 'polite' }, toast) : null,
            h('input', {
              ref: fileRef,
              type: 'file',
              accept: FILE_ACCEPT,
              multiple: false,
              style: { display: 'none' },
              onChange: onFileChange,
            }),
          ),
        );
      };
    }

    function apply(ctx) {
      const effect = (factory, label) => {
        if (typeof ctx.effect === 'function') return ctx.effect(factory, label);
        return factory();
      };

      effect(() => ctx.locale.register(NS, 'zh', ZH), 'lamplit: zh dictionary');
      effect(() => ctx.locale.register(NS, 'en', EN), 'lamplit: en dictionary');

      const t = ctx.locale.bind(NS);
      const Page = makePage(t);

      ctx.slots.inject('sidebar.panellist', () =>
        ctx.slots.register(
          {
            name: 'sidebar.panellist',
            id: 'lamplit',
            order: 30,
            label: () => t('app.title'),
            locale: NS,
          },
          PanelIcon,
        ),
      );

      ctx.slots.inject('main', () =>
        ctx.slots.register(
          {
            name: 'main',
            key: 'lamplit',
            locale: NS,
          },
          Page,
        ),
      );
    }

    return {
      inject: ['slots', 'locale'],
      apply,
    };
  },
});
