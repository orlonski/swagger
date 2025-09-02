# 1. Usar uma imagem base oficial do Node.js
# Usamos a versão 'alpine' por ser mais leve e segura
FROM node:18-alpine

# 2. Definir o diretório de trabalho dentro do container
WORKDIR /app

# 3. Copiar os ficheiros de dependências
# Copiamos estes primeiro para aproveitar o cache do Docker
COPY package.json package-lock.json ./

# 4. Instalar as dependências do projeto
RUN npm install

# 5. Copiar o resto do código da aplicação
COPY . .

# 6. Expor a porta em que a aplicação corre
EXPOSE 3000

# 7. O comando para iniciar o servidor quando o container arrancar
CMD [ "node", "server.js" ]
