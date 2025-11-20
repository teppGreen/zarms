# GitHub Issue Creation Feature - Visual Reference

## UI Components

### 1. Sidebar Navigation Icon

The GitHub issue creation feature is accessed via a new icon in the sidebar navigation:

```
┌─────────────────┐
│   CTMS v3.0     │
├─────────────────┤
│                 │
│  🏠  ホーム      │
│  📋  制作物      │
│  📁  案件        │
│  👥  メンバー    │
│  💡  ナレッジ    │
│  📊  統計        │
│  🐛  Issue   ← NEW!
│                 │
└─────────────────┘
```

Location: Bottom of sidebar, after "統計" (Summary)
Action: Click to open the GitHub issue creation modal

### 2. GitHub Issue Modal

When the icon is clicked, a modal appears with the following layout:

```
┌────────────────────────────────────────────────┐
│  GitHubイシュー登録                              │
├────────────────────────────────────────────────┤
│                                                │
│  タイトル *                                     │
│  ┌──────────────────────────────────────────┐ │
│  │                                          │ │
│  └──────────────────────────────────────────┘ │
│                                                │
│  詳細 *                                        │
│  ┌──────────────────────────────────────────┐ │
│  │                                          │ │
│  │                                          │ │
│  │                                          │ │
│  │                                          │ │
│  │                                          │ │
│  └──────────────────────────────────────────┘ │
│                                                │
│  ラベル                                        │
│  ┌──────────────────────────────────────────┐ │
│  │  🐛 bug                                  │ │
│  │  ✨ enhancement                           │ │
│  │  📚 documentation                         │ │
│  │  ❓ question                              │ │
│  └──────────────────────────────────────────┘ │
│  複数選択可（Ctrl/Cmdキーを押しながらクリック）  │
│                                                │
│                      ┌──────────┐ ┌─────────┐ │
│                      │キャンセル│ │  登録   │ │
│                      └──────────┘ └─────────┘ │
└────────────────────────────────────────────────┘
```

### 3. Loading State

While creating the issue, the modal shows a loading indicator:

```
┌────────────────────────────────────────────────┐
│  GitHubイシュー登録                              │
├────────────────────────────────────────────────┤
│                                                │
│                                                │
│              ⟳  (spinner animation)            │
│                                                │
│        GitHubイシューを登録しています            │
│                                                │
│                                                │
└────────────────────────────────────────────────┘
```

### 4. Success State

On successful creation, shows a checkmark and issue number:

```
┌────────────────────────────────────────────────┐
│  GitHubイシュー登録                              │
├────────────────────────────────────────────────┤
│                                                │
│                                                │
│                    ✓                           │
│                                                │
│         GitHubイシューを登録しました              │
│              イシュー番号: #42                  │
│                                                │
│                                                │
└────────────────────────────────────────────────┘
```

The modal automatically closes after 1.5 seconds.

## User Flow

### Typical User Journey

1. **Entry Point**
   ```
   User clicks 🐛 icon in sidebar
   ```

2. **Form Filling**
   ```
   User enters:
   - Title: "Bug: Login button not working"
   - Body: "When I click the login button, nothing happens"
   - Labels: Selects "🐛 bug"
   ```

3. **Submission**
   ```
   User clicks "登録" button
   → Modal shows loading spinner
   → API call to GitHub
   ```

4. **Success**
   ```
   → Success checkmark appears
   → Message shows: "GitHubイシューを登録しました"
   → Issue number displayed: "イシュー番号: #123"
   → Modal closes after 1.5 seconds
   ```

5. **Verification**
   ```
   → Issue appears on GitHub repository
   → Title, body, and labels are correctly set
   → Issue is created by the service account (token owner)
   ```

## Label Selection

### Single Label Selection
```
Click on a label → It becomes highlighted
```

### Multiple Label Selection
```
Hold Ctrl/Cmd → Click multiple labels → All become highlighted
```

Available labels:
- 🐛 **bug**: Something isn't working
- ✨ **enhancement**: New feature or request  
- 📚 **documentation**: Improvements or additions to documentation
- ❓ **question**: Further information is requested

## Error Scenarios

### Missing Configuration
```
┌────────────────────────────────────────────────┐
│  エラーが発生しました:                           │
│  GitHub設定が見つかりません。                    │
│  管理者にお問い合わせください。                  │
└────────────────────────────────────────────────┘
```

### Invalid Token/Network Error
```
┌────────────────────────────────────────────────┐
│  エラーが発生しました:                           │
│  GitHubイシューの作成中にエラーが発生しました    │
└────────────────────────────────────────────────┘
```

## Responsive Design

The modal maintains the same design across different screen sizes using the existing CTMS modal styles:
- Centered on screen
- Maximum width: 800px
- Responsive width: 90% on smaller screens
- Backdrop blur effect
- Smooth animations

## Accessibility Features

- Form validation for required fields (title and body)
- Clear visual feedback during loading
- Success confirmation with automatic closure
- Error messages in Japanese
- Keyboard navigation support (Tab, Enter, Escape)
- Multi-select hint text for labels

## Integration with CTMS

The feature seamlessly integrates with the existing CTMS design:
- Uses consistent color scheme (Material Design 3)
- Follows existing modal patterns
- Matches button styles and interactions
- Maintains Japanese language throughout
- No impact on existing functionality

## GitHub Repository View

When an issue is created via CTMS, it appears on GitHub like this:

```
┌─────────────────────────────────────────────────┐
│ Bug: Login button not working #123             │
├─────────────────────────────────────────────────┤
│                                                 │
│ <service-account-user> opened this issue        │
│ just now · 0 comments                           │
│                                                 │
│ 🐛 bug                                          │
│                                                 │
│ When I click the login button, nothing happens │
│                                                 │
└─────────────────────────────────────────────────┘
```

Notes:
- Author is the GitHub account that owns the Personal Access Token
- Labels are applied automatically
- Issue number is sequential (managed by GitHub)
- Timestamp is when the API call was made
