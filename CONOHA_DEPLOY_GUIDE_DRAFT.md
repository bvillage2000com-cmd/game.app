# ConoHa VPS + Node.js アプリケーション構築マニュアル

このマニュアルは、ConoHa VPSを使用してNode.jsアプリケーションを構築し、**独自ドメインで安全に公開（SSL化）** するための手順書です。

## 目次
1.  **ConoHa VPS の契約とサーバー作成**
2.  **独自ドメインの取得と設定**
3.  **SSH接続（サーバーへのログイン）**
4.  **アプリケーションのセットアップ**
5.  **Webサーバー設定 (Nginx)**
6.  **SSL化（https化）**
7.  **永続化設定 (PM2)**

---

## 1. ConoHa VPS の契約とサーバー作成

1.  **ConoHa VPS** にログイン。
2.  「サーバー追加」をクリック。
3.  **イメージタイプ**: 「アプリケーション」タブ -> **「Node.js」** を選択。
4.  **プラン**: メモリ 1GB 以上推奨。
5.  **rootパスワード**: **重要**。忘れないようにメモしてください。
6.  「追加」をクリックしてサーバー構築。
7.  サーバーリストで「IPアドレス」（例: `133.xxx.xxx.xxx`）をメモ。

---

## 2. 独自ドメインの取得と設定

IPアドレス（数字）ではなく、`my-game.com` のような名前でアクセスできるようにします。

1.  ConoHaの管理画面で「ドメイン」メニューを選択。
2.  「ドメイン取得」から好きなドメインを検索して取得（`.com` や `.net` など）。
3.  **DNS設定**:
    - 「DNS」メニュー -> 取得したドメインを選択。
    - 鉛筆マーク（編集）をクリック。
    - **タイプ**: `A (通常)`
    - **ホスト名**: `@` （空欄の意味）
    - **値**: 手順1でメモした「IPアドレス」を入力。
    - 「保存」をクリック。
    - （オプション）ホスト名 `www` も同様にIPアドレスに向けて追加しておくと親切です。

※ 設定が反映されるまで数分〜数時間かかることがあります。

---

## 3. SSH接続（サーバーへのログイン）

### Mac (ターミナル) の場合
1.  「ターミナル」アプリを開く。
2.  以下のコマンドを入力。
    ```bash
    ssh root@<IPアドレス>
    ```
3.  `yes` と入力し、`rootパスワード` を入力してログイン。

---

## 4. アプリケーションのセットアップ

```bash
# アプリ用フォルダ作成
cd /opt
git clone https://github.com/YOUR_GITHUB_USER/YOUR_REPO_NAME.git game-app
cd game-app
```
※ `YOUR_GITHUB_USER` / `YOUR_REPO_NAME` はご自身のものに変更。

### 依存パッケージのインストール
```bash
npm install
```

### 環境変数の設定
```bash
nano .env
```
中身:
```
SESSION_SECRET=your_secret_key
MASTER_PASS=your_master_password
```
保存: `Ctrl + O` -> `Enter` -> `Ctrl + X`

---

## 5. Webサーバー設定 (Nginx)

取得したドメインでアクセスできるようにします。

### 設定ファイルの作成
```bash
nano /etc/nginx/conf.d/game-app.conf
```

以下を貼り付け（**`server_name` を自分のドメインに変更**）。
```nginx
server {
    listen 80;
    server_name my-game.com;  # ← ここを取得したドメインに変更！

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```
保存: `Ctrl + O` -> `Enter` -> `Ctrl + X`

### 適用
```bash
systemctl restart nginx
```

この時点で `http://my-game.com` (httpのみ) でアクセスできるはずです。

---

## 6. SSL化（https化）

無料で使える「Let's Encrypt」を使って、鍵マーク（🔒）をつけます。

### Certbotのインストールと実行
```bash
# 自動設定ツールを起動
certbot --nginx
```

1.  メールアドレスを聞かれるので入力。
2.  利用規約 (`A`) に同意。
3.  ニュースレター (`N`) はNoでOK。
4.  対象のドメイン（先ほどNginx設定に書いたもの）が表示されるので、番号を入力（例: `1`）。
5.  「Congratulations!」と出れば完了です。

これで `https://my-game.com` でアクセスできるようになります！

---

## 7. 永続化設定 (PM2)

アプリが動き続けるように設定します。

```bash
# PM2のインストール
npm install -g pm2

# アプリ起動
pm2 start server.js --name "game-app"

# サーバー再起動時にも自動起動するように設定
pm2 save
pm2 startup
```
※ `pm2 startup` の後に表示されるコマンドをコピーして実行してください。

---

## 完了！

- **ゲーム画面**: `https://my-game.com/g/<テナント名>`
- **管理画面**: `https://my-game.com/master`

これで、友達やお客様に自信を持ってURLを配布できます！
