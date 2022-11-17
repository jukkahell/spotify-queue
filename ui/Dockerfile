FROM node:18-alpine As development
WORKDIR /usr/src/app
COPY --chown=node:node package*.json ./
RUN npm ci
COPY --chown=node:node . .
RUN npm run build
USER node

FROM nginx:1.23.2-alpine as production
ENV NODE_ENV production
WORKDIR /usr/src/app
COPY --from=development /usr/src/app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]