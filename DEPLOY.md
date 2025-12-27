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
git push -u https://a4Z2Q:w2JYe48Tq@justrunmy.app/git/r_Eg6z4 HEAD:deploy
```

## JustRunMy.App Remote

The JustRunMy.App remote is already configured. You can also add it as a named remote for easier pushing:

```bash
# Add remote (one-time setup)
git remote add justrunmy https://a4Z2Q:w2JYe48Tq@justrunmy.app/git/r_Eg6z4

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
- The push command includes credentials, so keep it secure
- Both GitHub and JustRunMy.App need to be pushed separately
- JustRunMy.App will rebuild and restart automatically after push

