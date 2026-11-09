# Wort · 我的德语日常

React + Vite + Tailwind CSS，纯前端，数据存浏览器 IndexedDB。无登录、无后端、无付费 API。

## 本地运行

Node.js 版本为 24.13.0（`.node-version` 与本地验证版本一致）。

```sh
npm ci
npm run dev
```

开发地址以终端输出为准，默认 `http://127.0.0.1:5173`。继续使用原来的域名和端口，才能访问原词库。

```sh
npm test
npm run build
npm run preview
```

构建预览默认 `http://127.0.0.1:4173`。PWA 只在构建预览或部署后的站点启用，开发服务器不注册 Service Worker。

## 已有功能

- 三个主导航：学习、词书、数据；设置由桌面侧栏底部或移动端底栏齿轮进入。闪卡和强化训练从学习页进入；手动加词和冠词配色保留。
- 每日新词默认上限 10，只从未学词取，扣除当天完成的新词；顺序模式按词书原序，乱序模式按当天额度随机抽取。
- 新词和复习闪卡、德语发音、快捷键、本地保存的进行中轮次；原有评分规则不变。
- CSV / JSON 批量导入先预览后确认；JSON 词库包列表与导入。两者共用合并去重逻辑，重复不覆盖进度。
- 独立的整库备份与恢复；PWA 离线外壳；≤768px 底部导航、至少 48px 按钮。
- 输出型强化训练：学习中的词每轮最多 10 个，按答错次数优先；听写、看中文写德语、冠词快测及混合模式。错词本自动收录答错至少 2 次的词。
- 强化训练新增例句挖空；数据页显示未来 7 天到期预报、错词本与学习概览。
- 假期模式暂停假期内的新词和新到期复习，结束后按原到期顺序分摊到返程后 3 天；当前级别未学词少于 50 时提示下一词包；备份超过 7 天时提醒。
- 内置歌德 A1 / A2 / B1 词书按需加载，沿用词包导入去重；可指定当前词书，只从该书未学池选每日新词。词书页底部集中放课程、词典和考试材料的外部链接。
- A2 标准词书按与 A1 的 `german+article` 去重后为 556 个净新词（核心主动 355、被动认读 80、扩展认读 121）。旧 A2 词书可升级书目；已有词条及学习进度不删除。
- A2-0 已固定 29 个语法主线与工具单元顺序；A2-1 已录入前 9 个单元（发音 2、语法 6、工具 1），列在语法页的 A2 分组。成绩沿用 `wort-grammar-v1`，A1 进度不变。
- 语法页包含发音 P1–P6、语言工具 T1–T4、32 个 A1 语法单元与 10 个情景单元。A1 词书为 745 条，可按核心主动、被动认读、扩展认读筛选；数据页提供六项 A1 出口测评。
- 设置页提供从 0 开始、不设最大值的每日新词上限、两种新词和复习出场顺序、自动朗读与语速、复习流水导出，以及需二次确认的整库清除。SM-2 评分不变，FSRS 暂未启用。

词包格式见 [WORD_PACK_FORMAT.md](WORD_PACK_FORMAT.md)，示例为 `examples/word-pack.json` 和 `examples/words.csv`。闪卡验收见 [STEP3_ACCEPTANCE.md](STEP3_ACCEPTANCE.md)，本次四项验收见 [BACKUP_PWA_ACCEPTANCE.md](BACKUP_PWA_ACCEPTANCE.md)。

输出型强化训练逐项验收见 [OUTPUT_ACCEPTANCE.md](OUTPUT_ACCEPTANCE.md)。答错立即复用 SRS 的「忘了」更新，答对不改排程；训练轮次另存于 `settings.outputSession`，不改变单词字段或现有 SRS 轮次。

本次扩展验收见 [STEP6_ACCEPTANCE.md](STEP6_ACCEPTANCE.md)。概览的累计复习次数与强化正确率从本次更新起记录；旧数据没有完整的逐次作答历史，无法反推此前次数。历史新词完成日会计入连续天数。暂停和统计都使用现有 `settings` 仓库，数据库版本与单词字段不变。

第七步的逐项验收见 [STEP7_ACCEPTANCE.md](STEP7_ACCEPTANCE.md)。假期日期、假期历史和备份提醒时间均保存在现有 `settings` 仓库，单词字段和数据库版本不变。没有旧版导出日期记录的浏览器，从首次打开本版本时开始计算 7 天提醒。

第八步的逐项验收见 [STEP8_ACCEPTANCE.md](STEP8_ACCEPTANCE.md)。三个内置 JSON 在 `public/wordbooks/`，打开页面只显示书目，点击加入时才读取对应文件。首次加入后，词包存于现有 `packs` 仓库，新增词经现有 `importWords` 入库；当前词书的 ID 和词键列表保存在现有 `settings` 仓库。没有指定当前词书时，沿用之前从全部未学词选取的行为。

第十步的逐项验收见 [STEP10_ACCEPTANCE.md](STEP10_ACCEPTANCE.md)。学习偏好和每次复习评分流水使用现有 `settings` 仓库，数据库版本及单词字段不变。复习流水从本版本开始记录，无法补出旧版逐次评分。

语法第三步的逐项验收见 [GRAMMAR_STEP3_ACCEPTANCE.md](GRAMMAR_STEP3_ACCEPTANCE.md)。新增单元内容来自用户提供的第三步文档，已生成到 `src/data/grammarA1More.json`，网站运行不依赖下载目录。原两个单元 ID 保持不变。

语法第四步的逐项验收见 [GRAMMAR_STEP4_ACCEPTANCE.md](GRAMMAR_STEP4_ACCEPTANCE.md)。四个名词与格单元的数据来自用户提供的第四步文档，存于 `src/data/grammarA1Cases.json`；词汇数据库、学习算法和原语法单元 ID 未改变。

A1 总纲的初始差距见 [A1_COVERAGE_AUDIT.md](A1_COVERAGE_AUDIT.md)。发音 P1–P6 的逐项内容与词例来源见 [PRONUNCIATION_COVERAGE.md](PRONUNCIATION_COVERAGE.md)。发音数据位于 `src/data/pronunciationA1.json`，网站运行不依赖下载目录。已完成的旧 `g-a1-00` 进度迁移到 P1；A1 内容以补全包 1–5 为准。

## 备份与恢复

「设置 → 数据管理 → 导出备份」下载 `Wort-backup-YYYY-MM-DD-HHMMSS.json`，文件名取设备本地日期和时间。文件包含：

- `words`：全部词条原字段、ID、添加时间、导入顺序、级别及 `status`、`dueAt`、`intervalDays`、`ease`、`reps`、`lapses`。
- `settings`：每日上限、导入计数器、每日已学记录、进行中轮次及其他已有设置。
- `packs`：已添加的词包列表和词条。
- `grammar`：语法单元完成状态、最高分和练习次数；旧备份缺少此字段时按空进度恢复。
- `a1Exit`：六项 A1 出口测评最近成绩与尝试次数；旧备份缺少此字段时按空进度恢复。
- 标识 `format: "wort-backup"`、`formatVersion: 1`、`databaseVersion: 3`、导出时间 `exportedAt`。

恢复时选择该 JSON，校验通过后展示时间、词数、词包数和每日上限；勾选确认后点击「确认整库恢复」。**恢复完整替换当前数据，备份没有的词、记录和词包会移除。** 建议先导出当前版本。取消或校验失败不写入，写入失败回滚整笔事务；成功后其他同站点页面自动刷新。

备份不做去重或内容规范化，已有字段原样还原。词包文件不能作为备份恢复，备份文件也不能作为批量词条或词包导入。

## 数据兼容与存储

本次保留 IndexedDB `wort-daily` **版本 3** 和 `words`、`settings`、`packs` 三个仓库，不修改已有单词结构。

原 v1→v2 迁移只追加 status/importOrder，v2→v3 追加学习进度，保留原词内容、ID 和设置。`settings` 的 `studySession` 保存轮次，`learned:YYYY-MM-DD` 保存当天完成的词 ID。今日按设备本地日期计算。

数据只属于当前浏览器的当前站点；不同域名、端口、浏览器或设备不共享。清除网站数据会删除词库和缓存。迁移到 Cloudflare 域名时，先从原地址导出备份，再到新地址恢复。备份文件由你保存，不上传服务器。

## 部署

项目通过 GitHub Actions 发布到 GitHub Pages：推送 `main` 后自动运行 `npm run build`，输出目录为 `dist`。发布地址：<https://yifanwang963-code.github.io/wort/>。

GitHub 仓库需允许 Pages，Pages 的 Build and deployment 来源选 **GitHub Actions**。账号同步构建变量需在仓库 Settings → Secrets and variables → Actions 中配置为 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_PUBLISHABLE_KEY`；不配置时仍可使用本地学习功能，但账号同步不可用。

项目根目录配置了 GitHub Pages 子路径 `/wort/`，Cloudflare Pages 构建仍使用根路径 `/`。PWA manifest 与 Service Worker 会跟随部署路径设置作用域和缓存地址。

### Cloudflare Pages

Cloudflare Pages 仍保留自动部署；推送 `main` 会同时更新 Cloudflare Pages。

| 配置项 | 值 |
| --- | --- |
| 框架预设 | React (Vite) |
| 根目录 | 此项目根目录，包含 package.json |
| 构建命令 | `npm run build` |
| 输出目录 | `dist` |
| Node.js | `.node-version` 指定 24.13.0 |
| Functions / 后端 / API 密钥 | 不需要 |

Git 部署：将源文件（含 `package-lock.json`、`public`、`scripts`、`.node-version`）放入仓库，在 Cloudflare Pages 连接仓库并填写上表。不要提交 `node_modules`、`.npm-cache` 或个人备份。也可在本地构建后，将完整 `dist` 目录作为静态文件上传。

`npm run build` 自动执行 `postbuild`，按产物内容生成 `dist/sw.js` 和缓存版本。不要只运行 `vite build`，否则不会生成离线脚本。生产目录包含 HTML、JS、CSS、manifest、图标、Service Worker 和 `_headers`。

`public/_headers` 对 HTML、manifest、Service Worker 设置重新验证缓存，对带哈希的构建资源设置长期缓存。四个主路由为 `#study`、`#wordbooks`、`#data-overview` / `#data-library`、`#settings`；闪卡继续使用 `#learn`、`#review`、`#output`，无需额外路由配置。旧 `#today`、`#library`、`#resources` 地址仍能打开对应新页面。官方说明：[构建配置](https://developers.cloudflare.com/pages/configuration/build-configuration/)、[Node 版本](https://developers.cloudflare.com/pages/configuration/build-image/)、[响应头](https://developers.cloudflare.com/pages/configuration/headers/)。

## PWA 与离线

Manifest 名称 **Wort**，`display: standalone`。`public/icons/wort-192.png`、`wort-512.png` 由原有紫底 Georgia 斜体 w. 标识导出；源 SVG 和 Windows 导出脚本 `scripts/generate-icons.ps1` 已保留。

首次联网打开构建版后，缓存 HTML、JS、CSS、manifest、图标。缓存安装完成后，离线重新打开或刷新仍能进入各页面，添加、学习、复习、导入和备份继续操作本机数据。内置词书不预缓存；首次点击加入时读取并缓存该 JSON，之后可离线再次读取。词库不进入应用外壳缓存，也不上传网络。首次从未访问过的站点不能离线加载；词书页底部的外部资源链接需要联网。

手机通过浏览器「添加到主屏幕」或「安装应用」进入独立窗口。真实手机使用 Cloudflare HTTPS 地址验收；手机访问电脑的普通局域网 HTTP 地址不适合 PWA 验收。[Service Worker 安全上下文和安装说明（MDN）](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers)。

更新时先联网打开，让新缓存下载完成，再关闭该站点所有标签页和独立窗口后重开；应用缓存更新不清除 IndexedDB。发音沿用设备 Web Speech API，离线朗读取决于设备是否安装本地德语语音。

## 自动检查

`npm test` 覆盖旧数据库迁移、导入去重与回滚、每日额度、闪卡评分、完整备份往返、错误备份保护、整库恢复回滚、离线外壳及 PNG 尺寸。`npm run build` 检查生产构建。

## Optional account sync (Supabase)

The app remains usable as a local guest without these variables. For local account testing, put `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the ignored `.env.local` file. For Cloudflare Pages, add the same two variables to both Production and Preview environments, then trigger a new build. Never put a `sb_secret_` key in the frontend.

Before enabling accounts, run [`supabase/user_data.sql`](supabase/user_data.sql) in the Supabase project's SQL Editor. It creates the single per-user snapshot table and restricts all row operations to `auth.uid() = user_id`. Keep email confirmation disabled if registration should immediately start a session. Set the password recovery redirect URL to the deployed site origin in Supabase Auth URL configuration.

Account sync stores the existing complete Wort backup plus the grammar-level selection in one JSON row. It waits five seconds after local changes, retries on reconnect, and flushes when the page is hidden. First-time devices prompt before replacing different local/cloud datasets. Logout leaves local data untouched.

### Release checks for account sync

1. Create/login to account A on device A. Login on device B with the same account; confirm the same words, SRS state, grammar progress and exit scores appear.
2. Review five due words on B; refresh A and confirm the new due dates and review count.
3. Disconnect A, complete a learning round, reconnect, wait for “已同步”, then confirm the new progress on B.
4. In a clean browser, use the site without logging in; adding words, learning, backup and restore must work locally.
5. Logout, continue seeing the local library, then login again and confirm the cloud snapshot is restored.

RLS verification is available in `supabase/rls_self_test.sql`: it uses a synthetic authenticated claim and a temporary row inside a transaction, asserts that user A cannot see user B's row, then rolls back. The project check should show four policies and zero rows left behind.

Build and output directory for Cloudflare Pages: `npm run build` and `dist`.
