# Claude 開發規範

## 語言
一律用繁體中文回應，即使提示使用英文或其他語言，除非特別要求。

## Commit 格式
遵從 [Conventional Commits](https://www.conventionalcommits.org/) 規範：

```
<type>[optional scope]: <description>
```

常用 type：`feat`、`fix`、`docs`、`style`、`refactor`、`test`、`chore`、`ci`、`perf`

## Commit 粒度
每個 commit 越小越好，專注單一職責。寧可多個小 commit，不要一個大 commit。

## 測試（寬鬆 TDD）
- 所有程式變更都應有相對應的測試變更或增刪
- 重複修改直到確認相對應的測試通過為止
- 不強制先寫測試，可先實作再補測試
