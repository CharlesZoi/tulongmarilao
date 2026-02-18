# Firebase Deployment Notes

## Firestore Rules Source of Truth
- Main app Firestore rules: `firestore.rules`
- Chat-specific rules reference: `firestore-chat.rules`

For the primary app database (reports and donation logs), deploy `firestore.rules`.

## Recommended `firebase.json` Mapping (if using Firebase CLI)
Use this mapping so deployments do not accidentally publish the chat-only rules to the main project:

```json
{
  "firestore": {
    "rules": "firestore.rules"
  }
}
```

If you maintain multiple Firebase projects, keep separate config/targets and deploy each rules file intentionally.
