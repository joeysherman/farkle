import { createRootRoute, Outlet } from '@tanstack/react-router';

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout(): JSX.Element {

  return (
    <div>
      <Outlet />
    </div>
  );
} 