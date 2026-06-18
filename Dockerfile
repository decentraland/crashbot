ARG RUN

FROM node:24-alpine@sha256:5fa278c599dbba0c8f873d8717d50ecbb57c5ae6a53b7ab240c25135e0b65995 as builderenv

WORKDIR /app

RUN apk add --no-cache git

# install dependencies
COPY package.json /app/package.json
COPY yarn.lock /app/yarn.lock
RUN yarn install --frozen-lockfile

# build the app
COPY . /app
RUN yarn build
RUN yarn test

# remove devDependencies, keep only used dependencies
RUN yarn install --prod --frozen-lockfile

########################### END OF BUILD STAGE ###########################

FROM node:24-alpine@sha256:5fa278c599dbba0c8f873d8717d50ecbb57c5ae6a53b7ab240c25135e0b65995

# NODE_ENV is used to configure some runtime options, like JSON logger
ENV NODE_ENV production

RUN apk update && apk upgrade
RUN apk add --no-cache tini

WORKDIR /app
COPY --from=builderenv /app /app

# Please _DO NOT_ use a custom ENTRYPOINT because it may prevent signals
# (i.e. SIGTERM) to reach the service
# Read more here: https://aws.amazon.com/blogs/containers/graceful-shutdowns-with-ecs/
#            and: https://www.ctl.io/developers/blog/post/gracefully-stopping-docker-containers/
ENTRYPOINT ["/sbin/tini", "--"]
# Run the program under Tini
CMD [ "/usr/local/bin/node", "--trace-warnings", "--abort-on-uncaught-exception", "--unhandled-rejections=strict", "dist/index.js" ]
