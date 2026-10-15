# Liberate Pocket

An independent, open-source browser-only explorer for the Pocket AI recorder.

- Animated marketing site at `/`
- Web Bluetooth GATT explorer at `/app/`
- No backend, analytics, cookies or Pocket cloud dependency
- Hosted on GitHub Pages

## Live site

https://kucukkanat.github.io/liberate-pocket/

## How to use

Open the app with desktop Chrome or Edge over HTTPS. Turn on Pocket, disconnect the official Pocket app, click **Connect Pocket** and select your recorder.

Explore accessible GATT characteristics without authentication. For authenticated status and recording commands, an existing 16-character session key is required. The app does not reset pairing or issue delete commands.

## Important

This is experimental community software, unaffiliated with the device manufacturer. Device protocol behavior depends on firmware. Keep your own backups. Bluetooth features require a compatible browser and hardware.

## Deployment

The `.github/workflows/pages.yml` workflow deploys the site on every push to `main`. In GitHub Settings → Pages, set source to **GitHub Actions**.

## Development

Serve this directory with any static server, such as `python3 -m http.server 8000`, then visit `http://localhost:8000`.

## Contributing

Protocol compatibility reports and pull requests are welcome.
