/* prettier-ignore-start */

/* eslint-disable */

// @ts-nocheck

// noinspection JSUnusedGlobalSymbols

// This file is auto-generated by TanStack Router

// Import Routes

import { Route as rootRoute } from './routes/__root'
import { Route as SignupImport } from './routes/signup'
import { Route as SigninImport } from './routes/signin'
import { Route as RoomImport } from './routes/room'
import { Route as ProfileImport } from './routes/profile'
import { Route as IndexImport } from './routes/index'
import { Route as RoomsRoomIdImport } from './routes/rooms/$roomId'
import { Route as AuthCallbackImport } from './routes/auth.callback'

// Create/Update Routes

const SignupRoute = SignupImport.update({
  path: '/signup',
  getParentRoute: () => rootRoute,
} as any)

const SigninRoute = SigninImport.update({
  path: '/signin',
  getParentRoute: () => rootRoute,
} as any)

const RoomRoute = RoomImport.update({
  path: '/room',
  getParentRoute: () => rootRoute,
} as any)

const ProfileRoute = ProfileImport.update({
  path: '/profile',
  getParentRoute: () => rootRoute,
} as any)

const IndexRoute = IndexImport.update({
  path: '/',
  getParentRoute: () => rootRoute,
} as any)

const RoomsRoomIdRoute = RoomsRoomIdImport.update({
  path: '/rooms/$roomId',
  getParentRoute: () => rootRoute,
} as any)

const AuthCallbackRoute = AuthCallbackImport.update({
  path: '/auth/callback',
  getParentRoute: () => rootRoute,
} as any)

// Populate the FileRoutesByPath interface

declare module '@tanstack/react-router' {
  interface FileRoutesByPath {
    '/': {
      id: '/'
      path: '/'
      fullPath: '/'
      preLoaderRoute: typeof IndexImport
      parentRoute: typeof rootRoute
    }
    '/profile': {
      id: '/profile'
      path: '/profile'
      fullPath: '/profile'
      preLoaderRoute: typeof ProfileImport
      parentRoute: typeof rootRoute
    }
    '/room': {
      id: '/room'
      path: '/room'
      fullPath: '/room'
      preLoaderRoute: typeof RoomImport
      parentRoute: typeof rootRoute
    }
    '/signin': {
      id: '/signin'
      path: '/signin'
      fullPath: '/signin'
      preLoaderRoute: typeof SigninImport
      parentRoute: typeof rootRoute
    }
    '/signup': {
      id: '/signup'
      path: '/signup'
      fullPath: '/signup'
      preLoaderRoute: typeof SignupImport
      parentRoute: typeof rootRoute
    }
    '/auth/callback': {
      id: '/auth/callback'
      path: '/auth/callback'
      fullPath: '/auth/callback'
      preLoaderRoute: typeof AuthCallbackImport
      parentRoute: typeof rootRoute
    }
    '/rooms/$roomId': {
      id: '/rooms/$roomId'
      path: '/rooms/$roomId'
      fullPath: '/rooms/$roomId'
      preLoaderRoute: typeof RoomsRoomIdImport
      parentRoute: typeof rootRoute
    }
  }
}

// Create and export the route tree

export const routeTree = rootRoute.addChildren({
  IndexRoute,
  ProfileRoute,
  RoomRoute,
  SigninRoute,
  SignupRoute,
  AuthCallbackRoute,
  RoomsRoomIdRoute,
})

/* prettier-ignore-end */

/* ROUTE_MANIFEST_START
{
  "routes": {
    "__root__": {
      "filePath": "__root.tsx",
      "children": [
        "/",
        "/profile",
        "/room",
        "/signin",
        "/signup",
        "/auth/callback",
        "/rooms/$roomId"
      ]
    },
    "/": {
      "filePath": "index.ts"
    },
    "/profile": {
      "filePath": "profile.ts"
    },
    "/room": {
      "filePath": "room.ts"
    },
    "/signin": {
      "filePath": "signin.ts"
    },
    "/signup": {
      "filePath": "signup.ts"
    },
    "/auth/callback": {
      "filePath": "auth.callback.tsx"
    },
    "/rooms/$roomId": {
      "filePath": "rooms/$roomId.tsx"
    }
  }
}
ROUTE_MANIFEST_END */
