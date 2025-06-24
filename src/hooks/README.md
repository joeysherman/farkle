# src/hooks

Any React Hooks that might be used across the application should be placed here.

## Available Hooks

### useAvatarUpload

A custom hook for handling avatar upload functionality. It provides:

- `uploadAvatar(avatarBuilderRef, userId)` - Function to upload avatar to Supabase storage
- `uploadStatus` - String indicating current upload status
- `isUploading` - Boolean indicating if upload is in progress

Used in: Profile page, Onboarding page
