# AGENTS.md - Development Guidelines for RepBoard

## Project Overview
RepBoard is a Capacitor-based mobile fitness tracking app for push-ups and pull-ups. It uses Firebase for authentication, Express.js backend for data persistence, and Vite for development/build tooling.

## Build & Development Commands

### Core Commands
```bash
# Start development server with hot reload
npm start

# Build for production
npm build

# Preview production build
npm preview

# Capacitor commands (for mobile development)
npx cap run android    # Run on Android device/emulator
npx cap run ios        # Run on iOS device/simulator
npx cap sync           # Sync web assets to native projects
```

### Testing
Currently no test framework is configured. When adding tests:
- Prefer Jest or Vitest for unit/integration testing
- Use Cypress or Playwright for E2E testing
- Add test scripts to package.json as `npm test` and `npm test:watch`

## Code Style Guidelines

### JavaScript/TypeScript
- **ES Modules**: Use ES6 import/export syntax (project is `"type": "module"`)
- **File Structure**: Keep files under 300 lines when possible
- **Function Naming**: Use descriptive camelCase names
- **Constants**: Use UPPER_SNAKE_CASE for configuration constants
- **Error Handling**: Always use try/catch for async operations, provide user feedback

```javascript
async function handleGoogleSignIn() {
  try {
    const result = await signInWithPopup(auth, provider);
    console.log("Signed in:", result.user.email);
    showPage('profilePage');
  } catch (error) {
    console.error("Sign-in error:", error);
    showFallbackMessage("Sign-in failed. Try again.");
  }
}
```

### Import Organization
1. External libraries (Firebase, Capacitor, etc.)
2. Local modules/components
3. Constants and configuration

```javascript
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";

```

### HTML Structure
- Use semantic HTML5 elements
- Maintain consistent indentation (2 spaces)
- Add meaningful ARIA labels for accessibility
- Keep mobile-first responsive design principles

### CSS Architecture
- **CSS Custom Properties**: Use CSS variables for theming (defined in `:root`)
- **BEM-like Naming**: Use descriptive class names with clear hierarchy
- **Mobile-First**: Design for mobile screens first, then scale up
- **Component Organization**: Group related styles with clear comments

```css
/* ==========================
   COMPONENT NAME
========================== */
.component-name {
  /* styles */
}
```

### Variable Naming Conventions
- **DOM Elements**: Use descriptive names with element type suffix
  ```javascript
  const usernameElement = document.getElementById("username");
  const repButton = document.getElementById("repButton");
  ```
- **Data Objects**: Use camelCase with clear purpose
  ```javascript
  let sessionReps = {
    pushup: 0,
    pullup: 0,
  };
  ```
- **Functions**: Use verb prefixes for actions
  ```javascript
  function updateUserUI(name) { }
  function handleRepButtonClick(count) { }
  async function fetchTotalsServer() { }
  ```

### State Management
- **User State**: Keep authentication state in global variables
- **Session Data**: Use localStorage for persistence across sessions
- **UI State**: Update DOM immediately, then sync with server

```javascript
let userId = null;
let username = "GUEST";

// localStorage pattern
sessionReps[type] += count;
localStorage.setItem(`sessionReps.${type}`, sessionReps[type]);
```

### API Integration
- **Error Handling**: Always check response.ok and provide fallbacks
- **Offline Support**: Check `navigator.onLine` before API calls
- **User Feedback**: Show loading states and error messages

```javascript
if (!navigator.onLine) {
  showFallbackMessage("You are offline.");
  return;
}

const res = await fetch(SERVER_URL + "/endpoint", {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
});

if (!res.ok) throw new Error(`HTTP ${res.status}`);
```

### Firebase Integration
- **Authentication**: Use GoogleAuthProvider with popup sign-in
- **Persistence**: Set browserLocalPersistence for session management
- **State Updates**: Use onAuthStateChanged for reactive UI updates

### Mobile Development (Capacitor)
- **Native Features**: Use Capacitor plugins for camera, splash screen, etc.
- **Platform Config**: Update capacitor.config.json for platform-specific settings
- **Build Process**: Always run `npx cap sync` after web asset changes

### Performance Guidelines
- **Bundle Size**: Keep dependencies minimal, prefer CDN imports for large libraries
- **Image Optimization**: Use appropriate formats and sizes for mobile
- **Lazy Loading**: Implement code splitting for larger features
- **Caching**: Use localStorage for frequently accessed data

### Security Best Practices
- **API Keys**: Keep Firebase config in client code (public by design)
- **User Data**: Never log sensitive user information
- **Input Validation**: Validate all user inputs before processing
- **HTTPS**: Always use HTTPS for API endpoints

### Git Workflow
- **Commit Messages**: Use conventional commits (feat:, fix:, docs:, etc.)
- **Branch Naming**: Use feature/branch-name or fix/branch-name pattern
- **Code Review**: Ensure all code follows these guidelines before merging

### File Organization
```
src/
├── js/
│   └── main.js          # Main application logic
├── css/
│   ├── style.css        # Global styles and components
│   └── profile.css      # Profile-specific styles
├── assets/
│   ├── icon/            # App icons and favicons
│   └── imgs/            # Images and logos
├── index.html           # Main HTML file
└── manifest.json        # PWA manifest
```

## Development Workflow
1. Run `npm start` for development
2. Test on mobile using `npx cap run android/ios`
3. Build with `npm build` before deployment
4. Sync native assets with `npx cap sync`

## Common Issues & Solutions
- **Firebase Auth**: Ensure proper CORS configuration for custom domains
- **Capacitor Build**: Always sync web assets before building native apps
- **Mobile Testing**: Test on actual devices, not just emulators
- **Performance**: Monitor bundle size and optimize images for mobile