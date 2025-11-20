# GitHub Integration Setup Guide

## Overview
This feature allows users of the CTMS web application to create GitHub issues directly from the application interface without requiring individual GitHub authentication.

## Prerequisites
- Access to the GitHub repository where you want to create issues
- Admin access to the Google Spreadsheet used as the database

## Setup Steps

### 1. Create a GitHub Personal Access Token

1. Log in to GitHub
2. Go to **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)**
3. Click **Generate new token (classic)**
4. Give your token a descriptive name (e.g., "CTMS Issue Creator")
5. Select the following scope:
   - ✅ **repo** (Full control of private repositories)
     - This includes: repo:status, repo_deployment, public_repo, repo:invite, security_events
6. Set an appropriate expiration date
7. Click **Generate token**
8. **Important**: Copy the token immediately - you won't be able to see it again!

### 2. Configure the Google Spreadsheet

Open your CTMS database spreadsheet and navigate to the **config** sheet. Add the following two rows:

#### Row 1: GitHub Token
| config_type | config_key | config_value | is_active | sort_order |
|-------------|------------|--------------|-----------|------------|
| GITHUB | GITHUB_TOKEN | ghp_your_token_here | TRUE | 0 |

#### Row 2: GitHub Repository
| config_type | config_key | config_value | is_active | sort_order |
|-------------|------------|--------------|-----------|------------|
| GITHUB | GITHUB_REPO | owner/repository | TRUE | 0 |

**Example for the teppGreen/ctms repository:**
```
config_type: GITHUB
config_key: GITHUB_REPO
config_value: teppGreen/ctms
is_active: TRUE
sort_order: 0
```

### 3. Verify the Setup

1. Open the CTMS web application
2. Look for the bug icon (🐛) labeled "Issue" in the sidebar navigation
3. Click on the icon to open the GitHub issue creation modal
4. Fill in the form:
   - **タイトル** (Title): Enter a test title
   - **詳細** (Body): Enter a description
   - **ラベル** (Labels): Optionally select one or more labels
5. Click **登録** (Register) to create the issue
6. Check your GitHub repository to verify that the issue was created

## Troubleshooting

### Issue Creation Fails
- **Check the token**: Ensure the GitHub Personal Access Token is valid and has the correct permissions
- **Check the repository name**: Verify that the repository name is in the correct format (`owner/repo`)
- **Check token expiration**: GitHub tokens can expire - generate a new one if needed
- **Check repository access**: Ensure the token has access to the specified repository

### Modal Doesn't Open
- Clear your browser cache and reload the page
- Check the browser console for JavaScript errors

### Configuration Not Found Error
- Ensure both `GITHUB_TOKEN` and `GITHUB_REPO` entries exist in the config sheet
- Verify that `config_type` is exactly `GITHUB` (case-sensitive)
- Ensure `is_active` is set to `TRUE`

## Security Considerations

1. **Token Storage**: The GitHub token is stored in the config sheet. Ensure that only authorized users have access to this spreadsheet.

2. **Token Permissions**: Use the minimum required permissions. The `repo` scope is needed for creating issues in private repositories. For public repositories, you could use the more restrictive `public_repo` scope.

3. **Token Rotation**: Regularly rotate your GitHub tokens and update the config sheet accordingly.

4. **Access Control**: Use the CTMS role-based access control to limit who can use the application. Only authenticated users (those in the members sheet) can access the application and create issues.

## Features

- Create GitHub issues with title and body
- Add labels to issues (multiple selection supported)
- Automatic issue creation without user GitHub authentication
- Issue number confirmation after successful creation
- Error handling with user-friendly messages

## Label Options

The modal provides the following default label options:
- 🐛 **bug**: Something isn't working
- ✨ **enhancement**: New feature or request
- 📚 **documentation**: Improvements or additions to documentation
- ❓ **question**: Further information is requested

You can customize these labels by editing the `index.html` file in the modal definition.

## API Rate Limits

GitHub API has rate limits:
- **Authenticated requests**: 5,000 requests per hour
- **Unauthenticated requests**: 60 requests per hour

Since this integration uses token authentication, you have 5,000 requests per hour, which should be more than sufficient for normal usage.

## Future Enhancements

Potential improvements for future versions:
- Add assignee selection
- Add milestone selection
- Custom label management
- Issue template support
- Link issues to specific works/projects in CTMS
- View created issues within CTMS
