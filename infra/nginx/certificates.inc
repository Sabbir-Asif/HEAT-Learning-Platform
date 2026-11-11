location /internal/certificates/ {
    internal;

    limit_except GET HEAD {
        deny all;
    }

    alias /srv/certificates/;
    autoindex off;
    sendfile on;

    types {
        application/pdf pdf;
    }

    add_header Cache-Control "private, no-store" always;
    add_header X-Content-Type-Options nosniff always;
}
