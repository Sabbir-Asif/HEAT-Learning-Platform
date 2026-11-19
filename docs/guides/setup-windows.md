# Set up on a fresh Windows machine

Step by step, from a Windows machine with nothing installed to the WSAP LMS running in the browser. The short version for developers who already have the tools is the [README](../../README.md#first-run).

You need Windows 10 22H2 (build 19045) or newer, or Windows 11, 64-bit, with an administrator account, an internet connection, 8 GB of RAM, 20 GB of free disk, and hardware virtualization switched on in the BIOS or UEFI (on most machines it already is). Docker Desktop is [free for personal use, education and small businesses](https://docs.docker.com/subscription/desktop-license/); check its terms for your organisation.

Run every command in **PowerShell**. Steps 1 and 2 and the `nvm` commands in step 5 need **PowerShell as administrator** (right-click PowerShell in the Start menu, then Run as administrator). The rest run in a normal PowerShell window.

## 1. Install WSL 2

Docker Desktop runs its Linux containers on WSL 2. In an administrator PowerShell:

```powershell
wsl --install --no-distribution
```

Restart the computer when it finishes. See the [Microsoft guide](https://learn.microsoft.com/en-us/windows/wsl/install). Check after the restart:

```powershell
wsl --status
```

It prints `Default Version: 2`.

## 2. Install the tools with winget

`winget` comes with Windows 11 and current Windows 10. Check it with `winget --version`. In an administrator PowerShell:

```powershell
winget install --id Git.Git -e
winget install --id CoreyButler.NVMforWindows -e
winget install --id Docker.DockerDesktop -e
winget install --id Gyan.FFmpeg -e
winget install --id Google.Chrome -e
```

What each one is for: Git fetches the code; nvm-windows installs the exact Node version; [Docker Desktop](https://docs.docker.com/desktop/setup/install/windows-install/) runs Postgres, Redis, Nginx and Mailpit; FFmpeg lets the worker transcode videos; Chrome is the browser for the demo and renders certificate PDFs. FFmpeg and the certificate part of Chrome are only needed if you use video upload or certificates.

Close PowerShell and open a new administrator PowerShell so the new programs are on the path. Then start Docker Desktop from the Start menu, accept the terms, and wait until the whale icon in the tray says "Docker Desktop is running".

Check:

```powershell
git --version
nvm version
docker --version
docker compose version
docker run --rm hello-world
ffmpeg -version
```

`hello-world` prints "Hello from Docker!".

## 3. Tell Git to keep Unix line endings

The project mounts text files into Linux containers, so they must not be rewritten with Windows line endings:

```powershell
git config --global core.autocrlf input
```

## 4. Get the code

In a normal PowerShell, keep the path short:

```powershell
mkdir C:\projects
cd C:\projects
git clone https://github.com/Sabbir-Asif/HEAT-Learning-Platform.git
cd HEAT-Learning-Platform
```

The repository is private, so Git Credential Manager (installed with Git) opens a browser window; sign in to a GitHub account that has been added to the repository. If no window opens, enter your GitHub username and, as the password, a [personal access token](https://github.com/settings/tokens) with read access to the repository.

## 5. Install Node.js 22.22 and pnpm

In an **administrator** PowerShell, inside the project folder (nvm-windows creates a link, which needs administrator rights):

```powershell
cd C:\projects\HEAT-Learning-Platform
nvm install 22.22.0
nvm use 22.22.0
node -v
corepack enable
```

`node -v` prints `v22.22.0`. Switch back to a **normal** PowerShell, go to the project folder, and check pnpm:

```powershell
cd C:\projects\HEAT-Learning-Platform
pnpm -v
```

It prints `11.28.11`; Corepack downloads that version on the first run. If `pnpm` is not found in the normal window, run `corepack enable` once more in the administrator window.

## 6. Install the dependencies

```powershell
pnpm install
```

This takes a few minutes the first time.

## 7. Start the local services and prepare the database

Docker Desktop must be running.

```powershell
pnpm dev:up
```

This copies every `.env.example` to `.env`, creates the `.data` folders, starts Postgres, Redis, Nginx and Mailpit, and returns when all four are healthy. The first run downloads the images. Allow the Windows Firewall prompt if one appears.

Create the tables and the first administrator, with sample faculties and departments so student sign-up has choices:

```powershell
pnpm --filter @heat/db exec prisma migrate deploy
$env:SEED_SAMPLE_DIRECTORY = "true"
pnpm --filter @heat/db exec prisma db seed
Remove-Item Env:SEED_SAMPLE_DIRECTORY
```

The administrator is `admin@heat.localhost` with password `ChangeMe-Local-Admin-2026`. You are asked to change the password at the first sign-in. To use your own, also set `$env:SUPER_ADMIN_EMAIL` and `$env:SUPER_ADMIN_PASSWORD` (at least 12 characters) before the seed command.

For certificate PDFs, open `apps\api\.env` in Notepad and set the line `CHROMIUM_EXECUTABLE_PATH=` to the Chrome path, with forward slashes:

```
CHROMIUM_EXECUTABLE_PATH=C:/Program Files/Google/Chrome/Application/chrome.exe
```

The worker reads `apps\api\.env`.

## 8. Start the apps (development)

```powershell
pnpm dev
```

Leave this window open. It starts the public site (port 3000), the admin console (3001), the API (4000) and the worker. The first visit to each page compiles it, so it is slow; for a demo use the next section.

## 9. Demo mode: build once, no compiling in the browser

Use this instead of step 8 when you present. Pages are compiled ahead of time, so every page opens at once. Stop `pnpm dev` first if it is running (`Ctrl+C`).

Build everything once. This also copies the images, fonts and styles into the production output of the two sites, which Next.js does not do itself:

```sh
pnpm demo:build
```

Then start the API, the worker and both sites together in one window. Each line of output is prefixed with the app name, and `Ctrl+C` stops all four:

```sh
pnpm demo
```

The ports are the same as in development, so Nginx and the addresses in the next step do not change. Run `pnpm demo:build` again after every code change. If the API or the worker will not start in this mode, run `pnpm --filter api dev` and `pnpm --filter worker dev` in two other windows in their place, and start the two sites with `pnpm --filter frontend-public start` and `pnpm --filter frontend-internal start` (set `PORT=3001` for the second one).

## 10. Open the site

Open the apps through Nginx, not on ports 3000 and 3001, because only Nginx forwards `/api` to the API:

| What           | Address                  |
| -------------- | ------------------------ |
| Public site    | <http://learn.localhost> |
| Admin console  | <http://admin.localhost> |
| Mail (Mailpit) | <http://localhost:8035>  |

Use Chrome, Edge or Firefox, which resolve `*.localhost` without a hosts-file change. Sign in to the admin console with the administrator from step 7. Verification emails and certificate emails appear in Mailpit.

Check the API from another PowerShell window:

```powershell
curl.exe localhost:4000/api/health
```

## Stop and start again

```powershell
pnpm dev:down
pnpm dev:up
```

`pnpm dev:down` keeps the data. `pnpm dev:reset` deletes the Postgres and Redis data and starts empty (run the two database commands of step 7 again afterwards). Stop the apps with `Ctrl+C` in their windows. Docker Desktop must be running whenever you run `pnpm dev:up`.

## Troubleshooting

| Symptom                                                         | Cause and fix                                                                                                                                                    |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docker` is not found, or `Is Docker installed?`                | Open a new PowerShell after the install, and start Docker Desktop.                                                                                              |
| `error during connect` or the Docker engine is not running      | Docker Desktop is not running yet. Start it and wait for "Docker Desktop is running".                                                                           |
| Docker Desktop says virtualization is disabled                  | Switch on Intel VT-x or AMD-V (SVM) in the BIOS or UEFI, then start again.                                                                                      |
| `address already in use` for port 80 when running `pnpm dev:up` | Another program holds port 80, often IIS or the World Wide Web Publishing Service. Stop it (`net stop was /y`, administrator) or move Nginx to port 8080, below. |
| `nvm use` says it cannot create a link or access is denied      | The window is not an administrator PowerShell.                                                                                                                  |
| Pages answer `502 Bad Gateway`                                  | The apps are not running yet. Nginx forwards to them on the host; wait for `pnpm dev` to finish starting, or start `pnpm demo` (step 9).                  |
| Sign-in says "The server sent an unexpected reply"              | You opened `localhost:3000` or `localhost:3001`. Use `learn.localhost` and `admin.localhost`.                                                                    |
| `pnpm build` ends with `Killed` or exit code 137                | The machine ran out of memory because both sites build at once. Close other programs and run `pnpm build --concurrency=1`.                                       |
| Page has no styles in demo mode                                 | The last build was not made with `pnpm demo:build`, so the copy step was skipped. Run it again and restart `pnpm demo`.                                                         |
| Scripts are disabled (`running scripts is disabled`)            | Run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`, then open a new window.                                                                              |

To move Nginx to port 8080:

```powershell
(Get-Content infra\compose\.env) -replace '^HTTP_PORT=.*', 'HTTP_PORT=8080' | Set-Content infra\compose\.env
```

Then add `http://learn.localhost:8080` and `http://admin.localhost:8080` to `TRUSTED_ORIGINS` in `apps\api\.env`, run `pnpm dev:up` again, restart the apps, and open the two addresses with `:8080`. More in [Local development](local-development.md#when-port-80-is-taken).

## Checks before you start working

```powershell
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
```

The commands are explained in [Quality and testing](quality-and-testing.md).
