FROM node:9

ARG NLP_DIRECTORY
ENV NLP_DIRECTORY=$NLP_DIRECTORY
RUN echo "Dictionary: ${NLP_DIRECTORY}"
RUN test -n "$NLP_DIRECTORY" || (echo "NLP_DIRECTORY  not set" && false)

# Create app directory
RUN mkdir -p /usr/src/bot
WORKDIR /usr/src/bot

# Install app dependencies
COPY package.json /usr/src/bot/
RUN npm install

# Bundle app source
COPY . /usr/src/bot/

EXPOSE 7001
CMD node nlp/nlpsvc.js -c ${NLP_DIRECTORY}

# Replace NLP directory (demo) with actual one
# Build image: docker image build . -f nlp/Dockerfile --build-arg NLP_DIRECTORY=demo -t orenariel/concierge:nlpsvc-demo
# Run image (reference mongodb image): docker run -it -p 2197:2197 --name nlpsvc orenariel/concierge:nlpsvc-demo
# Push: docker push orenariel/concierge:nlpsvc-demo