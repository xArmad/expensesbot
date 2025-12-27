# Deployment Guide

Quick guide for pushing changes to GitHub and JustRunMy.App.

## Quick Deploy

After making changes, run these commands:

```bash
# Navigate to project directory
cd C:\Users\rocky\Documents\famestar\expensesbot

# Stage your changes
git add .

# Commit with a descriptive message
git commit -m "Your commit message here"

# Push to GitHub
git push origin master

# Push to JustRunMy.App (auto-deploys)
# NOTE: Replace USERNAME and PASSWORD with your actual JustRunMy.App credentials
git push -u https://USERNAME:PASSWORD@justrunmy.app/git/r_Eg6z4 HEAD:deploy
```

## JustRunMy.App Remote

The JustRunMy.App remote is already configured. You can also add it as a named remote for easier pushing:

```bash
# Add remote (one-time setup)
# NOTE: Replace USERNAME and PASSWORD with your actual JustRunMy.App credentials
git remote add justrunmy https://USERNAME:PASSWORD@justrunmy.app/git/r_Eg6z4

# Then push with:
git push justrunmy HEAD:deploy
```

## GitHub Repository

- **URL**: https://github.com/xArmad/expensesbot
- **Branch**: `master`

## Deployment Process

1. **JustRunMy.App** automatically:
   - Builds the Docker image
   - Restarts the application
   - Shows build progress in the push output

2. **Check deployment status**:
   - View logs in JustRunMy.App dashboard
   - Check bot status in Discord
   - Test the commands in Discord

## Notes

- JustRunMy.App does **NOT** auto-detect changes - you must push manually
- **IMPORTANT**: Never commit credentials to git. Store them securely and use placeholders in this file.
- Both GitHub and JustRunMy.App need to be pushed separately
- JustRunMy.App will rebuild and restart automatically after push
- If credentials are exposed, rotate them immediately in JustRunMy.App dashboard

