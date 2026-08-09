<a id="top"></a>

# Civicomfy

<div align="center">

**🇯🇵 日本語** ・ <a href="#english">🇬🇧 English</a>

</div>

**Civitai・HuggingFace のモデルダウンローダーを ComfyUI に統合。**

ComfyUI を離れることなく、モデルの検索・閲覧・ダウンロードから、すでに手元にあるモデルの管理までこなせます。ツールバーのボタン一つですべてが開きます。

---

## できること

- 🔍 **閲覧・検索** — Civitai のカタログを検索(Meilisearch 採用)
- ⬇️ **ダウンロード** — Civitai / HuggingFace から URL・ID 指定で
- 📂 **自動振り分け** — 適切な ComfyUI フォルダへ保存(checkpoints・loras・vae など)
- 🗂️ **My Models** — インストール済みモデルの一覧・並び替え・削除
- 🖼️ **ギャラリー** — ワークフローが生成した画像**と動画**を閲覧
- 📊 **ダウンロード** — 進行中の転送・キュー・履歴をリアルタイム表示
- 🎨 **Claude テーマ** — ダーク/クリームの温かみのある統一デザイン

---

## スクリーンショット

<img width="920" alt="ダウンロード — リンクを貼ってフォルダを選ぶ" src="docs/images/download.png" />

コミット前にプレビューで確定 — 正確なファイル、正確なフォルダ、コピーできるトリガーワード。

<img width="920" alt="ダウンロード — モデルのライブプレビュー" src="docs/images/download-preview.png" />

<table>
<tr>
<td width="50%"><img alt="Civitai を閲覧" src="docs/images/browse.png" /><br><em>Browse — 検索・絞り込み・キュー</em></td>
<td width="50%"><img alt="My Models" src="docs/images/my-models.png" /><br><em>My Models — ディスク上のすべて</em></td>
</tr>
<tr>
<td width="50%"><img alt="ダウンロード" src="docs/images/downloads.png" /><br><em>Downloads — 実行中・待機中・履歴</em></td>
<td width="50%"><img alt="ライトテーマのギャラリー" src="docs/images/gallery-light.png" /><br><em>ギャラリー — ライトテーマ、複数選択</em></td>
</tr>
<tr>
<td width="50%"><img alt="ライトテーマの設定" src="docs/images/settings-light.png" /><br><em>Settings — ライトテーマ</em></td>
<td width="50%"><img alt="アイコンレールに折りたたんだサイドバー" src="docs/images/collapsed.png" /><br><em>サイドバーをアイコンレールに折りたたみ</em></td>
</tr>
</table>

> 実際のインターフェースを撮影したものです。モデル名・サムネイル・件数はプレースホルダーです。

---

## インストール

```bash
cd ComfyUI/custom_nodes
git clone https://github.com/KBYSHanahira/Civicomfy.git
```

ComfyUI を再起動すると、右上のツールバーに **Civicomfy** ボタンが表示されます。

---

## 30秒で始める

1. ツールバーの **Civicomfy** をクリック
2. **Settings(設定)** を開き、[Civitai API キー](https://civitai.com/user/account) を貼り付け
3. **Download(ダウンロード)** タブに Civitai または HuggingFace のリンクを貼り付け
4. **Start download** をクリック — 進捗は **Downloads** で確認

> 💡 API キーがなくても HuggingFace のファイルは閲覧・ダウンロードできます。Civitai のダウンロードには無料の API キーが必要です。

---

## インターフェース

**サイドバーナビゲーション。** セクションは目的別にまとめられています —
**Get models**(Download, Browse)、**Library**(My Models, Gallery)、
**Activity**(Downloads)、**Configure**(Settings, Directories)。現在のセクション名と
1行の説明が上部バーに表示され、**Downloads** のバッジがアプリのどこからでも進行中の
転送数を数えます。

**ウィンドウに合わせて縮小。** サイドバーは 60px のアイコンレールに折りたためるほか、
ウィンドウが狭くなるとスライドオーバーのドロワーになります。各パネルは自身のスクロール
位置を保持し、長いフォームは主要なアクションを画面外に隠さず下部に固定します。

**Claude テーマ、2つのパレット。** 既定は温かみのあるダーク、必要に応じて温かみのある
クリーム — サイドバー下部のトグルで切り替えます。すべての色は1つのトークンセットに由来する
ため、バッジやプログレスバーに至るまで両パレットで一貫します。選択はブラウザごとに記憶
されます。

**キーボードとマウス。** `Esc` でウィンドウ(または最前面のパネルだけ)を閉じ、
矢印キーでギャラリーのライトボックスを送り、カードグリッドは各ツールバーのスライダーで
ライブにサイズ変更できます。

---

## 各セクション

### 📥 Download(ダウンロード)

次のいずれかを貼り付ければ、あとは Civicomfy が処理します:

- Civitai モデル URL: `civitai.com/models/12345`
- Civitai モデル ID: `12345`
- Civitai バージョン URL: `…?modelVersionId=67890`
- HuggingFace ファイル URL: `huggingface.co/.../resolve/main/model.safetensors`

**得られるもの:**
- モデルのライブプレビュー(画像、ファイルバリアント、バージョン情報)
- モデルタイプに基づく保存先フォルダの自動選択
- 任意: 特定のファイルバリアントを選択(fp16 / fp8、pruned / full など)
- 任意: サブフォルダを選択、またはその場で新規作成
- 任意: ファイル名を変更
- **重複検出** — 既存のファイルは再ダウンロードしません(設定でより深いチェックを有効化可能 — MKLink/ジャンクションでマウントされたものを含む全サブフォルダを走査)
- **強制再ダウンロード** — 本当に上書きしたいときは重複検出を無視

**対応する Civitai ドメイン:** `civitai.com`, `civit.com`, `civit.red`, `civitai.red`

---

### 🔎 Browse(閲覧)

Civitai からモデルを検索・発見します。

- **タイプ**、**ベースモデル**(SDXL, SD 1.5, Flux, Pony, Illustrious, Wan, Hunyuan ほか35種以上)、**並び順**、**ページサイズ** で絞り込み
- モデルカードをクリック → Download タブに自動入力
- NSFW サムネイルは設定したしきい値を超えるとぼかし表示(クリックで表示)
- 絞り込みと検索はセッションをまたいで記憶

> Browse は少なくとも1つのフィルター(検索テキスト・タイプ・ベースモデルのいずれか)が必要です。

---

### 📊 Downloads(アクティビティ)

ダウンロード状況のライブダッシュボード。

- **Active(実行中)** — 速度・進捗%・経過時間つき
- **Queued(待機中)** — 待機ジョブ(同時実行は最大3件)
- **History(履歴)** — 直近100件の完了/失敗/キャンセル、再起動後も保持
- **キャンセル**、**再試行**、**フォルダを開く**、**履歴をクリア**

モーダルを開いている間、3秒ごとにポーリングします。

---

### 🗂️ My Models

ディスク上にあるモデルを管理します。

- すべての ComfyUI モデルフォルダを再帰的にスキャン
- Civitai のサイドカーファイル(`.preview.jpeg`)からサムネイルを表示
- タイプで絞り込み、名前/パスで検索、名前/サイズ/日付で並び替え
- **Civitai で開く** • **詳細を見る**(説明・トリガーワード — クリックでコピー)• **削除**(確認あり)
- 対応形式: `.safetensors`, `.ckpt`, `.pt`, `.pth`, `.bin`, `.gguf`, `.sft`

---

### 🖼️ ギャラリー

ComfyUI の **output** フォルダをグリッド表示 — ワークフローが実際に生成した画像と動画。

- **画像と動画に対応**(`.mp4` / `.webm` / `.mov` / `.m4v`)。動画カードは先頭フレームをポスターとして表示し、▶ バッジで動画だと一目でわかります
- **ライトボックスで動画を再生** — ネイティブのコントロール(再生・シーク・音量)つき。`ffmpeg` などの追加依存は不要
- サブフォルダで絞り込み、日付/名前で並び替え、サムネイルサイズをライブ変更
- ライトボックスは矢印キーで移動、ズーム対応
- 複数選択で一括 **ダウンロード** / **削除**

---

### 🧭 Directories(ディレクトリ)

任意のモデルタイプを好きなフォルダに割り当てられます — checkpoint と LoRA を別ドライブに
置いている場合などに便利です。行を空欄にすると ComfyUI のデフォルト(プレースホルダーで
表示)を維持します。パスは保存前にサーバー側で検証され、上書き設定は
`directory_overrides.json` に保持されます。

---

### ⚙️ Settings(設定)

| 設定 | 内容 |
|---|---|
| **Civitai API キー** | Civitai からのダウンロードに必要 |
| **HuggingFace トークン** | ゲート付き/非公開の HF モデルに必要 |
| **デフォルトモデルタイプ** | Download タブで最初に選択される種類 |
| **ダウンロードを自動で開く** | キュー投入後に Downloads へ移動 |
| **サブフォルダの詳細チェック** | 重複チェック時に、対象フォルダだけでなく全サブフォルダ(および MKLink/ジャンクションでマウントされたドライブ)を走査 |
| **成人向けコンテンツを隠す** | Browse 結果から NSFW を除外 |
| **NSFW ぼかししきい値** | この `nsfwLevel` 以上のサムネイルをぼかす(0–128) |
| **モデルメンテナンス** | 任意のカテゴリのメタデータ/サムネイルを一括更新 |

設定はブラウザの Cookie に保存されます(365日)。API キーはサーバーのファイルシステムに
一切保存されず、ブラウザからリクエストごとに送信されます。

---

## ダウンロードの仕組み

1. **HEAD リクエスト** で最終 URL を解決し、サーバーがバイトレンジ要求に対応しているか確認
2. **100MB 超かつレンジ対応** → N 個の並列チャンクに分割
3. **それ以外** → 単一のストリーミング接続
4. 各チャンクは指数バックオフで最大 **3回** 再試行
5. 進捗は 0.5 秒ごとに更新
6. キャンセル時は部分ファイルをクリーンに削除

> ⚠️ **既知の問題:** マルチ接続ダウンロードには現在バグがあります。確実性のため接続数は 1 にしてください。

### サイドカーファイル(Civitai のみ)

| ファイル | 内容 |
|---|---|
| `<name>.cminfo.json` | モデルのメタデータ、ベースモデル、トリガーワード、説明、サンプルプロンプト |
| `<name>.preview.jpeg` | Civitai の 450px サムネイル |

HuggingFace のダウンロードはサイドカーを作成しません。

### 制限

| | |
|---|---|
| 同時ダウンロード | 3 |
| 履歴エントリ | 100 |
| 履歴の保存先 | `download_history.json` |

---

## MKLink / シンボリックリンク / ジャンクション対応

モデルを外付けドライブに保存し `mklink /D` や `mklink /J` でリンクしている場合、
Civicomfy はリンクをたどります — サブフォルダのドロップダウンも重複ファイルスキャナーも
その中に入って走査します。循環リンクは検出してスキップします。

---

## 変更履歴

### 2.3.0

- **ギャラリーで動画を再生。** output フォルダの動画(`.mp4` / `.webm` / `.mov` / `.m4v`)が画像と並んで一覧に表示されるようになりました。グリッドのカードは動画の先頭フレームをポスターとして表示し、▶ バッジがつきます。ライトボックスではネイティブのコントロール(再生・シーク・音量)で再生できます。ComfyUI の `/view` ルート(すでに HTTP レンジ対応でファイルを配信)を指す `<video>` 要素でクライアント側で描画するため、**`ffmpeg` などの追加依存は不要**です。output のスキャンと削除のルートが動画拡張子を認識し、各エントリにクライアントが描画を切り替えるための `media_type` を付与します。

### 2.2.0

- **ギャラリーのライトボックスにダウンロード/削除ボタンを追加。** 以前は「前へ / 次へ / 閉じる」しか操作がなく、画像を保存・削除するにはビューアを閉じてカードを探し直す必要がありました。削除は確認のうえ次の画像へ進むので、開き直さずに選別を続けられます。残りがなくなればビューアを閉じます。ダウンロードは常にサムネイルではなくフル解像度の原本を取得します。
- **修正: 画像を削除した後にギャラリーカードをクリックすると誤った画像が開く問題。** カードは生成時にグリッド上の位置を保持していましたが、画像を削除すると以降のカードが1つずつ繰り上がるため、保持した位置が静かに隣の画像を指していました。カードはクリック時に位置を読み取り、削除のたびに振り直すようになりました。これは新しいライトボックスのボタンだけでなく、既存のカード個別削除にも影響していました。
- **修正: 削除確認の背後で矢印キーが画像を切り替えてしまう問題。** ダイアログは Escape と Enter は受け止めますが矢印キーは通すため、確認中もライトボックスが背後で移動していました。

### 2.1.0

パフォーマンス強化リリース。2つの画像グリッドは、数百ピクセル幅のサムネイルを描くために
フル解像度の原本をブラウザへ送っており、これがカクつきの原因でした。

**サムネイル**

- **新しいキャッシュ付きサムネイルサービス**(`server/routes/Thumbnails.py`)。画像は一度だけ WebP に縮小してディスクにキャッシュし、immutable なキャッシュヘッダーつきで配信します。元ファイルの mtime を URL に含めるため、再生成された画像は古いキャッシュに当たらず新しい URL になります。
  - ギャラリー: 50件のページが **276MB → 約1.1MB**。
  - My Models: 50件のページが **134MB → 約1.8MB**。
  - デコードはイベントループ外の小さな上限付きスレッドプールで実行され、閲覧が ComfyUI サーバー(キューを含む)をブロックしたり、実行中の生成から CPU を奪ったりしません。同一画像への同時リクエストは1回のデコードにまとめられます。
  - キャッシュは最大4000ファイルで、古いものから削除します。アップグレード後の初回アクセスで初期セットを生成し(1画像あたり約100ms)、以降はディスクから配信します。
- **ライトボックスが即座に開く** — 先にキャッシュ済みサムネイルを描画し、フルサイズ画像が届いたら差し替えます。ギャラリーのライトボックスは隣接画像も先読みするため、矢印キー移動で止まりません。
- **Send to Workflow** はフルプレビューではなくサムネイル URL をノードに載せるようになりました。ノードは 580px のボックスに描画し、ワークフローにある間ビットマップを保持し続けるため、従来はノードごとに数MBのキャンバスメモリを消費していました。
- **Download タブ** は Civitai の CDN に表示サイズの画像を要求します。従来プレビュー URL は `original=true`(フルアップロード)で届き、ブラウザ側で縮小していました。

**スクロール**

- My Models のカードは `content-visibility` を使い、画面外のカードはレイアウトと描画をスキップします。ギャラリーのグリッドはすでに対応済みで、My Models だけがカクついていた理由です。
- 両グリッドのホバーオーバーレイのぼかしを `:hover` に限定しました。従来は無条件に宣言され、各カードに常時合成される3層を与えていました — **1ページ151層 → 現在1層**。
- My Models はライブのグリッドへ50回追加する代わりに、ドキュメントフラグメント内でカードを構築します。

**修正**

- **ベースモデルのフィルター選択がセッション間で記憶される** ようになりました。保存設定に書き込まれておらず、リロードのたびにリセットされていました。
- **マルチ接続ダウンロード** をキャンセル/失敗してもワーカースレッドを放置しなくなりました。従来はスレッドが動作中に一時ディレクトリが削除され、Windows ではモデルディレクトリに `.<name>.parts_<id>` フォルダが取り残されていました。スレッドは上限付きで join し、クリーンアップは諦める前に再試行します。
- output フォルダのスキャンは、ページクリック・並び替え・サブフォルダ切り替えのたびに全画像を歩き直す代わりに短時間キャッシュします。画像の削除で無効化し、**Refresh** で強制的に再スキャンします。

---

## コントリビュート

PR を歓迎します。

<div align="center">

[⬆ 上へ戻る](#top)

</div>

---
---

<a id="english"></a>

# Civicomfy

<div align="center">

<a href="#top">🇯🇵 日本語</a> ・ **🇬🇧 English**

</div>

**A Civitai & HuggingFace model downloader, built into ComfyUI.**

Browse, search, and download models — and manage the ones you already have — without leaving ComfyUI. One button in the toolbar opens everything.

---

## What it does

- 🔍 **Browse & search** Civitai's catalogue (powered by Meilisearch)
- ⬇️ **Download** from Civitai *or* HuggingFace by URL/ID
- 📂 **Auto-saves** to the right ComfyUI folder (checkpoints, loras, vae, etc.)
- 🗂️ **My Models** — see, sort, and delete locally installed models
- 🖼️ **Gallery** — browse the images *and videos* your workflows produced
- 📊 **Downloads** — watch active transfers, queue, and history in real time
- 🎨 **Claude theme** — one warm design system, in dark or cream

---

## Screenshots

<img width="920" alt="Download — paste a link, pick a folder" src="docs/images/download.png" />

The preview resolves before you commit: exact file, exact folder, trigger words ready to copy.

<img width="920" alt="Download — live model preview" src="docs/images/download-preview.png" />

<table>
<tr>
<td width="50%"><img alt="Browse Civitai" src="docs/images/browse.png" /><br><em>Browse — search, filter, queue</em></td>
<td width="50%"><img alt="My Models" src="docs/images/my-models.png" /><br><em>My Models — everything on disk</em></td>
</tr>
<tr>
<td width="50%"><img alt="Downloads" src="docs/images/downloads.png" /><br><em>Downloads — active, queued, history</em></td>
<td width="50%"><img alt="Gallery in the light theme" src="docs/images/gallery-light.png" /><br><em>Gallery — light theme, multi-select</em></td>
</tr>
<tr>
<td width="50%"><img alt="Settings in the light theme" src="docs/images/settings-light.png" /><br><em>Settings — light theme</em></td>
<td width="50%"><img alt="Sidebar collapsed to an icon rail" src="docs/images/collapsed.png" /><br><em>Sidebar collapsed to an icon rail</em></td>
</tr>
</table>

> Captured from the real interface; model names, thumbnails and counts are placeholder data.

---

## Install

```bash
cd ComfyUI/custom_nodes
git clone https://github.com/KBYSHanahira/Civicomfy.git
```

Restart ComfyUI. A **Civicomfy** button appears in the top-right toolbar.

---

## Get started in 30 seconds

1. Click **Civicomfy** in the toolbar
2. Open **Settings** → paste your [Civitai API Key](https://civitai.com/user/account)
3. Paste a Civitai or HuggingFace link into the **Download** tab
4. Click **Start download** — watch progress in **Downloads**

> 💡 No API key? You can still browse and download HuggingFace files. Civitai downloads need a free API key.

---

## The interface

**Sidebar navigation.** Sections are grouped by what you're trying to do —
**Get models** (Download, Browse), **Library** (My Models, Gallery),
**Activity** (Downloads), **Configure** (Settings, Directories). The current
section's name and a one-line description sit in the top bar, and a badge on
**Downloads** counts transfers in flight from anywhere in the app.

**It shrinks with the window.** Collapse the sidebar to a 60 px icon rail, or let
it become a slide-over drawer when the window gets narrow. Every panel keeps its
own scroll position, and long forms keep their primary action pinned to the
bottom instead of hiding it below the fold.

**Claude theme, two palettes.** Warm dark by default, warm cream on request —
switch with the toggle at the bottom of the sidebar. Every colour comes from one
token set, so both palettes stay consistent down to the badges and progress bars.
Your choice is remembered per browser.

**Keyboard & mouse.** `Esc` closes the window (or just the panel on top of it),
arrow keys page through the gallery lightbox, and card grids resize live with the
slider in each toolbar.

---

## The sections

### 📥 Download

Paste any of these and Civicomfy handles the rest:

- Civitai model URL: `civitai.com/models/12345`
- Civitai model ID: `12345`
- Civitai version URL: `…?modelVersionId=67890`
- HuggingFace file URL: `huggingface.co/.../resolve/main/model.safetensors`

**What you get:**
- A live preview of the model (images, file variants, version info)
- Auto-selected save folder based on model type
- Optional: pick a specific file variant (fp16 vs fp8, pruned vs full, etc.)
- Optional: choose a subfolder, or create a new one inline
- Optional: rename the file
- **Duplicate detection** — won't re-download a file that already exists (toggle a deeper check in Settings — scans every subfolder including MKLink/junction-mounted ones)
- **Force Re-download** — overrides duplicate detection when you actually want to overwrite

**Supported Civitai domains:** `civitai.com`, `civit.com`, `civit.red`, `civitai.red`

---

### 🔎 Browse

Search and discover models from Civitai.

- Filter by **type**, **base model** (SDXL, SD 1.5, Flux, Pony, Illustrious, Wan, Hunyuan, +35 more), **sort order**, **page size**
- Click a model card → pre-fills the Download tab
- NSFW thumbnails are blurred above your chosen threshold (click to reveal)
- Your filters and search are remembered between sessions

> Browse needs at least one filter active (search text, type, or base model).

---

### 📊 Downloads (Activity)

A live dashboard for everything that's downloading.

- **Active** — current downloads with speed, progress %, time elapsed
- **Queued** — waiting jobs (up to 3 run at once)
- **History** — last 100 finished/failed/cancelled downloads, persisted across restarts
- **Cancel**, **retry**, **open folder**, **clear history**

Polls every 3 seconds while the modal is open.

---

### 🗂️ My Models

Manage models already on disk.

- Recursive scan of every ComfyUI model folder
- Preview thumbnails from Civitai sidecar files (`.preview.jpeg`)
- Filter by type, search by name/path, sort by name/size/date
- **Open on Civitai** • **View Detail** (description, trigger words — click to copy) • **Delete** (with confirmation)
- Supports `.safetensors`, `.ckpt`, `.pt`, `.pth`, `.bin`, `.gguf`, `.sft`

---

### 🖼️ Gallery

A grid view of your ComfyUI **output** folder — the images and videos your workflows actually produced.

- **Images and videos** (`.mp4` / `.webm` / `.mov` / `.m4v`). Video cards show the first frame as a poster with a ▶ badge, so a clip reads as a video at a glance
- **Play videos in the lightbox** with native controls (play, seek, volume) — no `ffmpeg` or extra dependency required
- Filter by subfolder, sort by date or name, resize thumbnails live
- Lightbox with arrow-key navigation and zoom
- Multi-select for batch **download** or **delete**

---

### 🧭 Directories

Point any model type at a folder of your choosing — handy when checkpoints live
on a different drive from LoRAs. Leave a row blank to keep ComfyUI's default
(shown as the placeholder). Paths are validated on the server before they're
saved, and overrides persist in `directory_overrides.json`.

---

### ⚙️ Settings

| Setting | What it does |
|---|---|
| **Civitai API Key** | Required to download from Civitai |
| **HuggingFace Token** | Needed for gated/private HF models |
| **Default model type** | What's pre-selected in the Download tab |
| **Auto-open Downloads** | Jumps to Downloads after queuing a download |
| **Deep subfolder check** | When checking for duplicates, scans every subfolder (and MKLink/junction-mounted drives) instead of just the target folder |
| **Hide mature content** | Filter NSFW out of Browse results |
| **NSFW blur threshold** | Blur thumbnails at this `nsfwLevel` and above (0–128) |
| **Model Maintenance** | Bulk-refresh metadata or thumbnails for any category |

Settings live in a browser cookie (365 days). API keys never touch the server's filesystem — they're sent per-request from your browser.

---

## How downloads work

1. **HEAD request** to resolve the final URL and check if the server supports byte-range requests
2. **Big files (>100 MB) with range support** → split into N parallel chunks
3. **Otherwise** → single streaming connection
4. Each chunk retries up to **3 times** with exponential backoff
5. Progress updates every 0.5 s
6. Cancel cleanly removes partial files

> ⚠️ **Known issue:** Multi-connection downloads currently have a bug. Use 1 connection for reliability.

### Sidecar files (Civitai only)

| File | What's inside |
|---|---|
| `<name>.cminfo.json` | Model metadata, base model, trigger words, description, sample prompts |
| `<name>.preview.jpeg` | 450 px thumbnail from Civitai |

HuggingFace downloads don't create sidecars.

### Limits

| | |
|---|---|
| Concurrent downloads | 3 |
| History entries | 100 |
| History storage | `download_history.json` |

---

## MKLink / symlink / junction support

If you store models on an external drive and link them in with `mklink /D` or `mklink /J`, Civicomfy follows the links — both the subfolder dropdown and the duplicate-file scanner walk into them. Circular links are detected and skipped.

---

## Changelog

### 2.3.0

- **Video playback in the Gallery.** Output-folder videos (`.mp4`, `.webm`, `.mov`, `.m4v`) now list alongside images. Grid cards show the video's first frame as a poster with a ▶ badge, and the lightbox plays the clip with native controls (play, seek, volume). Rendered client-side with a `<video>` element pointed at ComfyUI's `/view` route — which already serves the files with HTTP range support — so **no `ffmpeg` or extra dependency** is required. The output scan and delete routes now recognise video extensions and tag each entry with a `media_type` the client keys its rendering off.

### 2.2.0

- **Download and Delete buttons in the Gallery lightbox.** Previously the only actions were previous / next / close, so saving or removing an image meant closing the viewer and finding its card again. Delete asks for confirmation, then advances to the next image so you can keep culling without reopening; it closes the viewer when nothing is left. Download always fetches the full-resolution original, not the thumbnail.
- **Fixed: clicking a Gallery card after deleting one opened the wrong image.** Cards captured their grid position when built, but deleting an image shifts every later one down a slot, so the stored positions silently pointed at a neighbour. Cards now read their position at click time and are renumbered whenever one is removed. This affected the existing per-card delete too, not just the new lightbox button.
- **Fixed: arrow keys changed the image behind the delete confirmation.** The dialog swallows Escape and Enter but not the arrows, so the lightbox kept navigating underneath it while the prompt was open.

### 2.1.0

A performance release. Both image grids were sending full-resolution originals to the browser to draw thumbnails a few hundred pixels wide, which is what made them stutter.

**Thumbnails**

- **New cached thumbnail service** (`server/routes/Thumbnails.py`). Images are downscaled once to WebP, cached on disk, and served with an immutable cache header. The source file's mtime is part of the URL, so a regenerated image gets a new URL instead of a stale hit.
  - Gallery: a page of 50 dropped from **276 MB to ~1.1 MB**.
  - My Models: a page of 50 dropped from **134 MB to ~1.8 MB**.
  - Decoding runs on a small bounded thread pool, off the event loop, so browsing never blocks the ComfyUI server or steals CPU from a running generation. Concurrent requests for the same image collapse into one decode.
  - Cache is capped at 4000 files and prunes oldest-first. First visit after upgrading generates the initial set (~100 ms per image); everything after that is served from disk.
- **Lightboxes open instantly** — the cached thumbnail paints first, then the full-size image swaps in once it arrives. Gallery lightbox also preloads the neighbouring images so arrow-key navigation doesn't stall.
- **Send to Workflow** now puts a thumbnail URL on the node instead of the full preview. The node draws into a 580 px box and keeps its bitmap alive for as long as it's in the workflow, so this was costing multiple MB of canvas memory per node.
- **Download tab** asks Civitai's CDN for display-sized images. Preview URLs previously came through as `original=true` — the full upload — and were scaled down in the browser.

**Scrolling**

- My Models cards now use `content-visibility`, so cards scrolled out of view skip layout and paint. The Gallery grid already did this, which is why only My Models stuttered.
- The hover-overlay blur on both grids is now scoped to `:hover`. It was declared unconditionally, giving every card three permanently-composited layers — **151 across a page, now 1**.
- My Models builds its cards in a document fragment instead of appending 50 times into the live grid.

**Fixes**

- The **base-model filter selection is now remembered** between sessions. It was never written to the saved settings, so it reset on every reload.
- Cancelling or failing a **multi-connection download** no longer abandons its worker threads. They were left running while the temp directory was deleted underneath them, which on Windows strands a `.<name>.parts_<id>` folder in your model directory. Threads are now joined with a bound, and cleanup retries before giving up.
- The output-folder scan is cached briefly instead of re-walking every image on each page click, sort change, and subfolder switch. Deleting an image invalidates it, and **Refresh** forces a fresh scan.

---

## Contributing

PRs welcome.

<div align="center">

[⬆ Back to top](#top)

</div>
