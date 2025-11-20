# ctms
Creative Team Management System

## GitHub Issue Integration Setup

To enable GitHub issue creation from the web application:

1. Generate a GitHub Personal Access Token with `repo` scope:
   - Go to GitHub Settings > Developer settings > Personal access tokens
   - Generate new token with `repo` permissions
   
2. Add the following entries to the `config` sheet in your Google Spreadsheet:
   - `config_type`: `GITHUB`, `config_key`: `GITHUB_TOKEN`, `config_value`: `your_personal_access_token`
   - `config_type`: `GITHUB`, `config_key`: `GITHUB_REPO`, `config_value`: `owner/repository` (e.g., `teppGreen/ctms`)

3. The GitHub issue creation feature will be available via the sidebar icon (🐛)
