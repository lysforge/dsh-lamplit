# NOTICE

## Vendored code

`lib/vendor/weread/` 里的 `crypto.js`、`reader.js`、`web.js`、`qr-login.js`（以及它依赖的
`qrcode-generator.cjs`）来自 **dsh-weread 1.9.1**
（MIT License，作者见其仓库 `wwjzzy/dsh-weread`）。副本未改动逻辑，仅在文件头加了
来源说明。许可证全文见 `lib/vendor/weread/LICENSE`。

用途：读取**用户自己账号**的微信读书书架、目录与章节正文（网页版接口的签名与
分片解码）。这部分是协议实现，不是 UI 代码；灯下的界面与数据模型是独立实现。

## Original work

其余所有文件（Host 路由、存储、Markdown/TXT/PDF 解析、番茄来源、`client.js` 阅读器
界面、图标、locale）为本插件原创。

## Trademarks

「微信读书」「番茄小说」是各自权利人的商标；本插件只是用户自己账号的本地阅读客户端，
与两家公司无关联，也未获得其背书。
