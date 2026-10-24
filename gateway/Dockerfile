FROM nginx:stable-alpine
RUN apk add --no-cache openssl
COPY gateway/nginx.conf /etc/nginx/templates/default.conf.template
COPY gateway/15-wcc-tls.sh /docker-entrypoint.d/15-wcc-tls.sh
COPY wcc/web/ /usr/share/nginx/html/
RUN chmod +x /docker-entrypoint.d/15-wcc-tls.sh
ENV NGINX_ENVSUBST_FILTER=HTTPS_PORT
EXPOSE 8080 8443
