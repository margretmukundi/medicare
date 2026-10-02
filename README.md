# MediCare

MediCare is a static React storefront. Catalog, category, promotion, FAQ, and site content are hardcoded in `src/data/store.js`; the language toggle supports English and Swahili.

This version has no Supabase connection, admin panel, accounts, order processing, prescription uploads, or online payments. Product and contact information changes are made in source before deployment. The contact form opens the visitor's email app only when a pharmacy email is configured in `src/data/store.js`.

## Local development

```sh
npm ci
npm run dev
```

## Render static-site deployment

- Build command: `npm ci && npm run build`
- Publish directory: `dist`
- Environment variables: none required
- Rewrite rule: `/*` to `/index.html` with status `200`

To change catalog content, edit `src/data/store.js`, then run `npm run build`.
