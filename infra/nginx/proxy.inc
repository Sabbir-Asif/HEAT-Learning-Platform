proxy_http_version 1.1;
proxy_set_header Host $http_host;
proxy_set_header X-Real-IP $remote_addr;
# Overwrite, never append: a client-supplied X-Forwarded-For must not reach the API.
proxy_set_header X-Forwarded-For $remote_addr;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Forwarded-Host "";
proxy_set_header X-Forwarded-Prefix "";
proxy_set_header Forwarded "";
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection $connection_upgrade;
