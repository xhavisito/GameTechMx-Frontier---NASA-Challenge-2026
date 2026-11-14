# Upload and publish checklist

1. Extract `GameTechMx-Frontier.zip`.
2. Open a terminal inside the extracted folder and run:

   ```bash
   npm install
   npm test
   npm run build
   ```

3. Copy all extracted files into the root of `xhavisito/GameTechMx-Frontier---NASA-Challenge-2026`, preserving `.github`, `.gitignore`, and `.nvmrc`.
4. Commit them to `main` and push.
5. In GitHub, open **Settings → Pages → Build and deployment** and choose **GitHub Actions**.
6. Open the **Actions** tab. The workflow “Test, build and deploy Frontier” must finish with green checks.
7. Verify `https://xhavisito.github.io/GameTechMx-Frontier---NASA-Challenge-2026/` and replace the pending-demo wording in the README only after it loads.

The static deployment includes solo, sandbox, and local hot-seat play. To enable online rooms, deploy the Node server on a WebSocket-capable host, set `CORS_ORIGINS` there, and add its HTTPS URL as the GitHub Actions variable `VITE_SERVER_URL`. Run the Pages workflow again.
