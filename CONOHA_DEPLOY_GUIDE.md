# ConoHa VPS デプロイ手順書（完全版）

このドキュメントは、Node.jsアプリケーション（`game-app`）をConoHa VPSにデプロイし、公開するための手順をまとめたものです。

## 1. 前提条件と環境

*   **サーバー:** ConoHa VPS (Ubuntu 24.04など)
*   **ドメイン:** `geme.top`
*   **アプリケーション名:** `game-app`
*   **リポジトリ:** `https://github.com/bvillage2000com-cmd/game.app.git`

---

## 2. サーバーへの接続

詳しく設定済みのMacターミナルから、以下のコマンドで接続します。

```bash
ssh root@160.251.254.150
```

---

## 3. アプリケーションのセットアップ

### 3-1. 必要なツールのインストール

もしサーバーにGitやNode.jsが入っていない場合はインストールしますが、今回はテンプレート使用済みのためスキップ可能。
念のためアップデートしておきます。

```bash
apt update
```

### 3-2. アプリケーションの配置

アプリケーションを`/opt/game-app`ディレクトリに配置します。

```bash
# 古いフォルダがあれば削除（再デプロイ時など）
rm -rf /opt/game-app

# ディレクトリ作成
mkdir -p /opt/game-app
cd /opt/game-app

# GitHubからコードをクローン（ダウンロード）
git clone https://github.com/bvillage2000com-cmd/game.app.git .

# 依存ライブラリのインストール
npm install
```

### 3-3. 環境変数の設定

`.env`ファイルを作成し、重要な設定を記述します。

```bash
nano .env
```

**記述内容:**
```env
SESSION_SECRET=mysecretkeygame123
MASTER_PASS=your_master_password  <-- 好きなパスワードに変更
```

保存: `Ctrl+O` -> `Enter` -> `Ctrl+X`

---

## 4. Webサーバー（Nginx）の設定

WebサーバーとしてNginxを導入し、ポート80へのアクセスをアプリ（ポート3000）へ転送します。

### 4-1. Nginxのインストール

```bash
apt install -y nginx
```

### 4-2. 設定ファイルの作成

```bash
nano /etc/nginx/conf.d/game-app.conf
```

**記述内容:**
```nginx
server {
    listen 80;
    server_name gamegatya.top;  # ドメイン名

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

### 4-3. デフォルト設定の削除と反映

Nginxのデフォルト設定が邪魔をするため削除し、設定を反映させます。

```bash
rm -f /etc/nginx/sites-enabled/default
systemctl restart nginx
```

---

## 5. ファイアウォールの設定

外部からのアクセスを許可します。

### 5-1. サーバー内部（UFW）

```bash
ufw allow 'Nginx Full'
```

### 5-2. ConoHaコントロールパネル

1.  ConoHa管理画面へログイン
2.  サーバー詳細 -> 「ネットワーク情報」
3.  セキュリティグループ設定で **「IPv4v6-Web」** にチェックを入れて保存。

---

## 6. アプリケーションの起動と永続化（PM2）

アプリがサーバー再起動時にも自動で立ち上がるように設定します。

### 6-1. PM2のインストール

```bash
npm install -g pm2
```

### 6-2. アプリの起動

```bash
pm2 start server.js --name "game-app"
```

### 6-3. 自動起動の設定

```bash
pm2 save
pm2 startup
# 出力されたコマンド（sudo env PATH=...）をコピーして実行
```

---

## 7. SSL化（HTTPS設定）

**重要:** ドメイン（`geme.top`）のDNS設定が完了し、世界中に浸透してから実行してください（通常、設定変更から数時間〜1日後）。

```bash
# Certbotのインストール（必要な場合）
apt install -y certbot python3-certbot-nginx

# 証明書の取得と設定
certbot --nginx -d gamegatya.top
```

*   メールアドレスの登録などを聞かれたら入力してください。
*   利用規約に同意（Y）してください。

これが完了すると、`https://geme.top` で安全にアクセスできるようになります。

---

## 運用コマンド集

*   **アプリのログを見る:** `pm2 logs`
*   **アプリを再起動する:** `pm2 restart game-app`
*   **アプリを停止する:** `pm2 stop game-app`
*   **最新のコードを反映する:**
    ```bash
    cd /opt/game-app
    git pull origin main
    npm install
    pm2 restart game-app
    ```

---

## 8. 動画や画像の変更方法

アプリ内の動画（演出）や画像を変更・追加したい場合の手順です。

### 1. 手元のPC（Mac）でファイルを入れ替える

`public/fx` フォルダ内の動画ファイル（`fx1.mp4`, `fx2.mp4`...）などを新しいものに上書きします。

### 2. GitHubにアップロード

ターミナルで以下のコマンドを実行し、変更をGitHubに反映させます。

```bash
git add .
git commit -m "動画を変更"
git push origin main
```

### 3. サーバーに反映

サーバーにSSH接続し、以下のコマンドで最新の状態にします。

```bash
# サーバーに接続
ssh root@160.251.254.150

# アプリのフォルダに移動
cd /opt/game-app

# GitHubから最新データを取得
git pull origin main

# アプリを再起動して反映
pm2 restart game-app
```

