# 1. Usar uma imagem base oficial do Node.js (não Alpine para Oracle)
FROM node:18-slim

# 2. Instalar dependências do sistema necessárias para Oracle
RUN apt-get update && apt-get install -y \
    libaio1 \
    wget \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# 3. Baixar e instalar Oracle Instant Client
RUN mkdir -p /opt/oracle \
    && cd /opt/oracle \
    && wget https://download.oracle.com/otn_software/linux/instantclient/1923000/instantclient-basic-linux.x64-19.23.0.0.0dbru.zip \
    && unzip instantclient-basic-linux.x64-19.23.0.0.0dbru.zip \
    && rm instantclient-basic-linux.x64-19.23.0.0.0dbru.zip \
    && cd instantclient_19_23 \
    && echo /opt/oracle/instantclient_19_23 > /etc/ld.so.conf.d/oracle-instantclient.conf \
    && ldconfig

# 4. Definir variáveis de ambiente para Oracle
ENV LD_LIBRARY_PATH=/opt/oracle/instantclient_19_23:$LD_LIBRARY_PATH
ENV PATH=/opt/oracle/instantclient_19_23:$PATH

# 5. Definir o diretório de trabalho dentro do container
WORKDIR /app

# 6. Copiar os ficheiros de dependências
# Copiamos estes primeiro para aproveitar o cache do Docker
COPY package.json package-lock.json ./

# 7. Instalar as dependências do projeto
RUN npm install

# 8. Copiar o resto do código da aplicação
COPY . .

# 9. Expor a porta em que a aplicação corre
EXPOSE 3000

# 10. O comando para iniciar o servidor quando o container arrancar
CMD [ "node", "server.js" ]
