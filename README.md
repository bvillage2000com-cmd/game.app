# マルチテナント版（3人同時・別URL運用）

## URL
- マスター（あなた用）: /master
- ゲーム（店舗別）: /g/:slug
- 管理（店舗別）: /admin/:slug

例）slug=a の場合
- ゲーム: http://localhost:3000/g/a
- 管理: http://localhost:3000/admin/a

## 初期セットアップ
1) npm install
2) .env を作成（.env.template をコピーして .env）
3) npm start
4) /master で店舗（tenant）とユーザーを発行

## 演出動画
public/videos/ に以下4本を配置（ファイル名固定）
- effect1.mp4
- effect2.mp4
- effect3.mp4
- effect4.mp4

## 金フラSE（任意）
public/sounds/kin-fla.mp3 を置けば鳴ります（無くても動作OK）
