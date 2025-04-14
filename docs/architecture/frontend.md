### State Management
- Uses TanStack Query for server state management (fetching, caching API data).
- Hooks like `useGetNotesQuery`, `useGetNoteByIdQuery`, `useSubmitTextMutation`, etc., encapsulate API interactions.
- Minimal client state is managed with React `useState` within components.

### Rendering
- Uses `react-markdown` with `remark-gfm` for rendering Markdown content fetched from the backend, ensuring proper display of text formatting, links, and images. 