# Run the whole project with Docker only

For a demo or a trial on a computer with nothing installed. You install Git and Docker, build the images and start everything with Docker Compose. Node, pnpm, Postgres, Redis and Nginx are not installed on the computer: they run inside the containers. Pages are built ahead of time, so nothing compiles in the browser.

The stack in `infra/demo/` runs on plain HTTP at `http://learn.localhost` and `http://admin.localhost` on this computer only. It is not for the internet; for a server with domains and HTTPS use [Production deployment](deployment.md). To work on the code, use the setup guides for [Windows](setup-windows.md) or [Linux](setup-linux.md).

| Service         | What it is                                         |
| --------------- | -------------------------------------------------- |
| `postgres`      | Database                                           |
| `redis`         | Queue and rate limits                              |
| `mailpit`       | Catches all email, nothing is delivered            |
| `migrate`       | Creates the tables and the first administrator once |
| `api`, `worker` | HTTP API and background jobs (video, certificates) |
| `frontend-public`, `frontend-internal` | Public site and admin console       |
| `nginx`         | Front door on port 80                              |

You need 8 GB of RAM (the first build uses about 4 GB), 15 GB of free disk and an internet connection.

## 1. Install Git and Docker

### Windows

In an administrator PowerShell:

```powershell
wsl --install --no-distribution
```

Restart, then in an administrator PowerShell:

```powershell
winget install --id Git.Git -e
winget install --id Docker.DockerDesktop -e
```

Close PowerShell, open a new one, start Docker Desktop from the Start menu and wait for "Docker Desktop is running". Details and troubleshooting are in step 1 and 2 of [Set up on Windows](setup-windows.md). Then keep line endings as they are in the repository:

```powershell
git config --global core.autocrlf input
```

### Linux (Ubuntu or Debian)

Install Git and Docker Engine with the Compose plugin by following steps 1 and 3 of [Set up on Linux](setup-linux.md) (you can skip Node, steps 2 and 4).

### Check

```sh
git --version
docker --version
docker compose version
docker run --rm hello-world
```

## 2. Get the code

The repository is private: sign in with a GitHub account that has been added to it (a browser window opens), or use a [personal access token](https://github.com/settings/tokens) as the password.

```sh
git clone https://github.com/Sabbir-Asif/HEAT-Learning-Platform.git
cd HEAT-Learning-Platform
```

## 3. Create the settings file

The file holds development values only. Nothing in it is a secret.

Linux, macOS:

```sh
cp infra/demo/.env.example infra/demo/.env
```

Windows PowerShell:

```powershell
Copy-Item infra\demo\.env.example infra\demo\.env
```

## 4. Build and start

```sh
docker compose -f infra/demo/docker-compose.demo.yml up -d --build
```

The first run takes 10 to 20 minutes: it downloads the base images, installs the dependencies and builds both sites. Later starts take seconds. The command returns when the containers are started; wait until all of them are healthy:

```sh
docker compose -f infra/demo/docker-compose.demo.yml ps
```

`api`, `frontend-public`, `frontend-internal`, `nginx`, `postgres`, `redis` and `mailpit` show `healthy`. `migrate` and `init-data` show `Exited (0)`, which is right: they run once.

## 5. Open the site

| What           | Address                  |
| -------------- | ------------------------ |
| Public site    | <http://learn.localhost> |
| Admin console  | <http://admin.localhost> |
| Mail (Mailpit) | <http://localhost:8035>  |

Use Chrome, Edge or Firefox. Sign in to the admin console as `admin@heat.localhost` with password `ChangeMe-Local-Admin-2026`; you are asked to change the password at the first sign-in. The database has sample faculties and departments so student sign-up has choices. Verification and certificate emails appear in Mailpit.

## Everyday commands

Run them from the project folder.

```sh
docker compose -f infra/demo/docker-compose.demo.yml logs -f api
docker compose -f infra/demo/docker-compose.demo.yml stop
docker compose -f infra/demo/docker-compose.demo.yml start
docker compose -f infra/demo/docker-compose.demo.yml down
docker compose -f infra/demo/docker-compose.demo.yml down --volumes
```

`stop` and `start` pause and resume. `down` removes the containers and keeps the data. `down --volumes` also deletes the database, the uploaded videos and the certificates, so the next `up` starts empty.

After you pull new code, run the `up -d --build` command of step 4 again.

## Troubleshooting

| Symptom                                                          | Cause and fix                                                                                                                                            |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `copy infra/demo/.env.example to infra/demo/.env`                | Step 3 was skipped.                                                                                                                                      |
| `address already in use` for port 80                             | Another program holds port 80. Set `HTTP_PORT=8080` in `infra/demo/.env`, add `:8080` to `PUBLIC_APP_URL`, `ADMIN_APP_URL` and `TRUSTED_ORIGINS` there, run step 4 again and open the addresses with `:8080`. |
| Build ends with `Killed` or exit code 137                        | Docker has too little memory. In Docker Desktop open Settings, Resources and give it at least 6 GB, then run step 4 again.                               |
| A service is `unhealthy` or keeps restarting                     | Read its log with `docker compose -f infra/demo/docker-compose.demo.yml logs <service>`.                                                                |
| Sign-in says "The server sent an unexpected reply"               | Open `learn.localhost` and `admin.localhost`, not `localhost` with a port.                                                                               |
| `learn.localhost` does not open                                  | Use Chrome, Edge or Firefox. Otherwise add `127.0.0.1 learn.localhost admin.localhost` to the hosts file.                                                |
