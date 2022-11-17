# Run server & ui locally

```
cd server
cp src/secrets.ts.template src/secrets.ts
cp .env.example .env
```
Set valid values to secret.ts
At least db password and spotify secret are mandatory. Also check that the port is correct in db/index.ts.
To acquire the spotify secret go to https://developer.spotify.com/ , create new app and use that app's secret.

```
docker-compose up --build
```

# Build and deploy

Open WSL2 (or wherever Docker is running)

Server:
cd server
docker build . -t eu.gcr.io/spotiqu/server:latest
docker push eu.gcr.io/spotiqu/server:latest

UI:
cd ui
docker build . -t eu.gcr.io/spotiqu/ui:latest
docker push eu.gcr.io/spotiqu/ui:latest

