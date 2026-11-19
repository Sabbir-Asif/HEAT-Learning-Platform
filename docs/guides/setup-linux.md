# Set up on a fresh Linux machine

Step by step, from a machine with nothing installed to the WSAP LMS running in the browser. Written for Ubuntu 22.04 and 24.04 (64-bit); Debian differs only in the Docker repository address, see the note in step 3. The short version for developers who already have the tools is the [README](../../README.md#first-run).

You need a user with `sudo` rights, an internet connection, 8 GB of RAM and 20 GB of free disk.

## 1. Install the base tools

```sh
sudo apt update
sudo apt install -y git curl ca-certificates build-essential python3 ffmpeg
```

`build-essential` and `python3` are the compilers that native packages (for example `argon2`) fall back to when no prebuilt binary matches. `ffmpeg` is used by the worker to transcode videos.

Check:

```sh
git --version
ffmpeg -version
```

## 2. Install Node.js 22.22 with nvm

The project pins Node 22.22.0 in `.nvmrc`.

```sh
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
```

Close the terminal and open a new one, then check:

```sh
nvm --version
```

## 3. Install Docker Engine and Compose

Docker runs Postgres, Redis, Nginx and Mailpit. These are the steps from the [official Docker guide for Ubuntu](https://docs.docker.com/engine/install/ubuntu/).

```sh
sudo apt update
sudo apt install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
```

```sh
sudo tee /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
Components: stable
Signed-By: /etc/apt/keyrings/docker.asc
EOF
```

```sh
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

On Debian, replace `ubuntu` with `debian` in the `URIs` line and in the `gpg` address, and use the [Debian guide](https://docs.docker.com/engine/install/debian/).

Let your user run Docker without `sudo`, as described in the [post-installation steps](https://docs.docker.com/engine/install/linux-postinstall/):

```sh
sudo usermod -aG docker $USER
newgrp docker
```

If a later command still says "permission denied" on the Docker socket, log out and log in again.

Check:

```sh
docker --version
docker compose version
docker run --rm hello-world
```

`hello-world` prints "Hello from Docker!".

## 4. Install a browser for certificate PDFs (optional)

The worker renders certificate PDFs with Chromium. Skip this step if you do not need certificates on this machine. On Ubuntu the `chromium` apt package is a snap that the worker cannot control, so install Google Chrome from its `.deb` (64-bit x86 only):

```sh
curl -fsSLO https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
sudo apt install -y ./google-chrome-stable_current_amd64.deb
rm google-chrome-stable_current_amd64.deb
```

The program is at `/usr/bin/google-chrome-stable`. Step 8 tells the worker where it is.

## 5. Get the code

```sh
mkdir -p ~/projects && cd ~/projects
git clone https://github.com/Sabbir-Asif/HEAT-Learning-Platform.git
cd HEAT-Learning-Platform
```

The repository is private, so Git asks for a username and a password. Enter your GitHub username, and as the password a [personal access token](https://github.com/settings/tokens) with read access to the repository (GitHub no longer accepts account passwords for Git). Your GitHub account must have been added to the repository first.

## 6. Select Node and pnpm

Run these inside the project folder:

```sh
nvm install
nvm use
node -v
corepack enable
pnpm -v
```

`nvm install` reads `.nvmrc` and installs Node 22.22.0. `node -v` prints `v22.22.0`. `corepack enable` switches on the pnpm version pinned in `package.json`, so `pnpm -v` prints `11.28.11` the first time it runs (Corepack downloads it).

## 7. Install the dependencies

```sh
pnpm install
```

This takes a few minutes the first time.

## 8. Start the local services and prepare the database

```sh
pnpm dev:up
```

This copies every `.env.example` to `.env` (mode 600), creates the `.data` folders, starts Postgres, Redis, Nginx and Mailpit in Docker, and returns when all four are healthy. The first run downloads the images.

Now create the tables and the first administrator, with sample faculties and departments so student sign-up has choices:

```sh
pnpm --filter @heat/db exec prisma migrate deploy
SEED_SAMPLE_DIRECTORY=true pnpm --filter @heat/db exec prisma db seed
```

The administrator is `admin@heat.localhost` with password `ChangeMe-Local-Admin-2026`. You are asked to change the password at the first sign-in. To use your own, set `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD` (at least 12 characters) in front of the seed command the same way as `SEED_SAMPLE_DIRECTORY`.

If you installed Chrome in step 4, open `apps/api/.env` and set the line `CHROMIUM_EXECUTABLE_PATH=` to:

```
CHROMIUM_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
```

The worker in development reads `apps/api/.env`.

## 9. Start the apps

```sh
pnpm dev
```

Leave this terminal open. It starts the public site (port 3000), the admin console (3001), the API (4000) and the worker. Wait until the output shows the API listening and `Worker ready`.

## 10. Demo mode: build once, no compiling in the browser

Use this instead of step 9 when you present. Pages are compiled ahead of time, so every page opens at once. Stop `pnpm dev` first if it is running (`Ctrl+C`).

Build everything once. This also copies the images, fonts and styles into the production output of the two sites, which Next.js does not do itself:

```sh
pnpm demo:build
```

Then start the API, the worker and both sites together in one window. Each line of output is prefixed with the app name, and `Ctrl+C` stops all four:

```sh
pnpm demo
```

The ports are the same as in development, so Nginx and the addresses in the next step do not change. Run `pnpm demo:build` again after every code change. If the API or the worker will not start in this mode, run `pnpm --filter api dev` and `pnpm --filter worker dev` in two other windows in their place, and start the two sites with `pnpm --filter frontend-public start` and `pnpm --filter frontend-internal start` (set `PORT=3001` for the second one).

## 11. Open the site

Open the apps through Nginx, not on ports 3000 and 3001, because only Nginx forwards `/api` to the API:

| What          | Address                       |
| ------------- | ----------------------------- |
| Public site   | <http://learn.localhost>      |
| Admin console | <http://admin.localhost>      |
| Mail (Mailpit) | <http://localhost:8035>      |

Sign in to the admin console with the administrator from step 8. Verification emails and certificate emails appear in Mailpit.

Check the API from a second terminal:

```sh
curl localhost:4000/api/health
```

## Stop and start again

```sh
pnpm dev:down
pnpm dev:up
```

`pnpm dev:down` keeps the data. `pnpm dev:reset` deletes the Postgres and Redis data and starts empty (run the two database commands of step 8 again afterwards). Stop `pnpm dev` with `Ctrl+C`.

## Troubleshooting

| Symptom                                                         | Cause and fix                                                                                                                                                                                       |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `permission denied` on `/var/run/docker.sock`                   | Your user is not in the `docker` group yet. Run `sudo usermod -aG docker $USER`, then log out and in.                                                                                              |
| `address already in use` for port 80 when running `pnpm dev:up` | Another web server holds port 80 (often Apache or Nginx installed on the host). Stop it with `sudo systemctl stop apache2 nginx`, or move Nginx to port 8080, see below.                            |
| Pages answer `502 Bad Gateway`                                  | `pnpm dev` is not running or has not finished starting. Nginx forwards to the apps on the host.                                                                                                     |
| `502` only while the apps are running, and `ufw` is active      | The firewall blocks containers from reaching the host. Run `sudo ufw allow from 172.16.0.0/12 to any port 3000,3001,4000 proto tcp`.                                                                |
| Sign-in says "The server sent an unexpected reply"              | You opened `localhost:3000` or `localhost:3001`. Use `learn.localhost` and `admin.localhost`.                                                                                                       |
| `pnpm build` ends with `Killed` or exit code 137                | The machine ran out of memory because both sites build at once. Close other programs and run `pnpm build --concurrency=1`, or add swap space.                                                       |
| Page has no styles in demo mode                                 | The last build was not made with `pnpm demo:build`, so the copy step was skipped. Run it again and restart `pnpm demo`.                                                                                           |
| `learn.localhost` does not open                                 | Use Chrome, Chromium or Firefox. If your browser or system resolver does not resolve `*.localhost`, add `127.0.0.1 learn.localhost admin.localhost` to `/etc/hosts` with `sudo nano /etc/hosts`.     |

To move Nginx to port 8080:

```sh
sed -i 's/^HTTP_PORT=.*/HTTP_PORT=8080/' infra/compose/.env
```

Then add `http://learn.localhost:8080` and `http://admin.localhost:8080` to `TRUSTED_ORIGINS` in `apps/api/.env`, run `pnpm dev:up` again, restart `pnpm dev`, and open the two addresses with `:8080`. More in [Local development](local-development.md#when-port-80-is-taken).

## Checks before you start working

```sh
pnpm lint && pnpm format:check && pnpm typecheck
pnpm test
```

The commands are explained in [Quality and testing](quality-and-testing.md).
