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
      'nav.import': '导入',
      'nav.importFile': '选择文件…',
      'nav.importPath': '从本机路径导入…',
      'nav.importPathHint': '/Users/me/books/春夜.md',
      'nav.importPathGo': '导入',

      'filter.all': '全部',
      'filter.local': '本地',
      'filter.weread': '微信读书',
      'shelf.finished': '读完',
      'shelf.emptyTitle': '书架还是空的',
      'shelf.emptyBody': '把 Markdown、TXT 或 PDF 拖进这里，或者先连上你的微信读书、番茄小说。',
      'shelf.noMatch': '没有匹配的书',
      'shelf.noMatchHint': '换个关键词，或者把筛选拨回「全部」。',
      'shelf.dropTitle': '松手导入',
      'shelf.dropHint': '一次一本，按扩展名自动分派',
      'shelf.imported': '已导入《{title}》',
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
      'reader.reconnect': '重新连接微信读书',
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

      'view.home': '首页',
      'view.plaza': '广场',
      'view.settings': '设置',
      'cover.badgeWeread': '微信',

      'home.continue': '继续阅读',
      'home.wechatLine': '微信读书进度 {percent}% · 累计 {minutes} 分钟',
      'home.weekCard': '本周阅读',
      'home.weekdays': '一 二 三 四 五 六 日',
      'home.shelfCard': '书架',
      'home.unitBooks': '本',
      'home.unitNotes': '笔记',
      'home.booksCount': '{n} 本',
      'home.account': '账号',
      'home.notConnected': '未连接',
      'home.lastSync': '上次同步',
      'home.totalRead': '累计阅读',
      'home.hours': '{n} 小时',
      'home.sync': '同步书架',
      'home.recentReading': '最近在读',
      'home.allBooks': '全部',
      'home.recentNotes': '最近笔记',
      'home.allNotes': '全部笔记',
      'home.footer': '笔记 {notes} 条 · 书架 {books} 本 · 微信读书累计 {hours} 小时',

      'shelf.sourceAll': '全部来源',
      'shelf.footer': '{books} 本 · 微信读书 {weread} · 本地 {local}',
      'shelf.emptyImport': '导入文件',
      'shelf.emptyConnect': '连接微信读书',
      'shelf.emptyPlaza': '去广场看看',

      'plaza.weread': '微信读书',
      'plaza.github': 'GitHub 书库',
      'plaza.open': '打开',
      'plaza.wereadPlaceholder': '搜书名、作者，例如 基督山伯爵',
      'plaza.search': '搜索',
      'plaza.searching': '搜索中…',
      'plaza.wereadHint': '搜微信读书书城；搜到的点「加入书架」就能读。没搜的时候下面是分类页里的书。',
      'plaza.wereadIdle': '书架里还没有微信读书的书。',
      'plaza.pickKeyword': '没想好搜什么？试试这些：',
      'plaza.fromShelf': '或者从你书架里接着读：',
      'plaza.noResult': '没搜到，换个词试试。',
      'plaza.error': '没搜成：',
      'plaza.words': '{n} 字',
      'plaza.add': '加入书架',
      'plaza.added': '已加入',
      'plaza.download': '下载',
      'plaza.downloading': '处理中…',
      'plaza.githubPlaceholder': '在已添加的仓库里搜文件名',
      'plaza.addRepo': '添加仓库',
      'plaza.repoPlaceholder': 'owner/repo 或 owner/repo#子目录',
      'plaza.adding': '添加中…',
      'plaza.githubHint': '你填仓库，我列它里面的 PDF / EPUB / TXT，点一下下载到本地书架。',
      'plaza.githubFoot': '支持子目录：填 owner/repo#books 就只列 books/ 下面的文件。私有仓库需要在设置里填 token。',
      'plaza.noRepo': '还没添加仓库。点「添加仓库」，填一个 owner/repo 就行。',
      'plaza.refresh': '刷新目录',
      'plaza.loadMore': '再显示 50 个（还剩 {n}）',
      'plaza.fileCount': '共 {n} 个文件',
      'plaza.shuffle': '换一批',
      'plaza.prevPage': '上一页',
      'plaza.nextPage': '下一页',
      'plaza.loading': '读取中…',
      'plaza.filesError': '目录没读出来：',
      'plaza.noFiles': '这个仓库里没有可读的 PDF / EPUB / TXT。',

      'settings.sources': '来源',
      'settings.sourcesDesc': '账号只存在本机 ~/.dsh/lamplit，不上传。',
      'settings.connected': '已连接',
      'settings.disconnected': '未连接',
      'settings.wereadLine': '账号 {account} · 上次同步 {time} · 书架 {n} 本',
      'settings.wereadEmpty': '还没有连接微信读书。点「重新扫码」把账号连上。',
      'settings.wereadLongSession': '长期会话：票会自动续期，不用再扫。',
      'settings.wereadShortSession': '短期会话：一两天后要重新扫码。点「重新扫码」会自动补齐长期凭据。',
      'settings.rescan': '重新扫码',
      'settings.disconnect': '断开',
      'settings.github': 'GitHub 书库',
      'settings.githubDesc': '填仓库地址，就能在广场里浏览它里面的 PDF / EPUB / TXT。',
      'settings.removeRepo': '移除',
      'settings.addRepo': '添加',
      'settings.manage': '管理',
      'settings.repoModalTitle': 'GitHub 书库',
      'settings.repoModalHint': '仓库里的 PDF / EPUB / TXT 会出现在广场；私有仓库要填 token。',
      'settings.tokenDesc': 'GitHub token（可选）：把读取限额从 60 次/时提到 5000。',
      'settings.close': '关闭',
      'settings.githubSummary': '{n} 个仓库 · {token}',
      'settings.tokenOn': 'token 已配置',
      'settings.tokenOff': '未配 token',
      'settings.addRepoTitle': '添加 GitHub 仓库',
      'settings.addRepoHint': '写 owner/repo，或 owner/repo#子目录。仓库必须是公开的，私有仓库要填 token。',
      'settings.cancel': '取消',
      'settings.tokenSet': 'GitHub token 已保存（留空则不改）',
      'settings.tokenPlaceholder': 'GitHub token（可选，把读取限额从 60 次/时提到 5000）',
      'settings.saveToken': '保存',
      'settings.reading': '阅读',
      'settings.readingDesc': '这里是默认值，阅读器里改只影响当前这本书。',
      'settings.paper': '默认纸张',
      'settings.paperDesc': '打开新书时用哪一套',
      'settings.font': '字体',
      'settings.fontDesc': '衬线适合长文，黑体适合屏幕',
      'settings.metrics': '字号 · 行距 · 每行字数',
      'settings.metricsValue': '{size}px · {leading} · {measure} 字',
      'settings.mode': '翻页方式',
      'settings.modeDesc': '分页像纸书，滚动更自由',
      'settings.autohide': '工具条自动隐藏',
      'settings.autohideDesc': '2.5 秒无操作后淡出',
      'settings.data': '数据',
      'settings.dataDesc': '都在本机，想搬走随时导出。',
      'settings.libraryPath': '书库目录',
      'settings.libraryPathUnknown': '还没建目录',
      'settings.copyPath': '复制路径',
      'settings.export': '导出',
      'settings.exportDesc': '书单与笔记都是 Markdown',
      'settings.exportShelf': '导出书单',
      'settings.exportNotes': '导出全部笔记',
      'settings.backup': '备份',
      'settings.backupDesc': '书目 + 笔记 + 设置，不含正文缓存',
      'settings.backupSave': '导出备份',
      'settings.backupRestore': '从备份恢复',
      'settings.pending': '等 host 提供接口',
      'settings.cache': '章节缓存',
      'settings.cacheDesc': '在线书的正文缓存',
      'settings.cacheClear': '清空缓存',
      'settings.about': '关于',
      'settings.version': '版本 {version}',
      'settings.aboutDesc': 'MIT · github.com/lysforge/dsh-lamplit',
      'settings.repo': '打开仓库',
      'settings.checkUpdate': '检查更新',
      'settings.upToDate': '已是最新（{version}）',
      'settings.updateReady': '有新版本 {version}',

      'toast.backupSaved': '备份已导出',
      'time.today': '今天',
      'time.yesterday': '昨天',

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
      'rail.streak': '连续 {n} 天',
      'rail.noteMeta': '{book} · 第 {n} 章',

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
      'stats.wechatTime': '微信读书累计 {time}',

      'view.shelf': '书架',
      'view.discover': '发现',
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
      'nav.import': 'Import',
      'nav.importFile': 'Choose a file…',
      'nav.importPath': 'Import from a path…',
      'nav.importPathHint': '/Users/me/books/spring.md',
      'nav.importPathGo': 'Import',

      'filter.all': 'All',
      'filter.local': 'Local',
      'filter.weread': 'WeRead',
      'shelf.finished': 'Finished',
      'shelf.emptyTitle': 'Your shelf is empty',
      'shelf.emptyBody': 'Drop a Markdown, TXT or PDF file here, or connect WeRead and Fanqie first.',
      'shelf.noMatch': 'No book matches',
      'shelf.noMatchHint': 'Try another keyword, or switch the filter back to All.',
      'shelf.dropTitle': 'Drop to import',
      'shelf.dropHint': 'One file at a time, dispatched by extension',
      'shelf.imported': 'Imported “{title}”',
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
      'reader.reconnect': 'Reconnect WeRead',
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

      'view.home': 'Home',
      'view.plaza': 'Plaza',
      'view.settings': 'Settings',
      'cover.badgeWeread': 'WeRead',

      'home.continue': 'Continue reading',
      'home.wechatLine': 'WeRead {percent}% · {minutes} min so far',
      'home.weekCard': 'This week',
      'home.weekdays': 'M T W T F S S',
      'home.shelfCard': 'Shelf',
      'home.unitBooks': 'books',
      'home.unitNotes': 'notes',
      'home.booksCount': '{n}',
      'home.account': 'Account',
      'home.notConnected': 'Not connected',
      'home.lastSync': 'Last sync',
      'home.totalRead': 'Total read',
      'home.hours': '{n} h',
      'home.sync': 'Sync shelf',
      'home.recentReading': 'Recently read',
      'home.allBooks': 'All',
      'home.recentNotes': 'Recent notes',
      'home.allNotes': 'All notes',
      'home.footer': '{notes} notes · {books} books · {hours} h on WeRead',

      'shelf.sourceAll': 'All sources',
      'shelf.footer': '{books} books · {weread} WeRead · {local} local',
      'shelf.emptyImport': 'Import files',
      'shelf.emptyConnect': 'Connect WeRead',
      'shelf.emptyPlaza': 'Browse plaza',

      'plaza.weread': 'WeRead',
      'plaza.github': 'GitHub library',
      'plaza.wereadPlaceholder': 'Search title, author, keyword',
      'plaza.search': 'Search',
      'plaza.searching': 'Searching…',
      'plaza.wereadHint': 'Search the WeRead store and add a result to your shelf. Without a query you get the category picks.',
      'plaza.wereadIdle': 'Search a book to see what WeRead has.',
      'plaza.noResult': 'Nothing found. Try another word.',
      'plaza.error': 'Search failed: ',
      'plaza.words': '{n} chars',
      'plaza.add': 'Add to shelf',
      'plaza.added': 'Added',
      'plaza.download': 'Download',
      'plaza.downloading': 'Working…',
      'plaza.githubPlaceholder': 'Filter files in added repos',
      'plaza.addRepo': 'Add repo',
      'plaza.repoPlaceholder': 'owner/repo or owner/repo#subpath',
      'plaza.adding': 'Adding…',
      'plaza.githubHint': 'Give me a repo and I list its PDF / EPUB / TXT files; one click imports it to your shelf.',
      'plaza.githubFoot': 'Subpaths work: owner/repo#books lists only files under books/. Private repos need a token in Settings.',
      'plaza.noRepo': 'No repos yet. Hit “Add repo” and paste owner/repo.',
      'plaza.refresh': 'Refresh',
      'plaza.loadMore': 'Show 50 more ({n} left)',
      'plaza.fileCount': '{n} files',
      'plaza.shuffle': 'Shuffle',
      'plaza.prevPage': 'Previous page',
      'plaza.nextPage': 'Next page',
      'plaza.loading': 'Loading…',
      'plaza.filesError': 'Could not read the listing: ',
      'plaza.noFiles': 'No readable PDF / EPUB / TXT in this repo.',

      'settings.sources': 'Sources',
      'settings.sourcesDesc': 'Accounts stay in ~/.dsh/lamplit on this machine.',
      'settings.connected': 'Connected',
      'settings.disconnected': 'Not connected',
      'settings.wereadLine': 'Account {account} · synced {time} · {n} books',
      'settings.wereadEmpty': 'WeRead is not connected yet. Hit “Re-scan” to link it.',
      'settings.wereadLongSession': 'Long-lived session: the ticket renews itself.',
      'settings.wereadShortSession': 'Short-lived session: you will need to scan again in a day or two. Scanning again picks up the long-lived credential.',
      'settings.rescan': 'Re-scan',
      'settings.disconnect': 'Disconnect',
      'settings.github': 'GitHub library',
      'settings.githubDesc': 'Add a repo and browse its PDF / EPUB / TXT from the plaza.',
      'settings.removeRepo': 'Remove',
      'settings.addRepo': 'Add',
      'settings.manage': 'Manage',
      'settings.repoModalTitle': 'GitHub library',
      'settings.repoModalHint': 'PDF / EPUB / TXT in these repos show up in the plaza. Private repos need a token.',
      'settings.tokenDesc': 'GitHub token (optional): raises the API limit from 60 to 5000 per hour.',
      'settings.close': 'Close',
      'settings.githubSummary': '{n} repos · {token}',
      'settings.tokenOn': 'token set',
      'settings.tokenOff': 'no token',
      'settings.addRepoTitle': 'Add a GitHub repo',
      'settings.addRepoHint': 'Use owner/repo, or owner/repo#subfolder. Public repos work out of the box; private ones need a token.',
      'settings.cancel': 'Cancel',
      'settings.tokenSet': 'Token saved (leave blank to keep it)',
      'settings.tokenPlaceholder': 'GitHub token (optional, 60 → 5000 requests/hour)',
      'settings.saveToken': 'Save',
      'settings.reading': 'Reading',
      'settings.readingDesc': 'These are defaults; changes inside the reader apply to that book only.',
      'settings.paper': 'Default paper',
      'settings.paperDesc': 'What a new book opens with',
      'settings.font': 'Typeface',
      'settings.fontDesc': 'Serif for long text, sans for screens',
      'settings.metrics': 'Size · leading · characters',
      'settings.metricsValue': '{size}px · {leading} · {measure} chars',
      'settings.mode': 'Paging',
      'settings.modeDesc': 'Paged reads like paper, scroll is freer',
      'settings.autohide': 'Auto-hide toolbar',
      'settings.autohideDesc': 'Fades out after 2.5s idle',
      'settings.data': 'Data',
      'settings.dataDesc': 'All local. Export anytime.',
      'settings.libraryPath': 'Library folder',
      'settings.libraryPathUnknown': 'Not created yet',
      'settings.copyPath': 'Copy path',
      'settings.export': 'Export',
      'settings.exportDesc': 'Shelf and notes as Markdown',
      'settings.exportShelf': 'Export shelf',
      'settings.exportNotes': 'Export all notes',
      'settings.backup': 'Backup',
      'settings.backupDesc': 'Books, notes, settings — no text cache',
      'settings.backupSave': 'Export backup',
      'settings.backupRestore': 'Restore backup',
      'settings.pending': 'Waiting on a host endpoint',
      'settings.cache': 'Chapter cache',
      'settings.cacheDesc': 'Cached text of online books',
      'settings.cacheClear': 'Clear cache',
      'settings.about': 'About',
      'settings.version': 'Version {version}',
      'settings.aboutDesc': 'MIT · github.com/lysforge/dsh-lamplit',
      'settings.repo': 'Open repo',
      'settings.checkUpdate': 'Check for updates',
      'settings.upToDate': 'Up to date ({version})',
      'settings.updateReady': 'Version {version} is available',

      'toast.backupSaved': 'Backup exported',
      'time.today': 'Today',
      'time.yesterday': 'Yesterday',

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
      'rail.streak': '{n}-day streak',
      'rail.noteMeta': '{book} · Chapter {n}',

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
      'stats.wechatTime': 'WeChat Reading total {time}',

      'view.shelf': 'Shelf',
      'view.discover': 'Discover',
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
      '--pb-ink2:var(--dsw-alias-label-secondary);',
      '--pb-panel:var(--dsw-alias-bg-layer-1);--pb-panel2:var(--dsw-alias-bg-layer-2);',
      '--pb-cover-shadow:0 1px 3px rgba(0,0,0,.18);--pb-r-btn:8px;--pb-r-card:10px;--pb-r-chip:999px;',
      '-webkit-font-smoothing:antialiased}',
      '[data-platform="darwin"] .pb-root{--pb-frame-pad:var(--dsh-frame-top-clearance,0px)}',
      '.pb-root *,.pb-root *::before,.pb-root *::after{box-sizing:border-box}',
      '.pb-num{font-variant-numeric:tabular-nums}',

      /* ---------- 控件 ---------- */
      '.pb-btn{border:1px solid var(--pb-line);background:transparent;color:var(--dsw-alias-label-primary);',
      'border-radius:8px;height:32px;padding:0 12px;font:inherit;font-size:13px;line-height:1;cursor:pointer;',
      'display:inline-flex;align-items:center;gap:6px;white-space:nowrap;transition:background .15s ease,border-color .15s ease,color .15s ease}',
      '.pb-btn:hover{background:var(--dsw-alias-interactive-bg-hover)}',
      '.pb-btn:disabled{opacity:.45;cursor:default}',
      '.pb-btn-primary{background:var(--pb-accent);border-color:transparent;color:var(--dsw-alias-label-primary-foreground);font-weight:600}',
      '.pb-btn-primary:hover{background:var(--pb-accent);opacity:.9}',
      '.pb-btn-quiet{border-color:transparent;color:var(--pb-ink2);padding:0 8px}',
      '.pb-btn-quiet:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}',
      '.pb-iconbtn{width:32px;height:32px;padding:0;justify-content:center;border-radius:8px;border:1px solid transparent;',
      'background:transparent;color:var(--pb-ink2);display:inline-flex;align-items:center;cursor:pointer;font:inherit}',
      '.pb-iconbtn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}',
      '.pb-iconbtn[data-on="1"]{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}',
      '.pb-btn:focus-visible,.pb-iconbtn:focus-visible,.pb-tab:focus-visible,.pb-book:focus-visible,.pb-chip:focus-visible,',
      '.pb-scope:focus-visible,.pb-textlink:focus-visible,.pb-more:focus-visible,.pb-note-del:focus-visible,',
      '.pb-book-menu:focus-visible,.pb-sortbtn:focus-visible,.pb-pop-item:focus-visible,.pb-note-quote:focus-visible,',
      '.pb-continue:focus-visible,.pb-cfg-swatch:focus-visible,.pb-cfg-seg-opt:focus-visible,.pb-cfg-switch:focus-visible,',
      '.pb-srcchip:focus-visible,.pb-repo:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--pb-accent));outline-offset:2px}',
      '.pb-input{height:32px;border:1px solid transparent;border-radius:8px;background:var(--pb-panel2);',
      'color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;padding:0 10px;outline:none;min-width:0}',
      '.pb-input:focus{border-color:var(--pb-accent)}',
      '.pb-input::placeholder{color:var(--pb-mute)}',

      /* ---------- 顶栏 ---------- */
      '.pb-appbar{flex:none;height:56px;display:flex;align-items:center;gap:20px;padding:0 32px;',
      'border-bottom:1px solid var(--pb-line);background:var(--dsw-alias-bg-base);position:relative;z-index:6}',
      '.pb-wordmark{font-family:' + SERIF + ';font-size:13px;letter-spacing:.16em;color:var(--pb-mute);white-space:nowrap;flex:none}',
      '.pb-wordmark-rule{width:1px;height:12px;background:var(--pb-line);flex:none}',
      '.pb-tabs{display:flex;align-items:center;gap:22px;height:100%;flex:none}',
      '.pb-tab{position:relative;display:flex;align-items:center;gap:6px;height:100%;padding:0;border:0;background:none;',
      'font:inherit;font-size:14px;color:var(--pb-ink2);cursor:pointer;white-space:nowrap;flex:none;transition:color .15s ease}',
      '.pb-tab:hover{color:var(--dsw-alias-label-primary)}',
      '.pb-tab[data-on="1"]{color:var(--pb-accent);font-weight:600}',
      '.pb-tab[data-on="1"]::after{content:"";position:absolute;left:0;right:0;bottom:15px;height:2px;border-radius:2px;background:var(--pb-accent)}',
      '.pb-tab i{font-style:normal;font-size:12px;color:var(--pb-mute);font-weight:400}',
      '.pb-grow{flex:1}',
      '.pb-actions{margin-left:auto;display:flex;align-items:center;gap:8px;flex:none}',
      '.pb-search{position:relative;display:flex;align-items:center}',
      '.pb-search svg{position:absolute;left:10px;color:var(--pb-mute);pointer-events:none}',
      '.pb-search input{width:200px;height:32px;border:1px solid transparent;border-radius:8px;background:var(--pb-panel2);',
      'color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;padding:0 10px 0 30px;outline:none;transition:border-color .15s ease}',
      '.pb-search input:focus{border-color:var(--pb-accent)}',
      '.pb-search input::placeholder{color:var(--pb-mute)}',
      '.pb-pagehead{display:flex;align-items:center;gap:10px;min-width:0}',
      '.pb-back{width:24px;height:24px;flex:none;display:grid;place-items:center;border:0;background:none;color:var(--pb-mute);',
      'cursor:pointer;border-radius:4px;padding:0;margin-left:-6px}',
      '.pb-back:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}',
      '.pb-pagehead h1{margin:0;font-size:20px;font-weight:600;line-height:1.3;white-space:nowrap}',

      /* ---------- 弹层 ---------- */
      '.pb-pop{position:absolute;z-index:24;background:var(--pb-panel);border:1px solid var(--pb-line-strong);',
      'border-radius:8px;box-shadow:var(--dsw-elevation-panel);padding:4px;min-width:172px;animation:pb-rise .14s ease}',
      '@keyframes pb-rise{from{opacity:0;transform:translateY(-3px)}to{opacity:1;transform:none}}',
      '.pb-pop-item{display:flex;width:100%;align-items:center;gap:8px;height:30px;padding:0 9px;border:0;border-radius:6px;',
      'background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;cursor:pointer;text-align:left;white-space:nowrap}',
      '.pb-pop-item:hover{background:var(--dsw-alias-interactive-bg-hover)}',
      '.pb-pop-item[data-on="1"]{color:var(--pb-accent);font-weight:600}',
      '.pb-pop-item[data-danger="1"]{color:var(--dsw-alias-state-error-primary)}',
      '.pb-pop-path{display:flex;gap:6px;padding:4px}',

      /* ---------- 布局 ---------- */
      '.pb-stage{position:relative;flex:1;min-height:0;display:flex;flex-direction:column}',
      '.pb-view{position:relative;flex:1;min-height:0;display:flex;flex-direction:column}',
      '.pb-scroll{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;padding:28px 0 48px;scrollbar-color:var(--dsw-alias-scrollbar-bg-l2) transparent}',
      '.pb-shell{max-width:1120px;margin:0 auto;padding:0 32px;display:flex;gap:32px;align-items:flex-start}',
      '.pb-main{flex:1;min-width:0}',
      '.pb-h1{margin:0 0 20px;font-size:20px;font-weight:600;letter-spacing:.01em}',

      /* ---------- 继续阅读 ---------- */
      '.pb-continue{display:flex;align-items:center;gap:24px;width:100%;padding:18px 0 24px;border:0;border-bottom:1px solid var(--pb-line);',
      'border-radius:0;background:none;font:inherit;color:inherit;text-align:left;cursor:pointer;margin:0 0 24px}',
      '.pb-continue:hover{background:transparent}',
      '.pb-continue:hover .pb-continue-title{color:var(--pb-accent)}',
      '.pb-continue-cover{width:88px;height:117px;flex:none;border-radius:4px;overflow:hidden;box-shadow:var(--pb-cover-shadow);position:relative}',
      '.pb-continue-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px}',
      '.pb-eyebrow{margin:0;font-size:12px;letter-spacing:.08em;color:var(--pb-mute)}',
      '.pb-continue-title{margin:0;font-family:' + SERIF + ';font-size:22px;font-weight:600;line-height:1.35;',
      'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;transition:color .15s ease}',
      '.pb-continue-sub{margin:0;font-size:13px;color:var(--pb-ink2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.pb-progress-row{display:flex;align-items:center;gap:12px;max-width:420px;margin-top:4px}',
      '.pb-progress{flex:1;height:3px;border-radius:2px;background:var(--pb-line);overflow:hidden}',
      '.pb-progress i{display:block;height:100%;background:var(--pb-accent);border-radius:2px;transition:width .3s ease}',
      '.pb-progress-label{font-size:13px;color:var(--pb-ink2);font-variant-numeric:tabular-nums;flex:none}',
      '.pb-continue-note{margin:0;font-size:12px;color:var(--pb-mute);font-variant-numeric:tabular-nums}',
      '@media (max-width:760px){.pb-continue{flex-wrap:wrap;gap:16px}}.pb-continue{--x:0}',

      /* ---------- 首页卡片 ---------- */
      '.pb-cards{display:grid;grid-template-columns:1.15fr 1fr .95fr;gap:20px;margin:0 0 32px}',
      '@media (max-width:980px){.pb-cards{grid-template-columns:1fr 1fr}.pb-cards>.pb-card:last-child{grid-column:1/-1}}',
      '@media (max-width:680px){.pb-cards{grid-template-columns:1fr}.pb-cards>.pb-card:last-child{grid-column:auto}}',
      '.pb-card{border:1px solid var(--pb-line);border-radius:10px;padding:16px 18px;background:var(--pb-panel);min-width:0}',
      '.pb-card h3{margin:0 0 12px;font-size:12px;font-weight:400;letter-spacing:.06em;color:var(--pb-mute)}',
      '.pb-card-click{cursor:pointer;transition:border-color .15s ease,background .15s ease}',
      '.pb-card-click:hover{border-color:var(--pb-line-strong);background:var(--pb-panel2)}',
      '.pb-big{font-size:26px;font-weight:600;line-height:1.2;font-variant-numeric:tabular-nums;margin:0}',
      '.pb-big small{font-size:13px;font-weight:400;color:var(--pb-mute);margin-left:4px}',
      '.pb-bars{display:flex;align-items:flex-end;gap:8px;height:56px;margin:14px 0 8px}',
      '.pb-bar{width:10px;flex:none;border-radius:2px 2px 0 0;background:color-mix(in srgb,var(--pb-accent) 22%,transparent);min-height:3px}',
      '.pb-bar[data-on="1"]{background:var(--pb-accent)}',
      '.pb-rowline{display:flex;justify-content:space-between;gap:12px;font-size:12px;color:var(--pb-ink2);padding:3px 0}',
      '.pb-rowline b{font-weight:400;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-primary)}',
      '.pb-kv{display:flex;gap:22px;margin-top:2px}',
      '.pb-kv div{display:flex;flex-direction:column;gap:2px}',
      '.pb-kv b{font-size:15px;font-weight:600;font-variant-numeric:tabular-nums}',
      '.pb-kv span{font-size:12px;color:var(--pb-mute)}',
      '.pb-sec{display:flex;align-items:baseline;justify-content:space-between;margin:0 0 14px}',
      '.pb-sec h2{margin:0;font-size:15px;font-weight:600}',
      '.pb-link{border:0;background:none;padding:0;font-size:12px;color:var(--pb-accent);cursor:pointer}',
      '.pb-link:hover{text-decoration:underline}',
      '.pb-strip{display:flex;gap:20px;overflow:hidden;margin:0 0 32px}',
      '.pb-mini{width:76px;flex:none;border:0;background:none;padding:0;font:inherit;color:inherit;text-align:left;cursor:pointer}',
      '.pb-mini .pb-cover-box{width:76px;height:101px;border-radius:4px;overflow:hidden;position:relative;box-shadow:var(--pb-cover-shadow);background:var(--pb-panel2);transition:transform .18s ease}',
      '.pb-mini:hover .pb-cover-box{transform:translateY(-2px)}',
      '.pb-mini p{margin:8px 0 0;font-size:12px;line-height:1.4;color:var(--pb-ink2);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}',
      '.pb-note{display:flex;gap:12px;padding:10px 0;border-bottom:1px solid var(--pb-line);width:100%;text-align:left;border-left:0;border-right:0;border-top:0;background:none;font:inherit;color:inherit;cursor:pointer}',
      '.pb-note:last-child{border-bottom:0}',
      '.pb-note:hover .pb-note-line{background:var(--pb-accent)}',
      '.pb-note-line{width:2px;border-radius:2px;flex:none;background:color-mix(in srgb,var(--pb-accent) 40%,transparent);transition:background .15s ease}',
      '.pb-note-body{min-width:0}',
      '.pb-note-body p{margin:0;font-size:13px;line-height:1.6;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.pb-note-body p.pb-note-sub{font-size:12px;color:var(--pb-mute);margin-top:4px}',
      '.pb-foot{margin:26px 0 0;font-size:12px;color:var(--pb-mute);font-variant-numeric:tabular-nums}',

      /* ---------- 书架 ---------- */
      '.pb-toolbar{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:0 0 22px}',
      '.pb-chip{height:28px;padding:0 10px;border-radius:8px;border:0;background:none;color:var(--pb-ink2);font:inherit;font-size:12px;',
      'display:inline-flex;align-items:center;gap:6px;cursor:pointer;white-space:nowrap}',
      '.pb-chip:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}',
      '.pb-chip[data-on="1"]{background:var(--pb-panel2);color:var(--dsw-alias-label-primary);font-weight:600}',
      '.pb-chip i{font-style:normal;color:var(--pb-mute);font-weight:400;font-variant-numeric:tabular-nums}',
      '.pb-chip-dot{width:5px;height:5px;border-radius:50%;background:var(--pb-accent);flex:none}',
      '.pb-toolbar .pb-grow{flex:1}',
      '.pb-sortbtn{height:28px;padding:0 8px;border:0;background:none;color:var(--pb-ink2);font:inherit;font-size:12px;',
      'cursor:pointer;display:inline-flex;align-items:center;gap:4px;border-radius:8px;white-space:nowrap}',
      '.pb-sortbtn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}',
      '.pb-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:28px 22px;margin:0;padding:0;list-style:none}',
      '@media (max-width:1100px){.pb-grid{grid-template-columns:repeat(4,1fr)}}',
      '@media (max-width:760px){.pb-grid{grid-template-columns:repeat(3,1fr);gap:20px 14px}}',
      '@media (max-width:520px){.pb-grid{grid-template-columns:repeat(2,1fr)}}',
      '.pb-grid[data-density="list"]{grid-template-columns:1fr;gap:12px}',
      '.pb-book{position:relative;display:flex;flex-direction:column;gap:8px;padding:0;border:0;background:none;',
      'font:inherit;color:inherit;text-align:left;cursor:pointer}',
      '.pb-book-cover{position:relative;width:100%;aspect-ratio:3/4;border-radius:4px;overflow:hidden;background:var(--pb-panel2);',
      'box-shadow:var(--pb-cover-shadow);transition:transform .18s ease}',
      '.pb-book:hover .pb-book-cover{transform:translateY(-2px)}',
      '.pb-book-title{margin:0;font-size:13px;font-weight:400;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;',
      '-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}',
      '.pb-book-meta{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--pb-mute);min-width:0;line-height:1.4;margin:0}',
      '.pb-book-meta em{font-style:normal;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}',
      '.pb-book-meta b{margin-left:auto;font-weight:400;font-variant-numeric:tabular-nums;flex:none}',
      '.pb-book-menu{position:absolute;top:6px;right:6px;width:24px;height:24px;border:0;border-radius:4px;background:rgba(0,0,0,.45);',
      'color:#fff;display:grid;place-items:center;opacity:0;cursor:pointer;padding:0;transition:opacity .15s ease}',
      '.pb-book:hover .pb-book-menu,.pb-book-menu[data-open="1"]{opacity:1}',
      '.pb-done-dot{position:absolute;top:6px;left:6px;width:14px;height:14px;border-radius:50%;background:rgba(0,0,0,.42);',
      'border:2px solid #fff;display:grid;place-items:center;color:#fff}',
      '.pb-grid[data-density="list"] .pb-book{flex-direction:row;align-items:center;gap:14px}',
      '.pb-grid[data-density="list"] .pb-book-cover{width:44px;height:59px;aspect-ratio:auto;flex:none}',
      '.pb-grid[data-density="list"] .pb-book-title{-webkit-line-clamp:1}',
      '.pb-grid[data-density="list"] .pb-book-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}',
      '.pb-book-body{display:flex;flex-direction:column;gap:4px;min-width:0}',

      /* ---------- 广场 ---------- */
      '.pb-srcbar{display:flex;gap:4px;margin:0 0 16px}',
      '.pb-modal{position:fixed;left:50%;top:22%;transform:translateX(-50%);width:min(480px,calc(100vw - 48px));',
      'background:var(--dsw-alias-bg-layer-1);border:1px solid var(--pb-line-strong);border-radius:12px;padding:20px;',
      'box-shadow:var(--dsw-elevation-panel);z-index:40}',
      '.pb-modal-list{display:flex;flex-direction:column;gap:2px;max-height:180px;overflow:auto;margin:6px 0 10px}',
      '.pb-modal-row{display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--pb-line);font-size:12px}',
      '.pb-modal-row:last-child{border-bottom:0}',
      '.pb-modal-row code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.pb-modal-row .pb-textlink{margin-left:auto}',
      '.pb-modal-add{display:flex;gap:8px;align-items:center}',
      '.pb-modal h3{margin:0 0 6px;font-size:15px;font-weight:600}',
      '.pb-modal-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}',
      '.pb-skel-row{display:flex;align-items:center;gap:14px;padding:9px 0;animation:pb-breathe 1.4s ease-in-out infinite}',
      '@keyframes pb-breathe{0%,100%{opacity:.55}50%{opacity:1}}',
      '.pb-skel-cover{width:44px;height:59px;border-radius:4px;flex:none;height:59px}',
      '.pb-skel-line{flex:1;height:14px;border-radius:4px}',
      '.pb-hintrow{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:2px 0 6px}',
      '.pb-pager{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--dsw-alias-label-secondary)}',
      '.pb-pagebtn{width:24px;height:24px;border-radius:6px;border:1px solid var(--pb-line-strong);background:none;',
      'color:var(--dsw-alias-label-secondary);font:inherit;line-height:1;cursor:pointer;display:inline-flex;align-items:center;justify-content:center}',
      '.pb-pagebtn:hover:not(:disabled){background:var(--dsw-interactive-bg-hover,var(--dsw-alias-interactive-bg-hover));color:var(--dsw-alias-label-primary)}',
      '.pb-pagebtn:disabled{opacity:.35;cursor:default}',
      '.pb-filerow{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:4px 0 10px;border-bottom:1px solid var(--pb-line);margin-bottom:6px}',
      '.pb-filerow-actions{display:flex;gap:14px;align-items:center}',
      '.pb-srcbtn{height:34px;padding:0 12px;border-radius:8px;border:1px solid var(--pb-line-strong);background:var(--panel2);',
      'color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;display:inline-flex;align-items:center;gap:8px;cursor:pointer;max-width:420px}',
      '.pb-srcbtn:hover{background:var(--dsw-alias-interactive-bg-hover)}',
      '.pb-srcchip{height:30px;padding:0 12px;border-radius:8px;border:1px solid transparent;background:none;color:var(--pb-ink2);',
      'font:inherit;font-size:13px;cursor:pointer}',
      '.pb-srcchip:hover{color:var(--dsw-alias-label-primary)}',
      '.pb-srcchip[data-on="1"]{background:var(--pb-panel2);color:var(--dsw-alias-label-primary);font-weight:600}',
      '.pb-srch{display:flex;gap:8px;margin:0 0 8px}',
      '.pb-srch .pb-field{flex:1}',
      '.pb-field{height:36px;border-radius:8px;background:var(--pb-panel2);display:flex;align-items:center;gap:8px;padding:0 12px;min-width:0}',
      '.pb-field svg{color:var(--pb-mute);flex:none}',
      '.pb-field input{flex:1;min-width:0;height:100%;border:0;background:none;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;outline:none}',
      '.pb-field input::placeholder{color:var(--pb-mute)}',
      '.pb-hint{margin:10px 0 20px;font-size:12px;color:var(--pb-mute);line-height:1.7}',
      '.pb-list{margin:0;padding:0;list-style:none}',
      '.pb-item{display:flex;align-items:center;gap:16px;padding:10px 10px;border-radius:8px}',
      '.pb-item:hover{background:var(--pb-panel2)}',
      '.pb-item-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}',
      '.pb-item-title{margin:0;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.pb-item-sub{margin:0;font-size:12px;color:var(--pb-mute);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.pb-kind{width:32px;height:32px;border-radius:6px;background:var(--pb-panel2);display:grid;place-items:center;',
      'font-size:10px;color:var(--pb-mute);flex:none;letter-spacing:.02em}',
      '.pb-mini-cover{display:block;width:44px;height:59px;flex:none;border-radius:4px;overflow:hidden;position:relative;box-shadow:var(--pb-cover-shadow)}',
      '.pb-repo-block{margin:0 0 26px}',
      '.pb-plaza-start{margin-top:6px}',
      '.pb-chips{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 22px}',
      '.pb-chip{height:28px;padding:0 12px;border-radius:999px;border:1px solid var(--pb-line-strong);background:none;',
      'color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;cursor:pointer}',
      '.pb-chip:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}',
      '.pb-start-block{margin-top:4px}',
      '.pb-start-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:18px 16px}',
      '@media (max-width:1100px){.pb-start-grid{grid-template-columns:repeat(4,1fr)}}',
      '.pb-start-item{min-width:0}',
      '.pb-start-cover{position:relative;width:100%;aspect-ratio:3/4;border-radius:4px;overflow:hidden;box-shadow:var(--pb-cover-shadow)}',
      '.pb-start-title{margin:6px 0 0;font-size:12px;line-height:1.4;color:var(--dsw-alias-label-secondary);',
      'display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}',
      '.pb-repo-empty{margin:16px 0;font-size:12px;color:var(--pb-mute)}',

      /* ---------- 设置 ---------- */
      '.pb-drawer-settings{position:absolute;top:0;right:0;bottom:0;width:min(320px,88%);z-index:19;display:flex;flex-direction:column;',
      'background:var(--pb-panel);border-left:1px solid var(--pb-line-strong);box-shadow:var(--dsw-elevation-panel);',
      'animation:pb-slide-in .2s cubic-bezier(.2,.7,.3,1)}',
      '.pb-drawer-settings-body{flex:1;min-height:0;overflow-y:auto;padding:4px 16px 24px}',
      '.pb-settings-page{max-width:760px}',
      '.pb-sect{margin:0 0 34px}',
      '.pb-sect>h2{margin:0 0 6px;font-size:13px;font-weight:600;letter-spacing:.04em}',
      '.pb-sect>.pb-desc{margin:0 0 14px;font-size:12px;color:var(--pb-mute);line-height:1.7}',
      '.pb-srow{display:flex;align-items:center;gap:16px;padding:12px 0;border-bottom:1px solid var(--pb-line)}',
      '.pb-srow:last-child{border-bottom:0}',
      '.pb-srow .pb-lbl{flex:1;min-width:0}',
      '.pb-srow .pb-lbl b{display:block;font-size:13px;font-weight:400}',
      '.pb-srow .pb-lbl span{display:block;font-size:12px;color:var(--pb-mute);margin-top:2px;line-height:1.6}',
      '.pb-srow .pb-ctl{display:flex;align-items:center;gap:8px;flex:none;flex-wrap:wrap;justify-content:flex-end}',
      '.pb-source-row{display:flex;align-items:flex-start;gap:12px;padding:14px 0;border-bottom:1px solid var(--pb-line)}',
      '.pb-source-row:last-child{border-bottom:0}',
      '.pb-source-mark{width:32px;height:32px;border-radius:8px;background:var(--pb-panel2);display:grid;place-items:center;',
      'font-family:' + SERIF + ';font-size:12px;color:var(--pb-ink2);flex:none}',
      '.pb-source-main{flex:1;min-width:0}',
      '.pb-source-main b{font-size:13px;font-weight:400;display:flex;align-items:center;gap:8px}',
      '.pb-source-main p{margin:2px 0 0;font-size:12px;color:var(--pb-mute);line-height:1.6;overflow-wrap:anywhere}',
      '.pb-state{font-size:11px;padding:1px 6px;border-radius:4px;background:var(--pb-panel2);color:var(--pb-mute)}',
      '.pb-state[data-on="1"]{background:color-mix(in srgb,var(--pb-accent) 20%,transparent);color:var(--pb-accent)}',
      '.pb-repo-row{display:flex;align-items:center;gap:10px;padding:8px 0;font-size:12px;border-bottom:1px solid var(--pb-line)}',
      '.pb-repo-row code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:var(--pb-ink2);overflow-wrap:anywhere}',
      '.pb-repo-row span{margin-left:auto;color:var(--pb-mute);flex:none}',
      '.pb-cfg-swatches{display:flex;gap:8px}',
      '.pb-cfg-swatch{width:56px;height:36px;border-radius:6px;border:1px solid var(--pb-line);position:relative;cursor:pointer;padding:0}',
      '.pb-cfg-swatch[data-on="1"]{outline:2px solid var(--pb-accent);outline-offset:2px}',
      '.pb-cfg-swatch em{position:absolute;left:0;right:0;bottom:3px;text-align:center;font-style:normal;font-size:10px;color:rgba(0,0,0,.55)}',
      '.pb-cfg-seg{display:flex;gap:2px;background:var(--pb-panel2);border-radius:8px;padding:2px}',
      '.pb-cfg-seg-opt{border:0;background:none;font:inherit;font-size:12px;padding:4px 10px;border-radius:6px;color:var(--pb-mute);cursor:pointer}',
      '.pb-cfg-seg-opt[data-on="1"]{background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary)}',
      '.pb-cfg-switch{width:34px;height:20px;border-radius:999px;background:var(--pb-panel2);position:relative;cursor:pointer;border:0;padding:0;flex:none}',
      '.pb-cfg-switch::after{content:"";position:absolute;top:3px;left:3px;width:14px;height:14px;border-radius:50%;background:var(--pb-mute);transition:left .15s ease,background .15s ease}',
      '.pb-cfg-switch[data-on="1"]{background:color-mix(in srgb,var(--pb-accent) 45%,transparent)}',
      '.pb-cfg-switch[data-on="1"]::after{left:17px;background:var(--pb-accent)}',
      '.pb-cfg-range{width:120px;accent-color:var(--pb-accent)}',

      /* ---------- 空态 ---------- */
      '.pb-empty{min-height:52vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:10px;padding:40px 0}',
      '.pb-empty svg{color:var(--pb-mute);opacity:.55}',
      '.pb-empty h2{margin:6px 0 0;font-size:17px;font-weight:600}',
      '.pb-empty p{margin:0;max-width:420px;font-size:13px;line-height:1.7;color:var(--pb-mute)}',
      '.pb-empty-actions{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;justify-content:center}',

      '.pb-cover{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:14px 14px 26px;overflow:hidden}',
      '.pb-cover img{width:100%;height:100%;object-fit:cover;display:block}',
      'border-right:1px solid currentColor;opacity:.3}',
      '.pb-cover-title{margin:0;font-family:' + SERIF + ';font-size:13px;line-height:1.1;letter-spacing:.06em;text-align:center;',
      'max-height:100%;overflow:hidden}',
      '.pb-cover-title[data-vertical="1"]{writing-mode:vertical-rl;text-orientation:upright;height:100%;white-space:nowrap;',
      'text-overflow:ellipsis;letter-spacing:.1em}',
      '.pb-cover-title[data-vertical="0"]{font-size:12px;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;',
      '-webkit-box-orient:vertical;overflow:hidden}',
      'opacity:.7;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.pb-cover-mini .pb-cover-title,.pb-cover-mini .pb-cover-author,.pb-cover-mini .pb-cover-frame{display:none}',

      /* ---------- 右栏 ---------- */
      '.pb-bars{display:flex;align-items:flex-end;gap:8px;height:56px;margin:12px 0 8px}',
      '.pb-bar{width:10px;flex:none;border-radius:2px 2px 0 0;background:color-mix(in srgb,var(--pb-accent) 20%,transparent);min-height:2px}',
      '.pb-bar[data-today="1"]{background:var(--pb-accent)}',
      '.pb-textlink{border:0;background:none;padding:0;color:var(--pb-accent);font:inherit;font-size:12px;cursor:pointer}',
      '.pb-textlink:hover{text-decoration:underline}',

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

      /* ---------- 封面（覆盖早期规则） ---------- */
      '.pb-cover{position:absolute;inset:0;display:block;padding:0;overflow:hidden;background:var(--pb-panel2)}',
      '.pb-cover img{width:100%;height:100%;object-fit:cover;display:block}',
      '.pb-cover-t{position:absolute;inset:12px 10px 22px;display:flex;align-items:center;justify-content:center;',
      'font-family:' + SERIF + ';font-size:12px;line-height:1.15;letter-spacing:.1em;color:rgba(255,255,255,.92);',
      'writing-mode:vertical-rl;text-orientation:upright;overflow:hidden;text-shadow:0 1px 2px rgba(0,0,0,.22)}',
      '.pb-cover-t[data-h="1"]{writing-mode:horizontal-tb;text-orientation:initial;letter-spacing:.01em;font-size:10.5px;',
      'line-height:1.45;text-align:center;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden;padding:2px}',
      '.pb-cover[data-size="xs"] .pb-cover-t{font-size:8px;inset:5px 3px 9px;letter-spacing:.02em}',
      '.pb-cover[data-size="xs"] .pb-cover-badge{display:none}',
      '.pb-cover[data-size="sm"] .pb-cover-t{font-size:9px;inset:7px 5px 12px}',
      '.pb-cover[data-size="sm"] .pb-cover-badge{font-size:9px;padding:1px 4px}',
      '.pb-cover[data-size="md"] .pb-cover-t{font-size:11px;inset:10px 8px 18px}',
      '.pb-cover[data-size="lg"] .pb-cover-t{font-size:12px;inset:12px 9px 20px}',
      '.pb-cover[data-size="xxs"] .pb-cover-t,.pb-cover[data-size="xxs"] .pb-cover-badge{display:none}',
      '.pb-cover-badge{position:absolute;bottom:6px;right:6px;font-size:10px;line-height:1;padding:2px 5px;border-radius:4px;',
      'background:rgba(0,0,0,.5);color:#fff;letter-spacing:.02em}',
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
      '.pb-notes .pb-note{border:1px solid var(--pb-line);border-radius:var(--pb-r-btn);background:var(--dsw-alias-bg-layer-2);padding:10px 12px;display:flex;flex-direction:column;gap:6px}',
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
      '@media (max-width:980px){',
      '.pb-appbar{padding:0 20px;gap:14px}',
      '.pb-tabs{gap:16px}',
      '.pb-search input{width:150px}',
      '.pb-shell{padding:0 20px}',
      '.pb-scroll{padding:20px 0 40px}',
      '}',
      '@media (max-width:680px){',
      '.pb-appbar{padding:0 16px;gap:12px}',
      '.pb-wordmark,.pb-wordmark-rule{display:none}',
      '.pb-tabs{gap:14px}',
      '.pb-tab{font-size:13px}',
      '.pb-search{display:none}',
      '.pb-shell{padding:0 16px}',
      '.pb-continue{gap:16px}',
      '.pb-continue-cover{width:72px;height:96px}',
      '.pb-continue-title{font-size:18px}',
      '.pb-cards{gap:14px}',
      '.pb-strip{gap:14px;overflow-x:auto}',
      '.pb-settings{max-width:none}',
      '.pb-srow{flex-wrap:wrap;gap:8px}',
      '.pb-srow .pb-ctl{width:100%;justify-content:flex-start}',
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
      const local = clamp(Math.round(((index + inner) / total) * 100), 0, 100);
      if (local > 0) return local;
      // 本地还没读过：直接显示微信读书那边的进度，不然一本读了半本的书看起来是 0%。
      const remote = Number((book.remote && book.remote.percent) || 0);
      return clamp(Math.round(remote), 0, 100);
    }

    /** 这本书显示的进度是不是来自微信读书云端。 */
    function percentFromWechat(book) {
      if (!book || book.finished) return false;
      const progress = book.progress || {};
      const local = (Number(progress.chapterIndex) || 0) + (Number(progress.percent) || 0);
      return local === 0 && Number((book.remote && book.remote.percent) || 0) > 0;
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

    function fmtWhen(ts, t) {
      if (!ts) return '—';
      const date = new Date(ts);
      const now = new Date();
      const startOf = (value) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
      const days = Math.round((startOf(now) - startOf(date)) / 86400000);
      const clock = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
      if (days === 0) return t('time.today') + ' ' + clock;
      if (days === 1) return t('time.yesterday') + ' ' + clock;
      return date.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' }) + ' ' + clock;
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
    function saveFile(filename, text, mime) {
      if (typeof document === 'undefined' || typeof Blob !== 'function' || typeof URL === 'undefined') return false;
      if (typeof URL.createObjectURL !== 'function') return false;
      const blob = new Blob([String(text || '')], { type: mime || 'text/markdown;charset=utf-8' });
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

    function saveMarkdown(filename, markdown) {
      return saveFile(filename, markdown, 'text/markdown;charset=utf-8');
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

    const IconBack = (p) => svg(p || {}, h('path', { key: 'a', d: 'M14.5 5.5 8 12l6.5 6.5' }));
    const IconClose = (p) => svg(p || {}, h('path', { key: 'a', d: 'M6.5 6.5l11 11M17.5 6.5l-11 11' }));
    const IconCheck = (p) => svg(p || {}, h('path', { key: 'a', d: 'M5 12.5l4.5 4.5L19 7' }));
    const IconAlert = (p) =>
      svg(p || {}, h('circle', { key: 'c', cx: 12, cy: 12, r: 8.5 }), h('path', { key: 'a', d: 'M12 8v5M12 16.2v.1' }));
    const IconUpload = (p) => svg(p || {}, h('path', { key: 'a', d: 'M12 16V4.5M8 8.5 12 4.5l4 4M5 15.5v3h14v-3' }));
    const IconNote = (p) =>
      svg(
        p || {},
        h('path', { key: 'a', d: 'M6 3.8h8.4L19 8.4v11.8H6z' }),
        h('path', { key: 'b', d: 'M14 3.8v4.8h4.8M9 12.5h6M9 16h4' }),
      );
    const IconChart = (p) =>
      svg(
        p || {},
        h('path', { key: 'a', d: 'M4 19.5h16' }),
        h('path', { key: 'b', d: 'M7.5 19.5v-6M12 19.5V7.5M16.5 19.5v-9' }),
      );
    const IconGrid = (p) =>
      svg(
        p || {},
        h('rect', { key: 'a', x: 4, y: 4, width: 6.4, height: 6.4, rx: 1.4 }),
        h('rect', { key: 'b', x: 13.6, y: 4, width: 6.4, height: 6.4, rx: 1.4 }),
        h('rect', { key: 'c', x: 4, y: 13.6, width: 6.4, height: 6.4, rx: 1.4 }),
        h('rect', { key: 'd', x: 13.6, y: 13.6, width: 6.4, height: 6.4, rx: 1.4 }),
      );
    const IconRows = (p) =>
      svg(p || {}, h('path', { key: 'a', d: 'M4 7h16M4 12h16M4 17h10' }));
    const IconChevron = (p) => svg(p || {}, h('path', { key: 'a', d: 'M6.5 9.5 12 15l5.5-5.5' }));
    const IconSearch = (p) =>
      svg(p || {}, h('circle', { key: 'a', cx: 11, cy: 11, r: 6 }), h('path', { key: 'b', d: 'M15.6 15.6 20 20' }));
    const IconMore = (p) =>
      h(
        'svg',
        {
          viewBox: '0 0 24 24',
          width: (p && p.size) || 16,
          height: (p && p.size) || 16,
          fill: 'currentColor',
          'aria-hidden': true,
          focusable: false,
          style: { display: 'block', flex: 'none' },
        },
        h('circle', { key: 'a', cx: 6, cy: 12, r: 1.5 }),
        h('circle', { key: 'b', cx: 12, cy: 12, r: 1.5 }),
        h('circle', { key: 'c', cx: 18, cy: 12, r: 1.5 }),
      );
    const IconTrash = (p) =>
      svg(
        p || {},
        h('path', { key: 'a', d: 'M5 7h14M9.5 7V4.8h5V7M7 7l.9 12.2h8.2L17 7' }),
        h('path', { key: 'b', d: 'M10.5 10.4v5.6M13.5 10.4v5.6' }),
      );
    const IconSync = (p) =>
      svg(
        p || {},
        h('path', { key: 'a', d: 'M19 12a7 7 0 0 1-11.6 5.2M5 12a7 7 0 0 1 11.6-5.2' }),
        h('path', { key: 'b', d: 'M16.4 3.4v3.6H20M7.6 20.6V17H4' }),
      );
    const IconBook = (p) =>
      svg(
        p || {},
        h('path', { key: 'a', d: 'M5 5.5h9.5A2.5 2.5 0 0 1 17 8v11H7.5A2.5 2.5 0 0 1 5 16.5z' }),
        h('path', { key: 'b', d: 'M8.5 9h5M8.5 12h3.5' }),
      );
    const IconType = (p) =>
      svg(
        p || {},
        h('path', { key: 'a', d: 'M5.5 18 11 6.5 16.5 18' }),
        h('path', { key: 'b', d: 'M7.6 14.2h6.8' }),
        h('path', { key: 'c', d: 'M19 8.5v9' }),
      );
    const IconToc = (p) =>
      svg(
        p || {},
        h('path', { key: 'a', d: 'M4.5 6.5h.1M4.5 12h.1M4.5 17.5h.1' }),
        h('path', { key: 'b', d: 'M8 6.5h11.5M8 12h11.5M8 17.5h8' }),
      );
    const IconSliders = (p) =>
      svg(
        p || {},
        h('path', { key: 'a', d: 'M4 7h16M4 12h16M4 17h16' }),
        h('circle', { key: 'b', cx: 9, cy: 7, r: 1.7 }),
        h('circle', { key: 'c', cx: 15, cy: 12, r: 1.7 }),
        h('circle', { key: 'd', cx: 8, cy: 17, r: 1.7 }),
      );
    const IconFolder = (p) =>
      svg(p || {}, h('path', { key: 'a', d: 'M4 7.5A1.5 1.5 0 0 1 5.5 6H9l2 2.4h7.5A1.5 1.5 0 0 1 20 9.9v7.6A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5z' }));

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

    function formatBytes(size) {
      const bytes = Math.max(0, Number(size) || 0);
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / 1024 / 1024).toFixed(1) + ' MB';
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

    /* ------------------------------------------------------------------ */
    /* 封面                                                                */
    /* ------------------------------------------------------------------ */

    /** 生成封面的画：每条是一对渐变，封面属于「画」而不是容器。 */
    const COVER_ART = [
      'linear-gradient(150deg,#e2b04a,#b9602c)',
      'linear-gradient(150deg,#a3242a,#5d1218)',
      'linear-gradient(150deg,#2f4a3a,#17251d)',
      'linear-gradient(150deg,#3c4a63,#1d2534)',
      'linear-gradient(150deg,#5a4a3a,#2b211a)',
      'linear-gradient(150deg,#3f5b4a,#1e2c24)',
      'linear-gradient(150deg,#c9b48c,#8a7350)',
      'linear-gradient(150deg,#7d5b8e,#3b2a45)',
      'linear-gradient(150deg,#8f3f3f,#4a1d1d)',
      'linear-gradient(150deg,#2c4a5a,#142530)',
      'linear-gradient(150deg,#6a4a2a,#2f2113)',
      'linear-gradient(150deg,#1f3b52,#0c1822)',
    ];

    function coverArt(title) {
      const text = String(title || '');
      let hash = 0;
      for (let index = 0; index < text.length; index += 1) hash = (hash * 31 + text.charCodeAt(index)) % 100003;
      return COVER_ART[hash % COVER_ART.length];
    }

    /** 中文≥3 字且西文≤2 才算「中文书名」，走竖排；其余横排四行。 */
    function isVerticalTitle(title) {
      const text = String(title || '');
      const cjk = (text.match(/[\u3040-\u30ff\u4e00-\u9fff]/g) || []).length;
      const ascii = (text.match(/[A-Za-z]/g) || []).length;
      return cjk >= 3 && ascii <= 2;
    }

    function verticalLabel(title) {
      return Array.from(String(title || '').trim()).slice(0, 7).join('');
    }

    function Cover(props) {
      const book = props.book || {};
      const size = props.size || 'md';
      const maxChars = size === 'xs' ? 3 : size === 'sm' ? 5 : 7;
      const [broken, setBroken] = useState(false);
      const source = book.cover;
      const useImage = typeof source === 'string' && source !== '' && !broken;
      const title = String(book.title || '');
      const vertical = isVerticalTitle(title);
      const badge = book.source === 'weread' ? props.t('cover.badgeWeread') : '';

      return h(
        'div',
        { className: 'pb-cover', 'data-img': useImage ? '1' : '0', 'data-size': size, style: useImage ? undefined : { background: coverArt(title) } },
        useImage
          ? h('img', {
              src: source,
              alt: '',
              loading: 'lazy',
              referrerPolicy: 'no-referrer',
              onError: () => setBroken(true),
            })
          : h(
              'span',
              { className: 'pb-cover-t', 'data-h': vertical ? '0' : '1' },
              vertical ? verticalLabel(title).slice(0, maxChars) : title,
            ),
        badge ? h('span', { className: 'pb-cover-badge' }, badge) : null,
      );
    }

    /* ------------------------------------------------------------------ */
    /* 顶栏                                                                */
    /* ------------------------------------------------------------------ */

    const TABS = ['home', 'shelf', 'plaza', 'settings'];

    function TopBar(props) {
      const { t } = props;
      const [importOpen, setImportOpen] = useState(false);
      const [pathOpen, setPathOpen] = useState(false);
      const [path, setPath] = useState('');

      useEffect(() => {
        if (!importOpen) return undefined;
        const onDown = (event) => {
          const node = event.target;
          if (node && typeof node.closest === 'function' && (node.closest('.pb-pop') || node.closest('.pb-menu-anchor'))) return;
          setImportOpen(false);
        };
        window.addEventListener('mousedown', onDown, true);
        return () => window.removeEventListener('mousedown', onDown, true);
      }, [importOpen]);

      const secondary = props.view === 'notes' || props.view === 'stats';

      return h(
        'header',
        { className: 'pb-appbar' },
        h('span', { className: 'pb-wordmark' }, t('app.title')),
        h('span', { className: 'pb-wordmark-rule', 'aria-hidden': true }),
        secondary
          ? h(
              'div',
              { className: 'pb-pagehead' },
              h(
                'button',
                { type: 'button', className: 'pb-back', onClick: props.onBack, 'aria-label': t('nav.back'), title: t('nav.back') },
                h(IconBack, { size: 14 }),
              ),
              h('h1', null, props.view === 'notes' ? t('view.notes') : t('view.stats')),
            )
          : h(
              'nav',
              { className: 'pb-tabs', 'aria-label': t('view.label') },
              TABS.map((key) =>
                h(
                  'button',
                  {
                    key,
                    type: 'button',
                    className: 'pb-tab',
                    'data-on': props.view === key ? '1' : '0',
                    onClick: () => props.onView(key),
                  },
                  t('view.' + key),
                ),
              ),
            ),
        h(
          'div',
          { className: 'pb-actions' },
          secondary || props.view === 'plaza' || props.view === 'settings'
            ? null
            : h(
                'label',
                { className: 'pb-search' },
                h(IconSearch, { size: 14 }),
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
            'div',
            { className: 'pb-menu-anchor', style: { position: 'relative' } },
            h(
              'button',
              {
                type: 'button',
                className: 'pb-btn pb-btn-primary',
                onClick: () => setImportOpen((open) => !open),
                'aria-expanded': importOpen ? 'true' : 'false',
              },
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
                    { type: 'button', className: 'pb-pop-item', onClick: () => setPathOpen((open) => !open) },
                    h(IconFolder, { size: 13 }),
                    t('nav.importPath'),
                  ),
                  pathOpen
                    ? h(
                        'div',
                        { className: 'pb-pop-path' },
                        h('input', {
                          className: 'pb-input',
                          style: { flex: 1, width: 220 },
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
        ),
      );
    }

    /* ------------------------------------------------------------------ */
    /* 继续阅读 / 书卡 / 空态                                                */
    /* ------------------------------------------------------------------ */

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
      const remote = book.remote || {};
      const rawRemote = Number(remote.progress) || 0;
      const remotePercent = Math.round(rawRemote > 1 ? clamp(rawRemote, 0, 100) : clamp(rawRemote, 0, 1) * 100);
      const minutes = Math.round((Number(remote.seconds) || 0) / 60);

      return h(
        'button',
        { type: 'button', className: 'pb-continue', onClick: () => props.onOpen(book) },
        h('div', { className: 'pb-continue-cover' }, h(Cover, { book, t, size: 'lg' })),
        h(
          'div',
          { className: 'pb-continue-body' },
          h('p', { className: 'pb-eyebrow' }, t('home.continue')),
          h('p', { className: 'pb-continue-title', title: book.title }, book.title),
          h('p', { className: 'pb-continue-sub' }, chapter),
          h(
            'div',
            { className: 'pb-progress-row' },
            h('div', { className: 'pb-progress' }, h('i', { style: { width: percent + '%' } })),
            h('span', { className: 'pb-progress-label' }, t('shelf.readPercent', { n: percent })),
          ),
          remote.progress !== undefined && remote.progress !== null
            ? h('p', { className: 'pb-continue-note' }, t('home.wechatLine', { percent: remotePercent, minutes }))
            : null,
        ),
        h('span', { className: 'pb-btn pb-btn-primary' }, t('home.continue')),
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
            h(Cover, { book, t, size: 'md' }),
            book.finished ? h('span', { className: 'pb-done-dot', 'aria-hidden': true }, h(IconCheck, { size: 8 })) : null,
          ),
          h(
            'div',
            { className: 'pb-book-body' },
            h('h3', { className: 'pb-book-title', title: book.title }, book.title),
            h(
              'p',
              { className: 'pb-book-meta' },
              h('em', null, subtitle),
              h('b', { className: 'pb-num' }, book.finished ? t('shelf.finished') : t('shelf.percent', { n: percent })),
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
                { className: 'pb-pop', style: { right: 0, top: 30 }, onClick: (event) => event.stopPropagation() },
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
          { width: 96, height: 96, viewBox: '0 0 96 96', fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
          h('path', { d: 'M20 26h22c4 0 7 3 7 7v38c-4-3-9-4-14-4H20z' }),
          h('path', { d: 'M76 26H54c-4 0-7 3-7 7v38c4-3 9-4 14-4h15z' }),
          h('path', { d: 'M47 33v30' }),
          h('path', { d: 'M26 38h12M26 47h12' }),
        ),
        h('h2', null, t('shelf.emptyTitle')),
        h('p', null, t('shelf.emptyBody')),
        h(
          'div',
          { className: 'pb-empty-actions' },
          h('button', { type: 'button', className: 'pb-btn pb-btn-primary', onClick: props.onImport }, t('shelf.emptyImport')),
          h('button', { type: 'button', className: 'pb-btn', onClick: props.onConnect }, t('shelf.emptyConnect')),
          h('button', { type: 'button', className: 'pb-btn pb-btn-quiet', onClick: props.onPlaza }, t('shelf.emptyPlaza')),
        ),
      );
    }

    /* ------------------------------------------------------------------ */
    /* 首页                                                                */
    /* ------------------------------------------------------------------ */

    function HomePage(props) {
      const { t } = props;
      const shelf = props.shelf || [];
      const stats = props.stats || {};
      const days = lastSevenDays(stats.days);
      const max = Math.max(1, days.reduce((top, day) => Math.max(top, day.seconds), 0));
      const counts = props.counts || {};
      const weread = (props.providers || []).find((item) => item.id === 'weread') || null;
      const recent = props.recent || [];
      const recentNotes = props.recentNotes || [];
      const wereadMinutes = Math.round((Number(props.wereadSeconds) || 0) / 60);
      const wereadHours = Math.round((Number(props.wereadSeconds) || 0) / 3600);

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
              props.continueBook
                ? h(ContinueBar, {
                    t,
                    book: props.continueBook,
                    chapterTitle: props.chapterTitle,
                    onOpen: props.onOpen,
                  })
                : null,

              h(
                'div',
                { className: 'pb-cards' },
                h(
                  'div',
                  { className: 'pb-card pb-card-click', role: 'button', tabIndex: 0, onClick: props.onOpenStats },
                  h('h3', null, t('home.weekCard')),
                  h('p', { className: 'pb-big' }, formatDuration(stats.week, t)),
                  h(
                    'div',
                    { className: 'pb-bars', 'aria-hidden': true },
                    days.map((day) =>
                      h('span', {
                        key: day.key,
                        className: 'pb-bar',
                        'data-on': day.isToday ? '1' : '0',
                        style: { height: Math.max(3, Math.round((day.seconds / max) * 56)) + 'px' },
                      }),
                    ),
                  ),
                  h(
                    'div',
                    { className: 'pb-rowline' },
                    h('span', null, t('home.weekdays')),
                    h('span', { className: 'pb-num' }, t('rail.streak', { n: Math.max(0, stats.streak || 0) })),
                  ),
                ),
                h(
                  'div',
                  { className: 'pb-card pb-card-click', role: 'button', tabIndex: 0, onClick: () => props.onView('shelf') },
                  h('h3', null, t('home.shelfCard')),
                  h(
                    'div',
                    { className: 'pb-kv' },
                    h('div', null, h('b', { className: 'pb-num' }, fmtNumber(counts.all)), h('span', null, t('home.unitBooks'))),
                    h('div', null, h('b', { className: 'pb-num' }, fmtNumber(counts.reading)), h('span', null, t('filter.reading'))),
                    h('div', null, h('b', { className: 'pb-num' }, fmtNumber(counts.finished)), h('span', null, t('filter.finished'))),
                    h('div', null, h('b', { className: 'pb-num' }, fmtNumber(counts.notes)), h('span', null, t('home.unitNotes'))),
                  ),
                  h(
                    'div',
                    { style: { marginTop: 14 } },
                    h('div', { className: 'pb-rowline' }, h('span', null, t('filter.weread')), h('b', { className: 'pb-num' }, t('home.booksCount', { n: counts.weread }))),
                    h('div', { className: 'pb-rowline' }, h('span', null, t('filter.local')), h('b', { className: 'pb-num' }, t('home.booksCount', { n: counts.local }))),
                  ),
                ),
                h(
                  'div',
                  { className: 'pb-card' },
                  h('h3', null, t('filter.weread')),
                  h(
                    'div',
                    { className: 'pb-rowline' },
                    h('span', null, t('home.account')),
                    h('b', { className: 'pb-num' }, weread && weread.connected ? weread.account || '—' : t('home.notConnected')),
                  ),
                  h(
                    'div',
                    { className: 'pb-rowline' },
                    h('span', null, t('home.lastSync')),
                    h('b', { className: 'pb-num' }, weread && weread.lastSyncAt ? fmtWhen(weread.lastSyncAt, t) : '—'),
                  ),
                  h(
                    'div',
                    { className: 'pb-rowline' },
                    h('span', null, t('home.totalRead')),
                    h('b', { className: 'pb-num' }, t('home.hours', { n: wereadHours })),
                  ),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'pb-btn',
                      style: { marginTop: 12, width: '100%', justifyContent: 'center' },
                      onClick: props.onSync,
                      disabled: !weread || !weread.connected,
                    },
                    t('home.sync'),
                  ),
                ),
              ),

              recent.length > 0
                ? h(
                    'div',
                    null,
                    h(
                      'div',
                      { className: 'pb-sec' },
                      h('h2', null, t('home.recentReading')),
                      h('button', { type: 'button', className: 'pb-link', onClick: () => props.onView('shelf') }, t('home.allBooks') + ' →'),
                    ),
                    h(
                      'div',
                      { className: 'pb-strip' },
                      recent.slice(0, 5).map((book) =>
                        h(
                          'button',
                          { key: book.id, type: 'button', className: 'pb-mini', onClick: () => props.onOpen(book), title: book.title },
                          h('div', { className: 'pb-cover-box' }, h(Cover, { book, t, size: 'sm' })),
                          h('p', null, book.title),
                        ),
                      ),
                    ),
                  )
                : null,

              recentNotes.length > 0
                ? h(
                    'div',
                    null,
                    h(
                      'div',
                      { className: 'pb-sec' },
                      h('h2', null, t('home.recentNotes')),
                      h('button', { type: 'button', className: 'pb-link', onClick: () => props.onOpenNotes() }, t('home.allNotes') + ' →'),
                    ),
                    h(
                      'div',
                      null,
                      recentNotes.slice(0, 3).map((note) =>
                        h(
                          'button',
                          { key: String(note.id), type: 'button', className: 'pb-note', onClick: () => props.onOpenNote(note) },
                          h('span', { className: 'pb-note-line', 'aria-hidden': true }),
                          h(
                            'span',
                            { className: 'pb-note-body' },
                            h('p', null, note.quote),
                            h(
                              'p',
                              { className: 'pb-note-sub' },
                              t('rail.noteMeta', { book: note.bookTitle || t('notes.untitled'), n: (Number(note.chapterIndex) || 0) + 1 }),
                            ),
                          ),
                        ),
                      ),
                    ),
                  )
                : null,

              h(
                'p',
                { className: 'pb-foot' },
                t('home.footer', {
                  notes: counts.notes || 0,
                  books: counts.all || 0,
                  hours: wereadHours,
                }),
              ),
            ),
          ),
        ),
      );
    }

    /* ------------------------------------------------------------------ */
    /* 书架                                                                */
    /* ------------------------------------------------------------------ */

    function ShelfPage(props) {
      const { t } = props;
      const [sortOpen, setSortOpen] = useState(false);

      useEffect(() => {
        if (!sortOpen) return undefined;
        const onDown = (event) => {
          const node = event.target;
          if (node && typeof node.closest === 'function' && node.closest('.pb-menu-anchor')) return;
          setSortOpen(false);
        };
        window.addEventListener('mousedown', onDown, true);
        return () => window.removeEventListener('mousedown', onDown, true);
      }, [sortOpen]);

      const counts = props.counts;

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
              props.shelf.length > 0
                ? h(
                    'div',
                    { className: 'pb-toolbar' },
                    [
                      ['all', counts.all],
                      ['weread', counts.weread],
                      ['local', counts.local],
                    ].map(([key, count]) =>
                      h(
                        'button',
                        {
                          key,
                          type: 'button',
                          className: 'pb-chip',
                          'data-on': props.sourceFilter === key ? '1' : '0',
                          onClick: () => props.onSource(key),
                        },
                        key === 'weread' ? h('span', { className: 'pb-chip-dot', 'aria-hidden': true }) : null,
                        key === 'all' ? t('shelf.sourceAll') : t('filter.' + key),
                        h('i', { className: 'pb-num' }, fmtNumber(count || 0)),
                      ),
                    ),
                    h('span', { className: 'pb-grow' }),
                    h(
                      'button',
                      {
                        type: 'button',
                        className: 'pb-chip',
                        'data-on': props.filter === 'reading' ? '1' : '0',
                        onClick: () => props.onFilter(props.filter === 'reading' ? 'all' : 'reading'),
                      },
                      t('filter.reading'),
                      h('i', { className: 'pb-num' }, fmtNumber(counts.reading || 0)),
                    ),
                    h(
                      'button',
                      {
                        type: 'button',
                        className: 'pb-chip',
                        'data-on': props.filter === 'finished' ? '1' : '0',
                        onClick: () => props.onFilter(props.filter === 'finished' ? 'all' : 'finished'),
                      },
                      t('filter.finished'),
                      h('i', { className: 'pb-num' }, fmtNumber(counts.finished || 0)),
                    ),
                    h(
                      'div',
                      { className: 'pb-menu-anchor', style: { position: 'relative' } },
                      h(
                        'button',
                        { type: 'button', className: 'pb-sortbtn', onClick: () => setSortOpen((open) => !open) },
                        t('sort.' + props.sort),
                        h(IconChevron, { size: 12 }),
                      ),
                      sortOpen
                        ? h(
                            'div',
                            { className: 'pb-pop', style: { right: 0, top: 32 } },
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
                      'button',
                      {
                        type: 'button',
                        className: 'pb-chip',
                        onClick: () => props.onDensity(props.density === 'grid' ? 'list' : 'grid'),
                      },
                      props.density === 'grid' ? t('density.grid') : t('density.list'),
                    ),
                  )
                : null,

              props.shelf.length === 0
                ? h(EmptyShelf, {
                    t,
                    onImport: props.onImport,
                    onConnect: props.onConnect,
                    onPlaza: () => props.onView('plaza'),
                  })
                : props.books.length === 0
                  ? h(
                      'div',
                      { className: 'pb-empty' },
                      h('h2', null, t('shelf.noMatch')),
                      h('p', null, t('shelf.noMatchHint')),
                      h(
                        'div',
                        { className: 'pb-empty-actions' },
                        h(
                          'button',
                          {
                            type: 'button',
                            className: 'pb-btn',
                            onClick: () => {
                              props.onQuery('');
                              props.onFilter('all');
                              props.onSource('all');
                            },
                          },
                          t('filter.all'),
                        ),
                      ),
                    )
                  : h(
                      'ul',
                      { className: 'pb-grid', 'data-density': props.density },
                      props.books.map((book) =>
                        h(BookCard, {
                          key: book.id,
                          t,
                          book,
                          onOpen: props.onOpen,
                          onDelete: props.onDelete,
                          onFinish: props.onFinish,
                        }),
                      ),
                    ),

              props.shelf.length > 0
                ? h(
                    'p',
                    { className: 'pb-foot' },
                    t('shelf.footer', {
                      books: counts.all || 0,
                      weread: counts.weread || 0,
                      local: counts.local || 0,
                    }),
                  )
                : null,
            ),
          ),
        ),
      );
    }

    /* ------------------------------------------------------------------ */
    /* 笔记页（二级）                                                        */
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
            { className: 'pb-note-quote', 'data-open': open ? '1' : '0', onClick: () => props.onOpen(note), title: t('notes.jump') },
            note.quote,
          ),
          open ? null : h('button', { type: 'button', className: 'pb-more', onClick: () => setOpen(true) }, t('notes.expand')),
          note.note ? h('p', { className: 'pb-note-text' }, note.note) : null,
          h('p', { className: 'pb-note-meta' }, t('notes.meta', { n: (Number(note.chapterIndex) || 0) + 1, time: fmtTime(note.createdAt) })),
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
          if (!map.has(key)) map.set(key, { id: key, title: note.bookTitle || t('notes.untitled'), notes: [] });
          map.get(key).notes.push(note);
        });
        return Array.from(map.values());
      }, [notes, t]);

      const body =
        status === 'loading'
          ? [0, 1, 2].map((index) => h('div', { key: index, className: 'pb-skel', style: { height: 96, marginBottom: 12 } }))
          : status === 'error'
            ? h(
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
              )
            : (notes || []).length === 0
              ? h('div', { className: 'pb-empty-note' }, t('notes.empty'))
              : groups.map((group) =>
                  h(
                    'section',
                    { className: 'pb-group', key: group.id },
                    h(
                      'div',
                      { className: 'pb-group-head' },
                      h('span', { className: 'pb-group-cover' }, h(Cover, { book: props.bookOf(group.id, group.title), t, size: 'xxs' })),
                      h('h2', { className: 'pb-group-title', title: group.title }, group.title),
                      h('span', { className: 'pb-group-count' }, t('notes.count', { n: group.notes.length })),
                      h('span', { className: 'pb-grow' }),
                      h('button', { type: 'button', className: 'pb-textlink', onClick: () => props.onExportBook(group.id) }, t('notes.exportBook')),
                    ),
                    group.notes.map((note) => h(NoteEntry, { key: String(note.id), t, note, onOpen: props.onOpen, onDelete: props.onDelete })),
                  ),
                );

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
                h('button', { type: 'button', className: 'pb-scope', 'data-on': props.scope === 'all' ? '1' : '0', onClick: () => props.onScope('all') }, t('notes.scopeAll')),
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
                h('button', { type: 'button', className: 'pb-btn pb-btn-quiet', onClick: props.onExportAll, disabled: (notes || []).length === 0 }, t('notes.exportAll')),
                h('button', { type: 'button', className: 'pb-btn pb-btn-quiet', onClick: props.onCopy, disabled: (notes || []).length === 0 }, t('notes.copy')),
              ),
              body,
            ),
          ),
        ),
      );
    }

    /* ------------------------------------------------------------------ */
    /* 统计页（二级）                                                        */
    /* ------------------------------------------------------------------ */

    function StatsPage(props) {
      const { t } = props;
      const stats = props.stats || {};
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
                cells.map((cell) => h('div', { className: 'pb-stat', key: cell.key }, h('b', null, cell.value), h('span', null, cell.label))),
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
              h('p', { className: 'pb-page-foot' }, t('stats.footer', { notes: props.noteCount || 0, books: props.bookCount || 0 })),
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

      const label = t('filter.weread');
      const howKey = 'source.wereadHow';

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
        ? providers.filter((item) => item.id === 'weread')
        : [{ id: 'weread', connected: false, account: '', shelfCount: 0, lastSyncAt: 0, error: null }];
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
    /* 发现（微信读书书城）                                                  */
    /* ------------------------------------------------------------------ */

    /* ------------------------------------------------------------------ */
    /* 广场                                                                */
    /* ------------------------------------------------------------------ */

    function GithubFiles(props) {
      const { t, repo } = props;
      const [status, setStatus] = useState('idle');
      const [files, setFiles] = useState([]);
      const [error, setError] = useState('');
      const [busy, setBusy] = useState('');
      const [page, setPage] = useState(1);
      const PAGE_SIZE = 10;

      const load = useCallback(async () => {
        const key = repo.spec + '#' + (repo.path || '');
        const hit = plazaCache.files.get(key);
        if (hit && Date.now() - hit.at < PLAZA_TTL) {
          setFiles(hit.files);
          setPage(1);
          setStatus('ready');
          return;
        }
        setStatus('loading');
        setError('');
        try {
          const res = await call('/discover/github/files?repo=' + encodeURIComponent(repo.spec) + '&path=' + encodeURIComponent(repo.path || ''));
          const list = Array.isArray(res.files) ? res.files : [];
          plazaCache.files.set(key, { at: Date.now(), files: list });
          setFiles(list);
          setPage(1);
          setStatus('ready');
        } catch (err) {
          setError(errorText(err));
          setStatus('error');
        }
      }, [repo.spec, repo.path]);

      useEffect(() => {
        load();
      }, [load]);

      const grab = async (file) => {
        setBusy(file.path);
        setError('');
        try {
          await post('/discover/github/grab', { repo: repo.spec, path: file.path });
          if (props.onAdded) await props.onAdded();
        } catch (err) {
          setError(errorText(err));
        } finally {
          setBusy('');
        }
      };

      const keyword = String(props.filter || '').trim().toLowerCase();
      const matched = keyword === '' ? files : files.filter((file) => String(file.path || '').toLowerCase().indexOf(keyword) >= 0);
      const totalPages = Math.max(1, Math.ceil(matched.length / PAGE_SIZE));
      const current = Math.min(Math.max(page, 1), totalPages);
      const shown = matched.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

      return h(
        'section',
        { className: 'pb-repo-block' },
        h(
          'div',
          { className: 'pb-filerow' },
          h('span', { className: 'pb-hint', style: { margin: 0 } }, t('plaza.fileCount', { n: fmtNumber(files.length) })),
          h(
            'div',
            { className: 'pb-filerow-actions' },
            h('button', { type: 'button', className: 'pb-textlink', onClick: load }, t('plaza.refresh')),
            h(
              'div',
              { className: 'pb-pager' },
              h('button', { type: 'button', className: 'pb-pagebtn', disabled: current <= 1, onClick: () => setPage(current - 1), 'aria-label': t('plaza.prevPage') }, '‹'),
              h('span', { className: 'pb-num' }, current + ' / ' + totalPages),
              h('button', { type: 'button', className: 'pb-pagebtn', disabled: current >= totalPages, onClick: () => setPage(current + 1), 'aria-label': t('plaza.nextPage') }, '›'),
            ),
          ),
        ),
        status === 'loading'
          ? h(
              'ul',
              { className: 'pb-list pb-plaza-list' },
              [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((index) =>
                h('li', { key: 'sk' + index, className: 'pb-skel-row' }, h('span', { className: 'pb-skel pb-skel-cover' }), h('span', { className: 'pb-skel pb-skel-line' })),
              ),
            )
          : null,
        status === 'error' ? h('p', { className: 'pb-repo-empty' }, t('plaza.filesError') + error) : null,
        status === 'ready' && shown.length === 0 ? h('p', { className: 'pb-repo-empty' }, t('plaza.noFiles')) : null,
        status === 'ready' && shown.length > 0
          ? h(
              'ul',
              { className: 'pb-list' },
              shown.slice(0, 200).map((file) =>
                h(
                  'li',
                  { className: 'pb-item', key: file.path },
                  h(
                    'span',
                    { className: 'pb-mini-cover' },
                    h(Cover, {
                      book: {
                        title: String(file.name || file.path || '').replace(/\.[^.]+$/, '').slice(0, 2),
                        author: String(file.kind || '').toUpperCase(),
                      },
                      t,
                      size: 'xs',
                    }),
                  ),
                  h(
                    'div',
                    { className: 'pb-item-main' },
                    h('p', { className: 'pb-item-title', title: file.path }, file.name || file.path),
                    h('p', { className: 'pb-item-sub' }, file.path + ' · ' + formatBytes(file.size)),
                  ),
                  h(
                    'button',
                    { type: 'button', className: 'pb-btn', onClick: () => grab(file), disabled: busy === file.path },
                    busy === file.path ? t('plaza.downloading') : t('plaza.download'),
                  ),
                ),
              ),
            )
          : null,
        error && status === 'ready' ? h('p', { className: 'pb-repo-empty' }, error) : null,
      );
    }

    /** 广场的会话级缓存：切走再回来是瞬间的，过期才回源。 */
    const plazaCache = { browse: null, browseAt: 0, repos: null, reposAt: 0, files: new Map() };
    const PLAZA_TTL = 5 * 60 * 1000;

    function activeRepoLabel(repos, spec) {
      const repo = (repos || []).find((item) => item.spec === spec) || (repos || [])[0];
      if (!repo) return 'GitHub';
      return repo.owner + ' / ' + repo.repo + (repo.path ? ' · ' + repo.path : '');
    }

    function PlazaPage(props) {
      const { t } = props;
      const [source, setSource] = useState('weread');

      const [query, setQuery] = useState('');
      const [status, setStatus] = useState('idle');
      const [results, setResults] = useState([]);
      const [error, setError] = useState('');
      const [busy, setBusy] = useState('');
      const [done, setDone] = useState({});

      const [menuOpen, setMenuOpen] = useState(false);
      const [activeRepo, setActiveRepo] = useState('');
      const [repos, setRepos] = useState(null);
      const [repoStatus, setRepoStatus] = useState('idle');
      const [repoError, setRepoError] = useState('');
      const [filter, setFilter] = useState('');
      const [addOpen, setAddOpen] = useState(false);
      const [spec, setSpec] = useState('');
      const [repoModal, setRepoModal] = useState(false);
      const [adding, setAdding] = useState(false);

      const loadRepos = useCallback(async () => {
        setRepoStatus('loading');
        setRepoError('');
        try {
          const res =
            plazaCache.repos && Date.now() - plazaCache.reposAt < PLAZA_TTL
              ? { repos: plazaCache.repos }
              : await call('/discover/github/repos');
          const list = Array.isArray(res.repos) ? res.repos : [];
          plazaCache.repos = list;
          plazaCache.reposAt = Date.now();
          setRepos(list);
          setActiveRepo((current) => current || (list[0] ? list[0].spec : ''));
          setRepoStatus('ready');
        } catch (err) {
          setRepoError(errorText(err));
          setRepoStatus('error');
        }
      }, []);

      useEffect(() => {
        if (repos === null) loadRepos();
      }, [repos, loadRepos]);

      const [shuffleSeed, setShuffleSeed] = useState(0);
      const [browse, setBrowse] = useState([]);
      const [browseStatus, setBrowseStatus] = useState('idle');
      const [browseError, setBrowseError] = useState('');

      const loadBrowse = useCallback(async () => {
        if (plazaCache.browse && Date.now() - plazaCache.browseAt < PLAZA_TTL) {
          setBrowse(plazaCache.browse);
          setBrowseStatus('ready');
          return;
        }
        setBrowseStatus(browse.length > 0 ? 'ready' : 'loading');
        setBrowseError('');
        try {
          const res = await call('/provider/weread/browse');
          const books = Array.isArray(res.books) ? res.books : [];
          plazaCache.browse = books;
          plazaCache.browseAt = Date.now();
          setBrowse(books);
          setBrowseStatus('ready');
        } catch (err) {
          setBrowseError(errorText(err));
          setBrowseStatus('error');
        }
      }, [browse.length]);

      useEffect(() => {
        if (source === 'weread' && browseStatus === 'idle') loadBrowse();
      }, [source, browseStatus, loadBrowse]);

      const runSearch = async (input) => {
        const value = String(input ?? '').trim();
        if (value === '') {
          setStatus('idle');
          setResults([]);
          return;
        }
        setStatus('loading');
        setError('');
        try {
          const res = await call('/provider/weread/store?q=' + encodeURIComponent(value));
          setResults(Array.isArray(res.results) ? res.results : []);
          setStatus('ready');
        } catch (err) {
          setError(errorText(err));
          setStatus('error');
        }
      };

      const search = () => runSearch(query);

      const add = async (item) => {
        const id = item.bookId || item.id;
        setBusy(String(id));
        setError('');
        try {
          await post('/provider/weread/open', { bookId: id, title: item.title, author: item.author });
          setDone((current) => Object.assign({}, current, { [id]: true }));
          if (props.onAdded) await props.onAdded();
        } catch (err) {
          setError(errorText(err));
        } finally {
          setBusy('');
        }
      };

      const addRepo = async () => {
        const value = spec.trim();
        if (value === '') return;
        setAdding(true);
        setRepoError('');
        try {
          const res = await post('/discover/github/repos', { spec: value });
          setRepos(Array.isArray(res.repos) ? res.repos : []);
          setSpec('');
          setAddOpen(false);
          setRepoModal(false);
        } catch (err) {
          setRepoError(errorText(err));
        } finally {
          setAdding(false);
        }
      };

      const catalogue = status === 'ready' || status === 'loading' ? results : browse;
      const shownBooks = status === 'ready' || status === 'loading' ? catalogue : catalogue.slice(shuffleSeed * 10, shuffleSeed * 10 + 10);

      const weread = h(
        'div',
        null,
        h(
          'div',
          { className: 'pb-srch' },
          h(
            'label',
            { className: 'pb-field' },
            h(IconSearch, { size: 14 }),
            h('input', {
              value: query,
              placeholder: t('plaza.wereadPlaceholder'),
              'aria-label': t('plaza.wereadPlaceholder'),
              onChange: (event) => setQuery(event.target.value),
              onKeyDown: (event) => {
                if (event.key === 'Enter') search();
              },
            }),
          ),
          h('button', { type: 'button', className: 'pb-btn pb-btn-primary', onClick: search }, t('plaza.search')),
        ),
        h(
          'div',
          { className: 'pb-hintrow' },
          h('p', { className: 'pb-hint', style: { margin: 0 } }, t('plaza.wereadHint')),
          h(
            'button',
            {
              type: 'button',
              className: 'pb-textlink',
              onClick: () => setShuffleSeed((n) => (n + 1) * 10 >= browse.length ? 0 : n + 1),
              disabled: status === 'ready' || browse.length <= 10,
            },
            t('plaza.shuffle'),
          ),
        ),
        error ? h('p', { className: 'pb-repo-empty' }, t('plaza.error') + error) : null,
        browseStatus === 'loading'
          ? h(
              'ul',
              { className: 'pb-list pb-plaza-list' },
              [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((index) =>
                h('li', { key: 'sk' + index, className: 'pb-skel-row' }, h('span', { className: 'pb-skel pb-skel-cover' }), h('span', { className: 'pb-skel pb-skel-line' })),
              ),
            )
          : null,
        browseStatus === 'error' ? h('p', { className: 'pb-repo-empty' }, t('plaza.error') + browseError) : null,
        status === 'ready' && results.length === 0 ? h('p', { className: 'pb-repo-empty' }, t('plaza.noResult')) : null,
        status === 'loading' ? h('p', { className: 'pb-repo-empty' }, t('plaza.searching')) : null,
        shownBooks.length > 0
          ? h(
              'ul',
              { className: 'pb-list pb-plaza-list' },
              shownBooks.map((item) => {
                const id = String(item.bookId || item.id || item.title);
                return h(
                  'li',
                  { className: 'pb-item', key: id },
                  h('span', { className: 'pb-mini-cover' }, h(Cover, { book: { title: item.title, author: item.author, cover: item.cover }, t, size: 'xs' })),
                  h(
                    'div',
                    { className: 'pb-item-main' },
                    h('p', { className: 'pb-item-title' }, item.title),
                    h('p', { className: 'pb-item-sub' }, [item.author, item.words ? t('plaza.words', { n: fmtNumber(item.words) }) : ''].filter(Boolean).join(' · ')),
                  ),
                  h(
                    'button',
                    { type: 'button', className: 'pb-btn', onClick: () => props.onOpen && props.onOpen(item) },
                    t('plaza.open'),
                  ),
                );
              }),
            )
          : null,
      );

      const github = h(
        'div',
        null,
        h(
          'div',
          { className: 'pb-srch' },
          h(
            'label',
            { className: 'pb-field' },
            h(IconSearch, { size: 14 }),
            h('input', {
              value: filter,
              placeholder: t('plaza.githubPlaceholder'),
              'aria-label': t('plaza.githubPlaceholder'),
              onChange: (event) => setFilter(event.target.value),
            }),
          ),
        ),
        repoError ? h('p', { className: 'pb-repo-empty' }, repoError) : null,
        repoStatus === 'loading'
          ? h(
              'ul',
              { className: 'pb-list pb-plaza-list' },
              [0, 1, 2, 3, 4].map((index) =>
                h('li', { key: 'skr' + index, className: 'pb-skel-row' }, h('span', { className: 'pb-skel pb-skel-cover' }), h('span', { className: 'pb-skel pb-skel-line' })),
              ),
            )
          : null,
        repoStatus === 'ready' && (repos || []).length === 0
          ? h('p', { className: 'pb-repo-empty' }, t('plaza.noRepo'))
          : (repos || [])
              .filter((repo) => activeRepo === '' || repo.spec === activeRepo)
              .map((repo) =>
              h(GithubFiles, {
                key: repo.spec + (repo.path || ''),
                t,
                repo,
                filter,
                onAdded: props.onAdded,
              }),
            ),
        h('p', { className: 'pb-hint', style: { marginTop: 24 } }, t('plaza.githubFoot')),
      );

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
                { className: 'pb-srcbar pb-srcbar-flat' },
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'pb-srcchip',
                    'data-on': source === 'weread' ? '1' : '0',
                    onClick: () => setSource('weread'),
                  },
                  t('plaza.weread'),
                ),
                (repos || []).map((repo) =>
                  h(
                    'button',
                    {
                      key: repo.spec,
                      type: 'button',
                      className: 'pb-srcchip',
                      'data-on': source === 'github' && activeRepo === repo.spec ? '1' : '0',
                      title: repo.spec,
                      onClick: () => {
                        setActiveRepo(repo.spec);
                        setSource('github');
                      },
                    },
                    'GitHub · ' + repo.owner + ' / ' + repo.repo,
                  ),
                ),
              ),
              source === 'weread' ? weread : github,
            ),
          ),
        ),
      );
    }

    /* ------------------------------------------------------------------ */
    /* 设置                                                                */
    /* ------------------------------------------------------------------ */

    function SettingsPage(props) {
      const { t, settings } = props;
      const set = props.onSettings;
      const weread = (props.providers || []).find((item) => item.id === 'weread') || null;

      const [repos, setRepos] = useState(null);
      const [repoError, setRepoError] = useState('');
      const [spec, setSpec] = useState('');
      const [repoModal, setRepoModal] = useState(false);
      const [adding, setAdding] = useState(false);
      const [token, setToken] = useState('');
      const [hasToken, setHasToken] = useState(false);
      const [savingToken, setSavingToken] = useState(false);

      const loadGithub = useCallback(async () => {
        setRepoError('');
        try {
          const res = await call('/discover/github/repos');
          setRepos(Array.isArray(res.repos) ? res.repos : []);
        } catch (err) {
          setRepoError(errorText(err));
        }
        try {
          const info = await call('/discover/github/token');
          setHasToken(!!info.hasToken);
        } catch (err) {
          /* token 读不到不致命 */
        }
      }, []);

      useEffect(() => {
        loadGithub();
      }, [loadGithub]);

      const addRepo = async () => {
        const value = spec.trim();
        if (value === '') return;
        setAdding(true);
        setRepoError('');
        try {
          const res = await post('/discover/github/repos', { spec: value });
          setRepos(Array.isArray(res.repos) ? res.repos : []);
          setSpec('');
          setRepoModal(false);
        } catch (err) {
          setRepoError(errorText(err));
        } finally {
          setAdding(false);
        }
      };

      const removeRepo = async (repo) => {
        setRepoError('');
        try {
          const res = await del('/discover/github/repos?spec=' + encodeURIComponent(repo.spec));
          setRepos(Array.isArray(res.repos) ? res.repos : []);
        } catch (err) {
          setRepoError(errorText(err));
        }
      };

      const saveToken = async () => {
        setSavingToken(true);
        setRepoError('');
        try {
          const res = await post('/discover/github/token', { token: token.trim() });
          setHasToken(!!res.hasToken);
          setToken('');
        } catch (err) {
          setRepoError(errorText(err));
        } finally {
          setSavingToken(false);
        }
      };

      const row = (key, label, desc, control) =>
        h(
          'div',
          { className: 'pb-srow', key },
          h('div', { className: 'pb-lbl' }, h('b', null, label), desc ? h('span', null, desc) : null),
          h('div', { className: 'pb-ctl' }, control),
        );

      const seg = (key, options, value, onPick) =>
        h(
          'div',
          { className: 'pb-cfg-seg', key },
          options.map((option) =>
            h(
              'button',
              {
                key: option.value,
                type: 'button',
                className: 'pb-cfg-seg-opt',
                'data-on': value === option.value ? '1' : '0',
                onClick: () => onPick(option.value),
              },
              option.label,
            ),
          ),
        );

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
              { className: 'pb-main pb-settings-page' },

              h(
                'section',
                { className: 'pb-sect' },
                h('h2', null, t('settings.sources')),
                h('p', { className: 'pb-desc' }, t('settings.sourcesDesc')),
                h(
                  'div',
                  { className: 'pb-source-row' },
                  h('span', { className: 'pb-source-mark' }, '微'),
                  h(
                    'div',
                    { className: 'pb-source-main' },
                    h(
                      'b',
                      null,
                      t('filter.weread'),
                      h('span', { className: 'pb-state', 'data-on': weread && weread.connected ? '1' : '0' }, weread && weread.connected ? t('settings.connected') : t('settings.disconnected')),
                    ),
                    h(
                      'p',
                      null,
                      weread && weread.connected
                        ? t('settings.wereadLine', {
                            account: weread.account || '—',
                            time: weread.lastSyncAt ? fmtWhen(weread.lastSyncAt, t) : '—',
                            n: weread.shelfCount || 0,
                          })
                        : t('settings.wereadEmpty'),
                    ),
                    weread && weread.connected
                      ? h(
                          'p',
                          { className: 'pb-hint', style: { margin: '2px 0 0' } },
                          weread.refreshToken ? t('settings.wereadLongSession') : t('settings.wereadShortSession'),
                        )
                      : null,
                  ),
                  h(
                    'div',
                    { className: 'pb-ctl' },
                    h('button', { type: 'button', className: 'pb-btn', onClick: props.onSync, disabled: !weread || !weread.connected }, t('home.sync')),
                    h('button', { type: 'button', className: 'pb-btn pb-btn-quiet', onClick: props.onConnect }, t('settings.rescan')),
                    h(
                      'button',
                      { type: 'button', className: 'pb-btn pb-btn-quiet', onClick: props.onDisconnect, disabled: !weread || !weread.connected },
                      t('settings.disconnect'),
                    ),
                  ),
                ),
                h(
                  'div',
                  { className: 'pb-source-row' },
                  h('span', { className: 'pb-source-mark' }, 'GH'),
                  h(
                    'div',
                    { className: 'pb-source-main' },
                    h('b', null, t('settings.github')),
                    h('p', null, t('settings.githubSummary', { n: fmtNumber((repos || []).length), token: hasToken ? t('settings.tokenOn') : t('settings.tokenOff') })),
                  ),
                  h(
                    'div',
                    { className: 'pb-ctl' },
                    h(
                      'button',
                      {
                        type: 'button',
                        className: 'pb-btn',
                        onClick: () => {
                          setRepoModal(true);
                          if (repos === null) loadGithub();
                        },
                      },
                      t('settings.manage'),
                    ),
                  ),
                  repoModal
                    ? h(
                        'div',
                        { className: 'pb-scrim', onClick: () => (adding || savingToken ? null : setRepoModal(false)) },
                        h(
                          'div',
                          { className: 'pb-modal', onClick: (event) => event.stopPropagation(), role: 'dialog', 'aria-modal': 'true' },
                          h('h3', null, t('settings.repoModalTitle')),
                          h('p', { className: 'pb-hint' }, t('settings.repoModalHint')),
                          h(
                            'div',
                            { className: 'pb-modal-list' },
                            (repos || []).length === 0
                              ? h('p', { className: 'pb-hint' }, t('plaza.noRepo'))
                              : (repos || []).map((repo) =>
                                  h(
                                    'div',
                                    { className: 'pb-modal-row', key: repo.spec + (repo.path || '') },
                                    h('code', null, repo.spec + (repo.path ? '#' + repo.path : '')),
                                    h('button', { type: 'button', className: 'pb-textlink', onClick: () => removeRepo(repo) }, t('settings.removeRepo')),
                                  ),
                                ),
                          ),
                          h(
                            'div',
                            { className: 'pb-modal-add' },
                            h('input', {
                              className: 'pb-input',
                              style: { flex: 1, minWidth: 0 },
                              value: spec,
                              placeholder: t('plaza.repoPlaceholder'),
                              'aria-label': t('plaza.repoPlaceholder'),
                              onChange: (event) => setSpec(event.target.value),
                              onKeyDown: (event) => {
                                if (event.key === 'Enter') addRepo();
                              },
                            }),
                            h('button', { type: 'button', className: 'pb-btn pb-btn-primary', onClick: addRepo, disabled: adding }, adding ? t('plaza.adding') : t('settings.addRepo')),
                          ),
                          h('p', { className: 'pb-hint', style: { margin: '14px 0 6px' } }, t('settings.tokenDesc')),
                          h(
                            'div',
                            { className: 'pb-modal-add' },
                            h('input', {
                              className: 'pb-input',
                              type: 'password',
                              autoComplete: 'off',
                              style: { flex: 1, minWidth: 0 },
                              value: token,
                              placeholder: hasToken ? t('settings.tokenSet') : t('settings.tokenPlaceholder'),
                              'aria-label': t('settings.tokenPlaceholder'),
                              onChange: (event) => setToken(event.target.value),
                            }),
                            h('button', { type: 'button', className: 'pb-btn', onClick: saveToken, disabled: savingToken }, t('settings.saveToken')),
                          ),
                          repoError ? h('p', { className: 'pb-note-msg' }, repoError) : null,
                          h(
                            'div',
                            { className: 'pb-modal-actions' },
                            h('button', { type: 'button', className: 'pb-btn pb-btn-quiet', onClick: () => setRepoModal(false) }, t('settings.close')),
                          ),
                        ),
                      )
                    : null,
                ),
              ),

              h(
                'section',
                { className: 'pb-sect' },
                h('h2', null, t('settings.reading')),
                h('p', { className: 'pb-desc' }, t('settings.readingDesc')),
                row(
                  'theme',
                  t('settings.paper'),
                  t('settings.paperDesc'),
                  h(
                    'div',
                    { className: 'pb-cfg-swatches' },
                    THEMES.map((theme) =>
                      h(
                        'button',
                        {
                          key: theme,
                          type: 'button',
                          className: 'pb-cfg-swatch',
                          'data-on': settings.theme === theme ? '1' : '0',
                          onClick: () => set({ theme }),
                          title: t('reader.theme' + theme.charAt(0).toUpperCase() + theme.slice(1)),
                          style: {
                            background:
                              theme === 'paper' ? '#fbfaf6' : theme === 'sepia' ? '#f2e5cc' : theme === 'ink' ? '#15171b' : '#e6ecdb',
                          },
                        },
                        h('em', { style: theme === 'ink' ? { color: '#cbc7bc' } : undefined }, t('reader.theme' + theme.charAt(0).toUpperCase() + theme.slice(1))),
                      ),
                    ),
                  ),
                ),
                row(
                  'font',
                  t('settings.font'),
                  t('settings.fontDesc'),
                  seg(
                    'font',
                    [
                      { value: 'serif', label: t('reader.serif') },
                      { value: 'sans', label: t('reader.sans') },
                    ],
                    settings.fontFamily,
                    (value) => set({ fontFamily: value }),
                  ),
                ),
                row(
                  'metric',
                  t('settings.metrics'),
                  t('settings.metricsValue', { size: settings.fontSize, leading: settings.lineHeight.toFixed(1), measure: settings.measure }),
                  [
                    h('input', {
                      key: 'size',
                      className: 'pb-cfg-range',
                      type: 'range',
                      min: 15,
                      max: 32,
                      value: settings.fontSize,
                      'aria-label': t('reader.size'),
                      onChange: (event) => set({ fontSize: clamp(event.target.value, 15, 32) }),
                    }),
                    h('input', {
                      key: 'leading',
                      className: 'pb-cfg-range',
                      type: 'range',
                      min: 1.4,
                      max: 2.4,
                      step: 0.1,
                      value: settings.lineHeight,
                      'aria-label': t('reader.leading'),
                      onChange: (event) => set({ lineHeight: Math.round(clamp(event.target.value, 1.4, 2.4) * 10) / 10 }),
                    }),
                    h('input', {
                      key: 'measure',
                      className: 'pb-cfg-range',
                      type: 'range',
                      min: 24,
                      max: 52,
                      value: settings.measure,
                      'aria-label': t('reader.measure'),
                      onChange: (event) => set({ measure: Math.round(clamp(event.target.value, 24, 52)) }),
                    }),
                  ],
                ),
                row(
                  'mode',
                  t('settings.mode'),
                  t('settings.modeDesc'),
                  seg(
                    'mode',
                    [
                      { value: 'paged', label: t('reader.paged') },
                      { value: 'scroll', label: t('reader.scroll') },
                    ],
                    settings.mode,
                    (value) => set({ mode: value }),
                  ),
                ),
                row(
                  'autohide',
                  t('settings.autohide'),
                  t('settings.autohideDesc'),
                  h('button', {
                    type: 'button',
                    className: 'pb-cfg-switch',
                    'data-on': settings.chromeAutoHide ? '1' : '0',
                    role: 'switch',
                    'aria-checked': settings.chromeAutoHide ? 'true' : 'false',
                    onClick: () => set({ chromeAutoHide: !settings.chromeAutoHide }),
                  }),
                ),
              ),

              h(
                'section',
                { className: 'pb-sect' },
                h('h2', null, t('settings.data')),
                h('p', { className: 'pb-desc' }, t('settings.dataDesc')),
                row(
                  'path',
                  t('settings.libraryPath'),
                  props.storage || t('settings.libraryPathUnknown'),
                  [
                    h('button', { key: 'copy', type: 'button', className: 'pb-btn pb-btn-quiet', onClick: props.onCopyPath, disabled: !props.storage }, t('settings.copyPath')),
                  ],
                ),
                row('export', t('settings.export'), t('settings.exportDesc'), [
                  h('button', { key: 'shelf', type: 'button', className: 'pb-btn pb-btn-quiet', onClick: props.onExportShelf }, t('settings.exportShelf')),
                  h('button', { key: 'notes', type: 'button', className: 'pb-btn pb-btn-quiet', onClick: props.onExportNotes }, t('settings.exportNotes')),
                ]),
                row('backup', t('settings.backup'), t('settings.backupDesc'), [
                  h('button', { key: 'save', type: 'button', className: 'pb-btn pb-btn-quiet', onClick: props.onBackup }, t('settings.backupSave')),
                  h('button', { key: 'restore', type: 'button', className: 'pb-btn pb-btn-quiet', disabled: true, title: t('settings.pending') }, t('settings.backupRestore')),
                ]),
                row('cache', t('settings.cache'), t('settings.cacheDesc'), [
                  h('button', { key: 'clear', type: 'button', className: 'pb-btn pb-btn-quiet', disabled: true, title: t('settings.pending') }, t('settings.cacheClear')),
                ]),
              ),

              h(
                'section',
                { className: 'pb-sect' },
                h('h2', null, t('settings.about')),
                row(
                  'about',
                  t('settings.version', { version: props.version || '—' }),
                  t('settings.aboutDesc'),
                  [
                    h(
                      'button',
                      { key: 'check', type: 'button', className: 'pb-btn pb-btn-quiet', onClick: props.onCheckUpdate },
                      t('settings.checkUpdate'),
                    ),
                    h(
                      'a',
                      {
                        key: 'repo',
                        className: 'pb-btn pb-btn-quiet',
                        href: 'https://github.com/lysforge/dsh-lamplit',
                        target: '_blank',
                        rel: 'noopener noreferrer',
                      },
                      t('settings.repo'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      );
    }

    /** 正文块渲染：标题降两级，段落保留缩进，代码块保留换行。 */
    function blockElement(block, index) {
      const key = 'b' + index;
      if (!block || typeof block !== 'object') return null;
      const value = typeof block.x === 'string' ? block.x : '';
      switch (block.t) {
        case 'h': {
          const level = clamp(block.l || 2, 1, 3);
          return h('h' + (level + 2), { key, className: 'pb-h' + level }, value);
        }
        case 'q':
          return h('blockquote', { key, className: 'pb-q' }, value);
        case 'li':
          return h('p', { key, className: 'pb-li' }, value);
        case 'code':
          return h('pre', { key, className: 'pb-pre' }, h('code', null, value));
        case 'hr':
          return h('hr', { key, className: 'pb-hr' });
        default:
          return h('p', { key, className: 'pb-p' }, value);
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
          { className: 'pb-cfg-seg', role: 'group' },
          options.map((option) =>
            h(
              'button',
              {
                key: option.value,
                type: 'button',
                className: 'pb-cfg-seg-opt',
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
            className: 'pb-cfg-switch',
            'data-on': value ? '1' : '0',
            role: 'switch',
            'aria-checked': value ? 'true' : 'false',
            onClick: () => onChange(!value),
          },
          h('i'),
        );

      return h(
        'aside',
        { className: 'pb-drawer-settings', role: 'dialog', 'aria-modal': 'false', 'aria-label': t('reader.settings') },
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
          { className: 'pb-drawer-settings-body' },
          row(
            t('reader.theme'),
            null,
            h(
              'div',
              { className: 'pb-cfg-swatches' },
              THEMES.map((theme) =>
                h(
                  'button',
                  {
                    key: theme,
                    type: 'button',
                    className: 'pb-cfg-swatch',
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
              className: 'pb-cfg-range',
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
              className: 'pb-cfg-range',
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
              className: 'pb-cfg-range',
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
            'div',
            { style: { display: 'flex', gap: 8, justifyContent: 'center' } },
            h(
              'button',
              { type: 'button', className: 'pb-btn', onClick: () => loadChapter(chapterIndex, null) },
              t('reader.retry'),
            ),
            /登录|Cookie|失效|expired/i.test(String(error))
              ? h(
                  'button',
                  { type: 'button', className: 'pb-btn pb-btn-primary', onClick: () => props.onReconnect && props.onReconnect() },
                  t('reader.reconnect'),
                )
              : null,
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
        const [view, setView] = useState('home');
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
        const [version, setVersion] = useState('0.1.3');

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
          (async () => {
            try {
              const res = await call('/version');
              if (aliveRef.current && res && typeof res.current === 'string') setVersion(res.current);
            } catch (error) {
              /* 版本拿不到就用内置的 */
            }
          })();
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

        /* ---------------- 导出 / 备份 ---------------- */

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

        const copyLibraryPath = useCallback(async () => {
          if (!data.storage) return;
          try {
            await copyToClipboard(data.storage);
            say(tr('toast.copied'));
          } catch (error) {
            say(errorText(error));
          }
        }, [data.storage, say, tr]);

        const checkUpdate = useCallback(async () => {
          try {
            const res = await call('/version');
            const current = res.current || version;
            const latest = res.latest || current;
            if (latest && latest !== current) say(tr('settings.updateReady', { version: latest }));
            else say(tr('settings.upToDate', { version: current }));
            if (aliveRef.current && res.current) setVersion(res.current);
          } catch (error) {
            say(errorText(error));
          }
        }, [say, tr, version]);

        const runBackup = useCallback(async () => {
          setBusy('backup');
          try {
            const state = await call('/state');
            const notesRes = await call('/notes');
            const payload = {
              app: 'lamplit',
              version,
              exportedAt: Date.now(),
              settings: state.settings || {},
              shelf: (state.shelf || []).map((book) => ({
                id: book.id,
                title: book.title,
                author: book.author,
                source: book.source,
                format: book.format,
                chapterCount: book.chapterCount,
                progress: book.progress,
                finished: book.finished,
                addedAt: book.addedAt,
              })),
              notes: notesRes.notes || [],
            };
            const stamp = new Date().toISOString().slice(0, 10);
            saveFile('lamplit-backup-' + stamp + '.json', JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
            say(tr('toast.backupSaved'));
          } catch (error) {
            say(errorText(error));
          } finally {
            if (aliveRef.current) setBusy('');
          }
        }, [say, tr, version]);

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

        const openNotesPage = useCallback(
          (book) => {
            if (book && book.id) {
              setNotesScope('book');
              setNotesBookId(book.id);
            } else {
              setNotesScope('all');
            }
            setSession(null);
            setView('notes');
            refreshAfterReading();
          },
          [refreshAfterReading],
        );

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
            say(tr('toast.providerConnected', { label: tr('filter.weread') }));
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
            say(tr('toast.providerDisconnected', { label: tr('filter.weread') }));
          },
          [say, tr],
        );

        const syncProvider = useCallback(
          async () => {
            try {
              const res = await post('/provider/weread/sync');
              if (!aliveRef.current) return;
              await loadState();
              if (!aliveRef.current) return;
              say(tr('source.syncResult', { added: fmtNumber(res.added), updated: fmtNumber(res.updated) }));
            } catch (error) {
              say(errorText(error));
            }
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
          const started = (book) => {
            const progress = book.progress || {};
            return (book.lastOpenedAt || 0) > 0 || (progress.chapterIndex || 0) > 0 || (progress.percent || 0) > 0;
          };
          return {
            all: shelf.length,
            reading: shelf.filter((book) => !book.finished && started(book)).length,
            finished: shelf.filter((book) => book.finished).length,
            weread: shelf.filter((book) => book.source === 'weread').length,
            local: shelf.filter((book) => book.source !== 'weread').length,
            notes: notes.length,
          };
        }, [shelf, notes.length]);

        const wereadSeconds = useMemo(
          () =>
            shelf.reduce((sum, book) => {
              if (book.source !== 'weread') return sum;
              const remote = book.remote || {};
              return sum + (Number(remote.seconds) || 0);
            }, 0),
          [shelf],
        );

        const filteredBooks = useMemo(() => {
          const needle = query.trim().toLowerCase();
          const list = shelf
            .filter((book) => (sourceFilter === 'all' ? true : sourceFilter === 'local' ? book.source !== 'weread' : book.source === 'weread'))
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
        }, [shelf, sourceFilter, filter, query, sort]);

        const continueBook = useMemo(() => {
          const opened = shelf.filter((book) => !book.finished && (book.lastOpenedAt || 0) > 0);
          if (opened.length === 0) return null;
          return opened.slice().sort((a, b) => (b.lastOpenedAt || 0) - (a.lastOpenedAt || 0))[0];
        }, [shelf]);

        const recentBooks = useMemo(
          () =>
            shelf
              .filter((book) => (book.lastOpenedAt || 0) > 0)
              .slice()
              .sort((a, b) => (b.lastOpenedAt || 0) - (a.lastOpenedAt || 0))
              .slice(0, 5),
          [shelf],
        );

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

        /* ---------------- 组装 ---------------- */

        const dragging = dragDepth > 0;
        const body =
          view === 'shelf'
            ? h(
                'div',
                {
                  style: { display: 'contents' },
                  onDragEnter,
                  onDragOver,
                  onDragLeave,
                  onDrop,
                },
                h(ShelfPage, {
                  t: tr,
                  shelf,
                  books: filteredBooks,
                  counts,
                  filter,
                  onFilter: setFilter,
                  sourceFilter,
                  onSource: setSourceFilter,
                  sort,
                  onSort: setSort,
                  density,
                  onDensity: setDensity,
                  query,
                  onQuery: setQuery,
                  onOpen: openBook,
                  onDelete: removeBook,
                  onFinish: toggleFinished,
                  onImport: () => fileRef.current && fileRef.current.click(),
                  onConnect: () => setSheet(true),
                  onView: setView,
                }),
                dragging ? h('div', { className: 'pb-drop' }, h('strong', null, tr('shelf.dropTitle')), h('span', null, tr('shelf.dropHint'))) : null,
              )
            : view === 'plaza'
              ? h(PlazaPage, { t: tr, onAdded: loadState, shelf: data.shelf, onOpen: openBook })
              : view === 'settings'
                ? h(SettingsPage, {
                    t: tr,
                    settings,
                    onSettings: patchSettings,
                    providers: data.providers,
                    storage: data.storage,
                    version,
                    onSync: syncProvider,
                    onConnect: () => setSheet(true),
                    onDisconnect: () => disconnectProvider('weread'),
                    onCopyPath: copyLibraryPath,
                    onExportShelf: () => runExport('shelf'),
                    onExportNotes: () => runExport('notes'),
                    onBackup: runBackup,
                    onCheckUpdate: checkUpdate,
                  })
                : view === 'notes'
                  ? h(NotesPage, {
                      t: tr,
                      notes: pageNotes,
                      status: notesStatus,
                      error: notesError,
                      scope: notesScope,
                      scopeBookId: notesBookId,
                      onScope: setNotesScope,
                      query: notesQuery,
                      onQuery: setNotesQuery,
                      onReload: loadNotes,
                      onOpen: openFromNote,
                      onDelete: removeNote,
                      onExportBook: (bookId) => runExport('notes', bookId),
                      onExportAll: () => runExport('notes'),
                      onCopy: () => runCopy('notes'),
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
                    : h(HomePage, {
                        t: tr,
                        shelf,
                        stats,
                        providers: data.providers,
                        counts,
                        continueBook,
                        chapterTitle,
                        recent: recentBooks,
                        recentNotes: notes,
                        wereadSeconds,
                        onOpen: openBook,
                        onOpenNote: openFromNote,
                        onOpenNotes: () => openNotesPage(null),
                        onOpenStats: () => setView('stats'),
                        onView: setView,
                        onSync: syncProvider,
                      });

        return h(
          'div',
          { className: 'pb-root' },
          h('style', null, CSS),
          session
            ? null
            : h(TopBar, {
                t: tr,
                view,
                onView: setView,
                onBack: () => setView('home'),
                query,
                onQuery: (value) => {
                  setQuery(value);
                  if (view !== 'shelf' && value !== '') setView('shelf');
                },
                searchRef,
                onImport: () => fileRef.current && fileRef.current.click(),
                onImportPath: importPath,
              }),
          h(
            'div',
            { className: 'pb-stage' },
            body,
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
                  onReconnect: () => setSheet(true),
                })
              : null,
            sheet
              ? [
                  h('div', { key: 'scrim', className: 'pb-scrim', onClick: () => setSheet(false) }),
                  h(SourceSheet, {
                    key: 'sheet',
                    t: tr,
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
