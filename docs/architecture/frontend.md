### State Management
- Uses TanStack Query for server state management (fetching, caching API data).
- Hooks like `useGetNotesQuery`, `useGetNoteByIdQuery`, `useSubmitTextMutation`, etc., encapsulate API interactions.
- Minimal client state is managed with React `useState` within components.

### Rendering
- Uses `react-markdown` with `remark-gfm` for rendering Markdown content fetched from the backend, ensuring proper display of text formatting, links, and images.

### Authentication & State Management

*   **Auth State:** Managed via TanStack Query using a `useAuthStatus` hook (`src/hooks/useAuthStatus.ts`) which fetches the user's authentication state from the `/api/auth/status` endpoint. This query is cached.
*   **Auth Mutations:** Dedicated hooks (`useLoginMutation`, `useRegisterMutation`, `useLogoutMutation` in `src/hooks/useAuthMutations.ts`) handle API calls for login, registration, and logout. These hooks manage loading states, errors, cache invalidation (`authStatus` query), and redirection using `useNavigate` from TanStack Router.
*   **Route Protection:** Implemented using TanStack Router's `beforeLoad` property on protected routes (`src/router.tsx`). An `ensureUserIsAuthenticated` async function fetches the auth status (leveraging the `queryClient` directly for pre-load checking) and throws a `redirect` to `/login` if the user is not authenticated.
*   **UI Feedback:** `useToast` from shadcn/ui is used to provide feedback on authentication actions (success/failure). 