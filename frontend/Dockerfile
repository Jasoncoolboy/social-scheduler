FROM node:20-alpine

WORKDIR /app

# Install build tools needed for native modules
RUN apk add --no-cache python3 make g++

# Copy package files ONLY first
COPY package.json ./

# Remove any existing lock file to avoid platform conflicts
# Fresh install resolves correct platform binaries
RUN npm install --legacy-peer-deps

# Copy rest of source code
COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]