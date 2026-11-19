This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Testing

End-to-end tests use Playwright. Run them against a production build, the way CI does:

```bash
npm run test:e2e:prod
npm run test:e2e:prod -- tests/e2e/auth-horizon.spec.ts --workers=3
```

This builds a temporary copy of the app (your running `npm run dev` is not touched), serves it
on port 3100 (`E2E_PROD_PORT` to change), runs Playwright, then stops the server and deletes the
copy. Prefer it over `E2E_BASE_URL=http://localhost:3000 npm run test:e2e` against the dev server:
under parallel load the dev server can briefly answer a real page with a 404 while it compiles,
which shows up as random "element not found" failures. The security-header test also needs a
production build.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
