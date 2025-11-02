ARG PUPPETEER_VERSION="16.1.0"
FROM ghcr.io/puppeteer/puppeteer:${PUPPETEER_VERSION}

USER root 

RUN npm install -g pa11y

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome
USER pptruser
ENTRYPOINT [ "pa11y" ]
