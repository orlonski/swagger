# Usar Node.js padrão
FROM node:18-slim

# Instalar dependências básicas
RUN apt-get update && apt-get install -y \
    libaio1 \
    && rm -rf /var/lib/apt/lists/*

# Definir diretório de trabalho
WORKDIR /app

# Copiar package files
COPY package.json package-lock.json ./

# Instalar dependências (sem Oracle por enquanto)
RUN npm install --production

# Copiar código
COPY . .

# Expor porta
EXPOSE 3000

# Iniciar com logs
CMD ["sh", "-c", "echo 'Container starting...' && echo 'Node version:' && node --version && echo 'Starting server...' && node server-test.js"]
