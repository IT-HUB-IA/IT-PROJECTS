# Trabalhador do Mapa do Sistema (CicloDev). Imagem oficial do Playwright: Node + Chromium + as bibliotecas do sistema.
FROM mcr.microsoft.com/playwright:v1.56.1-noble
# curl: baixar as bibliotecas de CDN que as páginas pedem; o código analisado roda como "caixa", sem privilégio e sem o segredo
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates && rm -rf /var/lib/apt/lists/* \
 && (id caixa >/dev/null 2>&1 || useradd -m -u 1500 -s /usr/sbin/nologin caixa)
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force
COPY trabalhador.mjs ./
COPY lib ./lib
ENV NODE_ENV=production MAPA_TEMPO_PAPEL=480 MAPA_MAX_TELAS=80
# o processo principal fica como root só para poder rodar o código analisado como "caixa" (outro usuário, sem o segredo)
CMD ["node", "trabalhador.mjs"]
