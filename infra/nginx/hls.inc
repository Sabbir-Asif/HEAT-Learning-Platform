location /hls/ {
    if ($hls_authorized != "1") {
        return 403;
    }

    limit_except GET HEAD {
        deny all;
    }

    root /srv/media;
    autoindex off;
    sendfile on;
    tcp_nopush on;

    types {
        application/vnd.apple.mpegurl m3u8;
        video/mp2t ts;
        video/iso.segment m4s;
        video/mp4 mp4;
    }

    add_header Cache-Control $hls_cache_control always;
    add_header Vary Cookie always;
    add_header X-Content-Type-Options nosniff always;
}
