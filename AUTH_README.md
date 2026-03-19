# ProNeighbor — Auth Setup

## Install dependencies
```bash
npm install firebase react-router-dom
npm install --save-dev @types/react-router-dom
```

## File structure
```
src/
├── firebase.ts                        ← Firebase init + exports
├── App.tsx                            ← Router + AuthProvider wrapper
├── contexts/
│   └── AuthContext.tsx                ← useAuth() hook, all auth methods
└── components/
    └── auth/
        ├── AuthPages.tsx              ← LoginPage + RegisterPage
        └── ProtectedRoute.tsx         ← Redirect-to-login wrapper
```

## Usage

### Protect a route
```tsx
<Route path="/dashboard" element={
  <ProtectedRoute><Dashboard /></ProtectedRoute>
} />
```

### Use auth anywhere
```tsx
const { user, logout, signIn } = useAuth();
```

## Auth flows covered
- ✅ Email/Password login
- ✅ Email/Password registration (auto-creates Firestore user doc)
- ✅ Google Sign-In (popup, auto-creates Firestore user doc)
- ✅ Error handling with user-friendly messages
- ✅ Loading states on all async actions
- ✅ Protected route with loading screen

## Next steps
1. Replace Dashboard placeholder in App.tsx
2. Add /forgot-password route (sendPasswordResetEmail)
3. Add email verification (sendEmailVerification) post-registration
4. Add community onboarding step — collect locality/pin after first login
