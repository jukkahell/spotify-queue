# Run server locally

Install Postgres 11

```
cd server/
npm i

create database spotiqu;
create user spotiqu with encrypted password 'Password1';
grant all privileges on database spotiqu to spotiqu;

cp src/secrets.ts.template src/secrets.ts
```
Set valid values to secret.ts
At least db password and check that the port is correct in db/index.ts.

```
export DATABASE_URL=postgres://spotiqu:Password1@localhost:5432/spotiqu
npm run migrate up
npm start
```

# Run ui locally

```
npm i
npm start
```