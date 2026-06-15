FROM node:18

# Create app directory inside container
WORKDIR /app

# Copy package files first (for caching)
COPY package*.json ./

# Install dependencies
RUN npm install


# Copy all remaining files
COPY . .

RUN npx prisma generate

# Your backend port (change if needed)
EXPOSE 3000

# Start your server
CMD ["npm", "start"]