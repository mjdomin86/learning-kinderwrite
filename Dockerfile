FROM node:24-alpine
WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --omit=dev

# Copy app source
COPY . .

# Set environment
ENV NODE_ENV=production
ENV DB_PATH=/data/kidwrite.db
ENV PORT=80

# Expose port and start
EXPOSE 80
CMD ["node", "server.js"]
