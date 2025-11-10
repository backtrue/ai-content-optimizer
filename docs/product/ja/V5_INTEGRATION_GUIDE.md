# v5 フロントエンド統合ガイド

## 概要

このガイドでは、v5 適応型ハイブリッドスコアリングモデルを既存のフロントエンドアプリケーションに統合する方法について説明します。

## コアコンポーネント

### 1. AsyncAnalysisFlow.jsx
**目的**：非同期分析送信フォーム

**機能**
- コンテンツ入力（プレーンテキストと HTML をサポート）
- キーワード入力
- メール入力
- 送信ステータスインジケーター
- タスク ID 表示

**使用方法**
```jsx
import AsyncAnalysisFlow from '@/components/AsyncAnalysisFlow'

export default function AnalysisPage() {
  return (
    <div>
      <AsyncAnalysisFlow />
    </div>
  )
}
```

**Props**
- `onSubmitSuccess(taskId)` - 成功コールバック
- `onSubmitError(error)` - エラーコールバック

### 2. V5ResultsDashboard.jsx
**目的**：結果表示ダッシュボード

**機能**
- デュアルスコア表示（構造 + 戦略）
- 詳細なスコアチャート
- WHY/HOW/WHAT ビジュアライゼーション
- 改善提案リスト

**使用方法**
```jsx
import V5ResultsDashboard from '@/components/V5ResultsDashboard'

export default function ResultsPage() {
  const [results, setResults] = useState(null)
  
  return (
    <V5ResultsDashboard 
      results={results} 
      isLoading={false}
    />
  )
}
```

**Props**
- `results` - 分析結果オブジェクト（v5Scores を含む）
- `isLoading` - ロード状態

### 3. ResultsPage.jsx
**目的**：完全な結果クエリページ

**機能**
- URL パラメーターから taskId を取得
- 結果を自動フェッチ
- 完全な分析詳細を表示
- エラー処理と再試行

**ルート設定**
```jsx
import ResultsPage from '@/pages/ResultsPage'

// ルート設定内
{
  path: '/results/:taskId',
  element: <ResultsPage />
}
```

## 統合ステップ

### ステップ 1：ルート設定を更新

`src/App.jsx` またはルート設定ファイルに結果ページを追加します：

```jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import AnalysisPage from './pages/AnalysisPage'
import ResultsPage from './pages/ResultsPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AnalysisPage />} />
        <Route path="/results/:taskId" element={<ResultsPage />} />
      </Routes>
    </BrowserRouter>
  )
}
```

### ステップ 2：分析ページを更新

`AsyncAnalysisFlow` を分析ページに統合します：

```jsx
import AsyncAnalysisFlow from '@/components/AsyncAnalysisFlow'

export default function AnalysisPage() {
  const handleSubmitSuccess = (taskId) => {
    // オプション：成功通知を表示
    console.log('タスク送信:', taskId)
    // オプション：結果ページに移動
    // window.location.href = `/results/${taskId}`
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      <AsyncAnalysisFlow onSubmitSuccess={handleSubmitSuccess} />
    </div>
  )
}
```

### ステップ 3：環境変数

`.env` または `.dev.vars` に以下が含まれていることを確認します：

```env
# API エンドポイント
VITE_API_ENDPOINT=http://localhost:8787/api
# または本番環境
VITE_API_ENDPOINT=https://api.content-optimizer.ai

# 結果ページベース URL（メールリンク用）
VITE_SITE_URL=http://localhost:5173
# または本番環境
VITE_SITE_URL=https://content-optimizer.ai
```

### ステップ 4：API エンドポイント検証

バックエンドが以下のエンドポイントを実装していることを確認します：

**分析を送信**
```
POST /api/analyze
Content-Type: application/json

{
  "content": "記事コンテンツ",
  "targetKeywords": ["キーワード1", "キーワード2"],
  "contentFormatHint": "plain|html|auto",
  "email": "user@example.com"
}

レスポンス:
{
  "taskId": "uuid",
  "status": "queued"
}
```

**結果をクエリ**
```
GET /api/results/{taskId}

レスポンス:
{
  "taskId": "uuid",
  "status": "completed",
  "result": {
    "v5Scores": { ... },
    "strategyAnalysis": { ... },
    "recommendations": [ ... ]
  },
  "completedAt": "2025-01-01T00:00:00Z"
}
```

## スタイル統合

### Tailwind CSS 設定

`tailwind.config.js` が設定されていることを確認します：

```js
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

### カラースキーム

v5 コンポーネントは以下の色を使用します：

- **構造スコア**：緑（#10b981）
- **戦略スコア**：紫（#8b5cf6）
- **総合スコア**：青（#667eea）
- **高優先度**：赤（#ef4444）
- **中優先度**：黄（#f59e0b）
- **低優先度**：青（#3b82f6）

## エラー処理

### 一般的なエラーと解決策

**1. 404 - タスクが見つかりません**
```jsx
if (response.status === 404) {
  // 結果の有効期限切れ（7 日）または不正なタスク ID
  setError('結果の有効期限切れまたは無効なタスク ID')
}
```

**2. 503 - サービス利用不可**
```jsx
// 再試行ロジックを実装
const retryFetch = async (url, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url)
      if (response.ok) return response
      if (response.status === 503) {
        await new Promise(r => setTimeout(r, 1000 * (i + 1)))
        continue
      }
      throw new Error(`${response.status}`)
    } catch (e) {
      if (i === maxRetries - 1) throw e
    }
  }
}
```

**3. ネットワークエラー**
```jsx
try {
  const response = await fetch(url)
} catch (error) {
  // ネットワーク接続の問題
  setError('ネットワーク接続に失敗しました。接続を確認してください。')
}
```

## テスト

### ローカルテスト

1. **ローカル Worker を起動**
```bash
npm run dev
```

2. **送信をテスト**
```bash
curl -X POST http://localhost:8787/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "content": "test content",
    "targetKeywords": ["test"],
    "contentFormatHint": "plain",
    "email": "test@example.com"
  }'
```

3. **結果クエリをテスト**
```bash
curl http://localhost:8787/api/results/{taskId}
```

### 自動化テスト

E2E テストを実行：
```bash
node tests/e2e-async-flow.js
```

## パフォーマンス最適化

### 1. 結果キャッシング

重複クエリを避けるためにフロントエンドで結果をキャッシュします：

```jsx
const [cache, setCache] = useState({})

const fetchResults = async (taskId) => {
  if (cache[taskId]) {
    return cache[taskId]
  }
  
  const response = await fetch(`/api/results/${taskId}`)
  const data = await response.json()
  
  setCache(prev => ({ ...prev, [taskId]: data }))
  return data
}
```

### 2. ポーリング最適化

指数バックオフを使用して API 呼び出しを削減します：

```jsx
const [pollInterval, setPollInterval] = useState(1000)

useEffect(() => {
  const timer = setTimeout(() => {
    fetchResults()
    // ポーリング間隔を段階的に増加
    setPollInterval(prev => Math.min(prev * 1.5, 10000))
  }, pollInterval)
  
  return () => clearTimeout(timer)
}, [pollInterval])
```

### 3. チャート最適化

ダッシュボードのチャートが効率的にレンダリングされることを確認します：

```jsx
// React.memo を使用して不要な再レンダリングを避ける
const ScoreCard = React.memo(({ score, label }) => (
  <div>
    <p className="text-2xl font-bold">{score}</p>
    <p className="text-sm text-gray-600">{label}</p>
  </div>
))
```

## デプロイチェックリスト

- [ ] すべてのコンポーネントをインポート
- [ ] ルートを設定
- [ ] 環境変数を設定
- [ ] API エンドポイントを検証
- [ ] スタイルを適用
- [ ] エラー処理を実装
- [ ] ローカルテストに合格
- [ ] E2E テストに合格
- [ ] 本番環境 URL を更新
- [ ] メールテンプレートを検証

## FAQ

**Q：ダッシュボードの色をカスタマイズするにはどうすればよいですか？**
A：`V5ResultsDashboard.jsx` の Tailwind クラスを変更するか、`tailwind.config.js` でカラー設定を拡張します。

**Q：複数の言語をサポートするにはどうすればよいですか？**
A：i18n ライブラリ（例：react-i18next）を使用して、すべてのテキスト文字列の翻訳を提供します。

**Q：長時間実行される分析を処理するにはどうすればよいですか？**
A：進捗インジケーターを実装するか、ユーザーがバックグラウンドで分析を実行し、後でメールリンク経由で結果を表示できるようにします。

**Q：メールテンプレートをカスタマイズするにはどうすればよいですか？**
A：`functions/api/email-template.js` の HTML およびテキストテンプレートを変更します。

## サポートに連絡

統合に関する問題がある場合：
- **技術サポート**：tech-support@content-optimizer.ai
- **ドキュメント**：docs.content-optimizer.ai
