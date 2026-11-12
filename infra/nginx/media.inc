location ^~ /media/public/ {
    limit_except GET HEAD {
        deny all;
    }

    alias /srv/mediastore/public/;
    autoindex off;
    sendfile on;
    tcp_nopush on;

    types {
        image/webp webp;
        image/avif avif;
        application/pdf pdf;
        application/vnd.openxmlformats-officedocument.wordprocessingml.document docx;
        application/vnd.openxmlformats-officedocument.presentationml.presentation pptx;
        text/vtt vtt;
    }

    default_type application/octet-stream;

    add_header Content-Disposition $media_disposition always;
    add_header Cache-Control "public, max-age=31536000, immutable" always;
    add_header X-Content-Type-Options nosniff always;
}

location ^~ /media/protected/ {
    if ($media_authorized != "1") {
        return 403;
    }

    limit_except GET HEAD {
        deny all;
    }

    alias /srv/mediastore/protected/;
    autoindex off;
    sendfile on;
    tcp_nopush on;

    types {
        image/webp webp;
        image/avif avif;
        application/pdf pdf;
        application/vnd.openxmlformats-officedocument.wordprocessingml.document docx;
        application/vnd.openxmlformats-officedocument.presentationml.presentation pptx;
        text/vtt vtt;
    }

    default_type application/octet-stream;

    add_header Cache-Control "private, max-age=3600" always;
    add_header X-Content-Type-Options nosniff always;
}

location ^~ /internal/media/private/ {
    internal;

    alias /srv/mediastore/private/;
    autoindex off;
    sendfile on;

    add_header Cache-Control "private, no-store" always;
    add_header X-Content-Type-Options nosniff always;
}
