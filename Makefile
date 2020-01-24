DOCKER_TAG = pr-labeled:local

build:
	docker build -t $(DOCKER_TAG) .

run: build
	docker run -t $(DOCKER_TAG)
