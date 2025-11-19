# GitHub Issue Creation Feature - Testing Guide

## Feature Summary
This feature allows CTMS users to create GitHub issues directly from the web application without requiring their own GitHub authentication.

## What Was Added

### 1. Sidebar Navigation Icon (🐛)
- Location: Bottom of the sidebar navigation, below "統計" (Summary)
- Label: "Issue"
- Action: Clicking opens the GitHub issue creation modal

### 2. GitHub Issue Modal
The modal includes:
- **タイトル (Title)**: Required text field for the issue title
- **詳細 (Body)**: Required textarea for the issue description
- **ラベル (Labels)**: Multi-select dropdown with options:
  - 🐛 bug
  - ✨ enhancement
  - 📚 documentation
  - ❓ question
- **登録 (Register)** button: Submits the form
- **キャンセル (Cancel)** button: Closes the modal

### 3. Backend Integration
- New function: `createGithubIssue(issueData)` in Code.gs
- Uses GitHub REST API v3
- Authenticates using token from Config sheet
- Returns issue number on success

## Prerequisites for Testing

### Step 1: Setup Config Sheet
Add these entries to the `config` sheet in your database spreadsheet:

```
Row 1:
config_type: GITHUB
config_key: GITHUB_TOKEN
config_value: <your_github_personal_access_token>
is_active: TRUE
sort_order: 0

Row 2:
config_type: GITHUB
config_key: GITHUB_REPO
config_value: teppGreen/ctms
is_active: TRUE
sort_order: 0
```

### Step 2: Create GitHub Personal Access Token
1. Go to GitHub.com → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate new token with `repo` scope
3. Copy the token and add it to the config sheet

## Test Scenarios

### Test 1: Basic Issue Creation
**Steps:**
1. Open CTMS web application
2. Click the 🐛 icon in the sidebar
3. Fill in the form:
   - タイトル: "Test Issue from CTMS"
   - 詳細: "This is a test issue created from the CTMS application"
   - ラベル: Select "bug"
4. Click 登録

**Expected Result:**
- Modal shows loading state with message: "GitHubイシューを登録しています"
- On success, shows checkmark with message: "GitHubイシューを登録しました\nイシュー番号: #XX"
- Modal closes after 1.5 seconds
- Issue appears on GitHub with correct title, body, and label

### Test 2: Multiple Labels
**Steps:**
1. Open the GitHub issue modal
2. Fill in the form:
   - タイトル: "Feature Request: Add Export Function"
   - 詳細: "Would be nice to export data to CSV"
   - ラベル: Hold Ctrl/Cmd and select both "enhancement" and "question"
3. Click 登録

**Expected Result:**
- Issue created on GitHub with both labels applied

### Test 3: Missing Configuration
**Steps:**
1. Remove GITHUB_TOKEN from config sheet
2. Try to create an issue

**Expected Result:**
- Error message: "GitHub設定が見つかりません。管理者にお問い合わせください。"
- Modal resets to form view

### Test 4: Invalid Token
**Steps:**
1. Set GITHUB_TOKEN to an invalid value in config sheet
2. Try to create an issue

**Expected Result:**
- Error message indicating the issue creation failed
- Modal resets to form view

### Test 5: Cancel Button
**Steps:**
1. Open the GitHub issue modal
2. Start filling in the form
3. Click キャンセル

**Expected Result:**
- Modal closes immediately
- No issue is created on GitHub

## Verification Checklist

After testing, verify:
- [ ] Sidebar icon appears and is clickable
- [ ] Modal opens correctly
- [ ] Form validation works (required fields)
- [ ] Labels can be selected (single and multiple)
- [ ] Loading state displays during API call
- [ ] Success message shows correct issue number
- [ ] Error handling works for missing config
- [ ] Error handling works for invalid token
- [ ] Cancel button works
- [ ] Issues appear on GitHub with correct data
- [ ] Labels are applied correctly to issues

## Expected GitHub Issue Format

When created via CTMS, issues will appear like this:

```
Title: <user_entered_title>
Body: <user_entered_description>
Labels: <selected_labels>
Author: <github_account_that_owns_the_token>
```

## Common Issues and Solutions

### Issue: Modal doesn't open
**Solution:** Check browser console for JavaScript errors. Ensure `openGithubIssueModal()` function is defined.

### Issue: "GitHub設定が見つかりません" error
**Solution:** 
1. Verify config sheet has entries with `config_type = 'GITHUB'`
2. Check that `config_key` values are exactly 'GITHUB_TOKEN' and 'GITHUB_REPO'
3. Ensure `is_active` is TRUE

### Issue: HTTP 401 error
**Solution:** GitHub token is invalid or expired. Generate a new token.

### Issue: HTTP 404 error
**Solution:** Repository name format is incorrect or token doesn't have access. Format should be `owner/repo`.

### Issue: HTTP 403 error
**Solution:** Token doesn't have sufficient permissions. Ensure `repo` scope is enabled.

## Code Locations

If you need to modify the feature:

- **Frontend UI**: `index.html` lines ~557-604 (modal definition)
- **Frontend Logic**: `js.html` lines ~4829-4857 (modal functions)
- **Backend API**: `Code.gs` lines ~1204-1271 (createGithubIssue function)
- **Styling**: Uses existing modal styles in `css.html`

## API Rate Limits

- GitHub API allows 5,000 authenticated requests per hour
- Each issue creation uses 1 request
- Rate limit is shared across all users using the same token

## Future Enhancements

Potential improvements:
- Add assignee selection
- Add milestone selection  
- Support for issue templates
- Link issues to specific works/projects
- View created issues within CTMS
- Custom label management
