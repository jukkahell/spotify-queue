FROM node:18-alpine As development
WORKDIR /usr/src/app
COPY --chown=node:node package*.json ./
RUN npm ci
COPY --chown=node:node . .
RUN npm run build
USER node

###################
# BUILD FOR PRODUCTION
###################
FROM node:18-alpine As build
WORKDIR /usr/src/app
COPY --chown=node:node package*.json ./
COPY --chown=node:node --from=development /usr/src/app/node_modules ./node_modules
COPY --chown=node:node . .
RUN npm run build
ENV NODE_ENV production
RUN npm ci --only=production && npm cache clean --force
USER node

###################
# PRODUCTION
###################
FROM node:18-alpine As production
WORKDIR /usr/src/app
COPY --chown=node:node --from=build /usr/src/app/node_modules ./node_modules
COPY --chown=node:node --from=build /usr/src/app/package.json ./
COPY --chown=node:node --from=build /usr/src/app/dist ./src
COPY --chown=node:node --from=build /usr/src/app/migrations ./migrations
EXPOSE 8001
CMD [ "/bin/sh", "-c", "npm run migrate up && node src/app.js" ]