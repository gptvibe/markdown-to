# Docker Quick Run

Build image:

docker build -t markdown-to:local .

Run on a non-standard host port:

docker run -d --name markdown-to-local -p 43817:80 markdown-to:local

Open app:

http://localhost:43817

Stop and remove:

docker rm -f markdown-to-local
