# Use Node.js 18 LTS
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (skip postinstall since source files aren't copied yet)
RUN npm ci --ignore-scripts

# Copy all files (including tsconfig.json and source files)
COPY . .

# Build TypeScript
RUN npm run build

# Expose port (JustRunMy.App will set PORT env var)
EXPOSE 3001

# Start the application
CMD ["npm", "start"]

